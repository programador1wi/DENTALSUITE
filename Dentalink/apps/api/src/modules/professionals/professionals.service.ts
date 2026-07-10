import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  Prisma,
  ProfessionalBranchStatus,
  ProfessionalContractCommissionBase,
  ProfessionalContractPaymentCondition,
  ProfessionalContractPaymentDiscount,
  ProfessionalContractType
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { assertBranchAccess, branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  ALLOWED_SPECIALTY_NAMES,
  type AllowedSpecialtyName,
  isAllowedSpecialtyName,
  resolveAllowedSpecialtyName,
  withAllowedSpecialtyName
} from "../../common/utils/specialty-policy.util";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ConfigProfessionalDto } from "./dto/config-professional.dto";
import { TransferProfessionalBranchDto } from "./dto/transfer-professional-branch.dto";
import { BulkProfessionalContractDto } from "./dto/bulk-professional-contract.dto";

const CLOSED_TRANSFER_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.COMPLETED
];

const GENERAL_SPECIALTY_NAME = ALLOWED_SPECIALTY_NAMES[0];
const ORTHODONTICS_SPECIALTY_NAME = ALLOWED_SPECIALTY_NAMES[1];
const MIN_BRANCH_STAFFING = [
  { specialtyName: GENERAL_SPECIALTY_NAME, minimum: 2 },
  { specialtyName: ORTHODONTICS_SPECIALTY_NAME, minimum: 1 }
] as const;

type NormalizedContractTarget = {
  professionalId: string;
  branchIds: string[];
};

type NormalizedContractCategoryRate = {
  procedureCategoryId: string;
  rate: number;
};

type NormalizedContractFixedAmount = {
  procedureId: string;
  priceListId: string | null;
  amount: Prisma.Decimal;
  currency: string;
};

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, branchId?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const now = new Date();
    const where: Prisma.ProfessionalWhereInput = {
      organizationId: actor.organizationId,
      branches: {
        some: {
          branchId: branchScope(actor, branchId),
          status: ProfessionalBranchStatus.ACTIVE,
          OR: [{ endsAt: null }, { endsAt: { gt: now } }]
        }
      },
      ...(active !== undefined ? { isActive: active === "true" } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { licenseNumber: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const rows = await this.prisma.professional.findMany({
      where,
      skip,
      take,
      include: {
        specialties: { include: { specialty: true } },
        branches: {
          where: {
            status: ProfessionalBranchStatus.ACTIVE,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          },
          include: { branch: true }
        },
        user: true
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    });

    return rows.map((row) => ({
      ...row,
      specialties: row.specialties
        .map((item) => withAllowedSpecialtyName(item.specialty))
        .filter((specialty): specialty is NonNullable<typeof specialty> => Boolean(specialty)),
      branches: row.branches.map((item) => ({
        ...item.branch,
        agendaSlotMinutes: item.agendaSlotMinutes ?? item.branch.agendaSlotMinutes,
        defaultAppointmentDurationMinutes:
          item.defaultAppointmentDurationMinutes ?? item.agendaSlotMinutes ?? item.branch.agendaSlotMinutes,
        status: item.status,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        endedReason: item.endedReason
      }))
    }));
  }

  async findOne(actor: AuthUser, id: string) {
    const now = new Date();
    const professional = await this.prisma.professional.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        branches: {
          some: {
            branchId: { in: actor.branchIds },
            status: ProfessionalBranchStatus.ACTIVE,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        }
      },
      include: {
        specialties: { include: { specialty: true } },
        branches: {
          where: {
            status: ProfessionalBranchStatus.ACTIVE,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          },
          include: { branch: true }
        },
        user: true
      }
    });

    if (!professional) throw new NotFoundException("Professional not found");

    return {
      ...professional,
      specialties: professional.specialties
        .map((item) => withAllowedSpecialtyName(item.specialty))
        .filter((specialty): specialty is NonNullable<typeof specialty> => Boolean(specialty)),
      branches: professional.branches.map((item) => ({
        ...item.branch,
        agendaSlotMinutes: item.agendaSlotMinutes ?? item.branch.agendaSlotMinutes,
        defaultAppointmentDurationMinutes:
          item.defaultAppointmentDurationMinutes ?? item.agendaSlotMinutes ?? item.branch.agendaSlotMinutes,
        status: item.status,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        endedReason: item.endedReason
      }))
    };
  }

  async create(actor: AuthUser, dto: CreateProfessionalDto) {
    await this.validateForeignKeys(actor, dto.userId, dto.specialtyIds, dto.branchIds);

    const created = await this.prisma.$transaction(async (tx) => {
      const professional = await tx.professional.create({
        data: {
          organizationId: actor.organizationId,
          userId: dto.userId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          licenseNumber: dto.licenseNumber?.trim(),
          phone: dto.phone?.trim(),
          email: dto.email?.toLowerCase().trim(),
          color: dto.color,
          commissionRate: dto.commissionRate
        }
      });

      await tx.professionalSpecialty.createMany({
        data: [...new Set(dto.specialtyIds)].map((specialtyId) => ({ professionalId: professional.id, specialtyId })),
        skipDuplicates: true
      });

      await tx.professionalBranch.createMany({
        data: [...new Set(dto.branchIds)].map((branchId, index) => ({
          professionalId: professional.id,
          branchId,
          isPrimary: index === 0
        })),
        skipDuplicates: true
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Professional",
          entityId: professional.id,
          action: "create",
          after: { fullName: `${professional.firstName} ${professional.lastName}` }
        }
      });

      return professional;
    });

    return this.findOne(actor, created.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateProfessionalDto) {
    const current = await this.findOne(actor, id);
    await this.validateForeignKeys(actor, dto.userId, dto.specialtyIds, dto.branchIds);
    await this.assertStaffingReductionKeepsMinimum(actor, id, {
      currentBranchIds: current.branches.map((branch) => branch.id),
      currentSpecialtyNames: current.specialties.map((specialty) => specialty.name as AllowedSpecialtyName),
      currentIsActive: current.isActive,
      nextBranchIds: dto.branchIds ? [...new Set(dto.branchIds)] : current.branches.map((branch) => branch.id),
      nextSpecialtyIds: dto.specialtyIds ?? current.specialties.map((specialty) => specialty.id),
      nextIsActive: dto.isActive ?? current.isActive
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.professional.update({
        where: { id },
        data: {
          userId: dto.userId,
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          licenseNumber: dto.licenseNumber?.trim(),
          phone: dto.phone?.trim(),
          email: dto.email?.toLowerCase().trim(),
          color: dto.color,
          commissionRate: dto.commissionRate,
          isActive: dto.isActive
        }
      });

      if (dto.specialtyIds) {
        await tx.professionalSpecialty.deleteMany({ where: { professionalId: id } });
        await tx.professionalSpecialty.createMany({
          data: [...new Set(dto.specialtyIds)].map((specialtyId) => ({ professionalId: id, specialtyId })),
          skipDuplicates: true
        });
      }

      if (dto.branchIds) {
        const nextBranchIds = [...new Set(dto.branchIds)];
        const endedAt = new Date();

        for (const [index, branchId] of nextBranchIds.entries()) {
          await tx.professionalBranch.upsert({
            where: { professionalId_branchId: { professionalId: id, branchId } },
            update: {
              isPrimary: index === 0,
              status: ProfessionalBranchStatus.ACTIVE,
              endsAt: null,
              endedReason: null
            },
            create: {
              professionalId: id,
              branchId,
              isPrimary: index === 0,
              status: ProfessionalBranchStatus.ACTIVE
            }
          });
        }

        await tx.professionalBranch.updateMany({
          where: {
            professionalId: id,
            branchId: { notIn: nextBranchIds },
            status: { not: ProfessionalBranchStatus.ENDED }
          },
          data: {
            isPrimary: false,
            status: ProfessionalBranchStatus.ENDED,
            endsAt: endedAt,
            endedReason: "Retirado desde Gestion de profesionales"
          }
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Professional",
          entityId: id,
          action: "update",
          after: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            isActive: dto.isActive
          }
        }
      });
    });

    return this.findOne(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  async updateAgendaConfig(actor: AuthUser, id: string, branchId: string, dto: ConfigProfessionalDto) {
    await this.findOne(actor, id);

    if (!actor.branchIds.includes(branchId)) throw new BadRequestException("Invalid branchId");
    const now = new Date();

    const assignment = await this.prisma.professionalBranch.findFirst({
      where: {
        professionalId: id,
        branchId,
        status: ProfessionalBranchStatus.ACTIVE,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        professional: { organizationId: actor.organizationId },
        branch: { organizationId: actor.organizationId, status: "ACTIVE", deletedAt: null }
      },
      include: { branch: true }
    });

    if (!assignment) throw new BadRequestException("Professional is not assigned to this branch");

    const slotMinutes = dto.agendaSlotMinutes ?? assignment.agendaSlotMinutes ?? assignment.branch.agendaSlotMinutes;
    const defaultDuration = dto.defaultAppointmentDurationMinutes ?? assignment.defaultAppointmentDurationMinutes ?? slotMinutes;
    if (defaultDuration % slotMinutes !== 0) {
      throw new BadRequestException("defaultAppointmentDurationMinutes must be a multiple of agendaSlotMinutes");
    }

    await this.prisma.professionalBranch.update({
      where: { professionalId_branchId: { professionalId: id, branchId } },
      data: {
        agendaSlotMinutes: dto.agendaSlotMinutes,
        defaultAppointmentDurationMinutes: dto.defaultAppointmentDurationMinutes
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "ProfessionalBranch",
        entityId: `${id}:${branchId}`,
        action: "update_agenda_config",
        after: {
          professionalId: id,
          branchId,
          agendaSlotMinutes: dto.agendaSlotMinutes,
          defaultAppointmentDurationMinutes: dto.defaultAppointmentDurationMinutes
        }
      }
    });

    return this.findOne(actor, id);
  }

  async transferBranch(actor: AuthUser, dto: TransferProfessionalBranchDto) {
    if (dto.fromProfessionalId === dto.toProfessionalId) {
      throw new BadRequestException("Replacement professional must be different from current professional");
    }
    if (!actor.branchIds.includes(dto.branchId)) throw new BadRequestException("Invalid branchId");

    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();
    if (Number.isNaN(effectiveAt.getTime())) throw new BadRequestException("Invalid effectiveAt");

    const moveFutureAppointments = dto.moveFutureAppointments ?? true;
    const moveFutureBlocks = dto.moveFutureBlocks ?? true;
    const copySchedules = dto.copySchedules ?? true;
    const copyAgendaConfig = dto.copyAgendaConfig ?? true;
    const endSourceAssignment = dto.endSourceAssignment ?? true;

    const [branch, sourceAssignment, targetAssignment] = await Promise.all([
      this.prisma.branch.findFirst({
        where: {
          id: dto.branchId,
          organizationId: actor.organizationId,
          status: "ACTIVE",
          deletedAt: null
        }
      }),
      this.prisma.professionalBranch.findFirst({
        where: {
          professionalId: dto.fromProfessionalId,
          branchId: dto.branchId,
          status: ProfessionalBranchStatus.ACTIVE,
          professional: { organizationId: actor.organizationId, isActive: true },
          branch: { organizationId: actor.organizationId, status: "ACTIVE", deletedAt: null }
        },
        include: { branch: true, professional: true }
      }),
      this.prisma.professionalBranch.findFirst({
        where: {
          professionalId: dto.toProfessionalId,
          branchId: dto.branchId,
          status: ProfessionalBranchStatus.ACTIVE,
          startsAt: { lte: effectiveAt },
          OR: [{ endsAt: null }, { endsAt: { gt: effectiveAt } }],
          professional: {
            organizationId: actor.organizationId,
            isActive: true
          },
          branch: { organizationId: actor.organizationId, status: "ACTIVE", deletedAt: null }
        },
        include: { professional: true }
      })
    ]);

    if (!branch) throw new BadRequestException("Invalid branchId");
    if (!sourceAssignment) throw new BadRequestException("Current professional is not active in selected branch");
    if (sourceAssignment.startsAt > effectiveAt) {
      throw new BadRequestException("effectiveAt must be after the current professional branch start date");
    }
    if (sourceAssignment.endsAt && sourceAssignment.endsAt <= effectiveAt) {
      throw new BadRequestException("Current professional branch assignment already ends before effectiveAt");
    }
    if (!targetAssignment) {
      throw new BadRequestException("Replacement professional is not active in selected branch");
    }
    const targetProfessional = targetAssignment.professional;

    if (endSourceAssignment) {
      await this.assertStaffingReductionKeepsMinimum(actor, dto.fromProfessionalId, {
        currentBranchIds: [dto.branchId],
        currentSpecialtyNames: await this.resolveProfessionalAllowedSpecialtyNames(actor, dto.fromProfessionalId),
        currentIsActive: true,
        nextBranchIds: [],
        nextSpecialtyIds: [],
        nextIsActive: false
      });
    }

    const transferStatuses = this.transferableStatuses(moveFutureAppointments, moveFutureBlocks);
    const futureAppointments = transferStatuses.length
      ? await this.prisma.appointment.findMany({
          where: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            professionalId: dto.fromProfessionalId,
            startAt: { gte: effectiveAt },
            status: { in: transferStatuses }
          },
          select: { id: true, title: true, status: true, startAt: true, endAt: true }
        })
      : [];

    const appointmentConflicts = futureAppointments.length
      ? await this.prisma.appointment.findMany({
          where: {
            organizationId: actor.organizationId,
            professionalId: dto.toProfessionalId,
            status: { notIn: CLOSED_TRANSFER_STATUSES },
            OR: futureAppointments.map((appointment) => ({
              startAt: { lt: appointment.endAt },
              endAt: { gt: appointment.startAt }
            }))
          },
          select: { id: true, title: true, status: true, startAt: true, endAt: true, branch: { select: { name: true } } }
        })
      : [];

    if (appointmentConflicts.length) {
      throw new BadRequestException({
        message: "Replacement professional has appointment conflicts in the transfer range",
        conflicts: appointmentConflicts
      });
    }

    const sourceSchedules = copySchedules
      ? await this.prisma.professionalSchedule.findMany({
          where: {
            professionalId: dto.fromProfessionalId,
            branchId: dto.branchId,
            isActive: true,
            professional: { organizationId: actor.organizationId }
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
        })
      : [];

    const appointmentIds = futureAppointments.map((appointment) => appointment.id);
    const appointmentCount = futureAppointments.filter((appointment) => appointment.status !== AppointmentStatus.BLOCKED).length;
    const blockCount = futureAppointments.filter((appointment) => appointment.status === AppointmentStatus.BLOCKED).length;
    const now = new Date();
    const sourceEndsImmediately = effectiveAt <= now;

    const transfer = await this.prisma.$transaction(async (tx) => {
      await tx.professionalBranch.upsert({
        where: { professionalId_branchId: { professionalId: dto.toProfessionalId, branchId: dto.branchId } },
        update: {
          isPrimary: false,
          status: ProfessionalBranchStatus.ACTIVE,
          endsAt: null,
          endedReason: null,
          ...(copyAgendaConfig
            ? {
                agendaSlotMinutes: sourceAssignment.agendaSlotMinutes ?? sourceAssignment.branch.agendaSlotMinutes,
                defaultAppointmentDurationMinutes:
                  sourceAssignment.defaultAppointmentDurationMinutes ??
                  sourceAssignment.agendaSlotMinutes ??
                  sourceAssignment.branch.agendaSlotMinutes
              }
            : {})
        },
        create: {
          professionalId: dto.toProfessionalId,
          branchId: dto.branchId,
          isPrimary: false,
          status: ProfessionalBranchStatus.ACTIVE,
          startsAt: effectiveAt,
          ...(copyAgendaConfig
            ? {
                agendaSlotMinutes: sourceAssignment.agendaSlotMinutes ?? sourceAssignment.branch.agendaSlotMinutes,
                defaultAppointmentDurationMinutes:
                  sourceAssignment.defaultAppointmentDurationMinutes ??
                  sourceAssignment.agendaSlotMinutes ??
                  sourceAssignment.branch.agendaSlotMinutes
              }
            : {})
        }
      });

      if (endSourceAssignment) {
        await tx.professionalBranch.update({
          where: { professionalId_branchId: { professionalId: dto.fromProfessionalId, branchId: dto.branchId } },
          data: {
            isPrimary: false,
            status: sourceEndsImmediately ? ProfessionalBranchStatus.ENDED : ProfessionalBranchStatus.ACTIVE,
            endsAt: effectiveAt,
            endedReason: dto.notes?.trim() || `Sustituido por ${targetProfessional.firstName} ${targetProfessional.lastName}`,
            lastTransferredToId: dto.toProfessionalId,
            lastTransferredAt: now
          }
        });
      }

      if (copySchedules) {
        await tx.professionalSchedule.updateMany({
          where: {
            professionalId: dto.toProfessionalId,
            branchId: dto.branchId,
            isActive: true
          },
          data: { isActive: false }
        });

        if (sourceSchedules.length) {
          await tx.professionalSchedule.createMany({
            data: sourceSchedules.map((schedule) => ({
              professionalId: dto.toProfessionalId,
              branchId: dto.branchId,
              chairId: schedule.chairId,
              dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              breakStartTime: schedule.breakStartTime,
              breakEndTime: schedule.breakEndTime,
              isActive: true
            }))
          });
        }
      }

      if (appointmentIds.length) {
        await tx.appointment.updateMany({
          where: { id: { in: appointmentIds } },
          data: {
            professionalId: dto.toProfessionalId,
            updatedById: actor.id
          }
        });

        await tx.auditLog.createMany({
          data: futureAppointments.map((appointment) => ({
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            actorUserId: actor.id,
            entity: "Appointment",
            entityId: appointment.id,
            action: "transfer_professional",
            after: {
              fromProfessionalId: dto.fromProfessionalId,
              toProfessionalId: dto.toProfessionalId,
              effectiveAt: effectiveAt.toISOString()
            } as Prisma.InputJsonValue
          }))
        });
      }

      return tx.professionalBranchTransfer.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          fromProfessionalId: dto.fromProfessionalId,
          toProfessionalId: dto.toProfessionalId,
          effectiveAt,
          moveFutureAppointments,
          moveFutureBlocks,
          copySchedules,
          copyAgendaConfig,
          endSourceAssignment,
          appointmentsTransferred: appointmentCount,
          blocksTransferred: blockCount,
          schedulesCopied: sourceSchedules.length,
          notes: dto.notes?.trim(),
          createdById: actor.id
        }
      });
    });

    return {
      ...transfer,
      appointmentsTransferred: appointmentCount,
      blocksTransferred: blockCount,
      schedulesCopied: sourceSchedules.length
    };
  }

  async bulkUpdateContracts(actor: AuthUser, dto: BulkProfessionalContractDto) {
    const context = await this.prepareBulkContractContext(actor, dto);
    const { targets, priceList, categoryRates, fixedAmounts } = context;

    const now = new Date();
    const contractType = this.toContractType(dto.contractType);
    const commissionBase = this.toCommissionBase(dto.commissionBase);
    const paymentDiscount = this.toPaymentDiscount(dto.paymentDiscount);
    const paymentCondition = this.toPaymentCondition(dto.paymentCondition);
    const batchId = `bulk-contract-${now.getTime()}-${actor.id}`;

    const createdContracts = await this.prisma.$transaction(async (tx) => {
      const created: Prisma.ProfessionalContractGetPayload<{
        include: { branches: true; categoryRates: true; fixedAmounts: true };
      }>[] = [];

      for (const target of targets) {
        const previousContract = await tx.professionalContract.findFirst({
          where: {
            organizationId: actor.organizationId,
            professionalId: target.professionalId,
            isActive: true,
            branches: { some: { branchId: { in: target.branchIds } } }
          },
          include: {
            branches: true,
            categoryRates: true,
            fixedAmounts: true
          },
          orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }]
        });
        const previousForMerge = dto.keepPrevious ? previousContract : null;
        const contractCategoryRates = dto.keepPrevious
          ? this.mergeContractCategoryRates(previousForMerge?.categoryRates, categoryRates)
          : categoryRates;
        const contractFixedAmounts = dto.keepPrevious
          ? this.mergeContractFixedAmounts(previousForMerge?.fixedAmounts, fixedAmounts)
          : fixedAmounts;

        const otherBranchesBeforeRemoval = dto.removeOtherBranches
          ? await tx.professionalContract.findFirst({
              where: {
                organizationId: actor.organizationId,
                professionalId: target.professionalId,
                isActive: true,
                branches: { some: { branchId: { notIn: target.branchIds } } }
              },
              include: {
                branches: true,
                categoryRates: true,
                fixedAmounts: true
              },
              orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }]
            })
          : null;

        if (!dto.keepPrevious) {
          await tx.professionalContract.updateMany({
            where: {
              organizationId: actor.organizationId,
              professionalId: target.professionalId,
              isActive: true,
              branches: { some: { branchId: { in: target.branchIds } } }
            },
            data: { isActive: false, endsAt: now }
          });
        }

        if (dto.removeOtherBranches) {
          await tx.professionalContract.updateMany({
            where: {
              organizationId: actor.organizationId,
              professionalId: target.professionalId,
              isActive: true,
              branches: { some: { branchId: { notIn: target.branchIds } } }
            },
            data: { isActive: false, endsAt: now }
          });
        }

        await tx.professional.update({
          where: { id: target.professionalId },
          data: { commissionRate: dto.commissionRate }
        });

        const contract = await tx.professionalContract.create({
          data: {
            organizationId: actor.organizationId,
            professionalId: target.professionalId,
            contractType,
            commissionBase,
            paymentDiscount,
            paymentCondition,
            commissionRate: dto.commissionRate,
            priceListId: priceList?.id,
            priceListName: priceList?.name,
            startsAt: now,
            createdById: actor.id,
            branches: {
              create: target.branchIds.map((branchId) => ({ branchId }))
            },
            categoryRates: {
              create: contractCategoryRates.map((rate) => ({
                procedureCategoryId: rate.procedureCategoryId,
                rate: rate.rate
              }))
            },
            fixedAmounts: {
              create: contractFixedAmounts
            }
          },
          include: {
            branches: true,
            categoryRates: true,
            fixedAmounts: true
          }
        });

        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            entity: "ProfessionalContract",
            entityId: contract.id,
            action: "bulk_create",
            after: {
              professionalId: target.professionalId,
              branchIds: target.branchIds,
              commissionRate: dto.commissionRate,
              contractType,
              commissionBase,
              paymentDiscount,
              paymentCondition,
              priceListId: priceList?.id ?? null,
              categoryRates: contractCategoryRates.map((rate) => ({
                procedureCategoryId: rate.procedureCategoryId,
                rate: Number(rate.rate)
              })),
              fixedAmounts: contractFixedAmounts.map((amount) => ({
                procedureId: amount.procedureId,
                priceListId: amount.priceListId,
                amount: Number(amount.amount),
                currency: amount.currency
              })),
              keepPrevious: dto.keepPrevious ?? false,
              removeOtherBranches: dto.removeOtherBranches ?? false,
              batchId,
              zoneCodes: context.zoneCodes,
              before: {
                selectedContractId: previousContract?.id ?? null,
                selectedBranchIds: previousContract?.branches.map((branch) => branch.branchId) ?? [],
                selectedCategoryRates: previousContract?.categoryRates.length ?? 0,
                selectedFixedAmounts: previousContract?.fixedAmounts.length ?? 0,
                otherContractId: otherBranchesBeforeRemoval?.id ?? null,
                otherBranchIds: otherBranchesBeforeRemoval?.branches.map((branch) => branch.branchId) ?? []
              }
            } as Prisma.InputJsonValue
          }
        });

        created.push(contract);
      }

      return created;
    });

    return {
      updatedProfessionals: createdContracts.length,
      updatedScopes: targets.reduce((sum, target) => sum + target.branchIds.length, 0),
      fixedAmounts: createdContracts.reduce((sum, contract) => sum + contract.fixedAmounts.length, 0),
      categoryRates: createdContracts.reduce((sum, contract) => sum + contract.categoryRates.length, 0),
      contracts: createdContracts.map((contract) => ({
        id: contract.id,
        professionalId: contract.professionalId,
        branchIds: contract.branches.map((branch) => branch.branchId),
        commissionRate: Number(contract.commissionRate),
        priceListId: contract.priceListId,
        priceListName: contract.priceListName,
        categoryRates: contract.categoryRates.length,
        fixedAmounts: contract.fixedAmounts.length
      }))
    };
  }

  async previewBulkUpdateContracts(actor: AuthUser, dto: BulkProfessionalContractDto) {
    const context = await this.prepareBulkContractContext(actor, dto);
    const impactedCurrentContracts = await this.prisma.professionalContract.count({
      where: {
        organizationId: actor.organizationId,
        professionalId: { in: context.professionalIds },
        isActive: true,
        branches: { some: { branchId: { in: context.branchIds } } }
      }
    });
    const removedOtherContracts = dto.removeOtherBranches
      ? await this.prisma.professionalContract.count({
          where: {
            organizationId: actor.organizationId,
            professionalId: { in: context.professionalIds },
            isActive: true,
            branches: { some: { branchId: { notIn: context.branchIds } } }
          }
        })
      : 0;
    const totalScopes = context.targets.reduce((sum, target) => sum + target.branchIds.length, 0);
    const warnings: string[] = [];
    if (dto.commissionRate === 0 && totalScopes > 1) warnings.push("Se aplicara 0% a multiples alcances.");
    if (dto.removeOtherBranches) warnings.push("Se cerraran contratos activos fuera de las sucursales seleccionadas.");
    if (!dto.keepPrevious) warnings.push("No se conservaran montos fijos ni porcentajes avanzados anteriores.");

    return {
      professionals: context.professionalIds.length,
      branches: context.branchIds.length,
      scopes: totalScopes,
      contractsToCreate: context.targets.length,
      currentContractsToClose: dto.keepPrevious ? 0 : impactedCurrentContracts,
      otherContractsToClose: removedOtherContracts,
      fixedAmounts: context.fixedAmounts.length,
      categoryRates: context.categoryRates.length,
      priceListId: context.priceList?.id ?? null,
      priceListName: context.priceList?.name ?? null,
      zoneCodes: context.zoneCodes,
      warnings
    };
  }

  private transferableStatuses(moveFutureAppointments: boolean, moveFutureBlocks: boolean) {
    const statuses: AppointmentStatus[] = [];
    if (moveFutureAppointments) {
      statuses.push(
        AppointmentStatus.SCHEDULED,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.PENDING_CONFIRMATION,
        AppointmentStatus.ARRIVED,
        AppointmentStatus.WAITING_ROOM,
        AppointmentStatus.IN_PROGRESS
      );
    }
    if (moveFutureBlocks) statuses.push(AppointmentStatus.BLOCKED);
    return statuses;
  }

  private async prepareBulkContractContext(actor: AuthUser, dto: BulkProfessionalContractDto) {
    const targets = this.normalizeContractTargets(dto.targets);
    if (!targets.length) throw new BadRequestException("At least one professional and branch is required");

    const professionalIds = [...new Set(targets.map((target) => target.professionalId))];
    const branchIds = [...new Set(targets.flatMap((target) => target.branchIds))];
    branchIds.forEach((branchId) => assertBranchAccess(actor, branchId));

    const [branches, professionals, priceList] = await Promise.all([
      this.prisma.branch.findMany({
        where: {
          id: { in: branchIds },
          organizationId: actor.organizationId,
          status: "ACTIVE",
          deletedAt: null
        },
        include: { zone: true }
      }),
      this.prisma.professional.findMany({
        where: {
          id: { in: professionalIds },
          organizationId: actor.organizationId,
          isActive: true
        },
        include: {
          branches: {
            where: { status: ProfessionalBranchStatus.ACTIVE },
            select: { branchId: true }
          }
        }
      }),
      dto.priceListId
        ? this.prisma.priceList.findFirst({
            where: {
              id: dto.priceListId,
              organizationId: actor.organizationId,
              isActive: true
            },
            include: {
              categories: {
                where: { isActive: true },
                select: {
                  procedureCategoryId: true
                }
              },
              items: {
                select: {
                  procedureId: true,
                  price: true,
                  currency: true
                }
              }
            }
          })
        : Promise.resolve(null)
    ]);

    if (branches.length !== branchIds.length) throw new BadRequestException("One or more branches are invalid");
    if (professionals.length !== professionalIds.length) throw new BadRequestException("One or more professionals are invalid");
    if (dto.priceListId && !priceList) throw new BadRequestException("Invalid priceListId");

    const professionalsById = new Map(professionals.map((professional) => [professional.id, professional]));
    for (const target of targets) {
      const professional = professionalsById.get(target.professionalId);
      const assignedBranchIds = new Set(professional?.branches.map((branch) => branch.branchId) ?? []);
      const invalidBranch = target.branchIds.find((branchId) => !assignedBranchIds.has(branchId));
      if (invalidBranch) {
        throw new BadRequestException("Professional is not assigned to one or more selected branches");
      }
    }

    const categoryRates = this.normalizeContractCategoryRates(dto.categoryRates ?? []);
    if (categoryRates.length) {
      if (priceList) {
        const allowedCategoryIds = new Set(
          priceList.categories.flatMap((category) =>
            category.procedureCategoryId ? [category.procedureCategoryId] : []
          )
        );
        const invalidRate = categoryRates.find((rate) => !allowedCategoryIds.has(rate.procedureCategoryId));
        if (invalidRate) throw new BadRequestException("One or more procedure categories are outside the selected price list");
      } else {
        const categoryCount = await this.prisma.procedureCategory.count({
          where: {
            id: { in: categoryRates.map((rate) => rate.procedureCategoryId) },
            organizationId: actor.organizationId,
            isActive: true
          }
        });
        if (categoryCount !== categoryRates.length) {
          throw new BadRequestException("One or more procedure categories are invalid");
        }
      }
    }

    const fixedAmounts = this.normalizeContractFixedAmounts(dto, priceList);
    const zoneCodes = [...new Set(branches.map((branch) => branch.zone?.code ?? "SIN_ZONA"))];

    return {
      targets,
      professionalIds,
      branchIds,
      zoneCodes,
      priceList,
      categoryRates,
      fixedAmounts
    };
  }

  private normalizeContractTargets(targets: BulkProfessionalContractDto["targets"]): NormalizedContractTarget[] {
    const byProfessional = new Map<string, Set<string>>();
    for (const target of targets ?? []) {
      const professionalId = target.professionalId?.trim();
      if (!professionalId) continue;
      const branchIds = (target.branchIds ?? []).map((branchId) => branchId.trim()).filter(Boolean);
      if (!branchIds.length) continue;
      const current = byProfessional.get(professionalId) ?? new Set<string>();
      branchIds.forEach((branchId) => current.add(branchId));
      byProfessional.set(professionalId, current);
    }

    return [...byProfessional.entries()].map(([professionalId, branchIds]) => ({
      professionalId,
      branchIds: [...branchIds]
    }));
  }

  private normalizeContractCategoryRates(
    rates: NonNullable<BulkProfessionalContractDto["categoryRates"]>
  ): NormalizedContractCategoryRate[] {
    const byCategory = new Map<string, number>();
    for (const rate of rates) {
      const procedureCategoryId = rate.procedureCategoryId?.trim();
      if (!procedureCategoryId || !Number.isFinite(rate.rate) || rate.rate <= 0) continue;
      byCategory.set(procedureCategoryId, rate.rate);
    }
    return [...byCategory.entries()].map(([procedureCategoryId, rate]) => ({ procedureCategoryId, rate }));
  }

  private normalizeContractFixedAmounts(
    dto: BulkProfessionalContractDto,
    priceList:
      | {
          id: string;
          items: { procedureId: string; price: Prisma.Decimal; currency: string }[];
        }
      | null
  ): NormalizedContractFixedAmount[] {
    if (dto.fixedAmounts === undefined) {
      return (
        priceList?.items.map((item) => ({
          procedureId: item.procedureId,
          priceListId: priceList.id,
          amount: item.price,
          currency: item.currency
        })) ?? []
      );
    }

    if (!dto.fixedAmounts.length) return [];
    if (!priceList) throw new BadRequestException("A price list is required when fixed amounts are provided");

    const priceListItems = new Map(priceList.items.map((item) => [item.procedureId, item]));
    const byProcedure = new Map<string, NormalizedContractFixedAmount>();
    for (const amount of dto.fixedAmounts) {
      const procedureId = amount.procedureId?.trim();
      if (!procedureId) continue;
      const priceListItem = priceListItems.get(procedureId);
      if (!priceListItem) {
        throw new BadRequestException("One or more fixed amount procedures are outside the selected price list");
      }
      if (amount.priceListId && amount.priceListId !== priceList.id) {
        throw new BadRequestException("One or more fixed amounts reference another price list");
      }
      if (!Number.isFinite(amount.amount) || amount.amount < 0) {
        throw new BadRequestException("Fixed amounts must be greater than or equal to zero");
      }
      byProcedure.set(procedureId, {
        procedureId,
        priceListId: priceList.id,
        amount: new Prisma.Decimal(amount.amount),
        currency: amount.currency ?? priceListItem.currency
      });
    }

    return [...byProcedure.values()];
  }

  private mergeContractCategoryRates(
    previous:
      | {
          procedureCategoryId: string;
          rate: Prisma.Decimal;
        }[]
      | undefined,
    next: { procedureCategoryId: string; rate: number }[]
  ) {
    const byCategory = new Map<string, { procedureCategoryId: string; rate: number | Prisma.Decimal }>();
    previous?.forEach((rate) => {
      byCategory.set(rate.procedureCategoryId, {
        procedureCategoryId: rate.procedureCategoryId,
        rate: rate.rate
      });
    });
    next.forEach((rate) => byCategory.set(rate.procedureCategoryId, rate));
    return [...byCategory.values()];
  }

  private mergeContractFixedAmounts(
    previous:
      | {
          procedureId: string;
          priceListId: string | null;
          amount: Prisma.Decimal;
          currency: string;
        }[]
      | undefined,
    next: NormalizedContractFixedAmount[]
  ) {
    const byProcedure = new Map<
      string,
      { procedureId: string; priceListId: string | null; amount: Prisma.Decimal; currency: string }
    >();
    previous?.forEach((amount) => {
      byProcedure.set(amount.procedureId, {
        procedureId: amount.procedureId,
        priceListId: amount.priceListId,
        amount: amount.amount,
        currency: amount.currency
      });
    });
    next.forEach((amount) => byProcedure.set(amount.procedureId, amount));
    return [...byProcedure.values()];
  }

  private toContractType(value: BulkProfessionalContractDto["contractType"]) {
    return value === "performed" ? ProfessionalContractType.PERFORMED : ProfessionalContractType.PERFORMED_AND_PAID;
  }

  private toCommissionBase(value: BulkProfessionalContractDto["commissionBase"]) {
    if (value === "lab") return ProfessionalContractCommissionBase.LAB;
    if (value === "all") return ProfessionalContractCommissionBase.ALL;
    return ProfessionalContractCommissionBase.CLINICAL;
  }

  private toPaymentDiscount(value: BulkProfessionalContractDto["paymentDiscount"]) {
    if (value === "yes") return ProfessionalContractPaymentDiscount.PAYMENT_METHOD;
    if (value === "fixed") return ProfessionalContractPaymentDiscount.FIXED_AMOUNT;
    return ProfessionalContractPaymentDiscount.NONE;
  }

  private toPaymentCondition(value: BulkProfessionalContractDto["paymentCondition"]) {
    if (value === "on_due") return ProfessionalContractPaymentCondition.ON_DUE;
    if (value === "thirty_days") return ProfessionalContractPaymentCondition.THIRTY_DAYS;
    return ProfessionalContractPaymentCondition.ANY_DUE_DATE;
  }

  private async validateForeignKeys(actor: AuthUser, userId?: string, specialtyIds?: string[], branchIds?: string[]) {
    if (userId) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          organizationId: actor.organizationId,
          deletedAt: null,
          isActive: true
        }
      });
      if (!user) throw new BadRequestException("Invalid userId");
    }

    if (specialtyIds) {
      if (!specialtyIds.length) throw new BadRequestException("At least one specialty is required");
      const uniqueSpecialtyIds = [...new Set(specialtyIds)];
      const specialties = await this.prisma.specialty.findMany({
        where: {
          id: { in: uniqueSpecialtyIds },
          organizationId: actor.organizationId,
          isActive: true
        }
      });
      if (
        specialties.length !== uniqueSpecialtyIds.length ||
        specialties.some((specialty) => !isAllowedSpecialtyName(specialty.name))
      ) {
        throw new BadRequestException("One or more specialties are invalid");
      }
    }

    if (branchIds) {
      if (!branchIds.length) throw new BadRequestException("At least one branch is required");
      if (new Set(branchIds).size !== 1) {
        throw new BadRequestException("Un profesional solo puede tener una sucursal activa. Selecciona una sucursal clinica.");
      }
      const count = await this.prisma.branch.count({
        where: {
          id: { in: [...new Set(branchIds)] },
          users: { some: { userId: actor.id } },
          organizationId: actor.organizationId,
          status: "ACTIVE",
          deletedAt: null
        }
      });
      if (count !== new Set(branchIds).size) throw new BadRequestException("One or more branches are invalid");
    }
  }

  private async assertStaffingReductionKeepsMinimum(
    actor: AuthUser,
    professionalId: string,
    input: {
      currentBranchIds: string[];
      currentSpecialtyNames: AllowedSpecialtyName[];
      currentIsActive: boolean;
      nextBranchIds: string[];
      nextSpecialtyIds: string[];
      nextIsActive: boolean;
    }
  ) {
    const nextSpecialtyNames = input.nextSpecialtyIds.length
      ? await this.resolveAllowedSpecialtyNames(actor, input.nextSpecialtyIds)
      : [];
    const affectedBranchIds = [...new Set([...input.currentBranchIds, ...input.nextBranchIds])];

    for (const branchId of affectedBranchIds) {
      for (const rule of MIN_BRANCH_STAFFING) {
        const currentContribution =
          input.currentIsActive &&
          input.currentBranchIds.includes(branchId) &&
          input.currentSpecialtyNames.includes(rule.specialtyName)
            ? 1
            : 0;
        const nextContribution =
          input.nextIsActive && input.nextBranchIds.includes(branchId) && nextSpecialtyNames.includes(rule.specialtyName)
            ? 1
            : 0;

        if (nextContribution >= currentContribution) continue;

        const count = await this.countBranchProfessionalsBySpecialty(actor, branchId, rule.specialtyName, professionalId);
        if (count + nextContribution < rule.minimum) {
          throw new BadRequestException(
            `Branch must keep at least ${rule.minimum} active ${rule.specialtyName} professional(s)`
          );
        }
      }
    }
  }

  private async countBranchProfessionalsBySpecialty(
    actor: AuthUser,
    branchId: string,
    specialtyName: AllowedSpecialtyName,
    excludeProfessionalId?: string
  ) {
    const now = new Date();
    const professionals = await this.prisma.professional.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        ...(excludeProfessionalId ? { id: { not: excludeProfessionalId } } : {}),
        branches: {
          some: {
            branchId,
            status: ProfessionalBranchStatus.ACTIVE,
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        }
      },
      select: {
        specialties: { select: { specialty: { select: { name: true } } } }
      }
    });

    return professionals.filter((professional) =>
      professional.specialties.some((item) => resolveAllowedSpecialtyName(item.specialty.name) === specialtyName)
    ).length;
  }

  private async resolveProfessionalAllowedSpecialtyNames(actor: AuthUser, professionalId: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: actor.organizationId },
      select: { specialties: { select: { specialty: { select: { name: true } } } } }
    });

    if (!professional) throw new BadRequestException("Invalid professionalId");
    return professional.specialties
      .map((item) => resolveAllowedSpecialtyName(item.specialty.name))
      .filter((specialtyName): specialtyName is AllowedSpecialtyName => Boolean(specialtyName));
  }

  private async resolveAllowedSpecialtyNames(actor: AuthUser, specialtyIds: string[]) {
    const specialties = await this.prisma.specialty.findMany({
      where: {
        id: { in: [...new Set(specialtyIds)] },
        organizationId: actor.organizationId,
        isActive: true
      },
      select: { name: true }
    });

    return specialties
      .map((specialty) => resolveAllowedSpecialtyName(specialty.name))
      .filter((specialtyName): specialtyName is AllowedSpecialtyName => Boolean(specialtyName));
  }
}
