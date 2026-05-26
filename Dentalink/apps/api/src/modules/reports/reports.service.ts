import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  CashMovementType,
  CollectionCaseStatus,
  InstallmentStatus,
  LabOrderStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { assertBranchAccess } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  BaseReportQueryDto,
  ProfessionalsReportQueryDto,
  ReportExportFormat,
  ReportResponse
} from "./dto/reports.dto";

type ResolvedFilters = {
  start: Date;
  end: Date;
  branchId?: string;
  format: ReportExportFormat;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
      ...(filters.branchId ? { branchId: filters.branchId } : {})
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

    const professionalGroup = new Map<string, { professionalId: string; name: string; total: number; cancelled: number; noShow: number; bookedMinutes: number }>();
    for (const row of rows) {
      const key = row.professionalId;
      const name = `${row.professional.firstName} ${row.professional.lastName}`;
      const item = professionalGroup.get(key) ?? { professionalId: key, name, total: 0, cancelled: 0, noShow: 0, bookedMinutes: 0 };
      item.total += 1;
      item.bookedMinutes += row.durationMinutes;
      if (this.isCancelled(row.status)) item.cancelled += 1;
      if (row.status === AppointmentStatus.NO_SHOW) item.noShow += 1;
      professionalGroup.set(key, item);
    }

    const occupancyByProfessional = await this.computeProfessionalOccupancy(actor, filters, [...professionalGroup.values()]);

    const chairGroup = new Map<string, { chairId: string; chairName: string; total: number; bookedMinutes: number }>();
    for (const row of rows) {
      if (!row.chairId || !row.chair) continue;
      const key = row.chairId;
      const item = chairGroup.get(key) ?? { chairId: key, chairName: row.chair.name, total: 0, bookedMinutes: 0 };
      item.total += 1;
      item.bookedMinutes += row.durationMinutes;
      chairGroup.set(key, item);
    }
    const occupancyByChair = this.computeChairOccupancy([...chairGroup.values()], occupancyByProfessional.totalAvailableMinutes);

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
      ...(filters.branchId ? { branchId: filters.branchId } : {})
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
      ...(filters.branchId ? { branchId: filters.branchId } : {})
    };

    const [plansCreated, plansAccepted, inProgress, completed, planRows] = await Promise.all([
      this.prisma.treatmentPlan.count({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } }
      }),
      this.prisma.treatmentPlan.count({
        where: {
          ...baseWhere,
          status: { in: [TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.COMPLETED] },
          OR: [{ acceptedAt: { gte: filters.start, lt: filters.end } }, { createdAt: { gte: filters.start, lt: filters.end } }]
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
      ...(filters.branchId ? { branchId: filters.branchId } : {})
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

      const methodKey = payment.paymentMethodId;
      const current = incomeByMethodMap.get(methodKey) ?? { method: payment.paymentMethod.name, amount: 0 };
      current.amount += amount;
      incomeByMethodMap.set(methodKey, current);
    }

    const [plannedTotal, allocatedTotal, delinquentInstallments, cashMovements, productionItems] = await Promise.all([
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          status: { not: TreatmentPlanItemStatus.CANCELLED },
          treatmentPlan: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          treatmentPlanItem: {
            treatmentPlan: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
          }
        }
      }),
      this.prisma.installment.findMany({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
          patient: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
        },
        select: { amount: true, paidAmount: true }
      }),
      this.prisma.cashMovement.findMany({
        where: {
          createdAt: { gte: filters.start, lt: filters.end },
          cashRegister: {
            organizationId: actor.organizationId,
            ...(filters.branchId ? { branchId: filters.branchId } : {})
          }
        },
        select: {
          amount: true,
          type: true,
          cashRegister: { select: { branchId: true, branch: { select: { name: true } } } }
        }
      }),
      this.prisma.treatmentPlanItem.findMany({
        where: {
          status: TreatmentPlanItemStatus.COMPLETED,
          completedAt: { gte: filters.start, lt: filters.end },
          treatmentPlan: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
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
      delinquentInstallments.reduce((sum, installment) => sum + (Number(installment.amount) - Number(installment.paidAmount)), 0)
    );

    const cashByBranchMap = new Map<string, { branchId: string; branchName: string; netAmount: number }>();
    for (const movement of cashMovements) {
      const key = movement.cashRegister.branchId;
      const existing = cashByBranchMap.get(key) ?? {
        branchId: key,
        branchName: movement.cashRegister.branch.name,
        netAmount: 0
      };

      const amount = Number(movement.amount);
      if (movement.type === CashMovementType.EXPENSE || movement.type === CashMovementType.REFUND) {
        existing.netAmount -= amount;
      } else if (movement.type !== CashMovementType.CLOSING) {
        existing.netAmount += amount;
      }
      cashByBranchMap.set(key, existing);
    }

    const productionByProfessionalMap = new Map<string, { professionalId: string; name: string; amount: number }>();
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
    const cashByBranchRows = [...cashByBranchMap.values()].map((row) => ({ ...row, netAmount: this.roundMoney(row.netAmount) }));
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

  async getProfessionalsReport(actor: AuthUser, query: ProfessionalsReportQueryDto): Promise<ReportResponse<unknown>> {
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
          ...(filters.branchId ? { branchId: filters.branchId } : {})
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
            ...(filters.branchId ? { branchId: filters.branchId } : {})
          }
        },
        select: { total: true, treatmentPlan: { select: { professionalId: true } } }
      }),
      this.prisma.labOrder.findMany({
        where: {
          organizationId: actor.organizationId,
          professionalId: { in: professionalIds },
          ...(filters.branchId
            ? {
                treatmentPlan: {
                  branchId: filters.branchId
                }
              }
            : {})
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

  private async getAgendaMetrics(actor: AuthUser, filters: ResolvedFilters) {
    const where: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      startAt: { gte: filters.start, lt: filters.end },
      ...(filters.branchId ? { branchId: filters.branchId } : {})
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
      ...(filters.branchId ? { branchId: filters.branchId } : {})
    };

    const [newPatients, activePatients, withoutFutureAppointment, bySource] = await Promise.all([
      this.prisma.patient.count({ where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } } }),
      this.prisma.patient.count({ where: { ...baseWhere, status: { in: ["ACTIVE", "IN_TREATMENT"] } } }),
      this.prisma.patient.count({
        where: {
          ...baseWhere,
          appointments: {
            none: {
              startAt: { gte: new Date() },
              status: { notIn: [AppointmentStatus.CANCELLED_BY_CLINIC, AppointmentStatus.CANCELLED_BY_PATIENT, AppointmentStatus.NO_SHOW] }
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
      ...(filters.branchId ? { branchId: filters.branchId } : {})
    };

    const [plansCreated, plansAccepted, inProgress, completed] = await Promise.all([
      this.prisma.treatmentPlan.count({
        where: { ...baseWhere, createdAt: { gte: filters.start, lt: filters.end } }
      }),
      this.prisma.treatmentPlan.count({
        where: {
          ...baseWhere,
          status: { in: [TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.COMPLETED] },
          OR: [{ acceptedAt: { gte: filters.start, lt: filters.end } }, { createdAt: { gte: filters.start, lt: filters.end } }]
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
          ...(filters.branchId ? { branchId: filters.branchId } : {})
        },
        select: { amount: true }
      }),
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          status: { not: TreatmentPlanItemStatus.CANCELLED },
          treatmentPlan: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          treatmentPlanItem: {
            treatmentPlan: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
          }
        }
      }),
      this.prisma.installment.findMany({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
          patient: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
        },
        select: { amount: true, paidAmount: true }
      })
    ]);

    return {
      income: this.roundMoney(payments.reduce((sum, row) => sum + Number(row.amount), 0)),
      outstanding: this.roundMoney(Math.max(Number(plannedTotal._sum.total ?? 0) - Number(allocatedTotal._sum.amount ?? 0), 0)),
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
          treatmentPlan: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
        }
      }),
      this.prisma.labOrder.count({
        where: {
          organizationId: actor.organizationId,
          status: { in: [LabOrderStatus.REQUESTED, LabOrderStatus.SENT, LabOrderStatus.IN_PROCESS] },
          ...(filters.branchId ? { treatmentPlan: { branchId: filters.branchId } } : {})
        }
      }),
      this.prisma.inventoryItem.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          ...(filters.branchId ? { branchId: filters.branchId } : {})
        },
        select: { stock: true, minStock: true }
      }),
      this.prisma.collectionCase.count({
        where: {
          status: { in: [CollectionCaseStatus.PENDING, CollectionCaseStatus.CONTACTED, CollectionCaseStatus.PROMISE_TO_PAY] },
          nextContactAt: { lt: new Date() },
          patient: { organizationId: actor.organizationId, ...(filters.branchId ? { branchId: filters.branchId } : {}) }
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
    rows: Array<{ professionalId: string; name: string; total: number; cancelled: number; noShow: number; bookedMinutes: number }>
  ) {
    const schedules = await this.prisma.professionalSchedule.findMany({
      where: {
        professional: { organizationId: actor.organizationId },
        isActive: true,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
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
      const dailyMinutes = this.minutesDiff(schedule.startTime, schedule.endTime) - this.breakMinutes(schedule.breakStartTime, schedule.breakEndTime);
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

    const totalAvailableMinutes = [...availableByProfessional.values()].reduce((sum, value) => sum + value, 0);
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
    const endInclusive = query.dateTo ? new Date(query.dateTo) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endInclusive.getTime())) {
      throw new BadRequestException("Invalid date range");
    }

    const end = new Date(endInclusive);
    end.setHours(23, 59, 59, 999);

    const branchId = query.branchId ?? actor.branchIds[0];
    if (!branchId) throw new NotFoundException("Branch not found");
    assertBranchAccess(actor, branchId);

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

  private withExport<T>(
    response: ReportResponse<T>,
    baseFileName: string,
    rows: Record<string, unknown>[],
    format: ReportExportFormat
  ): ReportResponse<T> {
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

    const tsv = this.toDelimited(normalized, "\t");
    return {
      ...response,
      export: {
        format: ReportExportFormat.XLSX,
        fileName: `${baseFileName}.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: Buffer.from(tsv, "utf8").toString("base64")
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
    const raw = String(value ?? "");
    const needsQuote = raw.includes(delimiter) || raw.includes('"') || raw.includes("\n");
    if (!needsQuote) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
  }

  private isCancelled(status: AppointmentStatus) {
    return status === AppointmentStatus.CANCELLED_BY_CLINIC || status === AppointmentStatus.CANCELLED_BY_PATIENT;
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
