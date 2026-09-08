import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  AppointmentStatus,
  CashMovementType,
  CollectionCaseStatus,
  InstallmentStatus,
  LabOrderStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
  UserStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { createXlsxWorkbook } from "../../common/utils/xlsx.util";
import { assertBranchAccess, branchScope } from "../../common/utils/branch-scope.util";
import { hasEffectivePermission } from "@dentalwarner/shared";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  BaseReportQueryDto,
  ChartReportType,
  CreateExcelReportRequestDto,
  ExcelReportDefinition,
  GenerateChartReportDto,
  ProfessionalsReportQueryDto,
  ReportExportFormat,
  ReportParameterDefinition,
  ReportResponse,
  ReportsPeriodPreset
} from "./dto/reports.dto";
import { excelReportDefinitions } from "./reports-catalog";
import { PeriodReportProviderService } from "./period-report-provider.service";
import { PriceListReportService } from "./price-list-report.service";
import { ReportsAnalyticsService } from "./reports-analytics.service";

type ResolvedFilters = {
  start: Date;
  end: Date;
  branchId?: string;
  branchWhere: string | { in: string[] };
  format: ReportExportFormat;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly periodProvider?: PeriodReportProviderService,
    @Optional() private readonly priceListReport?: PriceListReportService,
    @Optional() private readonly analytics?: ReportsAnalyticsService
  ) {}

  getExcelCatalog(actor?: AuthUser, surface?: "REQUEST" | "PERIOD") {
    return excelReportDefinitions
      .filter(
        (definition) =>
          (!surface || definition.surfaces?.includes(surface)) &&
          (!actor ||
            (definition.requiredPermissions ?? [definition.permission, "reports.export"]).every((permission) =>
              this.hasPermission(actor, permission)
            ))
      )
      .map((definition) => this.serializeExcelDefinition(definition));
  }

  async createExcelRequest(actor: AuthUser, dto: CreateExcelReportRequestDto) {
    const startedAt = new Date();
    const definition = this.resolveExcelDefinition(dto);
    this.assertCanRequestReport(actor, definition);
    const format = this.resolveExcelFormat(dto, definition);
    const parameters = this.normalizeReportParameters(definition, dto);
    const query = {
      ...dto,
      ...parameters,
      parameters,
      format
    };
    let response: ReportResponse<unknown>;

    if (definition.handler === "appointments") response = await this.getAppointmentsReport(actor, query);
    else if (definition.handler === "patients") response = await this.getPatientsReport(actor, query);
    else if (definition.handler === "treatments") response = await this.getTreatmentsReport(actor, query);
    else if (definition.handler === "financial") response = await this.getFinancialReport(actor, query);
    else if (definition.handler === "professionals")
      response = await this.getProfessionalsReport(actor, query);
    else if (definition.handler === "users-list") response = await this.getUsersListReport(actor, query);
    else if (definition.handler === "appointments-patients")
      response = await this.getAppointmentsPatientsReport(actor, query);
    else if (definition.handler === "patient-payments")
      response = await this.getPatientPaymentsReport(actor, query);
    else if (definition.handler === "cash-flow") response = await this.getCashFlowReport(actor, query);
    else if (definition.handler === "expense-detail")
      response = await this.getExpenseDetailReport(actor, query);
    else if (definition.handler === "dentist-contracts")
      response = await this.getDentistContractsReport(actor, query);
    else if (definition.handler === "price-list") {
      if (!this.priceListReport) throw new BadRequestException("El generador del arancel no esta disponible");
      const result = await this.priceListReport.rows(actor, {
        ...(dto.parameters ?? {}),
        ...parameters
      });
      const filters = await this.resolveFilters(actor, { ...query, branchId: result.selection.branchId });
      response = await this.withExport(
        this.wrapResponse(filters, { rows: result.rows }),
        this.priceListReport.fileBaseName(result.selection.branchName, result.selection.priceListName),
        result.rows,
        format,
        "Listado de precios"
      );
    }
    else if (definition.handler?.startsWith("graphical-")) {
      const reportTypeByHandler: Record<string, ChartReportType> = {
        "graphical-daily-collection": "daily-collection",
        "graphical-patient-referrals": "patient-referrals",
        "graphical-captured-budgets": "captured-budgets"
      };
      const reportType = reportTypeByHandler[definition.handler];
      if (!reportType) throw new BadRequestException("Exportador grafico no disponible");
      if (!this.analytics) throw new BadRequestException("El proveedor analitico no esta disponible");
      const rows = await this.analytics.exportChartReportRows(actor, reportType, {
        preset: ReportsPeriodPreset.CUSTOM,
        dateFrom: String(parameters.dateFrom),
        dateTo: String(parameters.dateTo),
        branchId: parameters.branchId ? String(parameters.branchId) : undefined,
        page: 1,
        pageSize: 1_000_000
      } as GenerateChartReportDto);
      response = await this.withExport(
        this.wrapResponse(await this.resolveFilters(actor, query), { rows }),
        definition.id,
        rows,
        format,
        definition.name
      );
    }
    else if (definition.handler === "period-generic") {
      if (!this.periodProvider) throw new BadRequestException("El proveedor del reporte no esta disponible");
      const rows = await this.periodProvider.rows(definition, actor, {
        ...(dto.parameters ?? {}),
        ...parameters
      }, format);
      response = await this.withExport(
        this.wrapResponse(await this.resolveFilters(actor, query), { rows }),
        definition.id,
        rows,
        format
      );
    }
    else throw new BadRequestException("El generador del reporte no esta implementado");

    const completedAt = new Date();
    const fileSize = response.export ? Buffer.byteLength(response.export.base64, "base64") : null;
    const legacyType = this.legacyTypeForDefinition(definition);

    return {
      id: `sync-${startedAt.getTime()}`,
      type: legacyType,
      reportCode: definition.code,
      reportName: definition.name,
      category: definition.category,
      format,
      status: response.export ? "COMPLETED" : "FAILED",
      requestedBy: actor.id,
      requestedAt: startedAt.toISOString(),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      parameters,
      filters: response.filters,
      file: response.export ?? null,
      fileName: response.export?.fileName ?? null,
      mimeType: response.export?.mimeType ?? null,
      fileSize,
      rowCount: this.estimateRowCount(response.data),
      errorMessage: response.export ? null : "No se pudo generar el archivo"
    };
  }

  async getDashboard(actor: AuthUser, query: BaseReportQueryDto): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const agenda = await this.getAgendaMetrics(actor, filters);
    const patients = await this.getPatientMetrics(actor, filters);
    const treatments = await this.getTreatmentMetrics(actor, filters);
    const finances = await this.getFinanceMetrics(actor, filters);
    const operation = await this.getOperationMetrics(actor, filters);

    return this.wrapResponse(filters, { agenda, patients, treatments, finances, operation });
  }

  async getAppointmentsReport(actor: AuthUser, query: BaseReportQueryDto): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const { page, pageSize } = resolvePagination(query);

    const where: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      startAt: { gte: filters.start, lt: filters.end },
      branchId: filters.branchWhere
    };

    const rows = await this.prisma.appointment.findMany({
      where,
      select: {
        id: true,
        status: true,
        startAt: true,
        durationMinutes: true,
        branchId: true,
        professionalId: true,
        chairId: true,
        professional: { select: { firstName: true, lastName: true } },
        chair: { select: { name: true } }
      }
    });

    const byDayMap = new Map<string, { date: string; total: number; cancelled: number; noShow: number }>();
    for (const row of rows) {
      const key = this.dateKey(row.startAt);
      const item = byDayMap.get(key) ?? { date: key, total: 0, cancelled: 0, noShow: 0 };
      item.total += 1;
      if (this.isCancelled(row.status)) item.cancelled += 1;
      if (row.status === AppointmentStatus.NO_SHOW) item.noShow += 1;
      byDayMap.set(key, item);
    }

    const professionalGroup = new Map<
      string,
      {
        professionalId: string;
        name: string;
        total: number;
        cancelled: number;
        noShow: number;
        bookedMinutes: number;
      }
    >();
    for (const row of rows) {
      const key = row.professionalId;
      const name = `${row.professional.firstName} ${row.professional.lastName}`;
      const item = professionalGroup.get(key) ?? {
        professionalId: key,
        name,
        total: 0,
        cancelled: 0,
        noShow: 0,
        bookedMinutes: 0
      };
      item.total += 1;
      item.bookedMinutes += row.durationMinutes;
      if (this.isCancelled(row.status)) item.cancelled += 1;
      if (row.status === AppointmentStatus.NO_SHOW) item.noShow += 1;
      professionalGroup.set(key, item);
    }

    const occupancyByProfessional = await this.computeProfessionalOccupancy(actor, filters, [
      ...professionalGroup.values()
    ]);

    const chairGroup = new Map<
      string,
      { chairId: string; chairName: string; total: number; bookedMinutes: number }
    >();
    for (const row of rows) {
      if (!row.chairId || !row.chair) continue;
      const key = row.chairId;
      const item = chairGroup.get(key) ?? {
        chairId: key,
        chairName: row.chair.name,
        total: 0,
        bookedMinutes: 0
      };
      item.total += 1;
      item.bookedMinutes += row.durationMinutes;
      chairGroup.set(key, item);
    }
    const occupancyByChair = this.computeChairOccupancy(
      [...chairGroup.values()],
      occupancyByProfessional.totalAvailableMinutes
    );

    const byDay = [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const byProfessional = occupancyByProfessional.rows;
    const byChair = occupancyByChair;

    const data = {
      totals: {
        total: rows.length,
        cancelled: rows.filter((row) => this.isCancelled(row.status)).length,
        noShow: rows.filter((row) => row.status === AppointmentStatus.NO_SHOW).length
      },
      byDay: byDay.slice((page - 1) * pageSize, page * pageSize),
      byProfessional: byProfessional.slice((page - 1) * pageSize, page * pageSize),
      byChair: byChair.slice((page - 1) * pageSize, page * pageSize)
    };

    const response = this.wrapResponse(filters, data);
    return this.withExport(response, "appointments-report", byDay, filters.format);
  }

  async getPatientsReport(actor: AuthUser, query: BaseReportQueryDto): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const { page, pageSize } = resolvePagination(query);

    const baseWhere: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      branchId: filters.branchWhere
    };

    const [newPatients, activePatients, withoutFutureAppointment, bySource, newRows] = await Promise.all([
      this.prisma.patient.count({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } }
      }),
      this.prisma.patient.count({
        where: { ...baseWhere, status: { in: ["ACTIVE", "IN_TREATMENT"] } }
      }),
      this.prisma.patient.count({
        where: {
          ...baseWhere,
          appointments: {
            none: {
              startAt: { gte: new Date() },
              status: {
                notIn: [
                  AppointmentStatus.CANCELLED_BY_CLINIC,
                  AppointmentStatus.CANCELLED_BY_PATIENT,
                  AppointmentStatus.NO_SHOW,
                  AppointmentStatus.RESCHEDULED
                ]
              }
            }
          }
        }
      }),
      this.prisma.patient.groupBy({
        by: ["source"],
        where: baseWhere,
        _count: { _all: true }
      }),
      this.prisma.patient.findMany({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } },
        select: { id: true, firstName: true, lastName: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const bySourceRows = bySource
      .map((row) => ({ source: row.source || "UNSPECIFIED", count: row._count._all }))
      .sort((a, b) => b.count - a.count);
    const newPatientsList = newRows.map((row) => ({
      id: row.id,
      fullName: `${row.firstName} ${row.lastName}`,
      source: row.source || "UNSPECIFIED",
      createdAt: row.createdAt
    }));

    const data = {
      summary: {
        newPatients,
        activePatients,
        withoutFutureAppointment
      },
      bySource: bySourceRows.slice((page - 1) * pageSize, page * pageSize),
      newPatientsList: newPatientsList.slice((page - 1) * pageSize, page * pageSize)
    };

    const response = this.wrapResponse(filters, data);
    return this.withExport(response, "patients-report", newPatientsList, filters.format);
  }

  async getTreatmentsReport(actor: AuthUser, query: BaseReportQueryDto): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const { page, pageSize } = resolvePagination(query);
    const baseWhere: Prisma.TreatmentPlanWhereInput = {
      organizationId: actor.organizationId,
      isAlternative: false,
      branchId: filters.branchWhere
    };

    const [plansCreated, plansAccepted, inProgress, completed, planRows] = await Promise.all([
      this.prisma.treatmentPlan.count({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } }
      }),
      this.prisma.treatmentPlan.count({
        where: {
          ...baseWhere,
          status: {
            in: [TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.COMPLETED]
          },
          OR: [
            { acceptedAt: { gte: filters.start, lt: filters.end } },
            { createdAt: { gte: filters.start, lt: filters.end } }
          ]
        }
      }),
      this.prisma.treatmentPlan.count({
        where: { ...baseWhere, status: TreatmentPlanStatus.IN_PROGRESS }
      }),
      this.prisma.treatmentPlan.count({
        where: { ...baseWhere, status: TreatmentPlanStatus.COMPLETED }
      }),
      this.prisma.treatmentPlan.findMany({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          patient: { select: { firstName: true, lastName: true } },
          professional: { select: { firstName: true, lastName: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const acceptanceRate = plansCreated > 0 ? this.percent(plansAccepted, plansCreated) : 0;

    const planRowsData = planRows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      patient: `${row.patient.firstName} ${row.patient.lastName}`,
      professional: `${row.professional.firstName} ${row.professional.lastName}`,
      createdAt: row.createdAt
    }));

    const data = {
      summary: {
        plansCreated,
        plansAccepted,
        acceptanceRate,
        inProgress,
        completed
      },
      plans: planRowsData.slice((page - 1) * pageSize, page * pageSize)
    };

    const response = this.wrapResponse(filters, data);
    return this.withExport(response, "treatments-report", planRowsData, filters.format);
  }

  async getFinancialReport(actor: AuthUser, query: BaseReportQueryDto): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const { page, pageSize } = resolvePagination(query);

    const paymentWhere: Prisma.PaymentWhereInput = {
      organizationId: actor.organizationId,
      paidAt: { gte: filters.start, lt: filters.end },
      status: { not: PaymentStatus.REFUNDED },
      branchId: filters.branchWhere
    };

    const payments = await this.prisma.payment.findMany({
      where: paymentWhere,
      select: {
        amount: true,
        paidAt: true,
        paymentMethodId: true,
        paymentMethod: { select: { name: true } },
        branchId: true
      }
    });

    const incomeByDayMap = new Map<string, number>();
    const incomeByMethodMap = new Map<string, { method: string; amount: number }>();
    for (const payment of payments) {
      const amount = Number(payment.amount);
      const dayKey = this.dateKey(payment.paidAt);
      incomeByDayMap.set(dayKey, (incomeByDayMap.get(dayKey) ?? 0) + amount);

      const methodKey = payment.paymentMethodId || "none";
      const current = incomeByMethodMap.get(methodKey) ?? {
        method: payment.paymentMethod?.name || "Unknown",
        amount: 0
      };
      current.amount += amount;
      incomeByMethodMap.set(methodKey, current);
    }

    const [plannedTotal, allocatedTotal, delinquentInstallments, cashMovements, productionItems] =
      await Promise.all([
        this.prisma.treatmentPlanItem.aggregate({
          _sum: { total: true },
          where: {
            status: { not: TreatmentPlanItemStatus.CANCELLED },
            treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere }
          }
        }),
        this.prisma.paymentAllocation.aggregate({
          _sum: { amount: true },
          where: {
            treatmentPlanItem: {
              treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere }
            }
          }
        }),
        this.prisma.installment.findMany({
          where: {
            dueDate: { lt: new Date() },
            status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
            patient: { organizationId: actor.organizationId, branchId: filters.branchWhere }
          },
          select: { amount: true, paidAmount: true }
        }),
        this.prisma.cashMovement.findMany({
          where: {
            createdAt: { gte: filters.start, lt: filters.end },
            voidedAt: null,
            OR: [{ paymentMethodId: null }, { paymentMethod: { includeInPhysicalCashBalance: true } }],
            cashRegister: {
              organizationId: actor.organizationId,
              branchId: filters.branchWhere
            }
          },
          select: {
            amount: true,
            type: true,
            direction: true,
            cashRegister: { select: { branchId: true, branch: { select: { name: true } } } }
          }
        }),
        this.prisma.treatmentPlanItem.findMany({
          where: {
            status: TreatmentPlanItemStatus.COMPLETED,
            completedAt: { gte: filters.start, lt: filters.end },
            treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere }
          },
          select: {
            total: true,
            treatmentPlan: {
              select: {
                professionalId: true,
                professional: { select: { firstName: true, lastName: true } }
              }
            }
          }
        })
      ]);

    const outstandingBalance = Math.max(
      this.roundMoney(Number(plannedTotal._sum.total ?? 0) - Number(allocatedTotal._sum.amount ?? 0)),
      0
    );

    const delinquency = this.roundMoney(
      delinquentInstallments.reduce(
        (sum, installment) => sum + (Number(installment.amount) - Number(installment.paidAmount)),
        0
      )
    );

    const cashByBranchMap = new Map<string, { branchId: string; branchName: string; netAmount: number }>();
    for (const movement of cashMovements) {
      const key = movement.cashRegister.branchId;
      const existing = cashByBranchMap.get(key) ?? {
        branchId: key,
        branchName: movement.cashRegister.branch.name,
        netAmount: 0
      };

      if (movement.type === CashMovementType.CLOSING || movement.type === CashMovementType.CLOSING_CARRYOVER)
        continue;
      const amount = Number(movement.amount);
      existing.netAmount += movement.direction === "OUT" ? -amount : amount;
      cashByBranchMap.set(key, existing);
    }

    const productionByProfessionalMap = new Map<
      string,
      { professionalId: string; name: string; amount: number }
    >();
    for (const item of productionItems) {
      const key = item.treatmentPlan.professionalId;
      const name = `${item.treatmentPlan.professional.firstName} ${item.treatmentPlan.professional.lastName}`;
      const existing = productionByProfessionalMap.get(key) ?? { professionalId: key, name, amount: 0 };
      existing.amount += Number(item.total);
      productionByProfessionalMap.set(key, existing);
    }

    const incomeByDayRows = [...incomeByDayMap.entries()]
      .map(([date, amount]) => ({ date, amount: this.roundMoney(amount) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const incomeByMethodRows = [...incomeByMethodMap.values()]
      .map((row) => ({ method: row.method, amount: this.roundMoney(row.amount) }))
      .sort((a, b) => b.amount - a.amount);
    const cashByBranchRows = [...cashByBranchMap.values()].map((row) => ({
      ...row,
      netAmount: this.roundMoney(row.netAmount)
    }));
    const productionByProfessionalRows = [...productionByProfessionalMap.values()]
      .map((row) => ({ ...row, amount: this.roundMoney(row.amount) }))
      .sort((a, b) => b.amount - a.amount);

    const data = {
      summary: {
        incomeTotal: this.roundMoney(payments.reduce((sum, row) => sum + Number(row.amount), 0)),
        outstandingBalance,
        delinquency
      },
      incomeByDay: incomeByDayRows.slice((page - 1) * pageSize, page * pageSize),
      incomeByMethod: incomeByMethodRows.slice((page - 1) * pageSize, page * pageSize),
      cashByBranch: cashByBranchRows.slice((page - 1) * pageSize, page * pageSize),
      productionByProfessional: productionByProfessionalRows.slice((page - 1) * pageSize, page * pageSize)
    };

    const response = this.wrapResponse(filters, data);
    return this.withExport(response, "financial-report", incomeByDayRows, filters.format);
  }

  async getProfessionalsReport(
    actor: AuthUser,
    query: ProfessionalsReportQueryDto
  ): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const { page, pageSize } = resolvePagination(query);

    const professionals = await this.prisma.professional.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        ...(query.professionalId ? { id: query.professionalId } : {})
      },
      select: { id: true, firstName: true, lastName: true }
    });
    if (query.professionalId && professionals.length === 0) {
      throw new NotFoundException("Professional not found");
    }

    const professionalIds = professionals.map((row) => row.id);

    const [appointments, completedItems, labOrders] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          organizationId: actor.organizationId,
          professionalId: { in: professionalIds },
          startAt: { gte: filters.start, lt: filters.end },
          branchId: filters.branchWhere
        },
        select: { professionalId: true, status: true, durationMinutes: true }
      }),
      this.prisma.treatmentPlanItem.findMany({
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: filters.start, lt: filters.end },
          treatmentPlan: {
            professionalId: { in: professionalIds },
            organizationId: actor.organizationId,
            branchId: filters.branchWhere
          }
        },
        select: { total: true, treatmentPlan: { select: { professionalId: true } } }
      }),
      this.prisma.labOrder.findMany({
        where: {
          organizationId: actor.organizationId,
          professionalId: { in: professionalIds },
          treatmentPlan: {
            branchId: filters.branchWhere
          }
        },
        select: { professionalId: true, status: true }
      })
    ]);

    const statsMap = new Map<
      string,
      {
        professionalId: string;
        name: string;
        appointments: number;
        cancelled: number;
        noShow: number;
        bookedMinutes: number;
        production: number;
        labPending: number;
      }
    >();

    for (const professional of professionals) {
      statsMap.set(professional.id, {
        professionalId: professional.id,
        name: `${professional.firstName} ${professional.lastName}`,
        appointments: 0,
        cancelled: 0,
        noShow: 0,
        bookedMinutes: 0,
        production: 0,
        labPending: 0
      });
    }

    for (const appointment of appointments) {
      const target = statsMap.get(appointment.professionalId);
      if (!target) continue;
      target.appointments += 1;
      target.bookedMinutes += appointment.durationMinutes;
      if (this.isCancelled(appointment.status)) target.cancelled += 1;
      if (appointment.status === AppointmentStatus.NO_SHOW) target.noShow += 1;
    }

    for (const item of completedItems) {
      const target = statsMap.get(item.treatmentPlan.professionalId);
      if (!target) continue;
      target.production += Number(item.total);
    }

    for (const order of labOrders) {
      const isPendingLab =
        order.status === LabOrderStatus.REQUESTED ||
        order.status === LabOrderStatus.SENT ||
        order.status === LabOrderStatus.IN_PROCESS;
      if (!isPendingLab) continue;
      const target = statsMap.get(order.professionalId);
      if (!target) continue;
      target.labPending += 1;
    }

    const rows = [...statsMap.values()]
      .map((row) => ({
        ...row,
        production: this.roundMoney(row.production),
        cancellationRate: row.appointments > 0 ? this.percent(row.cancelled, row.appointments) : 0,
        noShowRate: row.appointments > 0 ? this.percent(row.noShow, row.appointments) : 0
      }))
      .sort((a, b) => b.production - a.production);

    const response = this.wrapResponse(filters, { rows: rows.slice((page - 1) * pageSize, page * pageSize) });
    return this.withExport(response, "professionals-report", rows, filters.format);
  }

  private async getUsersListReport(
    actor: AuthUser,
    query: BaseReportQueryDto & { status?: string }
  ): Promise<ReportResponse<unknown>> {
    const status = query.status ?? "ALL";
    const where: Prisma.UserWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null
    };

    if (status === "ENABLED") {
      where.status = UserStatus.ACTIVE;
      where.isActive = true;
    } else if (status === "DISABLED") {
      where.OR = [{ status: { in: [UserStatus.INACTIVE, UserStatus.LOCKED] } }, { isActive: false }];
    }

    const rows = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        isActive: true,
        role: { select: { name: true } },
        branches: { select: { branch: { select: { name: true } } } },
        lastLoginAt: true,
        createdAt: true
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    const exportRows = rows.map((row) => ({
      id: row.id,
      nombre: `${row.firstName} ${row.lastName}`,
      email: row.email,
      telefono: row.phone ?? "",
      estado: row.status,
      activo: row.isActive,
      rol: row.role?.name ?? "",
      sucursales: row.branches.map((item) => item.branch.name).join(", "),
      ultimoIngreso: row.lastLoginAt,
      creado: row.createdAt
    }));

    const filters: ResolvedFilters = {
      start: new Date(0),
      end: new Date(),
      branchWhere: branchScope(actor),
      format: query.format ?? ReportExportFormat.XLSX
    };
    const response = this.wrapResponse(filters, { rows: exportRows });
    return this.withExport(response, "users-list", exportRows, filters.format);
  }

  private async getAppointmentsPatientsReport(
    actor: AuthUser,
    query: BaseReportQueryDto & { professionalId?: string; statuses?: string[] }
  ): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const statuses = Array.isArray(query.statuses)
      ? query.statuses.filter((status) =>
          Object.values(AppointmentStatus).includes(status as AppointmentStatus)
        )
      : [];
    const where: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      branchId: filters.branchWhere,
      startAt: { gte: filters.start, lt: filters.end },
      patientId: { not: null },
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(statuses.length ? { status: { in: statuses as AppointmentStatus[] } } : {})
    };

    const rows = await this.prisma.appointment.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        reason: true,
        startAt: true,
        endAt: true,
        durationMinutes: true,
        branch: { select: { name: true } },
        patient: { select: { firstName: true, lastName: true, email: true, phone: true } },
        professional: { select: { firstName: true, lastName: true } },
        treatmentPlanId: true
      },
      orderBy: { startAt: "asc" }
    });

    const exportRows = rows.map((row) => ({
      id: row.id,
      sucursal: row.branch.name,
      paciente: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : "",
      emailPaciente: row.patient?.email ?? "",
      telefonoPaciente: row.patient?.phone ?? "",
      profesional: `${row.professional.firstName} ${row.professional.lastName}`,
      titulo: row.title,
      motivo: row.reason ?? "",
      estado: row.status,
      fechaInicio: row.startAt,
      fechaFin: row.endAt,
      minutos: row.durationMinutes,
      tipo: row.treatmentPlanId ? "TRATAMIENTO" : "DIAGNOSTICO"
    }));

    const response = this.wrapResponse(filters, { rows: exportRows });
    return this.withExport(response, "appointments-patients", exportRows, filters.format);
  }

  private async getPatientPaymentsReport(
    actor: AuthUser,
    query: BaseReportQueryDto & { paymentMethodId?: string; cashRegisterId?: string; status?: string }
  ): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const status = query.status && query.status !== "ALL" ? query.status : undefined;
    const where: Prisma.PaymentWhereInput = {
      organizationId: actor.organizationId,
      branchId: filters.branchWhere,
      paidAt: { gte: filters.start, lt: filters.end },
      ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}),
      ...(status && Object.values(PaymentStatus).includes(status as PaymentStatus)
        ? { status: status as PaymentStatus }
        : {}),
      ...(query.cashRegisterId ? { cashMovements: { some: { cashRegisterId: query.cashRegisterId } } } : {})
    };

    const rows = await this.prisma.payment.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        reference: true,
        paidAt: true,
        branch: { select: { name: true } },
        patient: { select: { firstName: true, lastName: true, email: true } },
        paymentMethod: { select: { name: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
        cashMovements: { select: { cashRegister: { select: { publicNumber: true } } } }
      },
      orderBy: { paidAt: "desc" }
    });

    const exportRows = rows.map((row) => ({
      id: row.id,
      sucursal: row.branch.name,
      paciente: `${row.patient.firstName} ${row.patient.lastName}`,
      emailPaciente: row.patient.email ?? "",
      monto: Number(row.amount),
      moneda: row.currency,
      metodoPago: row.paymentMethod?.name,
      estado: row.status,
      referencia: row.reference ?? "",
      caja: row.cashMovements
        .map((movement) => `CAJ-${String(movement.cashRegister.publicNumber).padStart(6, "0")}`)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(", "),
      recibidoPor: `${row.receivedBy.firstName} ${row.receivedBy.lastName}`,
      pagadoEl: row.paidAt
    }));

    const response = this.wrapResponse(filters, { rows: exportRows });
    return this.withExport(response, "patient-payments", exportRows, filters.format);
  }

  private async getCashFlowReport(
    actor: AuthUser,
    query: BaseReportQueryDto
  ): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const rows = await this.prisma.cashMovement.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        createdAt: { gte: filters.start, lt: filters.end },
        voidedAt: null,
        OR: [{ paymentMethodId: null }, { paymentMethod: { includeInCashFlowReports: true } }]
      },
      select: {
        type: true,
        direction: true,
        amount: true,
        description: true,
        reference: true,
        createdAt: true,
        cashRegister: { select: { publicNumber: true, status: true } },
        branch: { select: { name: true } },
        paymentMethod: { select: { name: true, type: true } },
        payment: {
          select: {
            paymentNumber: true,
            status: true,
            patient: { select: { firstName: true, lastName: true } }
          }
        },
        expense: { select: { publicNumber: true, status: true, description: true } },
        refund: { select: { id: true, status: true, reason: true } },
        createdBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    const exportRows = rows.map((row) => ({
      caja: `CAJ-${String(row.cashRegister.publicNumber).padStart(6, "0")}`,
      sucursal: row.branch.name,
      fecha: row.createdAt,
      tipo: row.type,
      direccion: row.direction,
      importe: (row.direction === "OUT" ? -1 : 1) * Number(row.amount),
      medioPago: row.paymentMethod?.name ?? "",
      pago: row.payment?.paymentNumber ? String(row.payment.paymentNumber).padStart(6, "0") : "",
      paciente: row.payment ? `${row.payment.patient.firstName} ${row.payment.patient.lastName}` : "",
      gasto: row.expense ? `GAS-${String(row.expense.publicNumber).padStart(6, "0")}` : "",
      referencia: row.reference ?? "",
      detalle: row.description ?? "",
      responsable: `${row.createdBy.firstName} ${row.createdBy.lastName}`,
      estadoCaja: row.cashRegister.status
    }));
    const response = this.wrapResponse(filters, { rows: exportRows });
    return this.withExport(response, "cash-flow", exportRows, filters.format);
  }

  private async getExpenseDetailReport(
    actor: AuthUser,
    query: BaseReportQueryDto
  ): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const rows = await this.prisma.expense.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        paidAt: { gte: filters.start, lt: filters.end }
      },
      select: {
        publicNumber: true,
        description: true,
        supplierName: true,
        quantity: true,
        unitCost: true,
        total: true,
        invoicedAt: true,
        paidAt: true,
        status: true,
        voidReason: true,
        branch: { select: { name: true } },
        category: { select: { name: true } },
        paymentMethod: { select: { name: true, type: true } },
        cashMovements: { select: { cashRegister: { select: { publicNumber: true } } } },
        createdBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { paidAt: "desc" }
    });

    const exportRows = rows.map((row) => ({
      gasto: `GAS-${String(row.publicNumber).padStart(6, "0")}`,
      categoria: row.category.name,
      detalle: row.description,
      proveedor: row.supplierName ?? "",
      cantidad: Number(row.quantity),
      costoUnitario: Number(row.unitCost),
      total: Number(row.total),
      fechaFactura: row.invoicedAt ?? "",
      fechaPago: row.paidAt,
      sucursal: row.branch.name,
      caja: row.cashMovements
        .map((movement) => `CAJ-${String(movement.cashRegister.publicNumber).padStart(6, "0")}`)
        .join(", "),
      medioPago: row.paymentMethod?.name ?? "",
      estado: row.status,
      motivoAnulacion: row.voidReason ?? "",
      registradoPor: `${row.createdBy.firstName} ${row.createdBy.lastName}`
    }));
    const response = this.wrapResponse(filters, { rows: exportRows });
    return this.withExport(response, "expense-detail", exportRows, filters.format);
  }

  private async getDentistContractsReport(
    actor: AuthUser,
    query: BaseReportQueryDto
  ): Promise<ReportResponse<unknown>> {
    const filters = await this.resolveFilters(actor, query);
    const rows = await this.prisma.professionalContract.findMany({
      where: {
        organizationId: actor.organizationId,
        branches: { some: { branchId: filters.branchWhere } }
      },
      select: {
        id: true,
        contractType: true,
        commissionBase: true,
        paymentDiscount: true,
        paymentCondition: true,
        commissionRate: true,
        priceListName: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
        professional: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            licenseNumber: true,
            specialties: { select: { specialty: { select: { name: true } } } }
          }
        },
        branches: {
          where: { branchId: filters.branchWhere },
          select: { branch: { select: { name: true } } }
        }
      },
      orderBy: [{ professional: { lastName: "asc" } }, { startsAt: "desc" }]
    });

    const exportRows = rows.map((row) => ({
      id: row.id,
      profesional: `${row.professional.firstName} ${row.professional.lastName}`,
      email: row.professional.email ?? "",
      cedula: row.professional.licenseNumber ?? "",
      sucursales: row.branches.map((item) => item.branch.name).join(", "),
      especialidades: row.professional.specialties.map((item) => item.specialty.name).join(", "),
      tipoContrato: row.contractType,
      baseComision: row.commissionBase,
      descuentoPago: row.paymentDiscount,
      condicionPago: row.paymentCondition,
      porcentajeComision: Number(row.commissionRate),
      listaPrecios: row.priceListName ?? "",
      estado: row.isActive ? "ACTIVO" : "INACTIVO",
      inicio: row.startsAt,
      fin: row.endsAt
    }));

    const response = this.wrapResponse(filters, { rows: exportRows });
    return this.withExport(response, "dentist-contracts", exportRows, filters.format);
  }

  private serializeExcelDefinition(definition: ExcelReportDefinition) {
    const legacyType = this.legacyTypeForDefinition(definition);
    return {
      ...definition,
      type: legacyType,
      title: definition.name,
      filters: definition.parameters.map((parameter) => parameter.key),
      lastRunAt: null
    };
  }

  private resolveExcelDefinition(dto: CreateExcelReportRequestDto) {
    const legacyCodeByType: Record<string, string> = {
      appointments: "APPOINTMENTS_SUMMARY",
      patients: "PATIENTS_SUMMARY",
      treatments: "TREATMENTS_SUMMARY",
      financial: "FINANCIAL_SUMMARY",
      professionals: "PROFESSIONALS_SUMMARY"
    };
    const code = dto.reportCode ?? (dto.type ? legacyCodeByType[dto.type] : undefined);
    const definition = excelReportDefinitions.find((item) => item.code === code);
    if (!definition) throw new NotFoundException("Reporte no encontrado");
    return definition;
  }

  private assertCanRequestReport(actor: AuthUser, definition: ExcelReportDefinition) {
    if (!definition.enabled) {
      throw new BadRequestException({
        code: "REPORT_UNAVAILABLE",
        message: definition.unavailableReason ?? "El generador del reporte no está disponible."
      });
    }
    const permissions = definition.requiredPermissions ?? [definition.permission, "reports.export"];
    if (permissions.some((permission) => !this.hasPermission(actor, permission))) {
      throw new ForbiddenException("No tienes permiso para solicitar este reporte");
    }
  }

  private resolveExcelFormat(dto: CreateExcelReportRequestDto, definition: ExcelReportDefinition) {
    const format = dto.format ?? ReportExportFormat.XLSX;
    if (format === ReportExportFormat.JSON || !definition.supportedFormats.includes(format)) {
      throw new BadRequestException("Formato no soportado");
    }
    return format;
  }

  private normalizeReportParameters(definition: ExcelReportDefinition, dto: CreateExcelReportRequestDto) {
    const input = { ...(dto.parameters ?? {}) } as Record<string, unknown>;
    if (dto.dateFrom && !input.dateFrom) input.dateFrom = dto.dateFrom;
    if (dto.dateTo && !input.dateTo) input.dateTo = dto.dateTo;
    if (dto.branchId && !input.branchId) input.branchId = dto.branchId;

    const normalized: Record<string, unknown> = {};
    for (const parameter of definition.parameters) {
      const raw = input[parameter.key] ?? parameter.defaultValue;
      if ((raw === undefined || raw === null || raw === "") && parameter.required) {
        throw new BadRequestException("Selecciona los campos obligatorios.");
      }
      if (raw === undefined || raw === null || raw === "") continue;
      normalized[parameter.key] = this.normalizeParameterValue(parameter, raw);
    }

    this.validateDateRange(definition, normalized);
    return normalized;
  }

  private normalizeParameterValue(parameter: ReportParameterDefinition, raw: unknown) {
    if (parameter.type === "multiselect" || parameter.type === "appointmentStatus") {
      const values = Array.isArray(raw) ? raw : String(raw).split(",").filter(Boolean);
      this.assertAllowedOption(parameter, values);
      return values;
    }
    if (parameter.type === "checkbox") return raw === true || raw === "true";
    if (parameter.type === "number") return Number(raw);
    const value = String(raw);
    this.assertAllowedOption(parameter, value);
    return value;
  }

  private assertAllowedOption(parameter: ReportParameterDefinition, value: string | string[]) {
    if (!parameter.options?.length) return;
    const allowed = new Set(parameter.options.map((option) => option.value));
    const values = Array.isArray(value) ? value : [value];
    const invalid = values.some((item) => !allowed.has(item));
    if (invalid) throw new BadRequestException(`Parametro invalido: ${parameter.label}`);
  }

  private validateDateRange(definition: ExcelReportDefinition, normalized: Record<string, unknown>) {
    if (!normalized.dateFrom && !normalized.dateTo) return;
    const dateFrom = normalized.dateFrom ? new Date(String(normalized.dateFrom)) : null;
    const dateTo = normalized.dateTo ? new Date(String(normalized.dateTo)) : null;
    if (
      !dateFrom ||
      !dateTo ||
      Number.isNaN(dateFrom.getTime()) ||
      Number.isNaN(dateTo.getTime()) ||
      dateFrom > dateTo
    ) {
      throw new BadRequestException("El rango de fechas no es valido.");
    }

    const maxRangeDays = definition.parameters.find(
      (parameter) => parameter.key === "dateFrom" || parameter.key === "dateTo"
    )?.maxRangeDays;
    if (maxRangeDays) {
      const days = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (days > maxRangeDays)
        throw new BadRequestException(`El rango maximo permitido es de ${maxRangeDays} dias.`);
    }
  }

  private legacyTypeForDefinition(definition: ExcelReportDefinition) {
    const legacyByCode: Record<string, string> = {
      APPOINTMENTS_SUMMARY: "appointments",
      PATIENTS_SUMMARY: "patients",
      TREATMENTS_SUMMARY: "treatments",
      FINANCIAL_SUMMARY: "financial",
      PROFESSIONALS_SUMMARY: "professionals",
      APPOINTMENTS_PATIENTS: "appointments",
      PATIENT_PAYMENTS: "financial",
      USERS_LIST: "professionals",
      DENTIST_CONTRACTS: "professionals"
    };
    return legacyByCode[definition.code] ?? definition.id;
  }

  private hasPermission(actor: AuthUser, permission: string) {
    return hasEffectivePermission(actor.permissions, permission);
  }

  private estimateRowCount(data: unknown) {
    if (Array.isArray(data)) return data.length;
    if (
      data &&
      typeof data === "object" &&
      "rows" in data &&
      Array.isArray((data as { rows?: unknown }).rows)
    ) {
      return (data as { rows: unknown[] }).rows.length;
    }
    return null;
  }

  private async getAgendaMetrics(actor: AuthUser, filters: ResolvedFilters) {
    const where: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      startAt: { gte: filters.start, lt: filters.end },
      branchId: filters.branchWhere
    };

    const appointments = await this.prisma.appointment.findMany({
      where,
      select: { status: true, professionalId: true, chairId: true, durationMinutes: true, startAt: true }
    });

    const byProfessional = new Map<string, { professionalId: string; count: number }>();
    const byChair = new Map<string, { chairId: string; count: number }>();

    for (const row of appointments) {
      const prof = byProfessional.get(row.professionalId) ?? { professionalId: row.professionalId, count: 0 };
      prof.count += 1;
      byProfessional.set(row.professionalId, prof);

      if (row.chairId) {
        const chair = byChair.get(row.chairId) ?? { chairId: row.chairId, count: 0 };
        chair.count += 1;
        byChair.set(row.chairId, chair);
      }
    }

    return {
      total: appointments.length,
      cancelled: appointments.filter((row) => this.isCancelled(row.status)).length,
      noShow: appointments.filter((row) => row.status === AppointmentStatus.NO_SHOW).length,
      byProfessional: [...byProfessional.values()],
      byChair: [...byChair.values()]
    };
  }

  private async getPatientMetrics(actor: AuthUser, filters: ResolvedFilters) {
    const baseWhere: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      branchId: filters.branchWhere
    };

    const [newPatients, activePatients, withoutFutureAppointment, bySource] = await Promise.all([
      this.prisma.patient.count({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } }
      }),
      this.prisma.patient.count({ where: { ...baseWhere, status: { in: ["ACTIVE", "IN_TREATMENT"] } } }),
      this.prisma.patient.count({
        where: {
          ...baseWhere,
          appointments: {
            none: {
              startAt: { gte: new Date() },
              status: {
                notIn: [
                  AppointmentStatus.CANCELLED_BY_CLINIC,
                  AppointmentStatus.CANCELLED_BY_PATIENT,
                  AppointmentStatus.NO_SHOW
                ]
              }
            }
          }
        }
      }),
      this.prisma.patient.groupBy({
        by: ["source"],
        where: baseWhere,
        _count: { _all: true }
      })
    ]);

    return {
      newPatients,
      activePatients,
      withoutFutureAppointment,
      bySource: bySource.map((row) => ({ source: row.source || "UNSPECIFIED", count: row._count._all }))
    };
  }

  private async getTreatmentMetrics(actor: AuthUser, filters: ResolvedFilters) {
    const baseWhere: Prisma.TreatmentPlanWhereInput = {
      organizationId: actor.organizationId,
      isAlternative: false,
      branchId: filters.branchWhere
    };

    const [plansCreated, plansAccepted, inProgress, completed] = await Promise.all([
      this.prisma.treatmentPlan.count({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } }
      }),
      this.prisma.treatmentPlan.count({
        where: {
          ...baseWhere,
          status: {
            in: [TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.COMPLETED]
          },
          OR: [
            { acceptedAt: { gte: filters.start, lt: filters.end } },
            { createdAt: { gte: filters.start, lt: filters.end } }
          ]
        }
      }),
      this.prisma.treatmentPlan.count({ where: { ...baseWhere, status: TreatmentPlanStatus.IN_PROGRESS } }),
      this.prisma.treatmentPlan.count({ where: { ...baseWhere, status: TreatmentPlanStatus.COMPLETED } })
    ]);

    return {
      plansCreated,
      plansAccepted,
      acceptanceRate: plansCreated > 0 ? this.percent(plansAccepted, plansCreated) : 0,
      inProgress,
      completed
    };
  }

  private async getFinanceMetrics(actor: AuthUser, filters: ResolvedFilters) {
    const [payments, plannedTotal, allocatedTotal, delinquentInstallments] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          paidAt: { gte: filters.start, lt: filters.end },
          status: { not: PaymentStatus.REFUNDED },
          branchId: filters.branchWhere
        },
        select: { amount: true }
      }),
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          status: { not: TreatmentPlanItemStatus.CANCELLED },
          treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          treatmentPlanItem: {
            treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere }
          }
        }
      }),
      this.prisma.installment.findMany({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
          patient: { organizationId: actor.organizationId, branchId: filters.branchWhere }
        },
        select: { amount: true, paidAmount: true }
      })
    ]);

    return {
      income: this.roundMoney(payments.reduce((sum, row) => sum + Number(row.amount), 0)),
      outstanding: this.roundMoney(
        Math.max(Number(plannedTotal._sum.total ?? 0) - Number(allocatedTotal._sum.amount ?? 0), 0)
      ),
      delinquency: this.roundMoney(
        delinquentInstallments.reduce((sum, row) => sum + (Number(row.amount) - Number(row.paidAmount)), 0)
      )
    };
  }

  private async getOperationMetrics(actor: AuthUser, filters: ResolvedFilters) {
    const [completedProcedures, pendingLabOrders, lowInventoryRows, overdueTasks] = await Promise.all([
      this.prisma.treatmentPlanItem.count({
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: filters.start, lt: filters.end },
          treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere }
        }
      }),
      this.prisma.labOrder.count({
        where: {
          organizationId: actor.organizationId,
          status: { in: [LabOrderStatus.REQUESTED, LabOrderStatus.SENT, LabOrderStatus.IN_PROCESS] },
          treatmentPlan: { branchId: filters.branchWhere }
        }
      }),
      this.prisma.inventoryStock.findMany({
        where: {
          organizationId: actor.organizationId,
          inventoryItem: { isActive: true },
          warehouse: { branchId: filters.branchWhere }
        },
        select: { stock: true, minStock: true }
      }),
      this.prisma.collectionCase.count({
        where: {
          status: {
            in: [
              CollectionCaseStatus.PENDING,
              CollectionCaseStatus.CONTACTED,
              CollectionCaseStatus.PROMISE_TO_PAY
            ]
          },
          nextContactAt: { lt: new Date() },
          patient: { organizationId: actor.organizationId, branchId: filters.branchWhere }
        }
      })
    ]);

    return {
      completedProcedures,
      pendingLabOrders,
      lowInventory: lowInventoryRows.filter((row) => Number(row.stock) <= Number(row.minStock)).length,
      overdueTasks
    };
  }

  private async computeProfessionalOccupancy(
    actor: AuthUser,
    filters: ResolvedFilters,
    rows: Array<{
      professionalId: string;
      name: string;
      total: number;
      cancelled: number;
      noShow: number;
      bookedMinutes: number;
    }>
  ) {
    const schedules = await this.prisma.professionalSchedule.findMany({
      where: {
        professional: { organizationId: actor.organizationId },
        isActive: true,
        branchId: filters.branchWhere,
        professionalId: { in: rows.map((row) => row.professionalId) }
      },
      select: {
        professionalId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        breakStartTime: true,
        breakEndTime: true
      }
    });

    const availableByProfessional = new Map<string, number>();
    for (const schedule of schedules) {
      const dailyMinutes =
        this.minutesDiff(schedule.startTime, schedule.endTime) -
        this.breakMinutes(schedule.breakStartTime, schedule.breakEndTime);
      const occurrences = this.countWeekdayOccurrences(filters.start, filters.end, schedule.dayOfWeek);
      const totalMinutes = Math.max(0, dailyMinutes * occurrences);
      availableByProfessional.set(
        schedule.professionalId,
        (availableByProfessional.get(schedule.professionalId) ?? 0) + totalMinutes
      );
    }

    const outRows = rows.map((row) => {
      const available = availableByProfessional.get(row.professionalId) ?? 0;
      return {
        ...row,
        availableMinutes: available,
        occupancyPercent: available > 0 ? this.percent(row.bookedMinutes, available) : 0
      };
    });

    const totalAvailableMinutes = [...availableByProfessional.values()].reduce(
      (sum, value) => sum + value,
      0
    );
    return { rows: outRows.sort((a, b) => b.total - a.total), totalAvailableMinutes };
  }

  private computeChairOccupancy(
    rows: Array<{ chairId: string; chairName: string; total: number; bookedMinutes: number }>,
    totalAvailableMinutes: number
  ) {
    if (rows.length === 0) return [];
    const availablePerChair = totalAvailableMinutes > 0 ? totalAvailableMinutes / rows.length : 0;
    return rows
      .map((row) => ({
        ...row,
        availableMinutes: this.roundMoney(availablePerChair),
        occupancyPercent: availablePerChair > 0 ? this.percent(row.bookedMinutes, availablePerChair) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }

  private async resolveFilters(actor: AuthUser, query: BaseReportQueryDto): Promise<ResolvedFilters> {
    const now = new Date();
    const start = query.dateFrom ? new Date(query.dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endInclusive = query.dateTo
      ? new Date(query.dateTo)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endInclusive.getTime())) {
      throw new BadRequestException("Invalid date range");
    }

    const end = new Date(endInclusive);
    end.setHours(23, 59, 59, 999);

    if (!actor.branchIds.length) throw new NotFoundException("Branch not found");
    const branchId = query.branchId;
    if (branchId) assertBranchAccess(actor, branchId);

    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, organizationId: actor.organizationId, deletedAt: null }
      });
      if (!branch) throw new NotFoundException("Branch not found");
    }

    return {
      start,
      end,
      branchId,
      branchWhere: branchScope(actor, branchId),
      format: query.format ?? ReportExportFormat.JSON
    };
  }

  private wrapResponse<T>(filters: ResolvedFilters, data: T): ReportResponse<T> {
    return {
      filters: {
        dateFrom: filters.start.toISOString(),
        dateTo: filters.end.toISOString(),
        branchId: filters.branchId
      },
      data
    };
  }

  private async withExport<T>(
    response: ReportResponse<T>,
    baseFileName: string,
    rows: Record<string, unknown>[],
    format: ReportExportFormat,
    sheetName = "Reporte"
  ): Promise<ReportResponse<T>> {
    if (format === ReportExportFormat.JSON) return response;
    const normalized = rows.map((row) => this.normalizeRow(row));

    if (format === ReportExportFormat.CSV) {
      const csv = this.toDelimited(normalized, ",");
      return {
        ...response,
        export: {
          format: ReportExportFormat.CSV,
          fileName: `${baseFileName}.csv`,
          mimeType: "text/csv",
          base64: Buffer.from(csv, "utf8").toString("base64")
        }
      };
    }

    const xlsx = createXlsxWorkbook([{ name: sheetName, rows: normalized }]);
    return {
      ...response,
      export: {
        format: ReportExportFormat.XLSX,
        fileName: `${baseFileName}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: xlsx.toString("base64")
      }
    };
  }

  private normalizeRow(row: Record<string, unknown>) {
    const out: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) out[key] = "";
      else if (value instanceof Date) out[key] = value.toISOString();
      else if (typeof value === "object") out[key] = JSON.stringify(value);
      else out[key] = value as string | number | boolean;
    }
    return out;
  }

  private toDelimited(rows: Record<string, string | number | boolean>[], delimiter: "," | "\t") {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(delimiter)];
    for (const row of rows) {
      const values = headers.map((header) => this.escapeField(row[header], delimiter));
      lines.push(values.join(delimiter));
    }
    return lines.join("\n");
  }

  private escapeField(value: string | number | boolean | undefined, delimiter: "," | "\t") {
    const rawValue = String(value ?? "");
    const raw = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
    const needsQuote = raw.includes(delimiter) || raw.includes('"') || raw.includes("\n");
    if (!needsQuote) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
  }

  private isCancelled(status: AppointmentStatus) {
    return (
      status === AppointmentStatus.CANCELLED_BY_CLINIC || status === AppointmentStatus.CANCELLED_BY_PATIENT
    );
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private percent(part: number, total: number) {
    if (total <= 0) return 0;
    return this.roundMoney((part / total) * 100);
  }

  private minutesDiff(startTime: string, endTime: string) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }

  private breakMinutes(start?: string | null, end?: string | null) {
    if (!start || !end) return 0;
    return Math.max(0, this.minutesDiff(start, end));
  }

  private countWeekdayOccurrences(start: Date, end: Date, dayOfWeek: number) {
    let count = 0;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
      if (cursor.getDay() === dayOfWeek) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }
}
