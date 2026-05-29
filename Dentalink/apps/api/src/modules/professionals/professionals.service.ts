import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateProfessionalDto } from "./dto/create-professional.dto";
import { UpdateProfessionalDto } from "./dto/update-professional.dto";
import { ConfigProfessionalDto } from "./dto/config-professional.dto";

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const where: Prisma.ProfessionalWhereInput = {
      organizationId: actor.organizationId,
      branches: { some: { branchId: { in: actor.branchIds } } },
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
        branches: { include: { branch: true } },
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
          item.defaultAppointmentDurationMinutes ?? item.agendaSlotMinutes ?? item.branch.agendaSlotMinutes
      }))
    }));
  }

  async findOne(actor: AuthUser, id: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id, organizationId: actor.organizationId, branches: { some: { branchId: { in: actor.branchIds } } } },
      include: {
        specialties: { include: { specialty: true } },
        branches: { include: { branch: true } },
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
          item.defaultAppointmentDurationMinutes ?? item.agendaSlotMinutes ?? item.branch.agendaSlotMinutes
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
        await tx.professionalBranch.deleteMany({ where: { professionalId: id } });
        await tx.professionalBranch.createMany({
          data: [...new Set(dto.branchIds)].map((branchId, index) => ({ professionalId: id, branchId, isPrimary: index === 0 })),
          skipDuplicates: true
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

    const assignment = await this.prisma.professionalBranch.findFirst({
      where: {
        professionalId: id,
        branchId,
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
