import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hasEffectivePermission } from "@dentalwarner/shared";
import {
  AppointmentStatus,
  BudgetStatus,
  ExpenseReportGroup,
  InventoryMovementStatus,
  InstallmentStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanItemStatus,
} from "@prisma/client";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  AnalyticsReportQueryDto,
  ChartReportType,
  GenerateChartReportDto,
  ReportsPeriodPreset,
} from "./dto/reports.dto";

const ATTENDED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.WAITING_ROOM,
  AppointmentStatus.IN_PROGRESS,
];
const SCHEDULED_EXCLUDED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.BLOCKED,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_CONFLICT,
  AppointmentStatus.CANCELLED_RESCHEDULED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED,
];
const CANCELLED_BY_PATIENT_OR_RESCHEDULE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_RESCHEDULED,
  AppointmentStatus.RESCHEDULED,
];
const RECEIVED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.RECEIVED,
  PaymentStatus.PARTIALLY_ALLOCATED,
  PaymentStatus.ALLOCATED,
];

type AnalyticsFilters = {
  start: Date;
  end: Date;
  branchId?: string;
  branchWhere: string | { in: string[] };
  branchName: string;
  branchIds: string[];
  timezone: string;
  currency: string;
  preset: ReportsPeriodPreset;
  periodMode: "automatic" | "historical";
  asOf: string;
  limit?: number;
  search?: string;
  professionalId?: string;
  specialtyId?: string;
  page: number;
  pageSize: number;
};

type PublicAnalyticsFilters = {
  dateFrom: string;
  dateTo: string;
  branchId: string | null;
  branchName: string;
  branchIds: string[];
  timezone: string;
  currency: string;
  preset: ReportsPeriodPreset;
  periodMode: "automatic" | "historical";
  asOf: string;
};

type ChartPayload = {
  schemaVersion: 2;
  type: ChartReportType;
  renderer:
    | "chart-table"
    | "table"
    | "matrix"
    | "stacked-cohort"
    | "redirect"
    | "captured-budgets";
  title: string;
  description: string;
  filters: PublicAnalyticsFilters;
  definitions: Record<string, unknown>;
  summary: Record<string, number | string>;
  chart: Array<Record<string, unknown>>;
  rows: Array<Record<string, unknown>>;
  data?: Record<string, unknown>;
  exportCode?: string;
};

@Injectable()
export class ReportsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPerformanceDashboard(
    actor: AuthUser,
    query: AnalyticsReportQueryDto,
  ) {
    const filters = await this.resolveFilters(actor, query);
    const previous = this.previousRange(filters.start, filters.end);

    const [
      agenda,
      monthlyAttention,
      currentFinance,
      previousFinance,
      monthlyFinance,
      waitTime,
      production,
    ] = await Promise.all([
      this.getAgendaPerformance(actor, filters),
      this.getMonthlyAttention(actor, filters),
      this.getFinancePerformance(
        actor,
        filters.start,
        filters.end,
        filters.branchWhere,
      ),
      this.getFinancePerformance(
        actor,
        previous.start,
        previous.end,
        filters.branchWhere,
      ),
      this.getMonthlyFinance(actor, filters),
      this.getWaitTimeMetrics(actor, filters),
      this.getProductionPerformance(actor, filters),
    ]);

    return {
      filters: this.publicFilters(filters),
      updatedAt: new Date().toISOString(),
      definitions: this.metricDefinitions(filters),
      agenda: {
        ...agenda,
        monthlyAttention,
      },
      finance: {
        sales: currentFinance.sales,
        collections: currentFinance.collections,
        previousSales: previousFinance.sales,
        previousCollections: previousFinance.collections,
        salesVariationPercent: this.variation(
          currentFinance.sales,
          previousFinance.sales,
        ),
        collectionsVariationPercent: this.variation(
          currentFinance.collections,
          previousFinance.collections,
        ),
        monthly: monthlyFinance,
      },
      operation: waitTime,
      production,
    };
  }

  getChartsCatalog() {
    return [
      [
        "results",
        "Resultados",
        "Ventas realizadas, costos teoricos y resultado mensual.",
        "chart-table",
      ],
      [
        "money-flow",
        "Flujos de dinero",
        "Ingresos efectivamente recibidos y egresos pagados.",
        "chart-table",
      ],
      [
        "patient-analysis",
        "Analisis de pacientes",
        "Abre Pacientes > Analisis.",
        "redirect",
      ],
      [
        "expenses",
        "Gastos",
        "Gastos por correspondencia contable y por fecha de pago.",
        "matrix",
      ],
      [
        "professional-efficiency",
        "Eficiencia por profesional",
        "Ventas por hora efectivamente atendida.",
        "table",
      ],
      [
        "sales-by-procedure",
        "Ventas por procedimiento",
        "Produccion realizada agrupada por procedimiento.",
        "table",
      ],
      [
        "sales-by-category",
        "Ventas por categoria",
        "Produccion realizada agrupada por categoria.",
        "table",
      ],
      [
        "budget-capture-efficiency",
        "Eficiencia de captacion de presupuestos",
        "Cohortes por mes de generacion y captura.",
        "stacked-cohort",
      ],
      [
        "daily-collection",
        "Informe de cobranza diario",
        "Recaudacion consolidada por sucursal y medio de pago.",
        "matrix",
      ],
      [
        "professional-ranking",
        "Ranking profesionales",
        "Presupuestos generados, capturados y razon.",
        "table",
      ],
      [
        "delinquent-patients",
        "Pacientes morosos",
        "Deuda vencida por antiguedad y saldo vigente.",
        "table",
      ],
      [
        "financing-status",
        "Estado de financiamientos",
        "Matriz temporal de cuotas y pagos.",
        "matrix",
      ],
      [
        "payroll-discount-status",
        "Estado de descuentos por planilla",
        "Matriz temporal de convenios y cobros.",
        "matrix",
      ],
      [
        "patient-referrals",
        "Derivacion de pacientes",
        "Tratamientos derivados entre sucursales y profesionales.",
        "table",
      ],
      [
        "captured-budgets",
        "Presupuestos capturados",
        "Captacion trimestral por profesional.",
        "captured-budgets",
      ],
    ].map(([type, title, description, renderer]) => ({
      type,
      title,
      description,
      renderer,
      destination:
        type === "patient-analysis" ? "/pacientes/analisis" : undefined,
    }));
  }

  async generateChartReport(
    actor: AuthUser,
    type: ChartReportType,
    query: GenerateChartReportDto,
  ): Promise<ChartPayload> {
    if (
      ["delinquent-patients", "patient-referrals"].includes(type) &&
      !hasEffectivePermission(actor.permissions, "patients.read")
    ) {
      throw new ForbiddenException(
        "No tienes permiso para consultar datos sensibles de pacientes",
      );
    }
    const filters = await this.resolveFilters(actor, query, type);

    switch (type) {
      case "results":
        return this.resultsReport(actor, filters);
      case "money-flow":
        return this.moneyFlowReport(actor, filters);
      case "patient-analysis":
        return this.redirectReport(filters);
      case "expenses":
        return this.expensesReport(actor, filters);
      case "professional-efficiency":
        return this.professionalEfficiencyReport(actor, filters, type);
      case "professional-ranking":
        return this.professionalRankingReport(actor, filters);
      case "sales-by-procedure":
        return this.salesByProcedureReport(actor, filters);
      case "sales-by-category":
        return this.salesByCategoryReport(actor, filters);
      case "budget-capture-efficiency":
        return this.budgetCaptureReport(actor, filters);
      case "daily-collection":
        return this.dailyCollectionReport(actor, filters);
      case "delinquent-patients":
        return this.delinquentPatientsReport(actor, filters);
      case "financing-status":
        return this.financingStatusReport(actor, filters);
      case "payroll-discount-status":
        return this.payrollDiscountReport(actor, filters);
      case "patient-referrals":
        return this.referralsReport(actor, filters);
      case "captured-budgets":
        return this.capturedBudgetsReport(actor, filters);
      case "sales-book":
        return this.salesBookReport(actor, filters);
      default:
        throw new BadRequestException("Unsupported chart report");
    }
  }

  async exportChartReportRows(
    actor: AuthUser,
    type: ChartReportType,
    query: GenerateChartReportDto,
  ) {
    const report = await this.generateChartReport(actor, type, query);
    if (type === "daily-collection") {
      const columns = Array.isArray(report.data?.columns)
        ? (report.data.columns as Array<Record<string, unknown>>)
        : [];
      const rows = Array.isArray(report.data?.rows)
        ? (report.data.rows as Array<Record<string, unknown>>)
        : [];
      return rows.map((row) => {
        const output: Record<string, string | number | null> = {
          concepto: String(row.label ?? ""),
          seccion: String(row.section ?? ""),
        };
        const cells = Array.isArray(row.cells)
          ? (row.cells as Array<Record<string, unknown>>)
          : [];
        columns.forEach((column, index) => {
          const label = String(column.label ?? `columna_${index + 1}`);
          output[`${label} - monto`] = Number(cells[index]?.amount ?? 0);
          output[`${label} - cantidad`] = Number(cells[index]?.count ?? 0);
        });
        return output;
      });
    }
    if (type === "captured-budgets") {
      const months = Array.isArray(report.data?.months)
        ? (report.data.months as Array<Record<string, unknown>>)
        : [];
      return report.rows.map((row) => {
        const output: Record<string, string | number | null> = {
          profesional: String(row.professional ?? ""),
          especialidad: String(row.specialty ?? ""),
          presupuestosEmitidos: Number(row.emitted ?? 0),
          presupuestosCapturados: Number(row.captured ?? 0),
          tasaCaptacionTotal: Number(row.captureRate ?? 0),
        };
        const rates = Array.isArray(row.monthlyRates) ? row.monthlyRates : [];
        months.forEach((month, index) => {
          output[`Tasa ${String(month.label ?? month.key ?? index + 1)}`] =
            Number(rates[index] ?? 0);
        });
        return output;
      });
    }
    return report.rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value === undefined ||
          value === null ||
          ["string", "number", "boolean"].includes(typeof value)
            ? (value as string | number | boolean | null)
            : JSON.stringify(value),
        ]),
      ),
    );
  }

  async resolveFilters(
    actor: AuthUser,
    query: AnalyticsReportQueryDto,
    type?: ChartReportType,
  ): Promise<AnalyticsFilters> {
    const chartQuery = query as GenerateChartReportDto;
    const branchWhere = branchScope(actor, query.branchId);
    let branchName = "Todas las sucursales autorizadas";
    let branchIds = [...actor.branchIds];
    let timezone = "America/Mexico_City";
    const primaryBranchId =
      actor.branches?.find((branch) => branch.isPrimary)?.id ??
      actor.branchIds[0];
    const timezoneBranchId = query.branchId ?? primaryBranchId;

    if (timezoneBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: timezoneBranchId,
          organizationId: actor.organizationId,
          deletedAt: null,
        },
        select: { id: true, name: true, timezone: true },
      });
      if (query.branchId && !branch)
        throw new NotFoundException("Branch not found");
      if (branch) {
        timezone = branch.timezone ?? timezone;
        if (query.branchId) {
          branchName = branch.name;
          branchIds = [branch.id];
        }
      }
    }

    const hasExplicitPeriod = Boolean(
      query.dateFrom ||
      query.dateTo ||
      query.month ||
      query.year ||
      query.preset === ReportsPeriodPreset.CUSTOM ||
      query.preset === ReportsPeriodPreset.LAST_30_DAYS,
    );
    const periodMode = hasExplicitPeriod ? "historical" : "automatic";
    const preset =
      query.preset ??
      (query.dateFrom || query.dateTo
        ? ReportsPeriodPreset.CUSTOM
        : ReportsPeriodPreset.MONTH);
    const now = new Date();
    let start: Date;
    let end: Date;
    let asOf = this.dateKey(now, timezone);

    if (periodMode === "automatic") {
      ({ start, end, asOf } = this.automaticReportRange(type, now, timezone));
    } else if (preset === ReportsPeriodPreset.LAST_30_DAYS) {
      const endKey = this.dateKey(now, timezone);
      const startKey = this.shiftDateKey(endKey, -29);
      start = this.zonedDateStart(startKey, timezone);
      end = this.zonedDateEnd(endKey, timezone);
      asOf = endKey;
    } else if (preset === ReportsPeriodPreset.CUSTOM) {
      if (!query.dateFrom || !query.dateTo)
        throw new BadRequestException(
          "dateFrom and dateTo are required for custom reports",
        );
      start = this.zonedDateStart(query.dateFrom, timezone);
      end = this.zonedDateEnd(query.dateTo, timezone);
      asOf = query.dateTo;
    } else {
      const parsedMonth = query.month
        ? Number(query.month)
        : Number(this.monthKey(now, timezone).slice(5));
      const parsedYear = query.year
        ? Number(query.year)
        : Number(this.monthKey(now, timezone).slice(0, 4));
      if (
        !Number.isInteger(parsedMonth) ||
        parsedMonth < 1 ||
        parsedMonth > 12 ||
        !Number.isInteger(parsedYear)
      ) {
        throw new BadRequestException("Invalid month or year");
      }
      const monthKey = `${parsedYear}-${String(parsedMonth).padStart(2, "0")}`;
      ({ start, end } = this.zonedMonthRange(monthKey, timezone));
      asOf = this.dateKey(end, timezone);
    }

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start > end
    ) {
      throw new BadRequestException("Invalid report range");
    }

    return {
      start,
      end,
      branchId: query.branchId,
      branchWhere,
      branchName,
      branchIds,
      timezone,
      currency: query.currency ?? "MXN",
      preset,
      periodMode,
      asOf,
      limit: chartQuery.limit,
      search: chartQuery.search?.trim(),
      professionalId: chartQuery.professionalId,
      specialtyId: chartQuery.specialtyId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 50,
    };
  }

  private automaticReportRange(
    type: ChartReportType | undefined,
    now: Date,
    timezone: string,
  ) {
    const today = this.dateKey(now, timezone);
    const currentMonth = today.slice(0, 7);
    const current = this.zonedMonthRange(currentMonth, timezone);

    if (
      type === "results" ||
      type === "money-flow" ||
      type === "budget-capture-efficiency"
    ) {
      return {
        start: this.zonedMonthRange(
          this.shiftMonthKey(currentMonth, -12),
          timezone,
        ).start,
        end: current.end,
        asOf: today,
      };
    }

    if (type === "daily-collection" || type === "delinquent-patients") {
      return {
        start: this.zonedDateStart(today, timezone),
        end: this.zonedDateEnd(today, timezone),
        asOf: today,
      };
    }

    if (type === "patient-referrals") {
      return {
        start: current.start,
        end: this.zonedDateEnd(today, timezone),
        asOf: today,
      };
    }

    return { ...current, asOf: today };
  }

  private async getAgendaPerformance(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ) {
    const appointmentWhere: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      branchId: filters.branchWhere,
      patientId: { not: null },
      startAt: { gte: filters.start, lte: filters.end },
    };

    const [appointments, newPatients, diagnosticBudgets] = await Promise.all([
      this.prisma.appointment.findMany({
        where: appointmentWhere,
        select: {
          id: true,
          status: true,
          durationMinutes: true,
          professionalId: true,
          branchId: true,
        },
      }),
      this.prisma.patient.count({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          deletedAt: null,
          createdAt: { gte: filters.start, lte: filters.end },
          OR: [
            {
              clinicalEvolutions: {
                some: {
                  createdAt: { gte: filters.start, lte: filters.end },
                  annulledAt: null,
                },
              },
            },
            {
              treatmentPlans: {
                some: {
                  createdAt: { gte: filters.start, lte: filters.end },
                  isAlternative: false,
                },
              },
            },
          ],
        },
      }),
      this.prisma.budget.count({
        where: {
          organizationId: actor.organizationId,
          createdAt: { gte: filters.start, lte: filters.end },
          treatmentPlan: {
            branchId: filters.branchWhere,
            isAlternative: false,
            appointments: {
              some: { reason: { contains: "diagn", mode: "insensitive" } },
            },
          },
        },
      }),
    ]);

    const scheduled = appointments.filter(
      (row) => !SCHEDULED_EXCLUDED_STATUSES.includes(row.status),
    ).length;
    const attended = appointments.filter((row) =>
      ATTENDED_STATUSES.includes(row.status),
    ).length;
    const cancelled = appointments.filter((row) =>
      CANCELLED_BY_PATIENT_OR_RESCHEDULE_STATUSES.includes(row.status),
    ).length;
    const usedMinutes = appointments
      .filter((row) => ATTENDED_STATUSES.includes(row.status))
      .reduce((sum, row) => sum + row.durationMinutes, 0);
    const availableMinutes = await this.computeAvailableMinutes(
      actor,
      filters,
      [...new Set(appointments.map((row) => row.professionalId))],
    );

    return {
      newPatients,
      cancelledAppointments: cancelled,
      occupancy: {
        usedMinutes,
        availableMinutes,
        percent:
          availableMinutes > 0
            ? this.percent(usedMinutes, availableMinutes)
            : 0,
      },
      diagnosticBudgets,
      attendedVsScheduled: {
        attended,
        scheduled,
        percent: scheduled > 0 ? this.percent(attended, scheduled) : 0,
      },
    };
  }

  private async getMonthlyAttention(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ) {
    const start = new Date(filters.end);
    start.setDate(1);
    start.setMonth(start.getMonth() - 11);
    start.setHours(0, 0, 0, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        patientId: { not: null },
        status: { in: ATTENDED_STATUSES },
        startAt: { gte: start, lte: filters.end },
      },
      select: { startAt: true },
    });

    const map = this.emptyMonthMap(start, filters.end, filters.timezone);
    for (const appointment of appointments) {
      const key = this.monthKey(appointment.startAt, filters.timezone);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([month, attended]) => ({ month, attended }));
  }

  private async getFinancePerformance(
    actor: AuthUser,
    start: Date,
    end: Date,
    branchWhere: string | { in: string[] },
  ) {
    const [sales, collections] = await Promise.all([
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: start, lte: end },
          treatmentPlan: {
            organizationId: actor.organizationId,
            branchId: branchWhere,
            isAlternative: false,
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          branchId: branchWhere,
          paidAt: { gte: start, lte: end },
          status: { in: RECEIVED_PAYMENT_STATUSES },
        },
      }),
    ]);

    return {
      sales: this.money(sales._sum.total),
      collections: this.money(collections._sum.amount),
    };
  }

  private async getMonthlyFinance(actor: AuthUser, filters: AnalyticsFilters) {
    const start = new Date(filters.end);
    start.setDate(1);
    start.setMonth(start.getMonth() - 11);
    start.setHours(0, 0, 0, 0);
    const map = new Map<
      string,
      { month: string; sales: number; collections: number }
    >();
    for (const key of this.emptyMonthMap(
      start,
      filters.end,
      filters.timezone,
    ).keys())
      map.set(key, { month: key, sales: 0, collections: 0 });

    const [items, payments] = await Promise.all([
      this.prisma.treatmentPlanItem.findMany({
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: start, lte: filters.end },
          treatmentPlan: {
            organizationId: actor.organizationId,
            branchId: filters.branchWhere,
            isAlternative: false,
          },
        },
        select: { total: true, completedAt: true },
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          paidAt: { gte: start, lte: filters.end },
          status: { in: RECEIVED_PAYMENT_STATUSES },
        },
        select: { amount: true, paidAt: true },
      }),
    ]);

    for (const item of items) {
      if (!item.completedAt) continue;
      const key = this.monthKey(item.completedAt, filters.timezone);
      const row = map.get(key);
      if (row) row.sales = this.roundMoney(row.sales + Number(item.total));
    }
    for (const payment of payments) {
      const key = this.monthKey(payment.paidAt, filters.timezone);
      const row = map.get(key);
      if (row)
        row.collections = this.roundMoney(
          row.collections + Number(payment.amount),
        );
    }
    return [...map.values()];
  }

  private async getWaitTimeMetrics(actor: AuthUser, filters: AnalyticsFilters) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        startAt: { gte: filters.start, lte: filters.end },
        statusHistory: {
          some: {
            newStatus: {
              in: [
                AppointmentStatus.WAITING_ROOM,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.COMPLETED,
              ],
            },
          },
        },
      },
      select: {
        id: true,
        statusHistory: {
          where: {
            newStatus: {
              in: [
                AppointmentStatus.WAITING_ROOM,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.COMPLETED,
              ],
            },
          },
          select: { newStatus: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const waits: number[] = [];
    for (const appointment of appointments) {
      const waiting = appointment.statusHistory.find(
        (row) => row.newStatus === AppointmentStatus.WAITING_ROOM,
      );
      const started = appointment.statusHistory.find(
        (row) =>
          (row.newStatus === AppointmentStatus.IN_PROGRESS ||
            row.newStatus === AppointmentStatus.COMPLETED) &&
          (!waiting || row.createdAt >= waiting.createdAt),
      );
      if (!waiting || !started) continue;
      waits.push(
        Math.max(
          0,
          Math.round(
            (started.createdAt.getTime() - waiting.createdAt.getTime()) / 60000,
          ),
        ),
      );
    }

    const currentAverage = waits.length
      ? this.roundMoney(
          waits.reduce((sum, value) => sum + value, 0) / waits.length,
        )
      : 0;
    const historicalAverage = await this.getHistoricalWaitAverage(
      actor,
      filters,
    );

    return {
      averageWaitMinutes: currentAverage,
      historicalAverageWaitMinutes: historicalAverage,
      variationPercent: this.variation(currentAverage, historicalAverage),
      samples: waits.length,
    };
  }

  private async getHistoricalWaitAverage(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ) {
    const historicalEnd = new Date(filters.start.getTime() - 1);
    const historicalStart = new Date(historicalEnd);
    historicalStart.setMonth(historicalStart.getMonth() - 12);
    const historical = await this.getWaitTimeMetricsRaw(
      actor,
      filters.branchWhere,
      historicalStart,
      historicalEnd,
    );
    return historical.length
      ? this.roundMoney(
          historical.reduce((sum, value) => sum + value, 0) / historical.length,
        )
      : 0;
  }

  private async getWaitTimeMetricsRaw(
    actor: AuthUser,
    branchWhere: string | { in: string[] },
    start: Date,
    end: Date,
  ) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchWhere,
        startAt: { gte: start, lte: end },
        statusHistory: {
          some: {
            newStatus: {
              in: [
                AppointmentStatus.WAITING_ROOM,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.COMPLETED,
              ],
            },
          },
        },
      },
      select: {
        statusHistory: {
          where: {
            newStatus: {
              in: [
                AppointmentStatus.WAITING_ROOM,
                AppointmentStatus.IN_PROGRESS,
                AppointmentStatus.COMPLETED,
              ],
            },
          },
          select: { newStatus: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return appointments.flatMap((appointment) => {
      const waiting = appointment.statusHistory.find(
        (row) => row.newStatus === AppointmentStatus.WAITING_ROOM,
      );
      const started = appointment.statusHistory.find(
        (row) =>
          (row.newStatus === AppointmentStatus.IN_PROGRESS ||
            row.newStatus === AppointmentStatus.COMPLETED) &&
          (!waiting || row.createdAt >= waiting.createdAt),
      );
      if (!waiting || !started) return [];
      return [
        Math.max(
          0,
          Math.round(
            (started.createdAt.getTime() - waiting.createdAt.getTime()) / 60000,
          ),
        ),
      ];
    });
  }

  private async getProductionPerformance(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ) {
    const completedItems = await this.prisma.treatmentPlanItem.findMany({
      where: {
        status: TreatmentPlanItemStatus.COMPLETED,
        completedAt: { gte: filters.start, lte: filters.end },
        treatmentPlan: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          isAlternative: false,
        },
      },
      select: {
        total: true,
        quantity: true,
        priceListItem: { select: { labCost: true } },
        treatmentPlan: {
          select: {
            professionalId: true,
            professional: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const hoursByProfessional = await this.attendedHoursByProfessional(
      actor,
      filters,
    );
    const professionalMap = new Map<
      string,
      {
        professionalId: string;
        name: string;
        sales: number;
        attendedHours: number;
      }
    >();
    let theoreticalCosts = 0;

    for (const item of completedItems) {
      theoreticalCosts +=
        Number(item.priceListItem?.labCost ?? 0) * Number(item.quantity ?? 1);
      const key = item.treatmentPlan.professionalId;
      const row = professionalMap.get(key) ?? {
        professionalId: key,
        name: `${item.treatmentPlan.professional.firstName} ${item.treatmentPlan.professional.lastName}`.trim(),
        sales: 0,
        attendedHours: hoursByProfessional.get(key) ?? 0,
      };
      row.sales += Number(item.total);
      professionalMap.set(key, row);
    }

    const salesByProfessional = [...professionalMap.values()]
      .map((row) => ({
        ...row,
        sales: this.roundMoney(row.sales),
        attendedHours: this.roundMoney(row.attendedHours),
        efficiency:
          row.attendedHours > 0
            ? this.roundMoney(row.sales / row.attendedHours)
            : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    return {
      theoreticalCosts: this.roundMoney(theoreticalCosts),
      salesByProfessional,
      professionalEfficiency: salesByProfessional,
    };
  }

  private async computeAvailableMinutes(
    actor: AuthUser,
    filters: AnalyticsFilters,
    professionalIds: string[],
  ) {
    if (!professionalIds.length) return 0;
    const schedules = await this.prisma.professionalSchedule.findMany({
      where: {
        professional: { organizationId: actor.organizationId },
        branchId: filters.branchWhere,
        professionalId: { in: professionalIds },
        isActive: true,
      },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        breakStartTime: true,
        breakEndTime: true,
      },
    });
    return schedules.reduce((sum, schedule) => {
      const minutes =
        this.minutesDiff(schedule.startTime, schedule.endTime) -
        this.breakMinutes(schedule.breakStartTime, schedule.breakEndTime);
      return (
        sum +
        Math.max(0, minutes) *
          this.countWeekdayOccurrences(
            filters.start,
            filters.end,
            schedule.dayOfWeek,
          )
      );
    }, 0);
  }

  private async attendedHoursByProfessional(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        status: { in: ATTENDED_STATUSES },
        startAt: { gte: filters.start, lte: filters.end },
      },
      select: { professionalId: true, durationMinutes: true },
    });
    const map = new Map<string, number>();
    for (const appointment of appointments) {
      map.set(
        appointment.professionalId,
        (map.get(appointment.professionalId) ?? 0) +
          appointment.durationMinutes / 60,
      );
    }
    return map;
  }

  private async resultsReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const months = this.monthWindows(
      filters.start,
      filters.end,
      filters.timezone,
    );
    const [items, inventory, contracts] = await Promise.all([
      this.prisma.treatmentPlanItem.findMany({
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: filters.start, lte: filters.end },
          treatmentPlan: {
            organizationId: actor.organizationId,
            branchId: filters.branchWhere,
            isAlternative: false,
          },
        },
        select: {
          total: true,
          performedAmount: true,
          quantity: true,
          completedAt: true,
          laboratoryCostSnapshot: true,
          internalCostSnapshot: true,
          procedure: { select: { id: true, categoryId: true } },
          treatmentPlan: {
            select: {
              branchId: true,
              professionalId: true,
              professional: { select: { commissionRate: true } },
            },
          },
        },
      }),
      this.prisma.inventoryMovement.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          status: InventoryMovementStatus.POSTED,
          type: { in: ["OUT", "EXIT", "WASTE"] },
          occurredAt: { gte: filters.start, lte: filters.end },
          voidedAt: null,
          treatmentPlanItemId: { not: null },
        },
        select: { quantity: true, unitCost: true, occurredAt: true },
      }),
      this.prisma.professionalContract.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          startsAt: { lte: filters.end },
          OR: [{ endsAt: null }, { endsAt: { gte: filters.start } }],
          branches: { some: { branchId: filters.branchWhere } },
        },
        select: {
          professionalId: true,
          commissionRate: true,
          startsAt: true,
          endsAt: true,
          branches: { select: { branchId: true } },
          categoryRates: {
            select: { procedureCategoryId: true, rate: true },
          },
          fixedAmounts: { select: { procedureId: true, amount: true } },
        },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);
    const rows = months.map((month) => ({
      ...month,
      sales: 0,
      professionals: 0,
      laboratories: 0,
      other: 0,
      inventory: 0,
    }));
    const byMonth = new Map(rows.map((row) => [row.key, row]));
    for (const item of items) {
      if (!item.completedAt) continue;
      const row = byMonth.get(
        this.monthKey(item.completedAt, filters.timezone),
      );
      if (!row) continue;
      const sale =
        Number(item.performedAmount) > 0
          ? Number(item.performedAmount)
          : Number(item.total);
      const quantity = Number(item.quantity ?? 1);
      row.sales += sale;
      const contract = contracts.find(
        (candidate) =>
          candidate.professionalId === item.treatmentPlan.professionalId &&
          candidate.branches.some(
            (branch) => branch.branchId === item.treatmentPlan.branchId,
          ) &&
          candidate.startsAt <= item.completedAt! &&
          (!candidate.endsAt || candidate.endsAt >= item.completedAt!),
      );
      const fixedAmount = contract?.fixedAmounts.find(
        (fixed) => fixed.procedureId === item.procedure.id,
      );
      const categoryRate = contract?.categoryRates.find(
        (rate) => rate.procedureCategoryId === item.procedure.categoryId,
      );
      const rate = Number(
        categoryRate?.rate ??
          contract?.commissionRate ??
          item.treatmentPlan.professional.commissionRate,
      );
      row.professionals += fixedAmount
        ? Number(fixedAmount.amount) * quantity
        : sale * (rate / 100);
      row.laboratories += Number(item.laboratoryCostSnapshot) * quantity;
      row.other += Number(item.internalCostSnapshot) * quantity;
    }
    for (const movement of inventory) {
      const row = byMonth.get(
        this.monthKey(movement.occurredAt, filters.timezone),
      );
      if (row)
        row.inventory +=
          Math.abs(Number(movement.quantity)) * Number(movement.unitCost ?? 0);
    }
    const chart = rows.map((row) => {
      const costs =
        row.professionals + row.laboratories + row.other + row.inventory;
      const result = row.sales - costs;
      return {
        label: row.label,
        month: row.key,
        sales: this.roundMoney(row.sales),
        costs: this.roundMoney(costs),
        result: this.roundMoney(result),
        percent: this.percent(result, row.sales),
      };
    });
    const tableRows = [
      { label: "Ventas", level: 0, values: chart.map((row) => row.sales) },
      {
        label: "Procedimientos realizados",
        level: 1,
        values: chart.map((row) => row.sales),
      },
      {
        label: "Costos operacionales teoricos",
        level: 0,
        values: chart.map((row) => -row.costs),
      },
      {
        label: "Profesionales",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.professionals)),
      },
      {
        label: "Laboratorios",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.laboratories)),
      },
      {
        label: "Otros",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.other)),
      },
      {
        label: "Inventario",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.inventory)),
      },
      { label: "Total", level: 0, values: chart.map((row) => row.result) },
      {
        label: "Total (%)",
        level: 0,
        percent: true,
        values: chart.map((row) => row.percent),
      },
    ];
    return this.reportPayload(
      "results",
      "chart-table",
      "Resultados",
      "Resultado mensual sobre procedimientos realizados.",
      filters,
      {
        summary: {
          sales: this.roundMoney(
            chart.reduce((sum, row) => sum + row.sales, 0),
          ),
          costs: this.roundMoney(
            chart.reduce((sum, row) => sum + row.costs, 0),
          ),
          net: this.roundMoney(chart.reduce((sum, row) => sum + row.result, 0)),
        },
        chart,
        rows: tableRows,
        data: {
          months: rows.map((row) => ({ key: row.key, label: row.label })),
          rows: tableRows,
        },
      },
    );
  }

  private async moneyFlowReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const months = this.monthWindows(
      filters.start,
      filters.end,
      filters.timezone,
    );
    const [payments, expenses, manualOutflows] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          paidAt: { gte: filters.start, lte: filters.end },
          status: { in: RECEIVED_PAYMENT_STATUSES },
        },
        select: {
          amount: true,
          paidAt: true,
          paymentMethod: { select: { includeInCashFlowReports: true } },
          splits: {
            select: {
              amount: true,
              paymentMethod: { select: { includeInCashFlowReports: true } },
            },
          },
        },
      }),
      this.prisma.expense.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          status: { not: "VOIDED" },
          paidAt: { gte: filters.start, lte: filters.end },
        },
        select: {
          total: true,
          paidAt: true,
          category: { select: { name: true, reportGroup: true } },
        },
      }),
      this.prisma.cashMovement.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          direction: "OUT",
          voidedAt: null,
          expenseId: null,
          createdAt: { gte: filters.start, lte: filters.end },
        },
        select: { amount: true, createdAt: true },
      }),
    ]);
    const rows = months.map((month) => ({
      ...month,
      income: 0,
      professionals: 0,
      laboratories: 0,
      commissions: 0,
      otherOperational: 0,
      expenseCategories: new Map<string, number>(),
    }));
    const byMonth = new Map(rows.map((row) => [row.key, row]));
    for (const payment of payments) {
      const row = byMonth.get(this.monthKey(payment.paidAt, filters.timezone));
      if (!row) continue;
      row.income += payment.splits.length
        ? payment.splits.reduce(
            (sum, split) =>
              sum +
              (split.paymentMethod.includeInCashFlowReports
                ? Number(split.amount)
                : 0),
            0,
          )
        : payment.paymentMethod?.includeInCashFlowReports === false
          ? 0
          : Number(payment.amount);
    }
    for (const expense of expenses) {
      const row = byMonth.get(this.monthKey(expense.paidAt, filters.timezone));
      if (!row) continue;
      const amount = Number(expense.total);
      if (expense.category.reportGroup === ExpenseReportGroup.PROFESSIONALS)
        row.professionals += amount;
      else if (expense.category.reportGroup === ExpenseReportGroup.LABORATORIES)
        row.laboratories += amount;
      else if (expense.category.reportGroup === ExpenseReportGroup.COMMISSIONS)
        row.commissions += amount;
      else
        row.expenseCategories.set(
          expense.category.name,
          (row.expenseCategories.get(expense.category.name) ?? 0) + amount,
        );
    }
    for (const movement of manualOutflows) {
      const row = byMonth.get(
        this.monthKey(movement.createdAt, filters.timezone),
      );
      if (row) row.otherOperational += Number(movement.amount);
    }
    const expenseNames = [
      ...new Set(rows.flatMap((row) => [...row.expenseCategories.keys()])),
    ].sort();
    const chart = rows.map((row) => {
      const operational =
        row.professionals +
        row.laboratories +
        row.commissions +
        row.otherOperational;
      const expensesTotal = [...row.expenseCategories.values()].reduce(
        (sum, value) => sum + value,
        0,
      );
      return {
        label: row.label,
        month: row.key,
        income: this.roundMoney(row.income),
        operational: this.roundMoney(operational),
        expenses: this.roundMoney(expensesTotal),
        total: this.roundMoney(row.income - operational - expensesTotal),
      };
    });
    const tableRows = [
      { label: "Ingresos", level: 0, values: chart.map((row) => row.income) },
      {
        label: "Ingresos recibidos",
        level: 1,
        values: chart.map((row) => row.income),
      },
      {
        label: "Costos operacionales",
        level: 0,
        values: chart.map((row) => -row.operational),
      },
      {
        label: "Profesionales",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.professionals)),
      },
      {
        label: "Laboratorios",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.laboratories)),
      },
      {
        label: "Comisiones",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.commissions)),
      },
      {
        label: "Otros egresos",
        level: 1,
        values: rows.map((row) => -this.roundMoney(row.otherOperational)),
      },
      { label: "Gastos", level: 0, values: chart.map((row) => -row.expenses) },
      ...expenseNames.map((name) => ({
        label: name,
        level: 1,
        values: rows.map(
          (row) => -this.roundMoney(row.expenseCategories.get(name) ?? 0),
        ),
      })),
      { label: "Total", level: 0, values: chart.map((row) => row.total) },
    ];
    return this.reportPayload(
      "money-flow",
      "chart-table",
      "Flujos de dinero",
      "Ingresos efectivamente recibidos menos egresos pagados.",
      filters,
      {
        summary: {
          income: this.roundMoney(
            chart.reduce((sum, row) => sum + row.income, 0),
          ),
          outflow: this.roundMoney(
            chart.reduce((sum, row) => sum + row.operational + row.expenses, 0),
          ),
          netFlow: this.roundMoney(
            chart.reduce((sum, row) => sum + row.total, 0),
          ),
        },
        chart,
        rows: tableRows,
        data: {
          months: rows.map((row) => ({ key: row.key, label: row.label })),
          rows: tableRows,
        },
      },
    );
  }

  private redirectReport(filters: AnalyticsFilters): ChartPayload {
    return this.reportPayload(
      "patient-analysis",
      "redirect",
      "Analisis de pacientes",
      "Navegacion al modulo existente de pacientes.",
      filters,
      {
        summary: {},
        chart: [],
        rows: [],
        data: { destination: "/pacientes/analisis" },
      },
    );
  }

  private async expensesReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const anchorMonth = this.monthKey(filters.end, filters.timezone);
    const start = this.zonedMonthRange(
      this.shiftMonthKey(anchorMonth, -11),
      filters.timezone,
    ).start;
    const end = this.zonedMonthRange(anchorMonth, filters.timezone).end;
    const months = this.monthWindows(start, end, filters.timezone);
    const expenses = await this.prisma.expense.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        status: { not: "VOIDED" },
        OR: [
          { accountingDate: { gte: start, lte: end } },
          { paidAt: { gte: start, lte: end } },
          { accountingDate: null },
        ],
      },
      select: {
        total: true,
        accountingDate: true,
        paidAt: true,
        category: { select: { name: true } },
      },
    });
    const build = (field: "accountingDate" | "paidAt") => {
      const categories = [
        ...new Set(expenses.map((row) => row.category.name)),
      ].sort();
      const rows = categories.map((category) => ({
        label: category,
        values: months.map(() => 0),
      }));
      const byCategory = new Map(rows.map((row) => [row.label, row]));
      for (const expense of expenses) {
        const date = expense[field];
        if (!date) continue;
        const index = months.findIndex(
          (month) => month.key === this.monthKey(date, filters.timezone),
        );
        if (index >= 0)
          byCategory.get(expense.category.name)!.values[index] += Number(
            expense.total,
          );
      }
      rows.forEach((row) => {
        row.values = row.values.map((value) => this.roundMoney(value));
      });
      return {
        rows,
        totals: months.map((_, index) =>
          this.roundMoney(
            rows.reduce((sum, row) => sum + row.values[index], 0),
          ),
        ),
      };
    };
    const accounting = build("accountingDate");
    const paid = build("paidAt");
    const unclassified = expenses
      .filter((row) => !row.accountingDate)
      .reduce((sum, row) => sum + Number(row.total), 0);
    return this.reportPayload(
      "expenses",
      "matrix",
      "Gastos",
      "Correspondencia contable y desembolso real en matrices separadas.",
      { ...filters, start, end },
      {
        summary: {
          unclassified: this.roundMoney(unclassified),
          count: expenses.length,
        },
        chart: [],
        rows: [],
        data: {
          months,
          accounting: {
            ...accounting,
            unclassified: this.roundMoney(unclassified),
          },
          paid,
        },
      },
    );
  }

  private async professionalEfficiencyReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
    type: ChartReportType,
  ): Promise<ChartPayload> {
    if (type === "professional-ranking")
      return this.professionalRankingReport(actor, filters);
    const [items, appointments, budgets] = await Promise.all([
      this.prisma.treatmentPlanItem.findMany({
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: filters.start, lte: filters.end },
          treatmentPlan: {
            organizationId: actor.organizationId,
            branchId: filters.branchWhere,
            isAlternative: false,
          },
        },
        select: {
          total: true,
          performedAmount: true,
          treatmentPlan: {
            select: {
              professionalId: true,
              professional: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          status: { in: ATTENDED_STATUSES },
          startAt: { gte: filters.start, lte: filters.end },
        },
        select: {
          professionalId: true,
          durationMinutes: true,
          professional: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.budget.findMany({
        where: {
          organizationId: actor.organizationId,
          status: { not: BudgetStatus.DRAFT },
          createdAt: { gte: filters.start, lte: filters.end },
          treatmentPlan: {
            branchId: filters.branchWhere,
            isAlternative: false,
          },
        },
        select: {
          total: true,
          professionalId: true,
          professional: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    const map = new Map<
      string,
      {
        professional: string;
        sales: number;
        attendedHours: number;
        budgeted: number;
      }
    >();
    const ensure = (id: string, firstName: string, lastName: string) => {
      const row = map.get(id) ?? {
        professional: `${firstName} ${lastName}`.trim(),
        sales: 0,
        attendedHours: 0,
        budgeted: 0,
      };
      map.set(id, row);
      return row;
    };
    for (const item of items)
      ensure(
        item.treatmentPlan.professionalId,
        item.treatmentPlan.professional.firstName,
        item.treatmentPlan.professional.lastName,
      ).sales +=
        Number(item.performedAmount) > 0
          ? Number(item.performedAmount)
          : Number(item.total);
    for (const appointment of appointments)
      ensure(
        appointment.professionalId,
        appointment.professional.firstName,
        appointment.professional.lastName,
      ).attendedHours += appointment.durationMinutes / 60;
    for (const budget of budgets)
      ensure(
        budget.professionalId,
        budget.professional.firstName,
        budget.professional.lastName,
      ).budgeted += Number(budget.total);
    const rows = [...map.values()]
      .map((row) => ({
        ...row,
        sales: this.roundMoney(row.sales),
        attendedHours: this.roundMoney(row.attendedHours),
        salesPerHour:
          row.attendedHours > 0
            ? this.roundMoney(row.sales / row.attendedHours)
            : null,
        budgeted: this.roundMoney(row.budgeted),
      }))
      .sort((a, b) => b.sales - a.sales);
    return this.reportPayload(
      "professional-efficiency",
      "table",
      "Eficiencia por profesional",
      "Ventas y presupuestos frente a horas realmente atendidas.",
      filters,
      { summary: { professionals: rows.length }, chart: [], rows },
    );
  }

  private async salesByProcedureReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const rows = await this.completedItemRows(actor, filters);
    const map = new Map<
      string,
      { procedure: string; category: string; total: number; count: number }
    >();
    for (const row of rows) {
      const category =
        row.priceSnapshotCategory ??
        row.priceListItem?.priceListCategory?.name ??
        row.procedure.category?.name ??
        "Sin categoria";
      const current = map.get(row.procedure.id) ?? {
        procedure: row.procedure.name,
        category,
        total: 0,
        count: 0,
      };
      current.total +=
        Number(row.performedAmount) > 0
          ? Number(row.performedAmount)
          : Number(row.total);
      current.count += Number(row.quantity ?? 1);
      map.set(row.procedure.id, current);
    }
    const limit = [25, 50, 100].includes(Number(filters.limit))
      ? Number(filters.limit)
      : 50;
    const detail = [...map.values()]
      .map((row) => ({
        ...row,
        total: this.roundMoney(row.total),
        count: this.roundMoney(row.count),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
    return this.reportPayload(
      "sales-by-procedure",
      "table",
      "Ventas por prestacion",
      "Ventas realizadas agrupadas por prestacion.",
      filters,
      {
        summary: {
          total: this.roundMoney(
            detail.reduce((sum, row) => sum + row.total, 0),
          ),
          procedures: map.size,
        },
        chart: [],
        rows: detail,
        data: { limit },
      },
    );
  }

  private async salesByCategoryReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const rows = await this.completedItemRows(actor, filters);
    const map = new Map<string, { total: number; count: number }>();
    for (const row of rows) {
      const key =
        row.priceSnapshotCategory ??
        row.priceListItem?.priceListCategory?.name ??
        row.procedure.category?.name ??
        "Sin categoria";
      const current = map.get(key) ?? { total: 0, count: 0 };
      current.total +=
        Number(row.performedAmount) > 0
          ? Number(row.performedAmount)
          : Number(row.total);
      current.count += Number(row.quantity ?? 1);
      map.set(key, current);
    }
    const detail = [...map.entries()]
      .map(([category, value]) => ({
        category,
        total: this.roundMoney(value.total),
        count: this.roundMoney(value.count),
      }))
      .sort((a, b) => b.total - a.total);
    return this.reportPayload(
      "sales-by-category",
      "table",
      "Ventas por categoria",
      "Ventas realizadas agrupadas por categoria.",
      filters,
      {
        summary: {
          total: this.roundMoney(
            detail.reduce((sum, row) => sum + row.total, 0),
          ),
          categories: detail.length,
        },
        chart: [],
        rows: detail,
      },
    );
  }

  private async budgetCaptureReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const facts = await this.budgetFacts(
      actor,
      filters,
      filters.start,
      filters.end,
    );
    const months = this.monthWindows(
      filters.start,
      filters.end,
      filters.timezone,
    );
    const segmentKeys = [
      ...new Set(
        facts.flatMap((fact) =>
          fact.capturedAt
            ? [this.monthKey(fact.capturedAt, filters.timezone)]
            : [],
        ),
      ),
    ].sort();
    const chart = months.map((month) => {
      const cohort = facts.filter(
        (fact) => this.monthKey(fact.createdAt, filters.timezone) === month.key,
      );
      const generated = cohort.reduce((sum, fact) => sum + fact.total, 0);
      const row: Record<string, unknown> = {
        label: month.label,
        month: month.key,
        generated: this.roundMoney(generated),
      };
      let captured = 0;
      for (const key of segmentKeys) {
        const amount = cohort
          .filter(
            (fact) =>
              fact.capturedAt &&
              this.monthKey(fact.capturedAt, filters.timezone) === key,
          )
          .reduce((sum, fact) => sum + fact.total, 0);
        row[key] = this.roundMoney(amount);
        captured += amount;
      }
      row.pending = this.roundMoney(Math.max(0, generated - captured));
      return row;
    });
    return this.reportPayload(
      "budget-capture-efficiency",
      "stacked-cohort",
      "Eficiencia de captacion de presupuestos",
      "Cohortes por mes de generacion y mes efectivo de captura.",
      filters,
      {
        summary: {
          generated: this.roundMoney(
            facts.reduce((sum, fact) => sum + fact.total, 0),
          ),
          captured: this.roundMoney(
            facts
              .filter((fact) => fact.capturedAt)
              .reduce((sum, fact) => sum + fact.total, 0),
          ),
          rate: this.percent(
            facts
              .filter((fact) => fact.capturedAt)
              .reduce((sum, fact) => sum + fact.total, 0),
            facts.reduce((sum, fact) => sum + fact.total, 0),
          ),
        },
        chart,
        rows: [],
        data: { segmentKeys, months },
      },
    );
  }

  private async dailyCollectionReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const [branches, payments, budgets] = await Promise.all([
      this.prisma.branch.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: filters.branchIds },
          deletedAt: null,
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          paidAt: { gte: filters.start, lte: filters.end },
          status: { in: RECEIVED_PAYMENT_STATUSES },
        },
        select: {
          branchId: true,
          amount: true,
          paymentMethod: {
            select: { name: true, includeInCollectionReports: true },
          },
          splits: {
            select: {
              amount: true,
              paymentMethod: {
                select: { name: true, includeInCollectionReports: true },
              },
            },
          },
        },
      }),
      this.prisma.budget.findMany({
        where: {
          organizationId: actor.organizationId,
          status: { not: BudgetStatus.DRAFT },
          createdAt: { gte: filters.start, lte: filters.end },
          treatmentPlan: {
            branchId: filters.branchWhere,
            isAlternative: false,
          },
        },
        select: { total: true, treatmentPlan: { select: { branchId: true } } },
      }),
    ]);
    const columns = [
      { id: "all", label: "Consolidado (todas)" },
      ...branches.map((branch) => ({ id: branch.id, label: branch.name })),
    ];
    const paymentCells = new Map<
      string,
      Map<string, { amount: number; count: number }>
    >();
    for (const payment of payments) {
      const parts = payment.splits.length
        ? payment.splits.map((split) => ({
            amount: Number(split.amount),
            method: split.paymentMethod.name,
            included: split.paymentMethod.includeInCollectionReports,
          }))
        : [
            {
              amount: Number(payment.amount),
              method: payment.paymentMethod?.name ?? "Sin medio registrado",
              included:
                payment.paymentMethod?.includeInCollectionReports !== false,
            },
          ];
      for (const part of parts) {
        if (!part.included) continue;
        const byBranch =
          paymentCells.get(part.method) ??
          new Map<string, { amount: number; count: number }>();
        const cell = byBranch.get(payment.branchId) ?? { amount: 0, count: 0 };
        cell.amount += part.amount;
        cell.count += 1;
        byBranch.set(payment.branchId, cell);
        paymentCells.set(part.method, byBranch);
      }
    }
    const cellsFor = (map: Map<string, { amount: number; count: number }>) =>
      columns.map((column) =>
        column.id === "all"
          ? {
              amount: this.roundMoney(
                [...map.values()].reduce((sum, cell) => sum + cell.amount, 0),
              ),
              count: [...map.values()].reduce(
                (sum, cell) => sum + cell.count,
                0,
              ),
            }
          : {
              amount: this.roundMoney(map.get(column.id)?.amount ?? 0),
              count: map.get(column.id)?.count ?? 0,
            },
      );
    const budgetMap = new Map<string, { amount: number; count: number }>();
    for (const budget of budgets) {
      const cell = budgetMap.get(budget.treatmentPlan.branchId) ?? {
        amount: 0,
        count: 0,
      };
      cell.amount += Number(budget.total);
      cell.count += 1;
      budgetMap.set(budget.treatmentPlan.branchId, cell);
    }
    const methodRows = [...paymentCells.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, map]) => ({
        label,
        section: "payment-method",
        cells: cellsFor(map),
      }));
    const totalMap = new Map<string, { amount: number; count: number }>();
    for (const map of paymentCells.values())
      for (const [branchId, value] of map) {
        const cell = totalMap.get(branchId) ?? { amount: 0, count: 0 };
        cell.amount += value.amount;
        cell.count += value.count;
        totalMap.set(branchId, cell);
      }
    const rows = [
      {
        label: "Presupuestos generados",
        section: "budgets",
        cells: cellsFor(budgetMap),
      },
      { label: "Total recaudado", section: "total", cells: cellsFor(totalMap) },
      {
        label: "Medios de Pago",
        section: "heading",
        cells: columns.map(() => ({ amount: 0, count: 0 })),
      },
      ...methodRows,
    ];
    return this.reportPayload(
      "daily-collection",
      "matrix",
      "Informe de recaudacion diario",
      "Presupuestos y cobranza por sucursal y medio de pago.",
      filters,
      {
        summary: {
          total: this.roundMoney(
            [...totalMap.values()].reduce((sum, cell) => sum + cell.amount, 0),
          ),
          payments: payments.length,
        },
        chart: [],
        rows,
        data: { columns, rows, date: filters.start.toISOString() },
        exportCode: "DAILY_COLLECTION",
      },
    );
  }

  private async delinquentPatientsReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const installments = await this.prisma.installment.findMany({
      where: {
        dueDate: { lte: filters.end },
        status: {
          in: [
            InstallmentStatus.PENDING,
            InstallmentStatus.PARTIAL,
            InstallmentStatus.OVERDUE,
          ],
        },
        patient: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          deletedAt: null,
          ...(filters.search
            ? {
                OR: [
                  {
                    firstName: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                  {
                    lastName: { contains: filters.search, mode: "insensitive" },
                  },
                  {
                    documentNumber: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },
      },
      select: {
        amount: true,
        paidAmount: true,
        dueDate: true,
        status: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            alternatePhone: true,
            email: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
    const patientIds = [...new Set(installments.map((row) => row.patient.id))];
    const balances = await this.patientBalances(
      actor,
      patientIds,
      filters.branchWhere,
    );
    const map = new Map<
      string,
      {
        patientId: string;
        patient: string;
        phone: string | null;
        mobile: string | null;
        email: string | null;
        upTo30: number;
        between31And60: number;
        over60: number;
        total: number;
        balance: number;
      }
    >();
    for (const installment of installments) {
      const remaining = Math.max(
        0,
        Number(installment.amount) - Number(installment.paidAmount),
      );
      const days = Math.max(
        0,
        Math.floor(
          (filters.end.getTime() - installment.dueDate.getTime()) / 86400000,
        ),
      );
      const current = map.get(installment.patient.id) ?? {
        patientId: installment.patient.id,
        patient:
          `${installment.patient.firstName} ${installment.patient.lastName}`.trim(),
        phone: installment.patient.phone,
        mobile: installment.patient.alternatePhone,
        email: installment.patient.email,
        upTo30: 0,
        between31And60: 0,
        over60: 0,
        total: 0,
        balance: this.roundMoney(balances.get(installment.patient.id) ?? 0),
      };
      if (days <= 30) current.upTo30 += remaining;
      else if (days <= 60) current.between31And60 += remaining;
      else current.over60 += remaining;
      current.total += remaining;
      map.set(installment.patient.id, current);
    }
    const needle = filters.search?.trim().toLocaleLowerCase("es-MX");
    const allRows = [...map.values()]
      .map((row) => ({
        ...row,
        upTo30: this.roundMoney(row.upTo30),
        between31And60: this.roundMoney(row.between31And60),
        over60: this.roundMoney(row.over60),
        total: this.roundMoney(row.total),
      }))
      .filter(
        (row) =>
          !needle ||
          `${row.patient} ${row.phone ?? ""} ${row.mobile ?? ""} ${row.email ?? ""}`
            .toLocaleLowerCase("es-MX")
            .includes(needle),
      )
      .sort((a, b) => b.total - a.total);
    const start = (filters.page - 1) * filters.pageSize;
    const rows = allRows.slice(start, start + filters.pageSize);
    return this.reportPayload(
      "delinquent-patients",
      "table",
      "Pacientes morosos",
      "Deuda vencida agrupada por antiguedad.",
      filters,
      {
        summary: {
          total: this.roundMoney(
            allRows.reduce((sum, row) => sum + row.total, 0),
          ),
          patients: allRows.length,
        },
        chart: [],
        rows,
        data: {
          pagination: {
            page: filters.page,
            pageSize: filters.pageSize,
            total: allRows.length,
          },
        },
      },
    );
  }

  private async financingStatusReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const anchorMonth = this.monthKey(filters.start, filters.timezone);
    const start = this.zonedMonthRange(anchorMonth, filters.timezone).start;
    const end = this.zonedMonthRange(
      this.shiftMonthKey(anchorMonth, 11),
      filters.timezone,
    ).end;
    const months = this.monthWindows(start, end, filters.timezone);
    const installments = await this.prisma.installment.findMany({
      where: {
        dueDate: { gte: start, lte: end },
        installmentPlan: {
          organizationId: actor.organizationId,
          treatmentPlan: {
            branchId: filters.branchWhere,
            isAlternative: false,
          },
        },
      },
      select: {
        amount: true,
        paidAmount: true,
        dueDate: true,
        installmentPlan: {
          select: {
            id: true,
            patient: { select: { firstName: true, lastName: true } },
            treatmentPlan: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
    const map = new Map<
      string,
      {
        label: string;
        treatmentPlanId: string;
        cells: Array<{ amount: number; paid: number; status: string } | null>;
      }
    >();
    for (const installment of installments) {
      const plan = installment.installmentPlan;
      const row = map.get(plan.id) ?? {
        label: `${plan.patient.firstName} ${plan.patient.lastName}`.trim(),
        treatmentPlanId: plan.treatmentPlan.id,
        cells: months.map(() => null),
      };
      const index = months.findIndex(
        (month) =>
          month.key === this.monthKey(installment.dueDate, filters.timezone),
      );
      if (index >= 0) {
        const amount = Number(installment.amount);
        const paid = Number(installment.paidAmount);
        row.cells[index] = {
          amount: this.roundMoney(amount),
          paid: this.roundMoney(paid),
          status: this.installmentPaymentStatus(amount, paid),
        };
      }
      map.set(plan.id, row);
    }
    const rows = [...map.values()];
    const totals = months.map((_, index) =>
      this.roundMoney(
        rows.reduce((sum, row) => sum + (row.cells[index]?.amount ?? 0), 0),
      ),
    );
    const collected = months.map((_, index) =>
      this.roundMoney(
        rows.reduce((sum, row) => sum + (row.cells[index]?.paid ?? 0), 0),
      ),
    );
    return this.reportPayload(
      "financing-status",
      "matrix",
      "Estado de financiamientos",
      "Cuotas esperadas y pagos asociados por mes.",
      { ...filters, start, end },
      {
        summary: {
          expected: this.roundMoney(
            totals.reduce((sum, value) => sum + value, 0),
          ),
          collected: this.roundMoney(
            collected.reduce((sum, value) => sum + value, 0),
          ),
        },
        chart: [],
        rows,
        data: { months, rows, totals, collected },
      },
    );
  }

  private async payrollDiscountReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const anchorMonth = this.monthKey(filters.start, filters.timezone);
    const start = this.zonedMonthRange(anchorMonth, filters.timezone).start;
    const end = this.zonedMonthRange(
      this.shiftMonthKey(anchorMonth, 11),
      filters.timezone,
    ).end;
    const months = this.monthWindows(start, end, filters.timezone);
    const charges = await this.prisma.agreementCharge.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        dueDate: { gte: start, lte: end },
        payrollDiscountPlan: { status: { not: "CANCELLED" } },
      },
      select: {
        originalAmount: true,
        paidAmount: true,
        dueDate: true,
        payrollDiscountPlan: {
          select: {
            id: true,
            patient: { select: { firstName: true, lastName: true } },
            company: { select: { legalName: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
    const map = new Map<
      string,
      {
        label: string;
        company: string;
        cells: Array<{ amount: number; paid: number; status: string } | null>;
      }
    >();
    for (const charge of charges) {
      const plan = charge.payrollDiscountPlan;
      const row = map.get(plan.id) ?? {
        label: `${plan.patient.firstName} ${plan.patient.lastName}`.trim(),
        company: plan.company.legalName,
        cells: months.map(() => null),
      };
      const index = months.findIndex(
        (month) =>
          month.key === this.monthKey(charge.dueDate, filters.timezone),
      );
      if (index >= 0) {
        const amount = Number(charge.originalAmount);
        const paid = Number(charge.paidAmount);
        row.cells[index] = {
          amount: this.roundMoney(amount),
          paid: this.roundMoney(paid),
          status: this.installmentPaymentStatus(amount, paid),
        };
      }
      map.set(plan.id, row);
    }
    const rows = [...map.values()];
    const totals = months.map((_, index) =>
      this.roundMoney(
        rows.reduce((sum, row) => sum + (row.cells[index]?.amount ?? 0), 0),
      ),
    );
    const collected = months.map((_, index) =>
      this.roundMoney(
        rows.reduce((sum, row) => sum + (row.cells[index]?.paid ?? 0), 0),
      ),
    );
    return this.reportPayload(
      "payroll-discount-status",
      "matrix",
      "Estado de descuento por planilla",
      "Cuotas de convenio y pagos asociados por mes.",
      { ...filters, start, end },
      {
        summary: {
          expected: this.roundMoney(
            totals.reduce((sum, value) => sum + value, 0),
          ),
          collected: this.roundMoney(
            collected.reduce((sum, value) => sum + value, 0),
          ),
        },
        chart: [],
        rows,
        data: { months, rows, totals, collected },
      },
    );
  }

  private async referralsReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const referrals = await this.prisma.treatmentPlanReferral.findMany({
      where: {
        organizationId: actor.organizationId,
        createdAt: { gte: filters.start, lte: filters.end },
        AND: [
          {
            OR: [
              { fromBranchId: filters.branchWhere },
              { toBranchId: filters.branchWhere },
            ],
          },
          ...(filters.professionalId
            ? [
                {
                  OR: [
                    { fromProfessionalId: filters.professionalId },
                    { toProfessionalId: filters.professionalId },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        reason: true,
        createdAt: true,
        fromBranchId: true,
        toBranchId: true,
        fromProfessionalId: true,
        toProfessionalId: true,
        treatmentPlan: { select: { id: true } },
        destinationTreatmentPlan: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const branchIds = [
      ...new Set(
        referrals.flatMap((row) => [row.fromBranchId, row.toBranchId]),
      ),
    ];
    const professionalIds = [
      ...new Set(
        referrals
          .flatMap((row) => [row.fromProfessionalId, row.toProfessionalId])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [branches, professionals] = await Promise.all([
      this.prisma.branch.findMany({
        where: { organizationId: actor.organizationId, id: { in: branchIds } },
        select: { id: true, name: true },
      }),
      this.prisma.professional.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: professionalIds },
        },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);
    const branchMap = new Map(branches.map((row) => [row.id, row.name]));
    const professionalMap = new Map(
      professionals.map((row) => [
        row.id,
        `${row.firstName} ${row.lastName}`.trim(),
      ]),
    );
    const allRows = referrals.map((row) => ({
      id: row.id,
      fromBranch: branchMap.get(row.fromBranchId) ?? row.fromBranchId,
      fromProfessional: row.fromProfessionalId
        ? (professionalMap.get(row.fromProfessionalId) ??
          row.fromProfessionalId)
        : "—",
      fromTreatmentPlanId: row.treatmentPlan.id,
      toBranch: branchMap.get(row.toBranchId) ?? row.toBranchId,
      toProfessional: row.toProfessionalId
        ? (professionalMap.get(row.toProfessionalId) ?? row.toProfessionalId)
        : "—",
      toTreatmentPlanId: row.destinationTreatmentPlan?.id ?? null,
      date: row.createdAt.toISOString(),
      reason: row.reason,
    }));
    const start = (filters.page - 1) * filters.pageSize;
    const rows = allRows.slice(start, start + filters.pageSize);
    return this.reportPayload(
      "patient-referrals",
      "table",
      "Derivacion de pacientes",
      "Derivaciones de tratamientos registradas entre sucursales y profesionales.",
      filters,
      {
        summary: {
          referrals: allRows.length,
          unlinkedHistorical: allRows.filter((row) => !row.toTreatmentPlanId)
            .length,
        },
        chart: [],
        rows,
        data: {
          pagination: {
            page: filters.page,
            pageSize: filters.pageSize,
            total: allRows.length,
          },
        },
        exportCode: "PATIENT_REFERRALS",
      },
    );
  }

  private async capturedBudgetsReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const anchorMonth = this.monthKey(filters.end, filters.timezone);
    const end = this.zonedMonthRange(anchorMonth, filters.timezone).end;
    const start = this.zonedMonthRange(
      this.shiftMonthKey(anchorMonth, -2),
      filters.timezone,
    ).start;
    const scopedFilters = { ...filters, start, end };
    const facts = await this.budgetFacts(actor, scopedFilters, start, end);
    const months = this.monthWindows(start, end, filters.timezone);
    const map = new Map<
      string,
      {
        professionalId: string;
        professional: string;
        specialty: string;
        emitted: number;
        captured: number;
        monthlyEmitted: number[];
        monthlyCaptured: number[];
      }
    >();
    for (const fact of facts) {
      if (
        filters.professionalId &&
        fact.professionalId !== filters.professionalId
      )
        continue;
      if (filters.specialtyId && fact.specialtyId !== filters.specialtyId)
        continue;
      const row = map.get(fact.professionalId) ?? {
        professionalId: fact.professionalId,
        professional: fact.professional,
        specialty: fact.specialty,
        emitted: 0,
        captured: 0,
        monthlyEmitted: months.map(() => 0),
        monthlyCaptured: months.map(() => 0),
      };
      const index = months.findIndex(
        (month) =>
          month.key === this.monthKey(fact.createdAt, filters.timezone),
      );
      row.emitted += fact.total;
      if (index >= 0) row.monthlyEmitted[index] += fact.total;
      if (fact.capturedAt) {
        row.captured += fact.total;
        if (index >= 0) row.monthlyCaptured[index] += fact.total;
      }
      map.set(fact.professionalId, row);
    }
    const rows = [...map.values()]
      .map((row) => ({
        professionalId: row.professionalId,
        professional: row.professional,
        specialty: row.specialty,
        emitted: this.roundMoney(row.emitted),
        captured: this.roundMoney(row.captured),
        captureRate: this.percent(row.captured, row.emitted),
        monthlyRates: row.monthlyEmitted.map((value, index) =>
          this.percent(row.monthlyCaptured[index], value),
        ),
      }))
      .sort(
        (a, b) =>
          b.captureRate - a.captureRate ||
          a.professional.localeCompare(b.professional),
      );
    const chart = rows.map((row) => ({
      label: row.professional,
      rate: row.captureRate,
    }));
    return this.reportPayload(
      "captured-budgets",
      "captured-budgets",
      "Presupuestos capturados",
      "Captacion por profesional en una ventana movil de tres meses.",
      { ...filters, start, end },
      {
        summary: {
          emitted: this.roundMoney(
            rows.reduce((sum, row) => sum + row.emitted, 0),
          ),
          captured: this.roundMoney(
            rows.reduce((sum, row) => sum + row.captured, 0),
          ),
          rate: this.percent(
            rows.reduce((sum, row) => sum + row.captured, 0),
            rows.reduce((sum, row) => sum + row.emitted, 0),
          ),
        },
        chart,
        rows,
        data: { months },
        exportCode: "CAPTURED_BUDGETS",
      },
    );
  }

  private async professionalRankingReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const facts = await this.budgetFacts(
      actor,
      filters,
      filters.start,
      filters.end,
    );
    const map = new Map<
      string,
      { professional: string; generated: number; captured: number }
    >();
    for (const fact of facts) {
      const row = map.get(fact.professionalId) ?? {
        professional: fact.professional,
        generated: 0,
        captured: 0,
      };
      row.generated += 1;
      if (fact.capturedAt) row.captured += 1;
      map.set(fact.professionalId, row);
    }
    const rows = [...map.values()]
      .map((row) => ({
        ...row,
        rate: this.percent(row.captured, row.generated),
      }))
      .sort((a, b) => b.rate - a.rate || b.captured - a.captured);
    return this.reportPayload(
      "professional-ranking",
      "table",
      "Ranking de profesionales",
      "Presupuestos generados y capturados por profesional.",
      filters,
      {
        summary: {
          professionals: rows.length,
          generated: rows.reduce((sum, row) => sum + row.generated, 0),
          captured: rows.reduce((sum, row) => sum + row.captured, 0),
        },
        chart: [],
        rows,
      },
    );
  }

  private async budgetFacts(
    actor: AuthUser,
    filters: AnalyticsFilters,
    start: Date,
    end: Date,
  ) {
    const budgets = await this.prisma.budget.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { not: BudgetStatus.DRAFT },
        createdAt: { gte: start, lte: end },
        treatmentPlan: { branchId: filters.branchWhere, isAlternative: false },
      },
      select: {
        id: true,
        total: true,
        createdAt: true,
        professionalId: true,
        professional: { select: { firstName: true, lastName: true } },
        treatmentPlan: {
          select: {
            specialtyId: true,
            specialtySnapshotName: true,
            specialty: { select: { name: true } },
          },
        },
        items: {
          select: {
            treatmentPlanItem: {
              select: {
                status: true,
                completedAt: true,
                paymentAllocations: {
                  where: {
                    payment: { status: { in: RECEIVED_PAYMENT_STATUSES } },
                  },
                  select: { payment: { select: { paidAt: true } } },
                },
              },
            },
          },
        },
      },
    });
    return budgets.map((budget) => {
      const captureDates: Date[] = [];
      for (const item of budget.items) {
        if (
          item.treatmentPlanItem.status === TreatmentPlanItemStatus.COMPLETED &&
          item.treatmentPlanItem.completedAt
        )
          captureDates.push(item.treatmentPlanItem.completedAt);
        for (const allocation of item.treatmentPlanItem.paymentAllocations)
          captureDates.push(allocation.payment.paidAt);
      }
      captureDates.sort((a, b) => a.getTime() - b.getTime());
      return {
        id: budget.id,
        total: this.money(budget.total),
        createdAt: budget.createdAt,
        capturedAt: captureDates[0] ?? null,
        professionalId: budget.professionalId,
        professional:
          `${budget.professional.firstName} ${budget.professional.lastName}`.trim(),
        specialtyId: budget.treatmentPlan.specialtyId,
        specialty:
          budget.treatmentPlan.specialtySnapshotName ??
          budget.treatmentPlan.specialty?.name ??
          "Sin especialidad",
      };
    });
  }

  private async patientBalances(
    actor: AuthUser,
    patientIds: string[],
    branchWhere: string | { in: string[] },
  ) {
    const balances = new Map(patientIds.map((patientId) => [patientId, 0]));
    if (!patientIds.length) return balances;
    const [items, allocations] = await Promise.all([
      this.prisma.treatmentPlanItem.findMany({
        where: {
          status: { not: TreatmentPlanItemStatus.CANCELLED },
          treatmentPlan: {
            organizationId: actor.organizationId,
            patientId: { in: patientIds },
            branchId: branchWhere,
            isAlternative: false,
          },
        },
        select: { total: true, treatmentPlan: { select: { patientId: true } } },
      }),
      this.prisma.paymentAllocation.findMany({
        where: {
          payment: {
            organizationId: actor.organizationId,
            status: { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] },
          },
          treatmentPlanItem: {
            treatmentPlan: {
              organizationId: actor.organizationId,
              patientId: { in: patientIds },
              branchId: branchWhere,
              isAlternative: false,
            },
          },
        },
        select: {
          amount: true,
          settlementDiscountAmount: true,
          treatmentPlanItem: {
            select: { treatmentPlan: { select: { patientId: true } } },
          },
        },
      }),
    ]);
    const planned = new Map<string, number>();
    const settled = new Map<string, number>();
    for (const item of items)
      planned.set(
        item.treatmentPlan.patientId,
        (planned.get(item.treatmentPlan.patientId) ?? 0) + Number(item.total),
      );
    for (const allocation of allocations) {
      const patientId = allocation.treatmentPlanItem.treatmentPlan.patientId;
      settled.set(
        patientId,
        (settled.get(patientId) ?? 0) +
          Number(allocation.amount) +
          Number(allocation.settlementDiscountAmount),
      );
    }
    for (const patientId of patientIds)
      balances.set(
        patientId,
        this.roundMoney(
          Math.max(
            (planned.get(patientId) ?? 0) - (settled.get(patientId) ?? 0),
            0,
          ),
        ),
      );
    return balances;
  }

  private async salesBookReport(
    actor: AuthUser,
    filters: AnalyticsFilters,
  ): Promise<ChartPayload> {
    const rows = await this.completedItemRows(actor, filters);
    return this.reportPayload(
      "sales-book",
      "table",
      "Libro de ventas",
      "Detalle de ventas realizadas por prestacion.",
      filters,
      {
        summary: {
          total: this.roundMoney(
            rows.reduce((sum, row) => sum + Number(row.total), 0),
          ),
          rows: rows.length,
        },
        chart: [],
        rows: rows.map((row) => ({
          completedAt: row.completedAt?.toISOString() ?? null,
          procedure: row.procedure.name,
          category:
            row.priceSnapshotCategory ??
            row.priceListItem?.priceListCategory?.name ??
            "Sin categoria",
          professional:
            `${row.treatmentPlan.professional.firstName} ${row.treatmentPlan.professional.lastName}`.trim(),
          amount: this.money(row.total),
        })),
      },
    );
  }

  private async completedItemRows(actor: AuthUser, filters: AnalyticsFilters) {
    return this.prisma.treatmentPlanItem.findMany({
      where: {
        status: TreatmentPlanItemStatus.COMPLETED,
        completedAt: { gte: filters.start, lte: filters.end },
        treatmentPlan: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          isAlternative: false,
        },
      },
      select: {
        total: true,
        performedAmount: true,
        quantity: true,
        completedAt: true,
        priceSnapshotCategory: true,
        procedure: {
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
          },
        },
        priceListItem: {
          select: { priceListCategory: { select: { name: true } } },
        },
        treatmentPlan: {
          select: {
            professional: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { completedAt: "desc" },
    });
  }

  private reportPayload(
    type: ChartReportType,
    renderer: ChartPayload["renderer"],
    title: string,
    description: string,
    filters: AnalyticsFilters,
    payload: {
      summary: Record<string, number | string>;
      chart: Array<Record<string, unknown>>;
      rows: Array<Record<string, unknown>>;
      data?: Record<string, unknown>;
      exportCode?: string;
    },
  ): ChartPayload {
    return {
      schemaVersion: 2,
      type,
      renderer,
      title,
      description,
      filters: this.publicFilters(filters),
      definitions: this.metricDefinitions(filters),
      ...payload,
    };
  }

  private publicFilters(filters: AnalyticsFilters) {
    return {
      dateFrom: filters.start.toISOString(),
      dateTo: filters.end.toISOString(),
      branchId: filters.branchId ?? null,
      branchName: filters.branchName,
      branchIds: filters.branchIds,
      timezone: filters.timezone,
      currency: filters.currency,
      preset: filters.preset,
      periodMode: filters.periodMode,
      asOf: filters.asOf,
    };
  }

  private metricDefinitions(filters: AnalyticsFilters) {
    return {
      attendedAppointment: {
        definition: "Cita con atencion registrada o paciente en sala/atencion.",
        includedStatuses: ATTENDED_STATUSES,
        excludedStatuses: SCHEDULED_EXCLUDED_STATUSES,
      },
      sale: {
        definition: "Valor de prestaciones realizadas.",
        formula:
          "SUM(TreatmentPlanItem.total) donde status=COMPLETED y completedAt cae en el periodo.",
      },
      collection: {
        definition: "Pagos efectivamente recibidos de pacientes.",
        includedStatuses: RECEIVED_PAYMENT_STATUSES,
        excludedStatuses: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED],
      },
      capturedBudget: {
        definition:
          "Presupuesto no borrador con una prestacion completada o un pago asignado a uno de sus items.",
        formula: "MIN(TreatmentPlanItem.completedAt, Payment.paidAt)",
      },
      period: {
        dateFrom: filters.start.toISOString(),
        dateTo: filters.end.toISOString(),
        mode: filters.periodMode,
        asOf: filters.asOf,
        timezone: filters.timezone,
        currency: filters.currency,
        lastUpdatedAt: new Date().toISOString(),
      },
    };
  }

  private previousRange(start: Date, end: Date) {
    const duration = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return { start: previousStart, end: previousEnd };
  }

  private emptyMonthMap(
    start: Date,
    end: Date,
    timezone = "America/Mexico_City",
  ) {
    return new Map(
      this.monthWindows(start, end, timezone).map((month) => [month.key, 0]),
    );
  }

  private monthWindows(
    start: Date,
    end: Date,
    timezone = "America/Mexico_City",
  ) {
    const rows: Array<{ key: string; label: string }> = [];
    const [startYear, startMonth] = this.monthKey(start, timezone)
      .split("-")
      .map(Number);
    const [endYear, endMonth] = this.monthKey(end, timezone)
      .split("-")
      .map(Number);
    let cursor = new Date(Date.UTC(startYear, startMonth - 1, 1, 12));
    const last = new Date(Date.UTC(endYear, endMonth - 1, 1, 12));
    while (cursor <= last) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      rows.push({
        key,
        label: new Intl.DateTimeFormat("es-MX", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(cursor),
      });
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12),
      );
    }
    return rows;
  }

  private zonedDateStart(date: string, timezone: string) {
    const guess = new Date(`${date}T00:00:00.000Z`);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(guess);
    const part = (type: string) =>
      Number(parts.find((item) => item.type === type)?.value ?? 0);
    const represented = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second"),
    );
    return new Date(guess.getTime() - (represented - guess.getTime()));
  }

  private zonedDateEnd(date: string, timezone: string) {
    return new Date(
      this.zonedDateStart(this.shiftDateKey(date, 1), timezone).getTime() - 1,
    );
  }

  private zonedMonthRange(month: string, timezone: string) {
    const start = this.zonedDateStart(`${month}-01`, timezone);
    const nextMonth = this.shiftMonthKey(month, 1);
    const end = new Date(
      this.zonedDateStart(`${nextMonth}-01`, timezone).getTime() - 1,
    );
    return { start, end };
  }

  private shiftDateKey(date: string, delta: number) {
    const cursor = new Date(`${date}T12:00:00.000Z`);
    cursor.setUTCDate(cursor.getUTCDate() + delta);
    return cursor.toISOString().slice(0, 10);
  }

  private shiftMonthKey(month: string, delta: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    const cursor = new Date(Date.UTC(year, monthNumber - 1 + delta, 1, 12));
    return `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private installmentPaymentStatus(amount: number, paid: number) {
    if (paid >= amount && amount > 0) return "PAID";
    if (paid > 0) return "PARTIAL";
    return "UNPAID";
  }

  private dateKey(date: Date, timezone = "America/Mexico_City") {
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).format(date);
  }

  private monthKey(date: Date, timezone = "America/Mexico_City") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      month: "2-digit",
      timeZone: timezone,
      year: "numeric",
    }).formatToParts(date);
    const year =
      parts.find((part) => part.type === "year")?.value ??
      String(date.getFullYear());
    const month =
      parts.find((part) => part.type === "month")?.value ??
      String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
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
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    while (cursor <= last) {
      if (cursor.getDay() === dayOfWeek) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  private money(value: Prisma.Decimal | number | null | undefined) {
    return this.roundMoney(Number(value ?? 0));
  }

  private variation(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return this.roundMoney(((current - previous) / previous) * 100);
  }

  private percent(part: number, total: number) {
    if (total <= 0) return 0;
    return this.roundMoney((part / total) * 100);
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }
}
