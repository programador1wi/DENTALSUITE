import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { AuthM2MClient } from "../../common/types/m2m-client.type";
import { DomainActorContext } from "../../common/types/domain-actor-context";
import { PrismaService } from "../../database/prisma.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { PatientFieldConfigService } from "../patient-field-config/patient-field-config.service";
import { PatientsService, type PreparedPatientCreate } from "../patients/patients.service";
import { PricingService } from "../pricing/pricing.service";
import {
  CreateDeveloperAppointmentDto,
  CreateDeveloperPatientDto,
  ListDeveloperAppointmentsQueryDto,
  ListDeveloperBudgetsQueryDto,
  ListDeveloperPatientsQueryDto,
  ListDeveloperProceduresQueryDto
} from "./dto/developer-api.dto";

const MAX_AGENDA_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const IDEMPOTENCY_LOCK_MS = 30_000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DeveloperApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: PatientsService,
    private readonly appointments: AppointmentsService,
    private readonly patientFieldConfig: PatientFieldConfigService,
    private readonly pricing: PricingService
  ) {}

  async listPatients(client: AuthM2MClient, query: ListDeveloperPatientsQueryDto) {
    const { page, limit, skip } = this.page(query.page, query.limit);
    const branchWhere = this.branchWhere(client, query.branchId);
    const term = query.search?.trim();
    const where: Prisma.PatientWhereInput = {
      organizationId: client.organizationId,
      deletedAt: null,
      ...branchWhere,
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { phone: { contains: term } },
              { documentNumber: { contains: term } }
            ]
          }
        : {})
    };
    const [total, items] = await Promise.all([
      this.prisma.patient.count({ where }),
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: this.patientSelect()
      })
    ]);
    return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getPatient(client: AuthM2MClient, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, organizationId: client.organizationId, deletedAt: null, ...this.branchWhere(client) },
      select: { ...this.patientSelect(), updatedAt: true }
    });
    if (!patient) throw new NotFoundException("Paciente no encontrado");
    return patient;
  }

  async createPatient(client: AuthM2MClient, dto: CreateDeveloperPatientDto, idempotencyKey?: string) {
    this.assertBranch(client, dto.branchId);
    const actor = await this.domainActor(client);
    let prepared: PreparedPatientCreate | undefined;
    const outcome = await this.idempotent(client, "patients.create", idempotencyKey, dto, async (tx) => {
      await this.patientFieldConfig.assertRequiredFields(client.organizationId, "newPatient", {
        legalName: dto.firstName,
        lastName: dto.lastName,
        curp: dto.documentNumber,
        email: dto.email,
        phone: dto.phone,
        birthDate: dto.birthDate,
        gender: dto.gender,
        documentNumber: dto.documentNumber,
        branchId: dto.branchId
      });
      const createDto = {
        branchId: dto.branchId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        birthDate: dto.birthDate,
        gender: dto.gender,
        documentNumber: dto.documentNumber,
        source: "DEVELOPER_API"
      };
      prepared = await this.patients.preparePatientForCreate(actor, createDto);
      const created = await this.patients.createPreparedPatientInTransaction(tx, actor, createDto, prepared);
      return tx.patient.findUniqueOrThrow({
        where: { id: created.id },
        select: this.patientSelect()
      });
    });
    if (outcome.executed && prepared) {
      await this.patients.finalizePatientCreation(actor, outcome.value.id, prepared);
    }
    return outcome.value;
  }

  async listAppointments(client: AuthM2MClient, query: ListDeveloperAppointmentsQueryDto) {
    const { page, limit, skip } = this.page(query.page, query.limit);
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
      throw new BadRequestException("Rango de fechas invalido");
    }
    if (endDate.getTime() - startDate.getTime() > MAX_AGENDA_RANGE_MS) {
      throw new BadRequestException({ code: "DATE_RANGE_TOO_LARGE", message: "El rango maximo de agenda es 31 dias." });
    }
    const where: Prisma.AppointmentWhereInput = {
      organizationId: client.organizationId,
      startAt: { lt: endDate },
      endAt: { gt: startDate },
      ...this.branchWhere(client, query.branchId),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.status ? { status: query.status } : {})
    };
    const [total, items] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          branchId: true,
          patientId: true,
          professionalId: true,
          chairId: true,
          startAt: true,
          endAt: true,
          status: true,
          reason: true,
          patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
          professional: { select: { id: true, firstName: true, lastName: true } },
          branch: { select: { id: true, name: true } }
        }
      })
    ]);
    return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async createAppointment(client: AuthM2MClient, dto: CreateDeveloperAppointmentDto, idempotencyKey?: string) {
    this.assertBranch(client, dto.branchId);
    const actor = await this.domainActor(client);
    let createdId: string | undefined;
    const outcome = await this.idempotent(client, "appointments.create", idempotencyKey, dto, async (tx) => {
      const createDto = {
        branchId: dto.branchId,
        patientId: dto.patientId,
        professionalId: dto.professionalId,
        chairId: dto.chairId,
        title: dto.reason?.trim() || "Cita desde integracion",
        reason: dto.reason,
        notes: dto.notes,
        startAt: dto.startAt,
        endAt: dto.endAt
      };
      const prepared = await this.appointments.prepareAppointmentForTransactionalCreate(actor, createDto);
      const created = await this.appointments.createPreparedAppointmentInTransaction(tx, actor, prepared);
      createdId = created.id;
      return tx.appointment.findUniqueOrThrow({
        where: { id: created.id },
        select: this.appointmentSelect()
      });
    });
    if (outcome.executed && createdId) {
      await this.appointments.dispatchEmailNotification(createdId, "SCHEDULED");
    }
    return outcome.value;
  }

  async listBudgets(client: AuthM2MClient, query: ListDeveloperBudgetsQueryDto) {
    const { page, limit, skip } = this.page(query.page, query.limit);
    if (query.branchId) this.assertBranch(client, query.branchId);
    const planBranch = this.branchWhere(client, query.branchId);
    const where: Prisma.BudgetWhereInput = {
      organizationId: client.organizationId,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      treatmentPlan: planBranch.branchId ? { branchId: planBranch.branchId } : undefined
    };
    const [total, items] = await Promise.all([
      this.prisma.budget.count({ where }),
      this.prisma.budget.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          patientId: true,
          treatmentPlanId: true,
          status: true,
          subtotal: true,
          discountTotal: true,
          total: true,
          expiresAt: true,
          createdAt: true,
          treatmentPlan: { select: { branchId: true } },
          patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } }
        }
      })
    ]);
    return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async listProcedures(client: AuthM2MClient, query: ListDeveloperProceduresQueryDto) {
    if (!query.branchId) throw new BadRequestException({ code: "BRANCH_REQUIRED", message: "branchId es obligatorio para resolver precios." });
    this.assertBranch(client, query.branchId);
    const actor = await this.domainActor(client);
    const catalog = await this.pricing.catalog(actor, { branchId: query.branchId });
    const term = query.search?.trim().toLocaleLowerCase("es-MX");
    const allItems = catalog.categories.flatMap((category) => category.items);
    const filtered = term
      ? allItems.filter((item) => item.procedure.name.toLocaleLowerCase("es-MX").includes(term) || item.procedure.code?.toLocaleLowerCase("es-MX").includes(term))
      : allItems;
    const { page, limit, skip } = this.page(query.page, query.limit);
    return {
      data: filtered.slice(skip, skip + limit),
      meta: { total: filtered.length, page, limit, totalPages: Math.ceil(filtered.length / limit) },
      context: catalog.context
    };
  }

  private async domainActor(client: AuthM2MClient): Promise<DomainActorContext> {
    const branchIds = client.branchScope === "SELECTED"
      ? client.branchIds
      : (await this.prisma.branch.findMany({
          where: { organizationId: client.organizationId, isActive: true },
          select: { id: true }
        })).map((branch) => branch.id);
    return {
      id: client.apiKeyId,
      organizationId: client.organizationId,
      email: "developer-api@dentalink.internal",
      firstName: "Integracion",
      lastName: client.name,
      roleIds: [],
      roleNames: ["Developer API"],
      permissions: [],
      branchIds,
      domainActor: { type: "API_KEY", apiKeyId: client.apiKeyId }
    };
  }

  private assertBranch(client: AuthM2MClient, branchId: string) {
    if (client.branchScope === "SELECTED" && !client.branchIds.includes(branchId)) {
      throw new ForbiddenException({ code: "BRANCH_NOT_ALLOWED", message: "La credencial no autoriza esta sucursal." });
    }
  }

  private branchWhere(client: AuthM2MClient, requested?: string): { branchId?: string | { in: string[] } } {
    if (requested) {
      this.assertBranch(client, requested);
      return { branchId: requested };
    }
    return client.branchScope === "SELECTED" ? { branchId: { in: client.branchIds } } : {};
  }

  private page(pageValue?: number, limitValue?: number) {
    const page = Math.max(pageValue ?? 1, 1);
    const limit = Math.min(Math.max(limitValue ?? 20, 1), 100);
    return { page, limit, skip: (page - 1) * limit };
  }

  private patientSelect() {
    return {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      gender: true,
      documentNumber: true,
      branchId: true,
      createdAt: true
    } satisfies Prisma.PatientSelect;
  }

  private appointmentSelect() {
    return {
      id: true,
      branchId: true,
      patientId: true,
      professionalId: true,
      chairId: true,
      startAt: true,
      endAt: true,
      status: true,
      reason: true,
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      professional: { select: { id: true, firstName: true, lastName: true } },
      branch: { select: { id: true, name: true } }
    } satisfies Prisma.AppointmentSelect;
  }

  private async idempotent<T>(
    client: AuthM2MClient,
    operation: string,
    key: string | undefined,
    payload: unknown,
    execute: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<{ value: T; executed: boolean }> {
    const idempotencyKey = key?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new BadRequestException({ code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key es obligatorio y debe tener entre 8 y 200 caracteres." });
    }
    const payloadHash = createHash("sha256").update(this.stableJson(payload)).digest("hex");
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + IDEMPOTENCY_LOCK_MS);
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
    const uniqueWhere = {
      apiKeyId_operation_idempotencyKey: {
        apiKeyId: client.apiKeyId,
        operation,
        idempotencyKey
      }
    } as const;
    const existing = await this.prisma.apiIdempotencyRecord.findUnique({ where: uniqueWhere });
    if (existing) return { value: await this.resolveIdempotencyRecord<T>(existing, payloadHash, now), executed: false };

    try {
      const value = await this.prisma.$transaction(async (tx) => {
        const record = await tx.apiIdempotencyRecord.create({
          data: {
            organizationId: client.organizationId,
            apiKeyId: client.apiKeyId,
            operation,
            idempotencyKey,
            payloadHash,
            lockedUntil,
            expiresAt
          }
        });
        const result = await execute(tx);
        const responseBody = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
        await tx.apiIdempotencyRecord.update({
          where: { id: record.id },
          data: { status: "COMPLETED", responseStatus: 201, responseBody, lockedUntil: new Date() }
        });
        return result;
      }, { timeout: 30_000 });
      return { value, executed: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await this.prisma.apiIdempotencyRecord.findUniqueOrThrow({
        where: uniqueWhere
      });
      return { value: await this.resolveIdempotencyRecord<T>(existing, payloadHash, now), executed: false };
    }
  }

  private async resolveIdempotencyRecord<T>(
    existing: {
      id: string;
      payloadHash: string;
      status: string;
      responseBody: Prisma.JsonValue | null;
      lockedUntil: Date;
    },
    payloadHash: string,
    now: Date
  ): Promise<T> {
    if (existing.payloadHash !== payloadHash) {
      throw new ConflictException({
        code: "IDEMPOTENCY_CONFLICT",
        message: "La clave ya fue usada con un payload diferente."
      });
    }
    if (existing.status === "COMPLETED") return existing.responseBody as T;
    if (existing.status === "UNCERTAIN" || existing.lockedUntil <= now) {
      if (existing.status === "PROCESSING") {
        await this.prisma.apiIdempotencyRecord.updateMany({
          where: { id: existing.id, status: "PROCESSING", lockedUntil: { lte: now } },
          data: { status: "UNCERTAIN", lockedUntil: now }
        });
      }
      throw new ConflictException({
        code: "IDEMPOTENCY_RESULT_UNCERTAIN",
        message: "La operación previa requiere conciliación y no se reintentará automáticamente.",
        retryable: false
      });
    }
    throw new ConflictException({
      code: "IDEMPOTENCY_IN_PROGRESS",
      message: "La solicitud equivalente sigue en proceso. Reintenta en unos segundos.",
      retryable: true
    });
  }

  private stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, item]) => `${JSON.stringify(name)}:${this.stableJson(item)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
  }
}
