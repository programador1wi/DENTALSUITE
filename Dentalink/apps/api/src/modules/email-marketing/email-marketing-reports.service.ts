import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, BudgetStatus, PatientStatus, Prisma } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { assertBranchAccess, branchScope } from "../../common/utils/branch-scope.util";
import { resolvePagination } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import { PreviewMarketingReportDto } from "./dto/email-marketing.dto";
import { marketingReportDefinition, marketingReportDefinitions } from "./email-marketing.catalog";
import { MarketingRecipientEligibilityService } from "./marketing-recipient-eligibility.service";

const excludedAppointmentStatuses: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_CONFLICT,
  AppointmentStatus.CANCELLED_RESCHEDULED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.BLOCKED
];

const attendedAppointmentStatuses: AppointmentStatus[] = [
  AppointmentStatus.ARRIVED,
  AppointmentStatus.WAITING_ROOM,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED
];

const patientSelect = Prisma.validator<Prisma.PatientSelect>()({
  id: true,
  branchId: true,
  firstName: true,
  lastName: true,
  documentNumber: true,
  email: true,
  phone: true,
  birthDate: true,
  status: true,
  marketingConsent: true,
  marketingUnsubscribedAt: true,
  deletedAt: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
  agreement: { select: { id: true, name: true } },
  appointments: {
    where: { status: { notIn: excludedAppointmentStatuses } },
    orderBy: { startAt: "desc" },
    take: 1,
    select: {
      startAt: true,
      status: true,
      professional: { select: { id: true, firstName: true, lastName: true } }
    }
  },
  budgets: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      status: true,
      total: true,
      professional: { select: { id: true, firstName: true, lastName: true } }
    }
  },
  collectionCases: {
    where: { amountDue: { gt: 0 } },
    select: { amountDue: true }
  }
});

type ReportPatient = Prisma.PatientGetPayload<{ select: typeof patientSelect }>;

type TreatmentReportContext = {
  professional: { id: string; firstName: string; lastName: string };
  lastAttentionByPatient: Map<string, Date>;
};

@Injectable()
export class EmailMarketingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: MarketingRecipientEligibilityService
  ) {}

  catalog() {
    return marketingReportDefinitions;
  }

  eligibilityPolicy(code?: string) {
    return marketingReportDefinition(code ?? "")?.eligibilityPolicy ?? "MARKETING_DEFAULT";
  }

  async preview(actor: AuthUser, code: string, dto: PreviewMarketingReportDto) {
    const definition = marketingReportDefinition(code);
    if (!definition) throw new NotFoundException("Reporte de marketing no encontrado");
    this.assertRequiredParameters(
      definition.requiredParameters.map((item) => item.key),
      dto.parameters
    );
    const { page, pageSize } = resolvePagination(dto);
    const branchId = this.stringParameter(dto.parameters, "branchId");
    if (code !== "PATIENTS_TREATED_BY_PROFESSIONAL") assertBranchAccess(actor, branchId);
    const where = this.buildWhere(actor, code, dto.parameters, dto.search);

    let total: number;
    let patients: ReportPatient[];
    if (code === "BIRTHDAYS_THIS_MONTH" || code === "BIRTHDAYS_TODAY") {
      const all = await this.prisma.patient.findMany({
        where,
        select: patientSelect,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      });
      const now = new Date();
      const filtered = all.filter((patient) => {
        if (!patient.birthDate) return false;
        if (patient.birthDate.getUTCMonth() !== now.getUTCMonth()) return false;
        return code !== "BIRTHDAYS_TODAY" || patient.birthDate.getUTCDate() === now.getUTCDate();
      });
      total = filtered.length;
      patients = filtered.slice((page - 1) * pageSize, page * pageSize);
    } else {
      [total, patients] = await Promise.all([
        this.prisma.patient.count({ where }),
        this.prisma.patient.findMany({
          where,
          select: patientSelect,
          orderBy: this.resolveOrder(dto.sortBy, dto.sortOrder),
          skip: (page - 1) * pageSize,
          take: pageSize
        })
      ]);
    }

    const treatmentContext =
      code === "PATIENTS_TREATED_BY_PROFESSIONAL"
        ? await this.resolveTreatmentReportContext(actor, dto.parameters, patients)
        : undefined;
    const eligibility = await this.eligibility.evaluateMany(
      actor,
      patients,
      undefined,
      definition.eligibilityPolicy
    );
    const eligibilityByPatient = new Map(eligibility.map((item) => [item.patientId, item]));
    const items = patients.map((patient) =>
      this.serializePatient(
        patient,
        code,
        definition.description,
        eligibilityByPatient.get(patient.id),
        treatmentContext
      )
    );
    const eligible = items.filter((item) => item.eligible).length;

    return {
      report: definition,
      parameters: dto.parameters,
      items,
      pagination: { page, pageSize, total, hasMore: page * pageSize < total },
      summary: { results: total, visible: items.length, eligible, ineligible: items.length - eligible }
    };
  }

  async selectedPatients(
    actor: AuthUser,
    patientIds: string[],
    options: {
      excludeCampaignId?: string;
      reportCode?: string;
      parameters?: Record<string, unknown>;
    } = {}
  ) {
    const uniqueIds = [...new Set(patientIds)];
    if (!uniqueIds.length) return { patients: [], eligibility: [] };
    const registeredEmailOnly = options.reportCode === "PATIENTS_TREATED_BY_PROFESSIONAL";
    const professionalId = registeredEmailOnly
      ? this.requiredString(options.parameters ?? {}, "professionalId")
      : undefined;
    const patients = await this.prisma.patient.findMany({
      where: {
        id: { in: uniqueIds },
        organizationId: actor.organizationId,
        deletedAt: null,
        ...(registeredEmailOnly
          ? {
              email: { not: null },
              NOT: { email: "" },
              OR: [
                {
                  clinicalEvolutions: {
                    some: { professionalId, annulledAt: null }
                  }
                },
                {
                  appointments: {
                    some: { professionalId, status: { in: attendedAppointmentStatuses } }
                  }
                }
              ]
            }
          : { branchId: branchScope(actor) })
      },
      select: patientSelect
    });
    const eligibility = await this.eligibility.evaluateMany(
      actor,
      patients,
      options.excludeCampaignId,
      this.eligibilityPolicy(options.reportCode)
    );
    return { patients, eligibility };
  }

  async exportRows(actor: AuthUser, code: string, dto: PreviewMarketingReportDto) {
    const pageSize = 100;
    const maximumRows = 5000;
    const firstPage = await this.preview(actor, code, { ...dto, page: 1, pageSize });
    if (firstPage.pagination.total > maximumRows) {
      throw new BadRequestException(
        `El reporte contiene ${firstPage.pagination.total} filas. Ajusta los filtros para exportar un máximo de ${maximumRows}`
      );
    }

    const pageCount = Math.ceil(firstPage.pagination.total / pageSize);
    const rows = [...firstPage.items];
    const concurrency = 5;
    for (let startPage = 2; startPage <= pageCount; startPage += concurrency) {
      const pages = Array.from(
        { length: Math.min(concurrency, pageCount - startPage + 1) },
        (_, index) => startPage + index
      );
      const responses = await Promise.all(
        pages.map((page) => this.preview(actor, code, { ...dto, page, pageSize }))
      );
      rows.push(...responses.flatMap((response) => response.items));
    }

    return [...new Map(rows.map((row) => [row.patientId, row])).values()];
  }

  private buildWhere(actor: AuthUser, code: string, parameters: Record<string, unknown>, search?: string) {
    const branchId = this.stringParameter(parameters, "branchId");
    const professionalId = this.stringParameter(parameters, "professionalId");
    const base: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(code === "PATIENTS_TREATED_BY_PROFESSIONAL"
        ? { email: { not: null }, NOT: { email: "" } }
        : { branchId: branchScope(actor, branchId) }),
      ...(search?.trim()
        ? {
            OR: [
              { firstName: { contains: search.trim(), mode: "insensitive" as const } },
              { lastName: { contains: search.trim(), mode: "insensitive" as const } },
              { documentNumber: { contains: search.trim(), mode: "insensitive" as const } },
              { email: { contains: search.trim(), mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const validAppointments: Prisma.AppointmentWhereInput = {
      status: { notIn: excludedAppointmentStatuses },
      ...(professionalId ? { professionalId } : {})
    };

    if (code === "PATIENTS_TREATED_BY_PROFESSIONAL") {
      const selectedProfessionalId = this.requiredString(parameters, "professionalId");
      return {
        ...base,
        OR: [
          {
            clinicalEvolutions: {
              some: { professionalId: selectedProfessionalId, annulledAt: null }
            }
          },
          {
            appointments: {
              some: {
                professionalId: selectedProfessionalId,
                status: { in: attendedAppointmentStatuses }
              }
            }
          }
        ]
      };
    }
    if (code === "PATIENTS_INACTIVE_MONTHS" || code === "PATIENTS_LAST_APPOINTMENT_MONTHS") {
      const cutoff = this.cutoff(parameters);
      const includeCancelled = parameters.includeCancelled === true;
      return {
        ...base,
        appointments: {
          none: {
            startAt: { gte: cutoff },
            ...(includeCancelled ? {} : validAppointments)
          }
        }
      };
    }
    if (code === "PATIENTS_NEW_SINCE")
      return { ...base, createdAt: { gte: this.requiredDate(parameters, "dateFrom") } };
    if (code === "BUDGETS_NOT_STARTED_MONTH") {
      const { start, end } = this.monthRange(this.requiredString(parameters, "month"));
      return {
        ...base,
        budgets: {
          some: {
            createdAt: { gte: start, lt: end },
            status: { in: [BudgetStatus.DRAFT, BudgetStatus.SENT] },
            ...(professionalId ? { professionalId } : {})
          }
        }
      };
    }
    if (code === "PATIENTS_BY_AGREEMENT")
      return { ...base, agreementId: this.requiredString(parameters, "agreementId") };
    if (code === "BUDGETS_UNFINISHED_BETWEEN") {
      const start = this.requiredDate(parameters, "dateFrom");
      const end = this.endOfDay(this.requiredDate(parameters, "dateTo"));
      return {
        ...base,
        budgets: {
          some: {
            createdAt: { gte: start, lte: end },
            status: { in: [BudgetStatus.DRAFT, BudgetStatus.SENT, BudgetStatus.ACCEPTED] },
            ...(professionalId ? { professionalId } : {})
          }
        }
      };
    }
    if (code === "BIRTHDAYS_THIS_MONTH" || code === "BIRTHDAYS_TODAY")
      return { ...base, birthDate: { not: null } };
    if (code === "DEBTOR_PATIENTS")
      return {
        ...base,
        OR: [{ status: PatientStatus.DEBTOR }, { collectionCases: { some: { amountDue: { gt: 0 } } } }]
      };
    if (code === "PATIENTS_DEBT_UNTIL_DATE")
      return {
        ...base,
        collectionCases: {
          some: {
            amountDue: { gt: 0 },
            createdAt: { lte: this.endOfDay(this.requiredDate(parameters, "cutoffDate")) }
          }
        }
      };
    if (code === "PATIENTS_ATTENDED_TODAY") {
      const start = this.startOfDay(new Date());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { ...base, appointments: { some: { ...validAppointments, startAt: { gte: start, lt: end } } } };
    }
    if (code === "PATIENTS_BY_TYPE") {
      const status = this.requiredString(parameters, "patientStatus");
      if (!Object.values(PatientStatus).includes(status as PatientStatus))
        throw new BadRequestException("Tipo de paciente inválido");
      return { ...base, status: status as PatientStatus };
    }
    return base;
  }

  private serializePatient(
    patient: ReportPatient,
    code: string,
    inclusionReason: string,
    eligibility?: Awaited<ReturnType<MarketingRecipientEligibilityService["evaluateMany"]>>[number],
    treatmentContext?: TreatmentReportContext
  ) {
    const lastAppointment = patient.appointments[0];
    const budget = patient.budgets[0];
    const professional =
      code === "PATIENTS_TREATED_BY_PROFESSIONAL"
        ? treatmentContext?.professional
        : code.startsWith("BUDGET")
          ? budget?.professional
          : lastAppointment?.professional;
    const debt = patient.collectionCases.reduce((sum, item) => sum + Number(item.amountDue), 0);
    return {
      patientId: patient.id,
      publicId: patient.id,
      documentNumber: patient.documentNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
      fullName: `${patient.firstName} ${patient.lastName}`.trim(),
      phone: patient.phone,
      email: patient.email,
      branchId: patient.branchId,
      branch: patient.branch.name,
      professional: professional ? `${professional.firstName} ${professional.lastName}`.trim() : null,
      professionalId: professional?.id ?? null,
      lastAppointment: lastAppointment?.startAt ?? null,
      lastAttentionAt: treatmentContext?.lastAttentionByPatient.get(patient.id) ?? null,
      debt,
      agreement: patient.agreement?.name ?? null,
      birthDate: patient.birthDate,
      patientStatus: patient.status,
      budgetStatus: budget?.status ?? null,
      budgetTotal: budget ? Number(budget.total) : null,
      createdAt: patient.createdAt,
      inclusionReason,
      eligible: eligibility?.eligible ?? false,
      eligibilityReasons: eligibility?.reasons ?? [
        { code: "MISSING_EMAIL", label: "No se pudo evaluar al paciente" }
      ]
    };
  }

  private async resolveTreatmentReportContext(
    actor: AuthUser,
    parameters: Record<string, unknown>,
    patients: ReportPatient[]
  ): Promise<TreatmentReportContext> {
    const professionalId = this.requiredString(parameters, "professionalId");
    const professional = await this.prisma.professional.findFirst({
      where: {
        id: professionalId,
        organizationId: actor.organizationId,
        isActive: true
      },
      select: { id: true, firstName: true, lastName: true }
    });
    if (!professional) {
      throw new BadRequestException("El profesional seleccionado no está activo en la organización");
    }

    const patientIds = patients.map((patient) => patient.id);
    const lastAttentionByPatient = new Map<string, Date>();
    if (!patientIds.length) return { professional, lastAttentionByPatient };

    const [evolutions, appointments] = await Promise.all([
      this.prisma.clinicalEvolution.groupBy({
        by: ["patientId"],
        where: {
          patientId: { in: patientIds },
          professionalId,
          annulledAt: null
        },
        _max: { createdAt: true }
      }),
      this.prisma.appointment.groupBy({
        by: ["patientId"],
        where: {
          patientId: { in: patientIds },
          professionalId,
          status: { in: attendedAppointmentStatuses }
        },
        _max: { startAt: true }
      })
    ]);

    for (const item of evolutions) {
      if (item._max.createdAt) lastAttentionByPatient.set(item.patientId, item._max.createdAt);
    }
    for (const item of appointments) {
      if (!item.patientId || !item._max.startAt) continue;
      const current = lastAttentionByPatient.get(item.patientId);
      if (!current || item._max.startAt > current)
        lastAttentionByPatient.set(item.patientId, item._max.startAt);
    }

    return { professional, lastAttentionByPatient };
  }

  private resolveOrder(
    sortBy?: string,
    sortOrder: "asc" | "desc" = "asc"
  ): Prisma.PatientOrderByWithRelationInput[] {
    if (sortBy === "createdAt") return [{ createdAt: sortOrder }];
    if (sortBy === "firstName") return [{ firstName: sortOrder }, { lastName: sortOrder }];
    return [{ lastName: sortOrder }, { firstName: sortOrder }];
  }

  private assertRequiredParameters(keys: string[], parameters: Record<string, unknown>) {
    const missing = keys.filter(
      (key) => parameters[key] === undefined || parameters[key] === null || parameters[key] === ""
    );
    if (missing.length) throw new BadRequestException(`Faltan parámetros requeridos: ${missing.join(", ")}`);
  }

  private requiredString(parameters: Record<string, unknown>, key: string) {
    const value = this.stringParameter(parameters, key);
    if (!value) throw new BadRequestException(`El parámetro ${key} es requerido`);
    return value;
  }

  private stringParameter(parameters: Record<string, unknown>, key: string) {
    const value = parameters[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private requiredDate(parameters: Record<string, unknown>, key: string) {
    const raw = this.requiredString(parameters, key);
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) throw new BadRequestException(`La fecha ${key} no es válida`);
    return value;
  }

  private cutoff(parameters: Record<string, unknown>) {
    const months = Number(parameters.months);
    if (!Number.isInteger(months) || months < 1 || months > 120)
      throw new BadRequestException("La cantidad de meses debe estar entre 1 y 120");
    const base = this.stringParameter(parameters, "cutoffDate")
      ? this.requiredDate(parameters, "cutoffDate")
      : new Date();
    const result = new Date(base);
    result.setUTCMonth(result.getUTCMonth() - months);
    return result;
  }

  private monthRange(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) throw new BadRequestException("El mes debe usar el formato AAAA-MM");
    const start = new Date(`${value}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
  }

  private startOfDay(value: Date) {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private endOfDay(value: Date) {
    const result = new Date(value);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}
