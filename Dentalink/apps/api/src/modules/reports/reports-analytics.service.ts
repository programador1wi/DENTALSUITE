import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  BudgetStatus,
  CashMovementType,
  InstallmentStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanItemStatus
} from "@prisma/client";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { AnalyticsReportQueryDto, ChartReportType, GenerateChartReportDto, ReportsPeriodPreset } from "./dto/reports.dto";

const ATTENDED_STATUSES: AppointmentStatus[] = [AppointmentStatus.COMPLETED, AppointmentStatus.WAITING_ROOM, AppointmentStatus.IN_PROGRESS];
const SCHEDULED_EXCLUDED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.BLOCKED,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_CONFLICT,
  AppointmentStatus.CANCELLED_RESCHEDULED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED
];
const CANCELLED_BY_PATIENT_OR_RESCHEDULE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_RESCHEDULED,
  AppointmentStatus.RESCHEDULED
];
const RECEIVED_PAYMENT_STATUSES: PaymentStatus[] = [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED];
const CAPTURED_BUDGET_STATUSES: BudgetStatus[] = [BudgetStatus.ACCEPTED];

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
};

type ChartPayload = {
  title: string;
  description: string;
  filters: PublicAnalyticsFilters;
  definitions: Record<string, unknown>;
  summary: Record<string, number | string>;
  chart: Array<Record<string, number | string>>;
  rows: Array<Record<string, number | string | null>>;
};

@Injectable()
export class ReportsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPerformanceDashboard(actor: AuthUser, query: AnalyticsReportQueryDto) {
    const filters = await this.resolveFilters(actor, query);
    const previous = this.previousRange(filters.start, filters.end);

    const [
      agenda,
      monthlyAttention,
      currentFinance,
      previousFinance,
      monthlyFinance,
      waitTime,
      production
    ] = await Promise.all([
      this.getAgendaPerformance(actor, filters),
      this.getMonthlyAttention(actor, filters),
      this.getFinancePerformance(actor, filters.start, filters.end, filters.branchWhere),
      this.getFinancePerformance(actor, previous.start, previous.end, filters.branchWhere),
      this.getMonthlyFinance(actor, filters),
      this.getWaitTimeMetrics(actor, filters),
      this.getProductionPerformance(actor, filters)
    ]);

    return {
      filters: this.publicFilters(filters),
      updatedAt: new Date().toISOString(),
      definitions: this.metricDefinitions(filters),
      agenda: {
        ...agenda,
        monthlyAttention
      },
      finance: {
        sales: currentFinance.sales,
        collections: currentFinance.collections,
        previousSales: previousFinance.sales,
        previousCollections: previousFinance.collections,
        salesVariationPercent: this.variation(currentFinance.sales, previousFinance.sales),
        collectionsVariationPercent: this.variation(currentFinance.collections, previousFinance.collections),
        monthly: monthlyFinance
      },
      operation: waitTime,
      production
    };
  }

  getChartsCatalog() {
    return [
      ["results", "Resultados", "Compara ventas realizadas con gastos pagados y costos teoricos."],
      ["money-flow", "Flujos de dinero", "Pagos recibidos, movimientos de caja y gastos pagados."],
      ["patient-analysis", "Analisis de pacientes", "Embudo entre citas agendadas, confirmadas y presupuestos capturados."],
      ["expenses", "Gastos", "Gastos por fecha de gasto y fecha real de pago."],
      ["professional-efficiency", "Eficiencia por profesional", "Ventas realizadas entre horas efectivamente atendidas."],
      ["sales-by-procedure", "Ventas por prestacion", "Produccion realizada agrupada por prestacion."],
      ["sales-by-category", "Ventas por categoria", "Produccion realizada agrupada por categoria de arancel."],
      ["budget-capture-efficiency", "Eficiencia de captacion de presupuestos", "Presupuestos capturados sobre presupuestos generados."],
      ["daily-collection", "Informe de recaudacion diario", "Cobranza recibida por dia y metodo de pago."],
      ["professional-ranking", "Ranking de profesionales", "Profesionales ordenados por ventas realizadas."],
      ["delinquent-patients", "Pacientes morosos", "Pacientes con cuotas vencidas o parcialmente pagadas."],
      ["financing-status", "Estado de financiamientos", "Cuotas agrupadas por estado de financiamiento."],
      ["payroll-discount-status", "Estado de descuento por planilla", "Descuentos por planilla agrupados por estado."],
      ["patient-referrals", "Derivacion de pacientes", "Derivaciones de tratamientos entre sucursales y profesionales."],
      ["captured-budgets", "Presupuestos capturados", "Presupuestos aceptados y montos capturados."],
      ["sales-book", "Libro de ventas", "Detalle exportable de ventas realizadas por prestacion."]
    ].map(([type, title, description]) => ({ type, title, description }));
  }

  async generateChartReport(actor: AuthUser, type: ChartReportType, query: GenerateChartReportDto): Promise<ChartPayload> {
    const filters = await this.resolveFilters(actor, query);

    switch (type) {
      case "results":
        return this.resultsReport(actor, filters);
      case "money-flow":
        return this.moneyFlowReport(actor, filters);
      case "patient-analysis":
        return this.patientAnalysisReport(actor, filters);
      case "expenses":
        return this.expensesReport(actor, filters);
      case "professional-efficiency":
      case "professional-ranking":
        return this.professionalEfficiencyReport(actor, filters, type);
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

  async resolveFilters(actor: AuthUser, query: AnalyticsReportQueryDto): Promise<AnalyticsFilters> {
    const preset = query.preset ?? (query.dateFrom || query.dateTo ? ReportsPeriodPreset.CUSTOM : ReportsPeriodPreset.MONTH);
    const now = new Date();
    let start: Date;
    let end: Date;

    if (preset === ReportsPeriodPreset.LAST_30_DAYS) {
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (preset === ReportsPeriodPreset.CUSTOM) {
      if (!query.dateFrom || !query.dateTo) throw new BadRequestException("dateFrom and dateTo are required for custom reports");
      start = new Date(query.dateFrom);
      end = new Date(query.dateTo);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      const parsedMonth = query.month ? Number(query.month) : now.getMonth() + 1;
      const parsedYear = query.year ? Number(query.year) : now.getFullYear();
      if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 || !Number.isInteger(parsedYear)) {
        throw new BadRequestException("Invalid month or year");
      }
      start = new Date(parsedYear, parsedMonth - 1, 1);
      end = new Date(parsedYear, parsedMonth, 0, 23, 59, 59, 999);
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException("Invalid report range");
    }

    const branchWhere = branchScope(actor, query.branchId);
    let branchName = "Todas las sucursales autorizadas";
    let branchIds = [...actor.branchIds];
    let timezone = "America/Mexico_City";

    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: query.branchId, organizationId: actor.organizationId, deletedAt: null },
        select: { id: true, name: true, timezone: true }
      });
      if (!branch) throw new NotFoundException("Branch not found");
      branchName = branch.name;
      branchIds = [branch.id];
      timezone = branch.timezone ?? timezone;
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
      preset
    };
  }

  private async getAgendaPerformance(actor: AuthUser, filters: AnalyticsFilters) {
    const appointmentWhere: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      branchId: filters.branchWhere,
      patientId: { not: null },
      startAt: { gte: filters.start, lte: filters.end }
    };

    const [appointments, newPatients, diagnosticBudgets] = await Promise.all([
      this.prisma.appointment.findMany({
        where: appointmentWhere,
        select: { id: true, status: true, durationMinutes: true, professionalId: true, branchId: true }
      }),
      this.prisma.patient.count({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          deletedAt: null,
          createdAt: { gte: filters.start, lte: filters.end },
          OR: [
            { clinicalEvolutions: { some: { createdAt: { gte: filters.start, lte: filters.end }, annulledAt: null } } },
            { treatmentPlans: { some: { createdAt: { gte: filters.start, lte: filters.end }, isAlternative: false } } }
          ]
        }
      }),
      this.prisma.budget.count({
        where: {
          organizationId: actor.organizationId,
          createdAt: { gte: filters.start, lte: filters.end },
          treatmentPlan: {
            branchId: filters.branchWhere,
            isAlternative: false,
            appointments: { some: { reason: { contains: "diagn", mode: "insensitive" } } }
          }
        }
      })
    ]);

    const scheduled = appointments.filter((row) => !SCHEDULED_EXCLUDED_STATUSES.includes(row.status)).length;
    const attended = appointments.filter((row) => ATTENDED_STATUSES.includes(row.status)).length;
    const cancelled = appointments.filter((row) => CANCELLED_BY_PATIENT_OR_RESCHEDULE_STATUSES.includes(row.status)).length;
    const usedMinutes = appointments
      .filter((row) => ATTENDED_STATUSES.includes(row.status))
      .reduce((sum, row) => sum + row.durationMinutes, 0);
    const availableMinutes = await this.computeAvailableMinutes(actor, filters, [
      ...new Set(appointments.map((row) => row.professionalId))
    ]);

    return {
      newPatients,
      cancelledAppointments: cancelled,
      occupancy: {
        usedMinutes,
        availableMinutes,
        percent: availableMinutes > 0 ? this.percent(usedMinutes, availableMinutes) : 0
      },
      diagnosticBudgets,
      attendedVsScheduled: {
        attended,
        scheduled,
        percent: scheduled > 0 ? this.percent(attended, scheduled) : 0
      }
    };
  }

  private async getMonthlyAttention(actor: AuthUser, filters: AnalyticsFilters) {
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
        startAt: { gte: start, lte: filters.end }
      },
      select: { startAt: true }
    });

    const map = this.emptyMonthMap(start, filters.end);
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
    branchWhere: string | { in: string[] }
  ) {
    const [sales, collections] = await Promise.all([
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: start, lte: end },
          treatmentPlan: { organizationId: actor.organizationId, branchId: branchWhere, isAlternative: false }
        }
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          branchId: branchWhere,
          paidAt: { gte: start, lte: end },
          status: { in: RECEIVED_PAYMENT_STATUSES }
        }
      })
    ]);

    return {
      sales: this.money(sales._sum.total),
      collections: this.money(collections._sum.amount)
    };
  }

  private async getMonthlyFinance(actor: AuthUser, filters: AnalyticsFilters) {
    const start = new Date(filters.end);
    start.setDate(1);
    start.setMonth(start.getMonth() - 11);
    start.setHours(0, 0, 0, 0);
    const map = new Map<string, { month: string; sales: number; collections: number }>();
    for (const key of this.emptyMonthMap(start, filters.end).keys()) map.set(key, { month: key, sales: 0, collections: 0 });

    const [items, payments] = await Promise.all([
      this.prisma.treatmentPlanItem.findMany({
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: start, lte: filters.end },
          treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere, isAlternative: false }
        },
        select: { total: true, completedAt: true }
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          paidAt: { gte: start, lte: filters.end },
          status: { in: RECEIVED_PAYMENT_STATUSES }
        },
        select: { amount: true, paidAt: true }
      })
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
      if (row) row.collections = this.roundMoney(row.collections + Number(payment.amount));
    }
    return [...map.values()];
  }

  private async getWaitTimeMetrics(actor: AuthUser, filters: AnalyticsFilters) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        startAt: { gte: filters.start, lte: filters.end },
        statusHistory: { some: { newStatus: { in: [AppointmentStatus.WAITING_ROOM, AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED] } } }
      },
      select: {
        id: true,
        statusHistory: {
          where: { newStatus: { in: [AppointmentStatus.WAITING_ROOM, AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED] } },
          select: { newStatus: true, createdAt: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    const waits: number[] = [];
    for (const appointment of appointments) {
      const waiting = appointment.statusHistory.find((row) => row.newStatus === AppointmentStatus.WAITING_ROOM);
      const started = appointment.statusHistory.find(
        (row) =>
          (row.newStatus === AppointmentStatus.IN_PROGRESS || row.newStatus === AppointmentStatus.COMPLETED) &&
          (!waiting || row.createdAt >= waiting.createdAt)
      );
      if (!waiting || !started) continue;
      waits.push(Math.max(0, Math.round((started.createdAt.getTime() - waiting.createdAt.getTime()) / 60000)));
    }

    const currentAverage = waits.length ? this.roundMoney(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0;
    const historicalAverage = await this.getHistoricalWaitAverage(actor, filters);

    return {
      averageWaitMinutes: currentAverage,
      historicalAverageWaitMinutes: historicalAverage,
      variationPercent: this.variation(currentAverage, historicalAverage),
      samples: waits.length
    };
  }

  private async getHistoricalWaitAverage(actor: AuthUser, filters: AnalyticsFilters) {
    const historicalEnd = new Date(filters.start.getTime() - 1);
    const historicalStart = new Date(historicalEnd);
    historicalStart.setMonth(historicalStart.getMonth() - 12);
    const historical = await this.getWaitTimeMetricsRaw(actor, filters.branchWhere, historicalStart, historicalEnd);
    return historical.length ? this.roundMoney(historical.reduce((sum, value) => sum + value, 0) / historical.length) : 0;
  }

  private async getWaitTimeMetricsRaw(
    actor: AuthUser,
    branchWhere: string | { in: string[] },
    start: Date,
    end: Date
  ) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchWhere,
        startAt: { gte: start, lte: end },
        statusHistory: { some: { newStatus: { in: [AppointmentStatus.WAITING_ROOM, AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED] } } }
      },
      select: {
        statusHistory: {
          where: { newStatus: { in: [AppointmentStatus.WAITING_ROOM, AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED] } },
          select: { newStatus: true, createdAt: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    return appointments.flatMap((appointment) => {
      const waiting = appointment.statusHistory.find((row) => row.newStatus === AppointmentStatus.WAITING_ROOM);
      const started = appointment.statusHistory.find(
        (row) =>
          (row.newStatus === AppointmentStatus.IN_PROGRESS || row.newStatus === AppointmentStatus.COMPLETED) &&
          (!waiting || row.createdAt >= waiting.createdAt)
      );
      if (!waiting || !started) return [];
      return [Math.max(0, Math.round((started.createdAt.getTime() - waiting.createdAt.getTime()) / 60000))];
    });
  }

  private async getProductionPerformance(actor: AuthUser, filters: AnalyticsFilters) {
    const completedItems = await this.prisma.treatmentPlanItem.findMany({
      where: {
        status: TreatmentPlanItemStatus.COMPLETED,
        completedAt: { gte: filters.start, lte: filters.end },
        treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere, isAlternative: false }
      },
      select: {
        total: true,
        quantity: true,
        priceListItem: { select: { labCost: true } },
        treatmentPlan: {
          select: {
            professionalId: true,
            professional: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });

    const hoursByProfessional = await this.attendedHoursByProfessional(actor, filters);
    const professionalMap = new Map<string, { professionalId: string; name: string; sales: number; attendedHours: number }>();
    let theoreticalCosts = 0;

    for (const item of completedItems) {
      theoreticalCosts += Number(item.priceListItem?.labCost ?? 0) * Number(item.quantity ?? 1);
      const key = item.treatmentPlan.professionalId;
      const row = professionalMap.get(key) ?? {
        professionalId: key,
        name: `${item.treatmentPlan.professional.firstName} ${item.treatmentPlan.professional.lastName}`.trim(),
        sales: 0,
        attendedHours: hoursByProfessional.get(key) ?? 0
      };
      row.sales += Number(item.total);
      professionalMap.set(key, row);
    }

    const salesByProfessional = [...professionalMap.values()]
      .map((row) => ({
        ...row,
        sales: this.roundMoney(row.sales),
        attendedHours: this.roundMoney(row.attendedHours),
        efficiency: row.attendedHours > 0 ? this.roundMoney(row.sales / row.attendedHours) : 0
      }))
      .sort((a, b) => b.sales - a.sales);

    return {
      theoreticalCosts: this.roundMoney(theoreticalCosts),
      salesByProfessional,
      professionalEfficiency: salesByProfessional
    };
  }

  private async computeAvailableMinutes(actor: AuthUser, filters: AnalyticsFilters, professionalIds: string[]) {
    if (!professionalIds.length) return 0;
    const schedules = await this.prisma.professionalSchedule.findMany({
      where: {
        professional: { organizationId: actor.organizationId },
        branchId: filters.branchWhere,
        professionalId: { in: professionalIds },
        isActive: true
      },
      select: { dayOfWeek: true, startTime: true, endTime: true, breakStartTime: true, breakEndTime: true }
    });
    return schedules.reduce((sum, schedule) => {
      const minutes = this.minutesDiff(schedule.startTime, schedule.endTime) - this.breakMinutes(schedule.breakStartTime, schedule.breakEndTime);
      return sum + Math.max(0, minutes) * this.countWeekdayOccurrences(filters.start, filters.end, schedule.dayOfWeek);
    }, 0);
  }

  private async attendedHoursByProfessional(actor: AuthUser, filters: AnalyticsFilters) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        status: { in: ATTENDED_STATUSES },
        startAt: { gte: filters.start, lte: filters.end }
      },
      select: { professionalId: true, durationMinutes: true }
    });
    const map = new Map<string, number>();
    for (const appointment of appointments) {
      map.set(appointment.professionalId, (map.get(appointment.professionalId) ?? 0) + appointment.durationMinutes / 60);
    }
    return map;
  }

  private async resultsReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const [finance, production, expenses] = await Promise.all([
      this.getFinancePerformance(actor, filters.start, filters.end, filters.branchWhere),
      this.getProductionPerformance(actor, filters),
      this.prisma.expense.aggregate({
        _sum: { total: true },
        where: { organizationId: actor.organizationId, branchId: filters.branchWhere, paidAt: { gte: filters.start, lte: filters.end } }
      })
    ]);
    const paidExpenses = this.money(expenses._sum.total);
    const net = this.roundMoney(finance.sales - paidExpenses - production.theoreticalCosts);
    return this.chartPayload("Resultados", "Ventas contra gastos pagados y costos teoricos.", filters, {
      summary: { sales: finance.sales, paidExpenses, theoreticalCosts: production.theoreticalCosts, net },
      chart: [
        { label: "Ventas", amount: finance.sales },
        { label: "Gastos", amount: paidExpenses },
        { label: "Costos teoricos", amount: production.theoreticalCosts },
        { label: "Resultado", amount: net }
      ],
      rows: [
        { metric: "Ventas realizadas", amount: finance.sales },
        { metric: "Gastos pagados", amount: paidExpenses },
        { metric: "Costos teoricos", amount: production.theoreticalCosts },
        { metric: "Resultado neto", amount: net }
      ]
    });
  }

  private async moneyFlowReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const [payments, cashExpenses, expenses] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          paidAt: { gte: filters.start, lte: filters.end },
          status: { in: RECEIVED_PAYMENT_STATUSES }
        }
      }),
      this.prisma.cashMovement.aggregate({
        _sum: { amount: true },
        where: {
          type: { in: [CashMovementType.EXPENSE, CashMovementType.REFUND] },
          createdAt: { gte: filters.start, lte: filters.end },
          cashRegister: { organizationId: actor.organizationId, branchId: filters.branchWhere }
        }
      }),
      this.prisma.expense.aggregate({
        _sum: { total: true },
        where: { organizationId: actor.organizationId, branchId: filters.branchWhere, paidAt: { gte: filters.start, lte: filters.end } }
      })
    ]);
    const received = this.money(payments._sum.amount);
    const outflow = this.money(cashExpenses._sum.amount) + this.money(expenses._sum.total);
    return this.chartPayload("Flujos de dinero", "Entradas y salidas efectivas del periodo.", filters, {
      summary: { received, outflow: this.roundMoney(outflow), netFlow: this.roundMoney(received - outflow) },
      chart: [
        { label: "Pagos recibidos", amount: received },
        { label: "Salidas caja/gastos", amount: this.roundMoney(outflow) }
      ],
      rows: [
        { concept: "Pagos recibidos de pacientes", amount: received },
        { concept: "Movimientos de egreso o devolucion", amount: this.money(cashExpenses._sum.amount) },
        { concept: "Gastos pagados", amount: this.money(expenses._sum.total) }
      ]
    });
  }

  private async patientAnalysisReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const [scheduled, confirmed, captured] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          patientId: { not: null },
          status: { notIn: [AppointmentStatus.BLOCKED] },
          startAt: { gte: filters.start, lte: filters.end }
        }
      }),
      this.prisma.appointment.count({
        where: {
          organizationId: actor.organizationId,
          branchId: filters.branchWhere,
          patientId: { not: null },
          status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.CONFIRMED_BY_EMAIL, AppointmentStatus.CONFIRMED_BY_PHONE, AppointmentStatus.CONFIRMED_BY_WHATSAPP] },
          startAt: { gte: filters.start, lte: filters.end }
        }
      }),
      this.prisma.budget.count({
        where: {
          organizationId: actor.organizationId,
          status: { in: CAPTURED_BUDGET_STATUSES },
          OR: [{ acceptedAt: { gte: filters.start, lte: filters.end } }, { acceptedAt: null, createdAt: { gte: filters.start, lte: filters.end } }],
          treatmentPlan: { branchId: filters.branchWhere, isAlternative: false }
        }
      })
    ]);
    return this.chartPayload("Analisis de pacientes", "Embudo de citas a presupuestos capturados.", filters, {
      summary: {
        scheduled,
        confirmed,
        captured,
        confirmedRate: this.percent(confirmed, scheduled),
        captureRate: this.percent(captured, scheduled)
      },
      chart: [
        { label: "Citas agendadas", value: scheduled },
        { label: "Citas confirmadas", value: confirmed },
        { label: "Presupuestos capturados", value: captured }
      ],
      rows: [
        { stage: "Citas agendadas", value: scheduled, percent: 100 },
        { stage: "Citas confirmadas", value: confirmed, percent: this.percent(confirmed, scheduled) },
        { stage: "Presupuestos capturados", value: captured, percent: this.percent(captured, scheduled) }
      ]
    });
  }

  private async expensesReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const expenses = await this.prisma.expense.findMany({
      where: { organizationId: actor.organizationId, branchId: filters.branchWhere, paidAt: { gte: filters.start, lte: filters.end } },
      select: { description: true, total: true, invoicedAt: true, paidAt: true, category: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
      take: 200
    });
    const categoryMap = new Map<string, number>();
    for (const expense of expenses) {
      const key = expense.category.name;
      categoryMap.set(key, this.roundMoney((categoryMap.get(key) ?? 0) + Number(expense.total)));
    }
    return this.chartPayload("Gastos", "Separacion entre fecha del gasto y fecha real de pago.", filters, {
      summary: { total: this.roundMoney(expenses.reduce((sum, row) => sum + Number(row.total), 0)), count: expenses.length },
      chart: [...categoryMap.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount),
      rows: expenses.map((row) => ({
        category: row.category.name,
        description: row.description,
        invoicedAt: row.invoicedAt?.toISOString() ?? null,
        paidAt: row.paidAt.toISOString(),
        amount: this.money(row.total)
      }))
    });
  }

  private async professionalEfficiencyReport(actor: AuthUser, filters: AnalyticsFilters, type: ChartReportType): Promise<ChartPayload> {
    const production = await this.getProductionPerformance(actor, filters);
    return this.chartPayload(
      type === "professional-ranking" ? "Ranking de profesionales" : "Eficiencia por profesional",
      "Ventas realizadas y eficiencia por hora atendida.",
      filters,
      {
        summary: { professionals: production.professionalEfficiency.length, theoreticalCosts: production.theoreticalCosts },
        chart: production.professionalEfficiency.map((row) => ({ label: row.name, amount: row.sales, efficiency: row.efficiency })),
        rows: production.professionalEfficiency.map((row) => ({
          professional: row.name,
          sales: row.sales,
          attendedHours: row.attendedHours,
          efficiency: row.efficiency
        }))
      }
    );
  }

  private async salesByProcedureReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.completedItemRows(actor, filters);
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.procedure.name, this.roundMoney((map.get(row.procedure.name) ?? 0) + Number(row.total)));
    const chart = [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
    return this.chartPayload("Ventas por prestacion", "Ventas realizadas agrupadas por prestacion.", filters, {
      summary: { total: this.roundMoney(chart.reduce((sum, row) => sum + row.amount, 0)), procedures: chart.length },
      chart,
      rows: chart
    });
  }

  private async salesByCategoryReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.completedItemRows(actor, filters);
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.priceSnapshotCategory ?? row.priceListItem?.priceListCategory?.name ?? "Sin categoria";
      map.set(key, this.roundMoney((map.get(key) ?? 0) + Number(row.total)));
    }
    const chart = [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
    return this.chartPayload("Ventas por categoria", "Ventas realizadas agrupadas por categoria.", filters, {
      summary: { total: this.roundMoney(chart.reduce((sum, row) => sum + row.amount, 0)), categories: chart.length },
      chart,
      rows: chart
    });
  }

  private async budgetCaptureReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const [generated, captured] = await Promise.all([
      this.prisma.budget.count({
        where: { organizationId: actor.organizationId, createdAt: { gte: filters.start, lte: filters.end }, treatmentPlan: { branchId: filters.branchWhere, isAlternative: false } }
      }),
      this.prisma.budget.count({
        where: {
          organizationId: actor.organizationId,
          status: { in: CAPTURED_BUDGET_STATUSES },
          OR: [{ acceptedAt: { gte: filters.start, lte: filters.end } }, { acceptedAt: null, createdAt: { gte: filters.start, lte: filters.end } }],
          treatmentPlan: { branchId: filters.branchWhere, isAlternative: false }
        }
      })
    ]);
    return this.chartPayload("Eficiencia de captacion de presupuestos", "Presupuestos capturados sobre presupuestos generados.", filters, {
      summary: { generated, captured, rate: this.percent(captured, generated) },
      chart: [
        { label: "Generados", value: generated },
        { label: "Capturados", value: captured }
      ],
      rows: [
        { metric: "Presupuestos generados", value: generated },
        { metric: "Presupuestos capturados", value: captured },
        { metric: "Tasa de captacion", value: this.percent(captured, generated) }
      ]
    });
  }

  private async dailyCollectionReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: filters.branchWhere,
        paidAt: { gte: filters.start, lte: filters.end },
        status: { in: RECEIVED_PAYMENT_STATUSES }
      },
      select: { amount: true, paidAt: true, paymentMethod: { select: { name: true } } },
      orderBy: { paidAt: "asc" }
    });
    const map = new Map<string, number>();
    for (const payment of payments) {
      const key = this.dateKey(payment.paidAt, filters.timezone);
      map.set(key, this.roundMoney((map.get(key) ?? 0) + Number(payment.amount)));
    }
    const chart = [...map.entries()].map(([date, amount]) => ({ label: date, amount }));
    return this.chartPayload("Informe de recaudacion diario", "Cobranza recibida por dia.", filters, {
      summary: { total: this.roundMoney(chart.reduce((sum, row) => sum + row.amount, 0)), payments: payments.length },
      chart,
      rows: payments.map((row) => ({ date: row.paidAt.toISOString(), method: row.paymentMethod?.name || null, amount: this.money(row.amount) }))
    });
  }

  private async delinquentPatientsReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.prisma.installment.findMany({
      where: {
        dueDate: { lte: filters.end },
        status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIAL, InstallmentStatus.OVERDUE] },
        patient: { organizationId: actor.organizationId, branchId: filters.branchWhere, deletedAt: null }
      },
      select: { amount: true, paidAmount: true, dueDate: true, status: true, patient: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 200
    });
    const total = rows.reduce((sum, row) => sum + Number(row.amount) - Number(row.paidAmount), 0);
    return this.chartPayload("Pacientes morosos", "Cuotas pendientes, parciales o vencidas.", filters, {
      summary: { total: this.roundMoney(total), installments: rows.length },
      chart: [
        { label: "Saldo moroso", amount: this.roundMoney(total) },
        { label: "Cuotas", value: rows.length }
      ],
      rows: rows.map((row) => ({
        patient: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
        dueDate: row.dueDate.toISOString(),
        status: row.status,
        balance: this.roundMoney(Number(row.amount) - Number(row.paidAmount))
      }))
    });
  }

  private async financingStatusReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.prisma.installment.groupBy({
      by: ["status"],
      where: { patient: { organizationId: actor.organizationId, branchId: filters.branchWhere, deletedAt: null } },
      _count: { _all: true },
      _sum: { amount: true, paidAmount: true }
    });
    const chart = rows.map((row) => ({
      label: row.status,
      value: row._count._all,
      amount: this.money(row._sum.amount),
      paid: this.money(row._sum.paidAmount)
    }));
    return this.chartPayload("Estado de financiamientos", "Cuotas agrupadas por estado.", filters, {
      summary: { statuses: chart.length },
      chart,
      rows: chart
    });
  }

  private async payrollDiscountReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.prisma.payrollDiscount.groupBy({
      by: ["status"],
      where: {
        organizationId: actor.organizationId,
        startDate: { lte: filters.end },
        patient: { branchId: filters.branchWhere }
      },
      _count: { _all: true },
      _sum: { totalAmount: true, discountAmount: true }
    });
    const chart = rows.map((row) => ({
      label: row.status,
      value: row._count._all,
      totalAmount: this.roundMoney(Number(row._sum.totalAmount ?? 0)),
      discountAmount: this.roundMoney(Number(row._sum.discountAmount ?? 0))
    }));
    return this.chartPayload("Estado de descuento por planilla", "Descuentos por planilla agrupados por estado.", filters, {
      summary: { statuses: chart.length },
      chart,
      rows: chart
    });
  }

  private async referralsReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.prisma.treatmentPlanReferral.findMany({
      where: {
        organizationId: actor.organizationId,
        createdAt: { gte: filters.start, lte: filters.end },
        OR: [{ fromBranchId: filters.branchWhere }, { toBranchId: filters.branchWhere }]
      },
      select: { reason: true, createdAt: true, fromBranchId: true, toBranchId: true },
      take: 200,
      orderBy: { createdAt: "desc" }
    });
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.reason, (map.get(row.reason) ?? 0) + 1);
    const chart = [...map.entries()].map(([label, value]) => ({ label, value }));
    return this.chartPayload("Derivacion de pacientes", "Derivaciones de tratamientos registradas.", filters, {
      summary: { referrals: rows.length },
      chart,
      rows: rows.map((row) => ({ reason: row.reason, createdAt: row.createdAt.toISOString(), fromBranchId: row.fromBranchId, toBranchId: row.toBranchId }))
    });
  }

  private async capturedBudgetsReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.prisma.budget.findMany({
      where: {
        organizationId: actor.organizationId,
        status: { in: CAPTURED_BUDGET_STATUSES },
        OR: [{ acceptedAt: { gte: filters.start, lte: filters.end } }, { acceptedAt: null, createdAt: { gte: filters.start, lte: filters.end } }],
        treatmentPlan: { branchId: filters.branchWhere, isAlternative: false }
      },
      select: { total: true, acceptedAt: true, createdAt: true, patient: { select: { firstName: true, lastName: true } }, professional: { select: { firstName: true, lastName: true } } },
      orderBy: { acceptedAt: "desc" },
      take: 200
    });
    const total = this.roundMoney(rows.reduce((sum, row) => sum + Number(row.total), 0));
    return this.chartPayload("Presupuestos capturados", "Presupuestos aceptados en el periodo.", filters, {
      summary: { total, captured: rows.length },
      chart: [{ label: "Capturados", value: rows.length, amount: total }],
      rows: rows.map((row) => ({
        patient: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
        professional: `${row.professional.firstName} ${row.professional.lastName}`.trim(),
        capturedAt: (row.acceptedAt ?? row.createdAt).toISOString(),
        amount: this.money(row.total)
      }))
    });
  }

  private async salesBookReport(actor: AuthUser, filters: AnalyticsFilters): Promise<ChartPayload> {
    const rows = await this.completedItemRows(actor, filters);
    return this.chartPayload("Libro de ventas", "Detalle de ventas realizadas por prestacion.", filters, {
      summary: { total: this.roundMoney(rows.reduce((sum, row) => sum + Number(row.total), 0)), rows: rows.length },
      chart: [],
      rows: rows.map((row) => ({
        completedAt: row.completedAt?.toISOString() ?? null,
        procedure: row.procedure.name,
        category: row.priceSnapshotCategory ?? row.priceListItem?.priceListCategory?.name ?? "Sin categoria",
        professional: `${row.treatmentPlan.professional.firstName} ${row.treatmentPlan.professional.lastName}`.trim(),
        amount: this.money(row.total)
      }))
    });
  }

  private async completedItemRows(actor: AuthUser, filters: AnalyticsFilters) {
    return this.prisma.treatmentPlanItem.findMany({
      where: {
        status: TreatmentPlanItemStatus.COMPLETED,
        completedAt: { gte: filters.start, lte: filters.end },
        treatmentPlan: { organizationId: actor.organizationId, branchId: filters.branchWhere, isAlternative: false }
      },
      select: {
        total: true,
        completedAt: true,
        priceSnapshotCategory: true,
        procedure: { select: { name: true } },
        priceListItem: { select: { priceListCategory: { select: { name: true } } } },
        treatmentPlan: { select: { professional: { select: { firstName: true, lastName: true } } } }
      },
      orderBy: { completedAt: "desc" },
      take: 500
    });
  }

  private chartPayload(
    title: string,
    description: string,
    filters: AnalyticsFilters,
    payload: {
      summary: Record<string, number | string>;
      chart: Array<Record<string, number | string>>;
      rows: Array<Record<string, number | string | null>>;
    }
  ): ChartPayload {
    return {
      title,
      description,
      filters: this.publicFilters(filters),
      definitions: this.metricDefinitions(filters),
      ...payload
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
      preset: filters.preset
    };
  }

  private metricDefinitions(filters: AnalyticsFilters) {
    return {
      attendedAppointment: {
        definition: "Cita con atencion registrada o paciente en sala/atencion.",
        includedStatuses: ATTENDED_STATUSES,
        excludedStatuses: SCHEDULED_EXCLUDED_STATUSES
      },
      sale: {
        definition: "Valor de prestaciones realizadas.",
        formula: "SUM(TreatmentPlanItem.total) donde status=COMPLETED y completedAt cae en el periodo."
      },
      collection: {
        definition: "Pagos efectivamente recibidos de pacientes.",
        includedStatuses: RECEIVED_PAYMENT_STATUSES,
        excludedStatuses: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED]
      },
      capturedBudget: {
        definition: "Presupuesto aceptado.",
        includedStatuses: CAPTURED_BUDGET_STATUSES
      },
      period: {
        dateFrom: filters.start.toISOString(),
        dateTo: filters.end.toISOString(),
        timezone: filters.timezone,
        currency: filters.currency,
        lastUpdatedAt: new Date().toISOString()
      }
    };
  }

  private previousRange(start: Date, end: Date) {
    const duration = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return { start: previousStart, end: previousEnd };
  }

  private emptyMonthMap(start: Date, end: Date) {
    const map = new Map<string, number>();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      map.set(this.monthKey(cursor), 0);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return map;
  }

  private dateKey(date: Date, timezone = "America/Mexico_City") {
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).format(date);
  }

  private monthKey(date: Date, timezone = "America/Mexico_City") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value ?? String(date.getFullYear());
    const month = parts.find((part) => part.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
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
