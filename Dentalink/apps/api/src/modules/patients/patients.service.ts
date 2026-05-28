import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  BudgetStatus,
  InstallmentStatus,
  PaymentStatus,
  Prisma,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
  type PatientStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { AddPatientAlertDto } from "./dto/add-patient-alert.dto";
import { AddPatientNoteDto } from "./dto/add-patient-note.dto";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { PatientAnalysisQueryDto } from "./dto/patient-analysis-query.dto";
import { PatientQueryDto } from "./dto/patient-query.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { MergePatientsDto } from "./dto/merge-patients.dto";

type AnalysisMonth = {
  key: string;
  label: string;
};

type DistributionRow = {
  label: string;
  value: number;
  percent: number;
};

type AnalysisFilters = {
  start: Date;
  end: Date;
  branchId?: string;
  branchName: string;
  branchIds: string[];
  months: AnalysisMonth[];
};

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: PatientQueryDto) {
    const { skip, take } = resolvePagination(query);
    const where: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status as PatientStatus } : {}),
      branchId: branchScope(actor, query.branchId),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { documentNumber: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.hasDebt === "true" ? { status: "DEBTOR" } : {}),
      ...(query.isNew === "true"
        ? {
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        : {}),
      ...(query.withoutFutureAppointment === "true"
        ? {
            appointments: {
              none: {
                startAt: { gte: new Date() },
                status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
              }
            }
          }
        : {})
    };

    const rows = await this.prisma.patient.findMany({
      where,
      skip,
      take,
      include: {
        branch: true,
        medicalAlerts: { where: { isActive: true } },
        appointments: {
          where: {
            startAt: { gte: new Date() },
            status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
          },
          orderBy: { startAt: "asc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      branchId: row.branchId,
      branchName: row.branch.name,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      status: row.status,
      createdAt: row.createdAt,
      hasDebt: row.status === "DEBTOR",
      hasFutureAppointment: row.appointments.length > 0,
      isNew: row.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      hasCriticalAlert: row.medicalAlerts.some((alert) =>
        ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase())
      )
    }));
  }

  async search(actor: AuthUser, q?: string, phone?: string, email?: string, documentNumber?: string) {
    const rows = await this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        branchId: { in: actor.branchIds },
        OR: [
          q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { documentNumber: { contains: q, mode: "insensitive" } }
                ]
              }
            : undefined,
          phone ? { phone } : undefined,
          email ? { email: email.toLowerCase().trim() } : undefined,
          documentNumber ? { documentNumber } : undefined
        ].filter(Boolean) as Prisma.PatientWhereInput[]
      },
      take: 20,
      orderBy: { createdAt: "desc" }
    });

    return rows;
  }

  async analysis(actor: AuthUser, query: PatientAnalysisQueryDto) {
    const filters = await this.resolveAnalysisFilters(actor, query);
    const scopedBranchId = branchScope(actor, filters.branchId);
    const now = new Date();

    const appointmentWhere: Prisma.AppointmentWhereInput = {
      organizationId: actor.organizationId,
      branchId: scopedBranchId,
      patientId: { not: null },
      startAt: { gte: filters.start, lt: filters.end },
      status: { not: AppointmentStatus.BLOCKED }
    };
    const patientWhere: Prisma.PatientWhereInput = {
      organizationId: actor.organizationId,
      branchId: scopedBranchId,
      deletedAt: null
    };
    const budgetWhere: Prisma.BudgetWhereInput = {
      organizationId: actor.organizationId,
      treatmentPlan: {
        branchId: scopedBranchId,
        isAlternative: false
      }
    };

    const [
      appointments,
      budgets,
      patients,
      payments,
      pendingBudgets,
      plannedTotal,
      allocatedTotal,
      overdueInstallments,
      userBranches
    ] = await Promise.all([
      this.prisma.appointment.findMany({
        where: appointmentWhere,
        select: { status: true, startAt: true }
      }),
      this.prisma.budget.findMany({
        where: {
          ...budgetWhere,
          OR: [
            { createdAt: { gte: filters.start, lt: filters.end } },
            { acceptedAt: { gte: filters.start, lt: filters.end } },
            {
              acceptedAt: null,
              status: BudgetStatus.ACCEPTED,
              createdAt: { gte: filters.start, lt: filters.end }
            }
          ]
        },
        select: { status: true, total: true, createdAt: true, acceptedAt: true }
      }),
      this.prisma.patient.findMany({
        where: patientWhere,
        select: {
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
          branchId: scopedBranchId,
          paidAt: { gte: filters.start, lt: filters.end },
          status: { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] }
        },
        select: {
          amount: true,
          paidAt: true,
          paymentMethod: { select: { name: true } }
        }
      }),
      this.prisma.budget.findMany({
        where: {
          ...budgetWhere,
          status: { in: [BudgetStatus.DRAFT, BudgetStatus.SENT] }
        },
        select: { total: true, createdAt: true }
      }),
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          status: { not: TreatmentPlanItemStatus.CANCELLED },
          treatmentPlan: {
            organizationId: actor.organizationId,
            branchId: scopedBranchId,
            isAlternative: false
          }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          payment: {
            organizationId: actor.organizationId,
            status: { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] }
          },
          treatmentPlanItem: {
            treatmentPlan: {
              organizationId: actor.organizationId,
              branchId: scopedBranchId,
              isAlternative: false
            }
          }
        }
      }),
      this.prisma.installment.findMany({
        where: {
          dueDate: { lt: now },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] },
          patient: patientWhere
        },
        select: { amount: true, paidAmount: true, dueDate: true }
      }),
      this.prisma.userBranch.findMany({
        where: {
          branchId: scopedBranchId,
          user: {
            organizationId: actor.organizationId,
            deletedAt: null,
            status: "ACTIVE"
          }
        },
        select: {
          branchId: true,
          branch: { select: { name: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      })
    ]);

    const confirmedStatuses = new Set<AppointmentStatus>([
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.ARRIVED,
      AppointmentStatus.WAITING_ROOM,
      AppointmentStatus.IN_PROGRESS,
      AppointmentStatus.COMPLETED
    ]);
    const months = new Map(
      filters.months.map((month) => [
        month.key,
        {
          month: month.label,
          scheduledAppointments: 0,
          confirmedAppointments: 0,
          acceptedBudgets: 0,
          newPatients: 0
        }
      ])
    );

    const appointmentStatusMap = new Map<string, number>();
    for (const appointment of appointments) {
      const month = months.get(this.monthKey(appointment.startAt));
      if (month) {
        month.scheduledAppointments += 1;
        if (confirmedStatuses.has(appointment.status)) month.confirmedAppointments += 1;
      }
      this.incrementCount(appointmentStatusMap, this.appointmentStatusLabel(appointment.status));
    }

    const budgetStatusMap = new Map<string, number>();
    for (const budget of budgets) {
      this.incrementCount(budgetStatusMap, this.budgetStatusLabel(budget.status));
      const acceptedDate = this.acceptedBudgetDate(budget);
      if (!acceptedDate) continue;
      if (acceptedDate < filters.start || acceptedDate >= filters.end) continue;
      const month = months.get(this.monthKey(acceptedDate));
      if (month) month.acceptedBudgets += 1;
    }

    const ageMap = new Map<string, number>();
    const genderMap = new Map<string, number>();
    const delegationMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();
    const patientStatusMap = new Map<string, number>();
    for (const patient of patients) {
      this.incrementCount(ageMap, this.ageBand(patient.birthDate, filters.end));
      this.incrementCount(genderMap, this.normalizeLabel(patient.gender, "Sin genero"));
      this.incrementCount(
        delegationMap,
        this.normalizeLabel(patient.address?.city ?? patient.address?.state, "Sin delegacion")
      );
      this.incrementCount(sourceMap, this.normalizeLabel(patient.source, "Sin fuente"));
      this.incrementCount(patientStatusMap, this.patientStatusLabel(patient.status));

      const createdMonth = months.get(this.monthKey(patient.createdAt));
      if (createdMonth) createdMonth.newPatients += 1;
    }

    const paymentMethodMap = new Map<string, { value: number; amount: number }>();
    for (const payment of payments) {
      const label = this.normalizeLabel(payment.paymentMethod?.name, "Sin metodo");
      const item = paymentMethodMap.get(label) ?? { value: 0, amount: 0 };
      item.value += 1;
      item.amount += Number(payment.amount);
      paymentMethodMap.set(label, item);
    }

    const scheduledAppointments = appointments.length;
    const confirmedAppointments = appointments.filter((appointment) =>
      confirmedStatuses.has(appointment.status)
    ).length;
    const acceptedBudgets = budgets.filter((budget) => {
      const acceptedDate = this.acceptedBudgetDate(budget);
      return Boolean(acceptedDate && acceptedDate >= filters.start && acceptedDate < filters.end);
    }).length;
    const acceptedBudgetAmount = budgets.reduce((sum, budget) => {
      const acceptedDate = this.acceptedBudgetDate(budget);
      if (!acceptedDate || acceptedDate < filters.start || acceptedDate >= filters.end) return sum;
      return sum + Number(budget.total);
    }, 0);

    const outstandingBalance = Math.max(
      Number(plannedTotal._sum.total ?? 0) - Number(allocatedTotal._sum.amount ?? 0),
      0
    );
    const accumulatedDebt = overdueInstallments.reduce(
      (sum, installment) => sum + Math.max(Number(installment.amount) - Number(installment.paidAmount), 0),
      0
    );
    const pendingBudgetAmount = pendingBudgets.reduce((sum, budget) => sum + Number(budget.total), 0);
    const monthlySeries = [...months.values()];
    const attendanceSeries = monthlySeries.map((month) =>
      month.scheduledAppointments > 0
        ? this.percent(month.confirmedAppointments, month.scheduledAppointments)
        : 0
    );

    return {
      filters: {
        from: filters.start.toISOString(),
        to: new Date(filters.end.getTime() - 1).toISOString(),
        branchId: filters.branchId ?? null,
        branchName: filters.branchName,
        updatedAt: now.toISOString()
      },
      branchContext: {
        name: filters.branchName,
        users: this.uniqueUsers(userBranches).slice(0, 8),
        userCount: this.uniqueUsers(userBranches).length
      },
      conversion: {
        totals: {
          scheduledAppointments,
          confirmedAppointments,
          acceptedBudgets,
          acceptedBudgetAmount: this.roundMoney(acceptedBudgetAmount),
          confirmedRate:
            scheduledAppointments > 0 ? this.percent(confirmedAppointments, scheduledAppointments) : 0,
          acceptedRate: scheduledAppointments > 0 ? this.percent(acceptedBudgets, scheduledAppointments) : 0
        },
        funnel: [
          {
            key: "scheduledAppointments",
            label: "Citas agendadas",
            value: scheduledAppointments,
            percent: 100,
            color: "#2f80c1"
          },
          {
            key: "confirmedAppointments",
            label: "Citas confirmadas",
            value: confirmedAppointments,
            percent:
              scheduledAppointments > 0 ? this.percent(confirmedAppointments, scheduledAppointments) : 0,
            color: "#55b95a"
          },
          {
            key: "acceptedBudgets",
            label: "Presupuestos aceptados",
            value: acceptedBudgets,
            percent: scheduledAppointments > 0 ? this.percent(acceptedBudgets, scheduledAppointments) : 0,
            color: "#f2ab43"
          }
        ],
        monthly: monthlySeries
      },
      patientData: {
        totalPatients: patients.length,
        distributions: {
          age: this.distribution(ageMap, patients.length),
          gender: this.distribution(genderMap, patients.length),
          delegation: this.distribution(delegationMap, patients.length),
          paymentMethods: this.paymentDistribution(paymentMethodMap),
          actionCategories: this.distribution(budgetStatusMap, budgets.length),
          appointmentStatus: this.distribution(appointmentStatusMap, appointments.length),
          sources: this.distribution(sourceMap, patients.length),
          patientStatus: this.distribution(patientStatusMap, patients.length)
        }
      },
      globalStats: [
        {
          key: "totalPatients",
          label: "Total de pacientes",
          value: patients.length,
          tone: "green",
          trend: monthlySeries.map((month) => month.newPatients)
        },
        {
          key: "accumulatedDebt",
          label: "Deuda acumulada",
          value: this.roundMoney(accumulatedDebt || outstandingBalance),
          format: "money",
          tone: "red",
          trend: filters.months.map((month) =>
            this.roundMoney(
              overdueInstallments
                .filter((installment) => this.monthKey(installment.dueDate) === month.key)
                .reduce(
                  (sum, installment) =>
                    sum + Math.max(Number(installment.amount) - Number(installment.paidAmount), 0),
                  0
                )
            )
          )
        },
        {
          key: "averageAttendance",
          label: "Asistencia promedio",
          value: scheduledAppointments > 0 ? this.percent(confirmedAppointments, scheduledAppointments) : 0,
          format: "percent",
          tone: "blue",
          trend: attendanceSeries
        },
        {
          key: "pendingBudgets",
          label: "Presupuestos pendientes",
          value: this.roundMoney(pendingBudgetAmount),
          format: "money",
          tone: "amber",
          trend: filters.months.map((month) =>
            this.roundMoney(
              pendingBudgets
                .filter((budget) => this.monthKey(budget.createdAt) === month.key)
                .reduce((sum, budget) => sum + Number(budget.total), 0)
            )
          )
        }
      ]
    };
  }

  async findOne(actor: AuthUser, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null },
      include: {
        branch: true,
        agreement: {
          select: {
            id: true,
            name: true,
            discountPercent: true,
            priceList: { select: { id: true, name: true, isDefault: true } }
          }
        },
        contacts: true,
        address: true,
        medicalAlerts: { orderBy: { createdAt: "desc" } },
        notes: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!patient) throw new NotFoundException("Patient not found");

    const [timeline, nextAppointment, lastAppointment, financialSummary, activeTreatments] =
      await Promise.all([
        this.getTimelineInternal(actor, id),
        this.prisma.appointment.findFirst({
          where: {
            patientId: id,
            organizationId: actor.organizationId,
            startAt: { gte: new Date() },
            status: { notIn: ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CLINIC", "NO_SHOW", "RESCHEDULED"] }
          },
          orderBy: { startAt: "asc" }
        }),
        this.prisma.appointment.findFirst({
          where: {
            patientId: id,
            organizationId: actor.organizationId,
            startAt: { lt: new Date() }
          },
          orderBy: { startAt: "desc" }
        }),
        this.getPatientFinancialSummary(actor, id),
        this.prisma.treatmentPlan.count({
          where: {
            patientId: id,
            organizationId: actor.organizationId,
            branchId: { in: actor.branchIds },
            isAlternative: false,
            status: { in: [TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS] }
          }
        })
      ]);

    return {
      ...patient,
      summary: {
        nextAppointment: nextAppointment?.startAt ?? null,
        lastAppointment: lastAppointment?.startAt ?? null,
        balance:
          financialSummary.outstandingAmount > 0
            ? financialSummary.outstandingAmount
            : -financialSummary.unallocatedCredit,
        activeTreatments,
        hasCriticalAlert: patient.medicalAlerts.some((alert) =>
          ["HIGH", "CRITICAL"].includes(alert.severity.toUpperCase())
        )
      },
      timeline
    };
  }

  async create(actor: AuthUser, dto: CreatePatientDto) {
    await this.validateBranch(actor, dto.branchId);

    const potentialDuplicates = await this.findPotentialDuplicates(actor, {
      phone: dto.phone,
      email: dto.email,
      documentNumber: dto.documentNumber
    });

    const patient = await this.prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          gender: dto.gender?.trim(),
          documentType: dto.documentType?.trim(),
          documentNumber: dto.documentNumber?.trim(),
          email: dto.email?.toLowerCase().trim(),
          phone: dto.phone?.trim(),
          alternatePhone: dto.alternatePhone?.trim(),
          occupation: dto.occupation?.trim(),
          referredBy: dto.referredBy?.trim(),
          source: dto.source?.trim(),
          status: (dto.status as PatientStatus | undefined) ?? "ACTIVE"
        }
      });

      if (dto.contacts?.length) {
        await tx.patientContact.createMany({
          data: dto.contacts.map((contact) => ({
            patientId: created.id,
            name: contact.name.trim(),
            relationship: contact.relationship?.trim(),
            phone: contact.phone?.trim(),
            email: contact.email?.toLowerCase().trim(),
            isEmergencyContact: contact.isEmergencyContact ?? false
          }))
        });
      }

      if (dto.address) {
        await tx.patientAddress.create({
          data: {
            patientId: created.id,
            street: dto.address.street?.trim(),
            city: dto.address.city?.trim(),
            state: dto.address.state?.trim(),
            country: dto.address.country?.trim(),
            zipCode: dto.address.zipCode?.trim()
          }
        });
      }

      if (dto.medicalAlerts?.length) {
        await tx.patientMedicalAlert.createMany({
          data: dto.medicalAlerts.map((alert) => ({
            patientId: created.id,
            type: alert.type.trim(),
            description: alert.description.trim(),
            severity: alert.severity.trim(),
            isActive: alert.isActive ?? true
          }))
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: created.id,
          action: "create",
          after: {
            firstName: created.firstName,
            lastName: created.lastName,
            email: created.email,
            phone: created.phone,
            documentNumber: created.documentNumber
          }
        }
      });

      return created;
    });

    return {
      patient: await this.findOne(actor, patient.id),
      potentialDuplicates
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdatePatientDto) {
    const current = await this.prisma.patient.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null },
      include: { contacts: true, address: true, medicalAlerts: true }
    });

    if (!current) throw new NotFoundException("Patient not found");
    if (dto.branchId) await this.validateBranch(actor, dto.branchId);

    const potentialDuplicates = await this.findPotentialDuplicates(
      actor,
      {
        phone: dto.phone ?? current.phone ?? undefined,
        email: dto.email ?? current.email ?? undefined,
        documentNumber: dto.documentNumber ?? current.documentNumber ?? undefined
      },
      id
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
          gender: dto.gender?.trim(),
          documentType: dto.documentType?.trim(),
          documentNumber: dto.documentNumber?.trim(),
          email: dto.email?.toLowerCase().trim(),
          phone: dto.phone?.trim(),
          alternatePhone: dto.alternatePhone?.trim(),
          occupation: dto.occupation?.trim(),
          referredBy: dto.referredBy?.trim(),
          source: dto.source?.trim(),
          status: dto.status as PatientStatus | undefined
        }
      });

      if (dto.contacts) {
        await tx.patientContact.deleteMany({ where: { patientId: id } });
        if (dto.contacts.length) {
          await tx.patientContact.createMany({
            data: dto.contacts.map((contact) => ({
              patientId: id,
              name: contact.name.trim(),
              relationship: contact.relationship?.trim(),
              phone: contact.phone?.trim(),
              email: contact.email?.toLowerCase().trim(),
              isEmergencyContact: contact.isEmergencyContact ?? false
            }))
          });
        }
      }

      if (dto.address) {
        await tx.patientAddress.upsert({
          where: { patientId: id },
          create: {
            patientId: id,
            street: dto.address.street?.trim(),
            city: dto.address.city?.trim(),
            state: dto.address.state?.trim(),
            country: dto.address.country?.trim(),
            zipCode: dto.address.zipCode?.trim()
          },
          update: {
            street: dto.address.street?.trim(),
            city: dto.address.city?.trim(),
            state: dto.address.state?.trim(),
            country: dto.address.country?.trim(),
            zipCode: dto.address.zipCode?.trim()
          }
        });
      }

      if (dto.medicalAlerts) {
        await tx.patientMedicalAlert.deleteMany({ where: { patientId: id } });
        if (dto.medicalAlerts.length) {
          await tx.patientMedicalAlert.createMany({
            data: dto.medicalAlerts.map((alert) => ({
              patientId: id,
              type: alert.type.trim(),
              description: alert.description.trim(),
              severity: alert.severity.trim(),
              isActive: alert.isActive ?? true
            }))
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: id,
          action: "update_sensitive",
          before: {
            firstName: current.firstName,
            lastName: current.lastName,
            birthDate: current.birthDate,
            gender: current.gender,
            documentType: current.documentType,
            documentNumber: current.documentNumber,
            email: current.email,
            phone: current.phone,
            alternatePhone: current.alternatePhone
          },
          after: {
            firstName: dto.firstName ?? current.firstName,
            lastName: dto.lastName ?? current.lastName,
            birthDate: dto.birthDate ?? current.birthDate,
            gender: dto.gender ?? current.gender,
            documentType: dto.documentType ?? current.documentType,
            documentNumber: dto.documentNumber ?? current.documentNumber,
            email: dto.email ?? current.email,
            phone: dto.phone ?? current.phone,
            alternatePhone: dto.alternatePhone ?? current.alternatePhone
          }
        }
      });
    });

    return {
      patient: await this.findOne(actor, id),
      potentialDuplicates
    };
  }

  async softDelete(actor: AuthUser, id: string) {
    const current = await this.prisma.patient.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds }, deletedAt: null }
    });

    if (!current) throw new NotFoundException("Patient not found");

    await this.prisma.patient.update({
      where: { id },
      data: {
        status: "INACTIVE",
        deletedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Patient",
        entityId: id,
        action: "soft_delete",
        before: {
          status: current.status,
          deletedAt: current.deletedAt
        },
        after: {
          status: "INACTIVE",
          deletedAt: new Date().toISOString()
        }
      }
    });

    return { success: true };
  }

  async addNote(actor: AuthUser, patientId: string, dto: AddPatientNoteDto) {
    await this.ensurePatientExists(actor, patientId);

    const note = await this.prisma.patientNote.create({
      data: {
        patientId,
        userId: actor.id,
        note: dto.note.trim(),
        isPrivate: dto.isPrivate ?? false
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "PatientNote",
        entityId: note.id,
        action: "create",
        after: {
          patientId,
          isPrivate: note.isPrivate
        }
      }
    });

    return note;
  }

  async addAlert(actor: AuthUser, patientId: string, dto: AddPatientAlertDto) {
    await this.ensurePatientExists(actor, patientId);

    const alert = await this.prisma.patientMedicalAlert.create({
      data: {
        patientId,
        type: dto.type.trim(),
        description: dto.description.trim(),
        severity: dto.severity.trim(),
        isActive: dto.isActive ?? true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "PatientMedicalAlert",
        entityId: alert.id,
        action: "create",
        after: {
          patientId,
          type: alert.type,
          severity: alert.severity,
          isActive: alert.isActive
        }
      }
    });

    return alert;
  }

  async timeline(actor: AuthUser, patientId: string) {
    await this.ensurePatientExists(actor, patientId);
    return this.getTimelineInternal(actor, patientId);
  }

  async merge(actor: AuthUser, dto: MergePatientsDto) {
    const targetPatientId = dto.targetPatientId.trim();
    const sourcePatientId = dto.sourcePatientId.trim();
    if (!targetPatientId || !sourcePatientId || targetPatientId === sourcePatientId) {
      throw new BadRequestException("Select two different patients");
    }

    const [target, source] = await Promise.all([
      this.prisma.patient.findFirst({
        where: {
          id: targetPatientId,
          organizationId: actor.organizationId,
          branchId: { in: actor.branchIds },
          deletedAt: null
        }
      }),
      this.prisma.patient.findFirst({
        where: {
          id: sourcePatientId,
          organizationId: actor.organizationId,
          branchId: { in: actor.branchIds },
          deletedAt: null
        }
      })
    ]);
    if (!target || !source) throw new NotFoundException("Patient not found");

    await this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.patientContact.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.patientMedicalAlert.updateMany({
          where: { patientId: source.id },
          data: { patientId: target.id }
        }),
        tx.patientNote.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.appointment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.medicalCondition.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.allergy.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.medication.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.clinicalEvolution.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.prescription.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.clinicalDocument.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.odontogramRecord.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.toothCondition.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.toothProcedure.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.periodontalChart.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.treatmentPlan.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.budget.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.payment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.paymentLink.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.installmentPlan.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.installment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.refund.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.collectionCase.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.fileAttachment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.consent.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } }),
        tx.labOrder.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })
      ]);

      const [targetAddress, targetMedicalHistory] = await Promise.all([
        tx.patientAddress.findUnique({ where: { patientId: target.id } }),
        tx.medicalHistory.findUnique({ where: { patientId: target.id } })
      ]);
      if (!targetAddress) {
        await tx.patientAddress.updateMany({
          where: { patientId: source.id },
          data: { patientId: target.id }
        });
      }
      if (!targetMedicalHistory) {
        await tx.medicalHistory.updateMany({
          where: { patientId: source.id },
          data: { patientId: target.id }
        });
      }

      await tx.patient.update({
        where: { id: target.id },
        data: {
          agreementId: target.agreementId ?? source.agreementId
        }
      });
      await tx.patient.update({
        where: { id: source.id },
        data: {
          status: "INACTIVE",
          deletedAt: new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Patient",
          entityId: target.id,
          action: "merge",
          after: {
            targetPatientId: target.id,
            sourcePatientId: source.id
          }
        }
      });
    });

    return this.findOne(actor, target.id);
  }

  private async getTimelineInternal(actor: AuthUser, patientId: string) {
    const [notes, alerts, patient] = await Promise.all([
      this.prisma.patientNote.findMany({
        where: { patientId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.patientMedicalAlert.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.patient.findFirst({
        where: { id: patientId, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
        select: { createdAt: true }
      })
    ]);

    if (!patient) throw new NotFoundException("Patient not found");

    const events = [
      {
        type: "PATIENT_CREATED",
        date: patient.createdAt,
        payload: {}
      },
      ...notes.map((note) => ({
        type: "NOTE",
        date: note.createdAt,
        payload: {
          id: note.id,
          note: note.note,
          isPrivate: note.isPrivate,
          user: note.user
        }
      })),
      ...alerts.map((alert) => ({
        type: "ALERT",
        date: alert.createdAt,
        payload: {
          id: alert.id,
          type: alert.type,
          description: alert.description,
          severity: alert.severity,
          isActive: alert.isActive
        }
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return events;
  }

  private async getPatientFinancialSummary(actor: AuthUser, patientId: string) {
    const billablePaymentStatus = { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] };
    const [plannedTotal, allocatedTotal, totalPayments, overdueInstallments] = await Promise.all([
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          treatmentPlan: {
            organizationId: actor.organizationId,
            patientId,
            branchId: { in: actor.branchIds },
            isAlternative: false
          },
          status: { not: TreatmentPlanItemStatus.CANCELLED }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          payment: {
            organizationId: actor.organizationId,
            patientId,
            status: billablePaymentStatus
          },
          treatmentPlanItem: {
            treatmentPlan: {
              organizationId: actor.organizationId,
              patientId,
              branchId: { in: actor.branchIds },
              isAlternative: false
            }
          }
        }
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          patientId,
          status: billablePaymentStatus
        }
      }),
      this.prisma.installment.count({
        where: {
          patientId,
          patient: { organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
          dueDate: { lt: new Date() },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] }
        }
      })
    ]);

    const plannedAmount = Number(plannedTotal._sum.total ?? 0);
    const allocatedPaidAmount = Number(allocatedTotal._sum.amount ?? 0);
    const totalPaidAmount = Number(totalPayments._sum.amount ?? 0);

    return {
      plannedAmount: this.roundMoney(plannedAmount),
      allocatedPaidAmount: this.roundMoney(allocatedPaidAmount),
      totalPaidAmount: this.roundMoney(totalPaidAmount),
      outstandingAmount: this.roundMoney(Math.max(plannedAmount - allocatedPaidAmount, 0)),
      unallocatedCredit: this.roundMoney(Math.max(totalPaidAmount - allocatedPaidAmount, 0)),
      overdueInstallments
    };
  }

  private async validateBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, branchId),
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });

    if (!branch) throw new BadRequestException("Invalid branchId");
  }

  private async ensurePatientExists(actor: AuthUser, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null
      },
      select: { id: true }
    });

    if (!patient) throw new NotFoundException("Patient not found");
  }

  private async findPotentialDuplicates(
    actor: AuthUser,
    fields: { phone?: string; email?: string; documentNumber?: string },
    excludeId?: string
  ) {
    const conditions: Prisma.PatientWhereInput[] = [];

    if (fields.phone?.trim()) {
      conditions.push({ phone: fields.phone.trim() });
    }

    if (fields.email?.trim()) {
      conditions.push({ email: fields.email.toLowerCase().trim() });
    }

    if (fields.documentNumber?.trim()) {
      conditions.push({ documentNumber: fields.documentNumber.trim() });
    }

    if (!conditions.length) return [];

    return this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: { in: actor.branchIds },
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: conditions
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        documentNumber: true,
        createdAt: true,
        status: true
      },
      take: 10,
      orderBy: { createdAt: "desc" }
    });
  }

  private async resolveAnalysisFilters(
    actor: AuthUser,
    query: PatientAnalysisQueryDto
  ): Promise<AnalysisFilters> {
    if (!actor.branchIds.length) throw new NotFoundException("Branch not found");

    const now = new Date();
    const parsedTo = this.parseMonthInput(query.to) ?? { year: now.getFullYear(), month: now.getMonth() };
    const parsedFrom = this.parseMonthInput(query.from) ?? this.shiftMonth(parsedTo, -11);
    const start = new Date(Date.UTC(parsedFrom.year, parsedFrom.month, 1));
    const end = new Date(Date.UTC(parsedTo.year, parsedTo.month + 1, 1));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException("Invalid analysis range");
    }

    let branchName = "Todas las sucursales";
    let branchIds = actor.branchIds;
    if (query.branchId) {
      branchScope(actor, query.branchId);
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: query.branchId,
          organizationId: actor.organizationId,
          deletedAt: null
        },
        select: { id: true, name: true }
      });
      if (!branch) throw new NotFoundException("Branch not found");
      branchName = branch.name;
      branchIds = [branch.id];
    }

    return {
      start,
      end,
      branchId: query.branchId,
      branchName,
      branchIds,
      months: this.monthRange(start, end)
    };
  }

  private parseMonthInput(value?: string) {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{1,2})/.exec(value.trim());
    if (!match) throw new BadRequestException("Invalid analysis month");
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
      throw new BadRequestException("Invalid analysis month");
    }
    return { year, month };
  }

  private shiftMonth(month: { year: number; month: number }, offset: number) {
    const shifted = new Date(Date.UTC(month.year, month.month + offset, 1));
    return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
  }

  private monthRange(start: Date, end: Date): AnalysisMonth[] {
    const out: AnalysisMonth[] = [];
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor < end) {
      out.push({
        key: this.monthKey(cursor),
        label: this.monthLabel(cursor)
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return out;
  }

  private monthKey(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private monthLabel(date: Date) {
    const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${names[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`;
  }

  private incrementCount(map: Map<string, number>, label: string, amount = 1) {
    map.set(label, (map.get(label) ?? 0) + amount);
  }

  private distribution(map: Map<string, number>, total: number, limit = 8): DistributionRow[] {
    if (total <= 0) return [];
    const sorted = [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    const visible = sorted.slice(0, limit);
    const hidden = sorted.slice(limit);
    if (hidden.length) {
      visible.push({
        label: "Otros",
        value: hidden.reduce((sum, row) => sum + row.value, 0)
      });
    }
    return visible.map((row) => ({
      ...row,
      percent: this.percent(row.value, total)
    }));
  }

  private paymentDistribution(map: Map<string, { value: number; amount: number }>) {
    const total = [...map.values()].reduce((sum, row) => sum + row.value, 0);
    if (total <= 0) return [];
    return [...map.entries()]
      .map(([label, row]) => ({
        label,
        value: row.value,
        amount: this.roundMoney(row.amount),
        percent: this.percent(row.value, total)
      }))
      .sort((a, b) => b.value - a.value);
  }

  private acceptedBudgetDate(budget: { status: BudgetStatus; acceptedAt: Date | null; createdAt: Date }) {
    if (budget.status !== BudgetStatus.ACCEPTED) return null;
    return budget.acceptedAt ?? budget.createdAt;
  }

  private normalizeLabel(value: string | null | undefined, fallback: string) {
    const clean = value?.trim();
    return clean ? clean : fallback;
  }

  private ageBand(birthDate: Date | null, reference: Date) {
    if (!birthDate) return "Sin edad";
    let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
    const hasHadBirthday =
      reference.getUTCMonth() > birthDate.getUTCMonth() ||
      (reference.getUTCMonth() === birthDate.getUTCMonth() &&
        reference.getUTCDate() >= birthDate.getUTCDate());
    if (!hasHadBirthday) age -= 1;
    if (age < 15) return "Menor de 14";
    if (age <= 20) return "Entre 15 y 20";
    if (age <= 35) return "Entre 21 y 35";
    if (age <= 50) return "Entre 36 y 50";
    if (age <= 65) return "Entre 51 y 65";
    if (age <= 70) return "Entre 66 y 70";
    return "Sobre 70";
  }

  private appointmentStatusLabel(status: AppointmentStatus) {
    const labels: Record<AppointmentStatus, string> = {
      SCHEDULED: "Agendada",
      CONFIRMED: "Confirmada",
      PENDING_CONFIRMATION: "Por confirmar",
      ARRIVED: "Llegada",
      WAITING_ROOM: "Sala de espera",
      IN_PROGRESS: "En atencion",
      COMPLETED: "Atendida",
      CANCELLED_BY_PATIENT: "Cancelada paciente",
      CANCELLED_BY_CLINIC: "Cancelada clinica",
      NO_SHOW: "No asistio",
      RESCHEDULED: "Reagendada",
      BLOCKED: "Bloqueada"
    };
    return labels[status];
  }

  private budgetStatusLabel(status: BudgetStatus) {
    const labels: Record<BudgetStatus, string> = {
      DRAFT: "Borrador",
      SENT: "Enviado",
      ACCEPTED: "Aceptado",
      REJECTED: "Rechazado",
      EXPIRED: "Expirado",
      CANCELLED: "Cancelado"
    };
    return labels[status];
  }

  private patientStatusLabel(status: PatientStatus) {
    const labels: Record<PatientStatus, string> = {
      NEW: "Nuevo",
      ACTIVE: "Activo",
      IN_TREATMENT: "En tratamiento",
      INACTIVE: "Inactivo",
      DEBTOR: "Deudor",
      COMPLETED: "Completado"
    };
    return labels[status];
  }

  private uniqueUsers(
    rows: Array<{
      branch: { name: string };
      user: { id: string; firstName: string; lastName: string; email: string };
    }>
  ) {
    const users = new Map<string, { id: string; name: string; email: string; branchName: string }>();
    for (const row of rows) {
      if (users.has(row.user.id)) continue;
      users.set(row.user.id, {
        id: row.user.id,
        name: `${row.user.firstName} ${row.user.lastName}`,
        email: row.user.email,
        branchName: row.branch.name
      });
    }
    return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private percent(part: number, total: number) {
    if (total <= 0) return 0;
    return this.roundMoney((part / total) * 100);
  }
}
