import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, Prisma, ProfessionalBranchStatus } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ConfigProfessionalDto } from "./dto/config-professional.dto";
import { TransferProfessionalBranchDto } from "./dto/transfer-professional-branch.dto";

const CLOSED_TRANSFER_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.COMPLETED
];

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const now = new Date();
    const where: Prisma.ProfessionalWhereInput = {
      organizationId: actor.organizationId,
      branches: {
        some: {
          branchId: { in: actor.branchIds },
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
      specialties: row.specialties.map((item) => item.specialty),
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
      specialties: professional.specialties.map((item) => item.specialty),
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
    await this.findOne(actor, id);
    await this.validateForeignKeys(actor, dto.userId, dto.specialtyIds, dto.branchIds);

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
      const count = await this.prisma.specialty.count({
        where: {
          id: { in: [...new Set(specialtyIds)] },
          organizationId: actor.organizationId,
          isActive: true
        }
      });
      if (count !== new Set(specialtyIds).size) throw new BadRequestException("One or more specialties are invalid");
    }

    if (branchIds) {
      if (!branchIds.length) throw new BadRequestException("At least one branch is required");
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
}
