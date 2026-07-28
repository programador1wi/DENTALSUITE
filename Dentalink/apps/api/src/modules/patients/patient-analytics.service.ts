import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
  type CurrencyCode,
  type PatientStatus
} from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { calculateTreatmentPlanFinancialSummary } from "../treatment-plans/treatment-plan-financial-summary.service";
import {
  PATIENT_ANALYTICS_METRICS,
  PATIENT_ANALYTICS_METRIC_VERSION,
  isAcceptedTreatmentItem,
  isConfirmedFromHistory,
  normalizePatientAnalyticsDetailMetric,
  percentage
} from "./patient-analytics.metric-definition";
import { PatientAnalysisDetailQueryDto, PatientAnalysisQueryDto } from "./dto/patient-analysis-query.dto";

const DEFAULT_TIMEZONE = "America/Mexico_City";
const MAX_RANGE_DAYS = 3660;
const FINANCIAL_PERMISSIONS = new Set([
  "patient_analytics.read_financial",
  "payments.read",
  "accounts_receivable.read",
  "system.manage_all"
]);
const ALL_BRANCH_PERMISSIONS = new Set([
  "patient_analytics.view_all_branches",
  "branches.view_all",
  "reports.read",
  "system.manage_all"
]);
const DETAIL_PERMISSIONS = new Set([
  "patient_analytics.view_patient_details",
  "patients.read",
  "system.manage_all"
]);

type Granularity = "day" | "month" | "year";
type AnalyticsFilters = {
  start: Date;
  end: Date;
  cutoffAt: Date;
  from: string;
  to: string;
  timezone: string;
  granularity: Granularity;
  branchIds: string[];
  branches: Array<{ id: string; name: string; timezone: string | null }>;
};

type AppointmentRow = {
  id: string;
  patientId: string | null;
  treatmentPlanId: string | null;
  status: AppointmentStatus;
  startAt: Date;
  statusHistory: Array<{ newStatus: AppointmentStatus; createdAt: Date }>;
};

type DistributionInput = Map<string, number>;

@Injectable()
export class PatientAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: AuthUser, query: PatientAnalysisQueryDto) {
    this.assertBasePermission(actor);
    const filters = await this.resolveFilters(actor, query);
    const canReadFinancial = this.hasAnyPermission(actor, FINANCIAL_PERMISSIONS);
    const startedAt = Date.now();

    const appointmentWhere: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      branchId: { in: filters.branchIds },
      patientId: { not: null },
      startAt: { gte: filters.start, lt: filters.end },
      status: { not: AppointmentStatus.BLOCKED }
    };
    const patientWhere: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      branchId: { in: filters.branchIds },
      deletedAt: null,
      status: { not: "MERGED" }
    };

    const appointments = await this.prisma.appointment.findMany({
      where: appointmentWhere,
      select: {
        id: true,
        patientId: true,
        treatmentPlanId: true,
        status: true,
        startAt: true,
        statusHistory: {
          where: { createdAt: { lte: filters.cutoffAt } },
          select: { newStatus: true, createdAt: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    const [
      patients,
      payments,
      careItems,
      acceptedPlanItems,
      debtPlans,
      pendingItems
    ] = await Promise.all([
      this.prisma.patient.findMany({
        where: patientWhere,
        select: {
          id: true,
          birthDate: true,
          gender: true,
          source: true,
          status: true,
          createdAt: true,
          address: { select: { city: true, state: true } }
        }
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          branchId: { in: filters.branchIds },
          paidAt: { gte: filters.start, lt: filters.end },
          status: { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] }
        },
        select: {
          amount: true,
          currency: true,
          paymentMethodId: true,
          paymentMethod: { select: { name: true } }
        }
      }),
      this.prisma.treatmentPlanItem.findMany({
        where: {
          treatmentPlan: {
            organizationId: actor.organizationId,
            branchId: { in: filters.branchIds },
            isAlternative: false
          },
          status: { not: TreatmentPlanItemStatus.CANCELLED },
          OR: [
            { plannedAt: { gte: filters.start, lt: filters.end } },
            { completedAt: { gte: filters.start, lt: filters.end } },
            { createdAt: { gte: filters.start, lt: filters.end } }
          ]
        },
        select: {
          procedure: { select: { categoryId: true, category: { select: { name: true } } } }
        }
      }),
      this.loadAcceptedPlanItems(actor, appointments, filters.cutoffAt),
      canReadFinancial ? this.loadDebtPlans(actor, filters.branchIds) : Promise.resolve([]),
      canReadFinancial
        ? this.loadPendingItems(actor, filters.branchIds, filters.cutoffAt)
        : Promise.resolve([])
    ]);

    const appointmentRows = appointments as AppointmentRow[];
    const confirmedIds = new Set(
      appointmentRows
        .filter((appointment) =>
          isConfirmedFromHistory({
            status: appointment.status,
            history: appointment.statusHistory,
            cutoffAt: filters.cutoffAt
          })
        )
        .map((appointment) => appointment.id)
    );
    const acceptedPlanIds = new Set(
      acceptedPlanItems
        .filter((item) => isAcceptedTreatmentItem(item, filters.cutoffAt))
        .map((item) => item.treatmentPlanId)
    );
    const acceptedAppointmentIds = new Set(
      appointmentRows
        .filter(
          (appointment) =>
            appointment.treatmentPlanId && acceptedPlanIds.has(appointment.treatmentPlanId)
        )
        .map((appointment) => appointment.id)
    );

    const scheduled = appointmentRows.length;
    const confirmed = confirmedIds.size;
    const accepted = acceptedAppointmentIds.size;
    const buckets = this.buildBuckets(filters);
    const trendMap = new Map(
      buckets.map((bucket) => [
        bucket.key,
        {
          period: bucket.key,
          label: bucket.label,
          scheduledAppointments: 0,
          confirmedAppointments: 0,
          acceptedBudgets: 0,
          newPatients: 0,
          attendedAppointments: 0,
          attendanceEligibleAppointments: 0,
          confirmedRate: 0,
          acceptedRate: 0,
          attendanceRate: 0
        }
      ])
    );
    for (const appointment of appointmentRows) {
      const bucket = trendMap.get(this.bucketKey(appointment.startAt, filters.timezone, filters.granularity));
      if (!bucket) continue;
      bucket.scheduledAppointments += 1;
      if (confirmedIds.has(appointment.id)) bucket.confirmedAppointments += 1;
      if (acceptedAppointmentIds.has(appointment.id)) bucket.acceptedBudgets += 1;
      if (
        appointment.startAt < filters.cutoffAt &&
        (appointment.status === AppointmentStatus.COMPLETED ||
          appointment.status === AppointmentStatus.NO_SHOW)
      ) {
        bucket.attendanceEligibleAppointments += 1;
        if (appointment.status === AppointmentStatus.COMPLETED) {
          bucket.attendedAppointments += 1;
        }
      }
    }
    for (const patient of patients) {
      const bucket = trendMap.get(this.bucketKey(patient.createdAt, filters.timezone, filters.granularity));
      if (bucket) bucket.newPatients += 1;
    }
    const trend = [...trendMap.values()].map((bucket) => ({
      ...bucket,
      confirmedRate: percentage(bucket.confirmedAppointments, bucket.scheduledAppointments),
      acceptedRate: percentage(bucket.acceptedBudgets, bucket.scheduledAppointments),
      attendanceRate: percentage(
        bucket.attendedAppointments,
        bucket.attendanceEligibleAppointments
      )
    }));

    const demographics = this.buildDemographics({
      patients,
      appointments: appointmentRows,
      payments,
      careItems,
      cutoffAt: filters.cutoffAt,
      filters
    });
    const attendanceEligible = appointmentRows.filter(
      (appointment) =>
        appointment.startAt < filters.cutoffAt &&
        (appointment.status === AppointmentStatus.COMPLETED ||
          appointment.status === AppointmentStatus.NO_SHOW)
    );
    const attended = attendanceEligible.filter(
      (appointment) => appointment.status === AppointmentStatus.COMPLETED
    ).length;
    const attendanceRate = percentage(attended, attendanceEligible.length);

    const globalMetrics: Array<Record<string, unknown>> = [
      {
        key: "totalPatients",
        label: "Total de pacientes",
        value: patients.length,
        format: "number",
        formula: PATIENT_ANALYTICS_METRICS.patients.formula,
        denominator: PATIENT_ANALYTICS_METRICS.patients.denominator,
        trend: trend.slice(-6).map((point) => point.newPatients)
      },
      {
        key: "averageAttendance",
        label: "Asistencia efectiva",
        value: attendanceRate,
        format: "percent",
        formula: PATIENT_ANALYTICS_METRICS.attendance.formula,
        denominator: PATIENT_ANALYTICS_METRICS.attendance.denominator,
        trend: trend.slice(-6).map((point) => point.attendanceRate)
      }
    ];

    if (canReadFinancial) {
      const debtByCurrency = this.calculateDebtByCurrency(debtPlans);
      const pendingBreakdown = this.calculatePendingBudgets(pendingItems);
      globalMetrics.splice(1, 0, {
        key: "accumulatedDebt",
        label: "Deuda acumulada",
        values: debtByCurrency,
        format: "money",
        formula: PATIENT_ANALYTICS_METRICS.debt.formula,
        denominator: PATIENT_ANALYTICS_METRICS.debt.denominator,
        trend: []
      });
      globalMetrics.push({
        key: "pendingBudgets",
        label: "Presupuestos pendientes",
        values: pendingBreakdown.totals,
        breakdown: pendingBreakdown.breakdown,
        format: "money",
        formula: PATIENT_ANALYTICS_METRICS.pendingBudgets.formula,
        denominator: PATIENT_ANALYTICS_METRICS.pendingBudgets.denominator,
        trend: []
      });
    }

    const metadata = {
      organizationId: actor.organizationId,
      branchIds: filters.branchIds,
      branches: filters.branches.map((branch) => ({ id: branch.id, name: branch.name })),
      from: filters.from,
      to: filters.to,
      timezone: filters.timezone,
      cutoffAt: filters.cutoffAt.toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      metricVersion: PATIENT_ANALYTICS_METRIC_VERSION,
      granularity: filters.granularity,
      source: "live" as const,
      currencies: [...new Set(payments.map((payment) => payment.currency))],
      durationMs: Date.now() - startedAt
    };

    await this.audit(actor, "view", filters, {
      metricVersion: PATIENT_ANALYTICS_METRIC_VERSION,
      durationMs: metadata.durationMs,
      financial: canReadFinancial
    });

    return {
      metadata,
      capabilities: {
        canReadFinancial,
        canViewAllBranches: this.hasAnyPermission(actor, ALL_BRANCH_PERMISSIONS),
        canExport: actor.permissions.some((permission) =>
          ["patient_analytics.export", "reports.export", "system.manage_all"].includes(permission)
        ),
        canRefresh: actor.permissions.some((permission) =>
          ["patient_analytics.refresh", "reports.read", "system.manage_all"].includes(permission)
        ),
        canViewPatientDetails: this.hasAnyPermission(actor, DETAIL_PERMISSIONS)
      },
      conversion: {
        totals: {
          scheduledAppointments: scheduled,
          confirmedAppointments: confirmed,
          acceptedBudgets: accepted,
          scheduledRate: scheduled > 0 ? 100 : 0,
          confirmedRate: percentage(confirmed, scheduled),
          acceptedRate: percentage(accepted, scheduled),
          confirmedToAcceptedRate: percentage(accepted, confirmed)
        },
        funnel: [
          { key: "scheduled", label: "Citas agendadas", value: scheduled, percent: scheduled > 0 ? 100 : 0 },
          {
            key: "confirmed",
            label: "Citas confirmadas",
            value: confirmed,
            percent: percentage(confirmed, scheduled)
          },
          {
            key: "accepted-budgets",
            label: "Presupuestos aceptados",
            value: accepted,
            percent: percentage(accepted, scheduled)
          }
        ],
        trend,
        definition: {
          scheduled: PATIENT_ANALYTICS_METRICS.scheduledAppointments,
          confirmed: PATIENT_ANALYTICS_METRICS.confirmedAppointments,
          accepted: PATIENT_ANALYTICS_METRICS.acceptedBudgets
        }
      },
      demographics,
      globalMetrics
    };
  }

  async refresh(actor: AuthUser, query: PatientAnalysisQueryDto) {
    if (
      !actor.permissions.some((permission) =>
        ["patient_analytics.refresh", "reports.read", "system.manage_all"].includes(permission)
      )
    ) {
      throw new ForbiddenException("Insufficient permissions");
    }
    const filters = await this.resolveFilters(actor, query);
    await this.audit(actor, "refresh", filters, { source: "live", invalidatedCache: false });
    return this.overview(actor, query);
  }

  async detail(actor: AuthUser, metric: string, query: PatientAnalysisDetailQueryDto) {
    metric = normalizePatientAnalyticsDetailMetric(metric);
    this.assertBasePermission(actor);
    const filters = await this.resolveFilters(actor, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const includeIdentity = this.hasAnyPermission(actor, DETAIL_PERMISSIONS);

    if (["debt", "pending-budgets"].includes(metric) && !this.hasAnyPermission(actor, FINANCIAL_PERMISSIONS)) {
      throw new ForbiddenException("Financial analytics permission is required");
    }

    if (metric === "patients") {
      const where: Prisma.PatientWhereInput = {
        organizationId: actor.organizationId,
        branchId: { in: filters.branchIds },
        deletedAt: null,
        status: { not: "MERGED" },
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { documentNumber: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      };
      const [rows, total] = await Promise.all([
        this.prisma.patient.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: query.order ?? "desc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            status: true,
            branch: { select: { id: true, name: true } },
            appointments: {
              select: { startAt: true },
              orderBy: { startAt: "desc" },
              take: 1
            }
          }
        }),
        this.prisma.patient.count({ where })
      ]);
      return this.detailResponse(
        metric,
        rows.map((row) => ({
          id: row.id,
          patientName: includeIdentity ? `${row.firstName} ${row.lastName}`.trim() : "Paciente protegido",
          createdAt: row.createdAt,
          status: row.status,
          branch: row.branch.name,
          lastAppointmentAt: row.appointments[0]?.startAt ?? null,
          patientUrl: includeIdentity ? `/patients/${row.id}` : null
        })),
        total,
        page,
        pageSize,
        filters
      );
    }

    if (["scheduled", "confirmed", "accepted-budgets", "attendance"].includes(metric)) {
      const where: Prisma.AppointmentWhereInput = {
        organizationId: actor.organizationId,
        branchId: { in: filters.branchIds },
        patientId: { not: null },
        startAt: { gte: filters.start, lt: filters.end },
        status: { not: AppointmentStatus.BLOCKED },
        ...(query.search
          ? {
              patient: {
                OR: [
                  { firstName: { contains: query.search, mode: "insensitive" } },
                  { lastName: { contains: query.search, mode: "insensitive" } }
                ]
              }
            }
          : {})
      };
      const candidates = await this.prisma.appointment.findMany({
        where,
        orderBy: { startAt: query.order ?? "desc" },
        select: {
          id: true,
          startAt: true,
          status: true,
          treatmentPlanId: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
          branch: { select: { name: true } },
          professional: { select: { firstName: true, lastName: true } },
          statusHistory: {
            where: { createdAt: { lte: filters.cutoffAt } },
            select: { newStatus: true, createdAt: true }
          }
        }
      });
      let eligible = candidates;
      if (metric === "confirmed") {
        eligible = candidates.filter((appointment) =>
          isConfirmedFromHistory({
            status: appointment.status,
            history: appointment.statusHistory,
            cutoffAt: filters.cutoffAt
          })
        );
      }
      if (metric === "attendance") {
        eligible = candidates.filter(
          (appointment) =>
            appointment.startAt < filters.cutoffAt &&
            (appointment.status === AppointmentStatus.COMPLETED ||
              appointment.status === AppointmentStatus.NO_SHOW)
        );
      }
      if (metric === "accepted-budgets") {
        const acceptedItems = await this.loadAcceptedPlanItems(actor, candidates, filters.cutoffAt);
        const planIds = new Set(
          acceptedItems
            .filter((item) => isAcceptedTreatmentItem(item, filters.cutoffAt))
            .map((item) => item.treatmentPlanId)
        );
        eligible = candidates.filter(
          (appointment) => appointment.treatmentPlanId && planIds.has(appointment.treatmentPlanId)
        );
      }
      const rows = eligible.slice(skip, skip + pageSize).map((appointment) => ({
        id: appointment.id,
        patientName: includeIdentity
          ? `${appointment.patient?.firstName ?? ""} ${appointment.patient?.lastName ?? ""}`.trim()
          : "Paciente protegido",
        scheduledAt: appointment.startAt,
        status: appointment.status,
        branch: appointment.branch.name,
        professional:
          `${appointment.professional.firstName} ${appointment.professional.lastName}`.trim(),
        patientUrl: includeIdentity && appointment.patient ? `/patients/${appointment.patient.id}` : null
      }));
      return this.detailResponse(metric, rows, eligible.length, page, pageSize, filters);
    }

    if (metric === "debt") {
      const plans = await this.loadDebtPlans(actor, filters.branchIds, query.search);
      const rows = plans
        .map((plan) => {
          const summary = calculateTreatmentPlanFinancialSummary(plan);
          return {
            id: plan.id,
            patientName: includeIdentity
              ? `${plan.patient.firstName} ${plan.patient.lastName}`.trim()
              : "Paciente protegido",
            treatmentPlan: plan.name,
            branch: plan.branch.name,
            currency: summary.currency,
            total: Number(summary.budgetAmount),
            paid: Number(summary.settledAmount),
            balance: Number(summary.debtAmount),
            patientUrl: includeIdentity ? `/patients/${plan.patientId}` : null
          };
        })
        .filter((row) => row.balance > 0);
      return this.detailResponse(metric, rows.slice(skip, skip + pageSize), rows.length, page, pageSize, filters);
    }

    if (metric === "pending-budgets") {
      const items = await this.loadPendingItems(actor, filters.branchIds, filters.cutoffAt, query.search);
      const rows = items.map((item) => ({
        id: item.id,
        patientName: includeIdentity
          ? `${item.treatmentPlan.patient.firstName} ${item.treatmentPlan.patient.lastName}`.trim()
          : "Paciente protegido",
        treatmentPlan: item.treatmentPlan.name,
        procedure: item.procedureNameSnapshot ?? item.procedure.name,
        branch: item.treatmentPlan.branch.name,
        status: item.treatmentPlan.status,
        currency: item.priceCurrency,
        total: Number(item.total),
        performed: Number(item.performedAmount),
        pending: Math.max(Number(item.total) - Number(item.performedAmount), 0),
        lastActivityAt: item.updatedAt,
        patientUrl: includeIdentity ? `/patients/${item.treatmentPlan.patientId}` : null
      }));
      return this.detailResponse(metric, rows.slice(skip, skip + pageSize), rows.length, page, pageSize, filters);
    }

    throw new NotFoundException("Analytics detail metric not found");
  }

  async exportCsv(actor: AuthUser, metric: string, query: PatientAnalysisDetailQueryDto) {
    if (
      !actor.permissions.some((permission) =>
        ["patient_analytics.export", "reports.export", "system.manage_all"].includes(permission)
      )
    ) {
      throw new ForbiddenException("Analytics export permission is required");
    }
    const filters = await this.resolveFilters(actor, query);
    const rows: Array<Record<string, unknown>> = [];
    const maxRows = 5000;
    let page = 1;
    while (rows.length < maxRows) {
      const result = await this.detail(actor, metric, {
        ...query,
        page,
        pageSize: 100
      } as PatientAnalysisDetailQueryDto);
      rows.push(...result.rows);
      if (page >= result.pagination.totalPages) break;
      page += 1;
    }

    const limited = rows.slice(0, maxRows);
    const columns = [...new Set(limited.flatMap((row) => Object.keys(row)))].filter(
      (column) => column !== "patientUrl"
    );
    const csv = [
      columns.map((column) => this.csvCell(column)).join(","),
      ...limited.map((row) => columns.map((column) => this.csvCell(row[column])).join(","))
    ].join("\r\n");
    await this.audit(actor, "export", filters, {
      metric,
      exportedRows: limited.length,
      truncated: rows.length >= maxRows
    });
    return `\uFEFF${csv}`;
  }

  private async resolveFilters(actor: AuthUser, query: PatientAnalysisQueryDto): Promise<AnalyticsFilters> {
    if (!actor.branchIds.length) throw new ForbiddenException("No authorized branches");
    const requestedBranchIds = [
      ...(query.branchId ? [query.branchId] : []),
      ...(query.branchIds ?? [])
    ].filter(Boolean);
    const branchIds = [...new Set(requestedBranchIds.length ? requestedBranchIds : [actor.branchIds[0]])];
    const unauthorized = branchIds.filter((branchId) => !actor.branchIds.includes(branchId));
    if (unauthorized.length) throw new ForbiddenException("Branch outside authorized scope");
    if (branchIds.length > 1 && !this.hasAnyPermission(actor, ALL_BRANCH_PERMISSIONS)) {
      throw new ForbiddenException("Consolidated branch analytics permission is required");
    }

    const branches = await this.prisma.branch.findMany({
      where: {
        id: { in: branchIds },
        organizationId: actor.organizationId,
        deletedAt: null,
        isActive: true
      },
      select: { id: true, name: true, timezone: true }
    });
    if (branches.length !== branchIds.length) throw new BadRequestException("Invalid branch selection");

    const timezone = query.timezone ?? this.commonTimezone(branches) ?? DEFAULT_TIMEZONE;
    this.assertTimezone(timezone);
    const nowParts = this.dateParts(new Date(), timezone);
    const defaultTo = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-${String(nowParts.day).padStart(2, "0")}`;
    const defaultFromDate = new Date(Date.UTC(nowParts.year, nowParts.month - 12, 1));
    const defaultFrom = `${defaultFromDate.getUTCFullYear()}-${String(defaultFromDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const from = this.normalizeDateInput(query.from ?? defaultFrom, "from");
    const to = this.normalizeDateInput(query.to ?? defaultTo, "to");
    const startParts = this.parseDateParts(from);
    const endParts = this.parseDateParts(to);
    const start = this.zonedDateToUtc(startParts, timezone);
    const endStart = this.zonedDateToUtc(endParts, timezone);
    const nextEnd = new Date(endStart.getTime());
    nextEnd.setUTCDate(nextEnd.getUTCDate() + 1);
    const end = this.zonedDateToUtc(
      {
        year: nextEnd.getUTCFullYear(),
        month: nextEnd.getUTCMonth() + 1,
        day: nextEnd.getUTCDate()
      },
      timezone
    );
    if (start >= end) throw new BadRequestException("from must be before or equal to to");
    const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
    if (rangeDays > MAX_RANGE_DAYS) throw new BadRequestException("Analysis range cannot exceed 10 years");
    const granularity = this.resolveGranularity(query.granularity, rangeDays);
    return {
      start,
      end,
      cutoffAt: new Date(Math.min(Date.now(), end.getTime() - 1)),
      from,
      to,
      timezone,
      granularity,
      branchIds,
      branches
    };
  }

  private async loadAcceptedPlanItems(
    actor: AuthUser,
    appointments: Array<{ treatmentPlanId: string | null }>,
    cutoffAt: Date
  ) {
    const planIds = [...new Set(appointments.map((appointment) => appointment.treatmentPlanId).filter(Boolean))] as string[];
    if (!planIds.length) return [];
    return this.prisma.treatmentPlanItem.findMany({
      where: {
        treatmentPlanId: { in: planIds },
        treatmentPlan: { organizationId: actor.organizationId, isAlternative: false },
        status: TreatmentPlanItemStatus.COMPLETED,
        completionPercentage: 100,
        OR: [{ completedAt: null }, { completedAt: { lte: cutoffAt } }]
      },
      select: {
        treatmentPlanId: true,
        status: true,
        completionPercentage: true,
        completedAt: true
      }
    });
  }

  private loadDebtPlans(actor: AuthUser, branchIds: string[], search?: string) {
    return this.prisma.treatmentPlan.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: branchIds },
        isAlternative: false,
        status: { notIn: [TreatmentPlanStatus.CANCELLED, TreatmentPlanStatus.REJECTED] },
        ...(search
          ? {
              patient: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } }
                ]
              }
            }
          : {})
      },
      select: {
        id: true,
        name: true,
        status: true,
        patientId: true,
        patient: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
        items: {
          select: {
            status: true,
            total: true,
            originalPrice: true,
            discount: true,
            discountAmount: true,
            completionPercentage: true,
            performedAmount: true,
            priceCurrency: true,
            paymentAllocations: {
              select: {
                amount: true,
                settlementDiscountAmount: true,
                payment: {
                  select: {
                    status: true,
                    allocations: { select: { amount: true } },
                    refunds: {
                      where: { status: RefundStatus.PROCESSED },
                      select: { amount: true, status: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  private loadPendingItems(actor: AuthUser, branchIds: string[], cutoffAt: Date, search?: string) {
    const fiveYearsAgo = new Date(cutoffAt);
    fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
    return this.prisma.treatmentPlanItem.findMany({
      where: {
        createdAt: { gte: fiveYearsAgo, lte: cutoffAt },
        status: { notIn: [TreatmentPlanItemStatus.COMPLETED, TreatmentPlanItemStatus.CANCELLED] },
        completionPercentage: { lt: 100 },
        treatmentPlan: {
          organizationId: actor.organizationId,
          branchId: { in: branchIds },
          isAlternative: false,
          status: { notIn: [TreatmentPlanStatus.CANCELLED, TreatmentPlanStatus.REJECTED] },
          ...(search
            ? {
                patient: {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } }
                  ]
                }
              }
            : {})
        }
      },
      select: {
        id: true,
        total: true,
        performedAmount: true,
        priceCurrency: true,
        procedureNameSnapshot: true,
        updatedAt: true,
        procedure: { select: { name: true } },
        treatmentPlan: {
          select: {
            patientId: true,
            name: true,
            status: true,
            branch: { select: { name: true } },
            patient: { select: { firstName: true, lastName: true } }
          }
        }
      }
    });
  }

  private calculateDebtByCurrency(plans: Awaited<ReturnType<PatientAnalyticsService["loadDebtPlans"]>>) {
    const totals = new Map<string, number>();
    for (const plan of plans) {
      const summary = calculateTreatmentPlanFinancialSummary(plan);
      const debt = Number(summary.debtAmount);
      if (debt <= 0) continue;
      totals.set(summary.currency, (totals.get(summary.currency) ?? 0) + debt);
    }
    return [...totals.entries()].map(([currency, value]) => ({
      currency,
      value: this.roundMoney(value)
    }));
  }

  private calculatePendingBudgets(items: Awaited<ReturnType<PatientAnalyticsService["loadPendingItems"]>>) {
    const totals = new Map<string, number>();
    const breakdown = new Map<string, Map<string, number>>();
    for (const item of items) {
      const pending = Math.max(Number(item.total) - Number(item.performedAmount), 0);
      const currency = item.priceCurrency;
      const stage =
        item.treatmentPlan.status === TreatmentPlanStatus.DRAFT ||
        item.treatmentPlan.status === TreatmentPlanStatus.PRESENTED
          ? "pendingAcceptance"
          : "acceptedPendingExecution";
      totals.set(currency, (totals.get(currency) ?? 0) + pending);
      const stageTotals = breakdown.get(stage) ?? new Map<string, number>();
      stageTotals.set(currency, (stageTotals.get(currency) ?? 0) + pending);
      breakdown.set(stage, stageTotals);
    }
    const serialize = (values: Map<string, number>) =>
      [...values.entries()].map(([currency, value]) => ({ currency, value: this.roundMoney(value) }));
    return {
      totals: serialize(totals),
      breakdown: [...breakdown.entries()].map(([stage, values]) => ({ stage, values: serialize(values) }))
    };
  }

  private buildDemographics(input: {
    patients: Array<{
      birthDate: Date | null;
      gender: string | null;
      source: string | null;
      status: PatientStatus;
      address: { city: string | null; state: string | null } | null;
    }>;
    appointments: AppointmentRow[];
    payments: Array<{
      amount: Prisma.Decimal;
      currency: CurrencyCode;
      paymentMethodId: string | null;
      paymentMethod: { name: string } | null;
    }>;
    careItems: Array<{ procedure: { categoryId: string; category: { name: string } } }>;
    cutoffAt: Date;
    filters: AnalyticsFilters;
  }) {
    const age = new Map<string, number>();
    const gender = new Map<string, number>();
    const location = new Map<string, number>();
    const source = new Map<string, number>();
    const patientStatus = new Map<string, number>();
    for (const patient of input.patients) {
      this.increment(age, this.ageBand(patient.birthDate, input.cutoffAt));
      this.increment(gender, this.normalized(patient.gender, "Sin informacion"));
      this.increment(
        location,
        this.normalized(
          patient.address?.city ?? patient.address?.state,
          "Sin informacion"
        )
      );
      this.increment(source, this.normalized(patient.source, "Sin informacion"));
      this.increment(patientStatus, this.patientStatusLabel(patient.status));
    }

    const appointmentStatus = new Map<string, number>();
    for (const appointment of input.appointments) {
      this.increment(appointmentStatus, this.appointmentStatusLabel(appointment.status));
    }
    const paymentMethods = new Map<string, number>();
    for (const payment of input.payments) {
      this.increment(
        paymentMethods,
        this.normalized(payment.paymentMethod?.name, payment.paymentMethodId ? "Metodo sin nombre" : "Sin metodo")
      );
    }
    const careCategory = new Map<string, number>();
    for (const item of input.careItems) {
      this.increment(careCategory, item.procedure.category.name);
    }

    const metadata = {
      period: { from: input.filters.from, to: input.filters.to },
      cutoffAt: input.filters.cutoffAt.toISOString(),
      branchIds: input.filters.branchIds
    };
    return [
      this.metricDistribution("age", "Edad", age, input.patients.length, "Pacientes unicos", metadata),
      this.metricDistribution("gender", "Genero", gender, input.patients.length, "Pacientes unicos", metadata),
      this.metricDistribution("location", "Municipio o localidad", location, input.patients.length, "Pacientes unicos", metadata),
      this.metricDistribution(
        "paymentMethods",
        "Medios de pago",
        paymentMethods,
        input.payments.length,
        "Transacciones validas",
        metadata
      ),
      this.metricDistribution(
        "careCategory",
        "Categoria de atencion",
        careCategory,
        input.careItems.length,
        "Prestaciones del periodo agrupadas por categoryId",
        metadata
      ),
      this.metricDistribution(
        "appointmentStatus",
        "Estado de citas",
        appointmentStatus,
        input.appointments.length,
        "Ultimo estado efectivo de cada cita",
        metadata
      ),
      this.metricDistribution("source", "Fuente de pacientes", source, input.patients.length, "Pacientes unicos", metadata),
      this.metricDistribution(
        "patientStatus",
        "Estado de pacientes",
        patientStatus,
        input.patients.length,
        "Pacientes unicos",
        metadata
      )
    ];
  }

  private metricDistribution(
    key: string,
    label: string,
    map: DistributionInput,
    denominator: number,
    universe: string,
    metadata: Record<string, unknown>
  ) {
    const omitted = map.get("Sin informacion") ?? 0;
    map.delete("Sin informacion");

    let entries = [...map.entries()]
      .map(([itemLabel, value]) => ({
        key: itemLabel.toLocaleLowerCase("es-MX").replace(/[^a-z0-9]+/g, "-"),
        label: itemLabel,
        value,
        percent: percentage(value, denominator)
      }))
      .sort((a, b) => b.value - a.value);

    if (entries.length > 15) {
      const top = entries.slice(0, 15);
      const othersValue = entries.slice(15).reduce((sum, item) => sum + item.value, 0);
      top.push({
        key: "otros",
        label: "Otros",
        value: othersValue,
        percent: percentage(othersValue, denominator)
      });
      entries = top;
    }

    entries.push({
      key: "sin-informacion",
      label: "Sin informacion",
      value: omitted,
      percent: percentage(omitted, denominator)
    });

    return {
      key,
      label,
      universe,
      formula: `COUNT por categoria / ${denominator || 0}`,
      denominator,
      omitted,
      ...metadata,
      data: entries
    };
  }

  private buildBuckets(filters: AnalyticsFilters) {
    const buckets: Array<{ key: string; label: string }> = [];
    const cursor = new Date(filters.start);
    const seen = new Set<string>();
    while (cursor < filters.end) {
      const key = this.bucketKey(cursor, filters.timezone, filters.granularity);
      if (!seen.has(key)) {
        seen.add(key);
        buckets.push({ key, label: this.bucketLabel(cursor, filters.timezone, filters.granularity) });
      }
      if (filters.granularity === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
      else if (filters.granularity === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
    return buckets;
  }

  private bucketKey(date: Date, timezone: string, granularity: Granularity) {
    const parts = this.dateParts(date, timezone);
    if (granularity === "year") return String(parts.year);
    const month = String(parts.month).padStart(2, "0");
    if (granularity === "month") return `${parts.year}-${month}`;
    return `${parts.year}-${month}-${String(parts.day).padStart(2, "0")}`;
  }

  private bucketLabel(date: Date, timezone: string, granularity: Granularity) {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: timezone,
      ...(granularity === "day"
        ? { day: "2-digit", month: "short" }
        : granularity === "month"
          ? { month: "short", year: "2-digit" }
          : { year: "numeric" })
    }).format(date);
  }

  private resolveGranularity(value: PatientAnalysisQueryDto["granularity"], rangeDays: number): Granularity {
    if (value && value !== "auto") return value;
    if (rangeDays <= 31) return "day";
    if (rangeDays <= 731) return "month";
    return "year";
  }

  private normalizeDateInput(value: string, edge: "from" | "to") {
    if (/^\d{4}-\d{2}$/.test(value)) {
      const [year, month] = value.split("-").map(Number);
      if (edge === "from") return `${value}-01`;
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return `${value}-${String(last).padStart(2, "0")}`;
    }
    const parts = this.parseDateParts(value);
    const canonical = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    if (canonical !== value) throw new BadRequestException(`Invalid ${edge} date`);
    return canonical;
  }

  private parseDateParts(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new BadRequestException("Invalid analysis date");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      throw new BadRequestException("Invalid analysis date");
    }
    return { year, month, day };
  }

  private zonedDateToUtc(parts: { year: number; month: number; day: number }, timezone: string) {
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
    let utc = new Date(localAsUtc);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const zoned = this.dateTimeParts(utc, timezone);
      const represented = Date.UTC(
        zoned.year,
        zoned.month - 1,
        zoned.day,
        zoned.hour,
        zoned.minute,
        zoned.second
      );
      utc = new Date(utc.getTime() + (localAsUtc - represented));
    }
    return utc;
  }

  private dateParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return { year: value("year"), month: value("month"), day: value("day") };
  }

  private dateTimeParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: value("hour"),
      minute: value("minute"),
      second: value("second")
    };
  }

  private assertTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    } catch {
      throw new BadRequestException("Invalid timezone");
    }
  }

  private commonTimezone(branches: Array<{ timezone: string | null }>) {
    const values = [...new Set(branches.map((branch) => branch.timezone).filter(Boolean))];
    return values.length === 1 ? values[0] : undefined;
  }

  private ageBand(birthDate: Date | null, cutoffAt: Date) {
    if (!birthDate) return "Sin informacion";
    let years = cutoffAt.getUTCFullYear() - birthDate.getUTCFullYear();
    const beforeBirthday =
      cutoffAt.getUTCMonth() < birthDate.getUTCMonth() ||
      (cutoffAt.getUTCMonth() === birthDate.getUTCMonth() &&
        cutoffAt.getUTCDate() < birthDate.getUTCDate());
    if (beforeBirthday) years -= 1;
    if (years < 0) return "Sin informacion";
    if (years <= 14) return "0 a 14";
    if (years <= 20) return "15 a 20";
    if (years <= 35) return "21 a 35";
    if (years <= 50) return "36 a 50";
    if (years <= 65) return "51 a 65";
    if (years <= 70) return "66 a 70";
    return "71 o mas";
  }

  private normalized(value: string | null | undefined, fallback: string) {
    const normalized = value?.trim().replace(/\s+/g, " ");
    if (!normalized) return fallback;
    return normalized
      .toLocaleLowerCase("es-MX")
      .replace(/(^|\s)\p{L}/gu, (match) => match.toLocaleUpperCase("es-MX"));
  }

  private appointmentStatusLabel(status: AppointmentStatus) {
    const labels: Partial<Record<AppointmentStatus, string>> = {
      SCHEDULED: "Agendada",
      CONFIRMED: "Confirmada",
      CONFIRMED_BY_EMAIL: "Confirmada por email",
      CONFIRMED_BY_PHONE: "Confirmada por telefono",
      CONFIRMED_BY_WHATSAPP: "Confirmada por WhatsApp",
      COMPLETED: "Atendida",
      NO_SHOW: "No asistio",
      CANCELLED_BY_CLINIC: "Cancelada por clinica",
      CANCELLED_BY_PATIENT: "Cancelada por paciente",
      CANCELLED_CONFLICT: "Cancelada por conflicto",
      CANCELLED_RESCHEDULED: "Cancelada por reprogramacion",
      RESCHEDULED: "Reprogramada"
    };
    return labels[status] ?? this.normalized(status.replaceAll("_", " "), status);
  }

  private patientStatusLabel(status: PatientStatus) {
    const labels: Partial<Record<PatientStatus, string>> = {
      NEW: "Nuevo",
      PROVISIONAL: "Provisional",
      ACTIVE: "Activo",
      IN_TREATMENT: "En tratamiento",
      INACTIVE: "Inactivo",
      DEBTOR: "Deudor",
      COMPLETED: "Finalizado",
      MERGED: "Fusionado"
    };
    return labels[status] ?? status;
  }

  private increment(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private csvCell(value: unknown) {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? value.toISOString() : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  private assertBasePermission(actor: AuthUser) {
    if (
      !actor.permissions.some((permission) =>
        ["patient_analytics.read", "patients.read", "reports.read", "system.manage_all"].includes(permission)
      )
    ) {
      throw new ForbiddenException("Patient analytics permission is required");
    }
  }

  private hasAnyPermission(actor: AuthUser, permissions: Set<string>) {
    return actor.permissions.some((permission) => permissions.has(permission));
  }

  private detailResponse(
    metric: string,
    rows: Array<Record<string, unknown>>,
    total: number,
    page: number,
    pageSize: number,
    filters: AnalyticsFilters
  ) {
    return {
      metric,
      metadata: {
        branchIds: filters.branchIds,
        from: filters.from,
        to: filters.to,
        timezone: filters.timezone,
        cutoffAt: filters.cutoffAt.toISOString(),
        metricVersion: PATIENT_ANALYTICS_METRIC_VERSION
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      },
      rows
    };
  }

  private async audit(
    actor: AuthUser,
    action: "view" | "refresh" | "export",
    filters: AnalyticsFilters,
    details: Record<string, unknown>
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        branchId: filters.branchIds.length === 1 ? filters.branchIds[0] : null,
        userId: actor.id,
        actorUserId: actor.id,
        entity: "PatientAnalytics",
        action,
        after: {
          branchIds: filters.branchIds,
          from: filters.from,
          to: filters.to,
          timezone: filters.timezone,
          metricVersion: PATIENT_ANALYTICS_METRIC_VERSION,
          ...details
        }
      }
    });
  }
}
