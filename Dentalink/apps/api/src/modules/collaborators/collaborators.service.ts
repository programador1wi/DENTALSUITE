import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProfessionalBranchStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuthUser } from "../../common/types/auth-user";
import { assertBranchAccess } from "../../common/utils/branch-scope.util";
import { resolvePagination } from "../../common/utils/pagination.util";
import { isAllowedSpecialtyName } from "../../common/utils/specialty-policy.util";
import { PrismaService } from "../../database/prisma.service";
import { CreateCollaboratorDto, CollaboratorScheduleDto } from "./dto/create-collaborator.dto";
import { CreateProfessionalAccessDto } from "./dto/create-professional-access.dto";
import { ListCollaboratorsQueryDto } from "./dto/list-collaborators-query.dto";

type DirectoryBranch = { id: string; code: string | null; name: string; isPrimary: boolean };
type DirectoryRow = {
  id: string;
  userId: string | null;
  professionalId: string | null;
  kind: "ADMINISTRATIVE" | "CLINICAL";
  hasAccess: boolean;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: { id: string; code: string | null; name: string } | null;
  accessBranches: DirectoryBranch[];
  clinicalBranch: { id: string; code: string | null; name: string } | null;
  specialties: { id: string; name: string }[];
  licenseNumber: string | null;
  commissionRate: string | null;
  accessStatus: "ACTIVE" | "INACTIVE" | "LOCKED" | "PENDING" | null;
  clinicalStatus: "ACTIVE" | "INACTIVE" | "NOT_APPLICABLE";
};

const FIXED_END_TIMES_BY_DAY: Partial<Record<number, string>> = {
  1: "19:00",
  2: "19:00",
  3: "19:00",
  4: "19:00",
  5: "19:00",
  6: "15:00"
};

@Injectable()
export class CollaboratorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListCollaboratorsQueryDto) {
    const canReadUsers = this.can(actor, "users.read");
    const canReadProfessionals = this.can(actor, "professionals.read");
    if (!canReadUsers && !canReadProfessionals) throw new ForbiddenException("Insufficient permissions");
    assertBranchAccess(actor, query.branchId);

    const search = query.search?.trim();
    const branchIds = query.branchId ? [query.branchId] : actor.branchIds;
    const userWhere: Prisma.UserWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      branches: { some: { branchId: { in: branchIds } } },
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const professionalWhere: Prisma.ProfessionalWhereInput = {
      organizationId: actor.organizationId,
      branches: {
        some: {
          branchId: { in: branchIds },
          status: ProfessionalBranchStatus.ACTIVE,
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }]
        }
      },
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

    const [users, professionals] = await Promise.all([
      canReadUsers
        ? this.prisma.user.findMany({
            where: userWhere,
            include: {
              role: true,
              branches: { include: { branch: true } },
              professional: {
                include: {
                  specialties: { include: { specialty: true } },
                  branches: {
                    where: { status: ProfessionalBranchStatus.ACTIVE },
                    include: { branch: true }
                  }
                }
              }
            }
          })
        : Promise.resolve([]),
      canReadProfessionals
        ? this.prisma.professional.findMany({
            where: professionalWhere,
            include: {
              specialties: { include: { specialty: true } },
              branches: {
                where: { status: ProfessionalBranchStatus.ACTIVE },
                include: { branch: true }
              },
              user: { include: { role: true, branches: { include: { branch: true } } } }
            }
          })
        : Promise.resolve([])
    ]);

    const rows = new Map<string, DirectoryRow>();
    for (const user of users) {
      const professional = canReadProfessionals ? user.professional : null;
      rows.set(`user:${user.id}`, {
        id: `user:${user.id}`,
        userId: user.id,
        professionalId: professional?.id ?? null,
        kind: professional ? "CLINICAL" : "ADMINISTRATIVE",
        hasAccess: true,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role ? { id: user.role.id, code: user.role.code, name: user.role.name } : null,
        accessBranches: user.branches.map(({ branch, isPrimary }) => ({
          id: branch.id,
          code: branch.code,
          name: branch.name,
          isPrimary
        })),
        clinicalBranch: professional?.branches[0]
          ? {
              id: professional.branches[0].branch.id,
              code: professional.branches[0].branch.code,
              name: professional.branches[0].branch.name
            }
          : null,
        specialties: canReadProfessionals && professional
          ? professional.specialties
              .filter(({ specialty }) => isAllowedSpecialtyName(specialty.name))
              .map(({ specialty }) => ({ id: specialty.id, name: specialty.name }))
          : [],
        licenseNumber: canReadProfessionals ? professional?.licenseNumber ?? null : null,
        commissionRate: canReadProfessionals && professional ? String(professional.commissionRate) : null,
        accessStatus: user.status,
        clinicalStatus: professional ? (professional.isActive ? "ACTIVE" : "INACTIVE") : "NOT_APPLICABLE"
      });
    }

    for (const professional of professionals) {
      const user = professional.user;
      const key = user ? `user:${user.id}` : `professional:${professional.id}`;
      const existing = rows.get(key);
      rows.set(key, {
        id: key,
        userId: user?.id ?? null,
        professionalId: professional.id,
        kind: "CLINICAL",
        hasAccess: Boolean(user),
        firstName: canReadUsers && user ? user.firstName : professional.firstName,
        lastName: canReadUsers && user ? user.lastName : professional.lastName,
        email: canReadUsers && user ? user.email : professional.email,
        phone: canReadUsers && user ? user.phone : professional.phone,
        role: canReadUsers && user?.role ? { id: user.role.id, code: user.role.code, name: user.role.name } : existing?.role ?? null,
        accessBranches: canReadUsers && user
          ? user.branches.map(({ branch, isPrimary }) => ({
              id: branch.id,
              code: branch.code,
              name: branch.name,
              isPrimary
            }))
          : existing?.accessBranches ?? [],
        clinicalBranch: professional.branches[0]
          ? {
              id: professional.branches[0].branch.id,
              code: professional.branches[0].branch.code,
              name: professional.branches[0].branch.name
            }
          : null,
        specialties: professional.specialties
          .filter(({ specialty }) => isAllowedSpecialtyName(specialty.name))
          .map(({ specialty }) => ({ id: specialty.id, name: specialty.name })),
        licenseNumber: professional.licenseNumber,
        commissionRate: String(professional.commissionRate),
        accessStatus: canReadUsers ? user?.status ?? null : null,
        clinicalStatus: professional.isActive ? "ACTIVE" : "INACTIVE"
      });
    }

    const filtered = [...rows.values()]
      .filter((row) => {
        if (query.kind === "ADMINISTRATIVE" && row.kind !== "ADMINISTRATIVE") return false;
        if (query.kind === "CLINICAL" && row.kind !== "CLINICAL") return false;
        if (query.kind === "CLINICAL_WITHOUT_ACCESS" && (row.kind !== "CLINICAL" || row.hasAccess)) return false;
        if (query.accessStatus === "WITHOUT_ACCESS" && row.hasAccess) return false;
        if (query.accessStatus && query.accessStatus !== "WITHOUT_ACCESS" && row.accessStatus !== query.accessStatus) return false;
        if (query.clinicalStatus && row.clinicalStatus !== query.clinicalStatus) return false;
        return true;
      })
      .sort((left, right) =>
        `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`, "es", {
          sensitivity: "base"
        })
      );
    const { page, pageSize, skip } = resolvePagination(query);
    return { items: filtered.slice(skip, skip + pageSize), total: filtered.length, page, pageSize };
  }

  async create(actor: AuthUser, dto: CreateCollaboratorDto) {
    if (dto.kind === "CLINICAL") this.ensurePermission(actor, "professionals.create");
    if (dto.kind === "CLINICAL" && !dto.clinicalProfile) {
      throw new BadRequestException("El perfil clinico es obligatorio para un usuario clinico");
    }
    await this.validateUserReferences(actor, dto.roleId, dto.branchIds, dto.primaryBranchId);
    await this.ensureEmailAvailable(dto.email);
    if (dto.clinicalProfile) await this.validateClinicalProfile(actor, dto.clinicalProfile);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim(),
          roleId: dto.roleId,
          permissionsOverride: false,
          createdById: actor.id
        }
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: dto.roleId } });
      await tx.userBranch.createMany({
        data: [...new Set(dto.branchIds)].map((branchId) => ({
          userId: user.id,
          branchId,
          isPrimary: branchId === (dto.primaryBranchId ?? dto.branchIds[0])
        }))
      });

      let professionalId: string | null = null;
      if (dto.kind === "CLINICAL" && dto.clinicalProfile) {
        const profile = dto.clinicalProfile;
        const professional = await tx.professional.create({
          data: {
            organizationId: actor.organizationId,
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            licenseNumber: profile.licenseNumber?.trim(),
            phone: user.phone,
            email: user.email,
            color: profile.color,
            commissionRate: profile.commissionRate
          }
        });
        professionalId = professional.id;
        await tx.professionalSpecialty.createMany({
          data: [...new Set(profile.specialtyIds)].map((specialtyId) => ({ professionalId: professional.id, specialtyId }))
        });
        await tx.professionalBranch.create({
          data: {
            professionalId: professional.id,
            branchId: profile.branchId,
            isPrimary: true,
            agendaSlotMinutes: profile.agendaSlotMinutes,
            defaultAppointmentDurationMinutes: profile.defaultAppointmentDurationMinutes
          }
        });
        if (profile.schedules?.length) {
          await tx.professionalSchedule.createMany({
            data: profile.schedules.map((schedule) => ({
              professionalId: professional.id,
              branchId: profile.branchId,
              chairId: profile.chairId,
              dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              breakStartTime: schedule.breakStartTime,
              breakEndTime: schedule.breakEndTime
            }))
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Collaborator",
          entityId: user.id,
          action: "create",
          after: { kind: dto.kind, professionalId }
        }
      });
      return { userId: user.id, professionalId };
    });

    return result;
  }

  async createProfessionalAccess(actor: AuthUser, professionalId: string, dto: CreateProfessionalAccessDto) {
    await this.validateUserReferences(actor, dto.roleId, dto.branchIds, dto.primaryBranchId);
    await this.ensureEmailAvailable(dto.email);
    const professional = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: actor.organizationId },
      include: { branches: { where: { status: ProfessionalBranchStatus.ACTIVE } } }
    });
    if (!professional) throw new NotFoundException("Professional not found");
    if (professional.userId) throw new BadRequestException("El profesional ya tiene un usuario de acceso vinculado");
    if (!professional.branches.some((branch) => actor.branchIds.includes(branch.branchId))) {
      throw new ForbiddenException("Branch access denied");
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: professional.firstName,
          lastName: professional.lastName,
          phone: professional.phone,
          roleId: dto.roleId,
          permissionsOverride: false,
          createdById: actor.id
        }
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: dto.roleId } });
      await tx.userBranch.createMany({
        data: [...new Set(dto.branchIds)].map((branchId) => ({
          userId: user.id,
          branchId,
          isPrimary: branchId === (dto.primaryBranchId ?? dto.branchIds[0])
        }))
      });
      await tx.professional.update({ where: { id: professional.id }, data: { userId: user.id, email: user.email } });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Professional",
          entityId: professional.id,
          action: "create_access",
          after: { userId: user.id }
        }
      });
      return { userId: user.id, professionalId: professional.id };
    });
  }

  private async validateUserReferences(actor: AuthUser, roleId: string, branchIds: string[], primaryBranchId?: string) {
    const uniqueBranchIds = [...new Set(branchIds)];
    if (!uniqueBranchIds.length) throw new BadRequestException("At least one branch is required");
    if (primaryBranchId && !uniqueBranchIds.includes(primaryBranchId)) {
      throw new BadRequestException("Primary branch must be included in branchIds");
    }
    uniqueBranchIds.forEach((branchId) => assertBranchAccess(actor, branchId));
    const [role, branchCount] = await Promise.all([
      this.prisma.role.findFirst({
        where: {
          id: roleId,
          isActive: true,
          deletedAt: null,
          OR: [{ organizationId: actor.organizationId }, { organizationId: null }]
        }
      }),
      this.prisma.branch.count({
        where: {
          id: { in: uniqueBranchIds },
          organizationId: actor.organizationId,
          status: "ACTIVE",
          deletedAt: null
        }
      })
    ]);
    if (!role) throw new BadRequestException("Invalid role");
    if (branchCount !== uniqueBranchIds.length) throw new BadRequestException("One or more branches are invalid");
  }

  private async ensureEmailAvailable(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existing) throw new ConflictException("El correo ya esta registrado en otro usuario");
  }

  private async validateClinicalProfile(actor: AuthUser, profile: NonNullable<CreateCollaboratorDto["clinicalProfile"]>) {
    assertBranchAccess(actor, profile.branchId);
    const uniqueSpecialtyIds = [...new Set(profile.specialtyIds)];
    const [branch, specialties, chair] = await Promise.all([
      this.prisma.branch.findFirst({
        where: {
          id: profile.branchId,
          organizationId: actor.organizationId,
          status: "ACTIVE",
          deletedAt: null
        }
      }),
      this.prisma.specialty.findMany({
        where: { id: { in: uniqueSpecialtyIds }, organizationId: actor.organizationId, isActive: true }
      }),
      profile.chairId
        ? this.prisma.chair.findFirst({
            where: {
              id: profile.chairId,
              branchId: profile.branchId,
              organizationId: actor.organizationId,
              isActive: true
            }
          })
        : Promise.resolve(null)
    ]);
    if (!branch) throw new BadRequestException("Invalid clinical branch");
    if (!uniqueSpecialtyIds.length || specialties.length !== uniqueSpecialtyIds.length || specialties.some((item) => !isAllowedSpecialtyName(item.name))) {
      throw new BadRequestException("One or more specialties are invalid");
    }
    if (profile.chairId && !chair) throw new BadRequestException("Invalid chairId");
    if (
      profile.agendaSlotMinutes &&
      profile.defaultAppointmentDurationMinutes &&
      profile.defaultAppointmentDurationMinutes % profile.agendaSlotMinutes !== 0
    ) {
      throw new BadRequestException("defaultAppointmentDurationMinutes must be a multiple of agendaSlotMinutes");
    }
    const schedules = profile.schedules ?? [];
    if (new Set(schedules.map((schedule) => schedule.dayOfWeek)).size !== schedules.length) {
      throw new BadRequestException("Only one schedule per day is allowed");
    }
    for (const schedule of schedules) await this.validateSchedule(actor, profile.branchId, profile.chairId, schedule, branch);
  }

  private async validateSchedule(
    actor: AuthUser,
    branchId: string,
    chairId: string | undefined,
    schedule: CollaboratorScheduleDto,
    branch: { agendaStartHour: number; agendaEndHour: number }
  ) {
    const start = this.toMinutes(schedule.startTime);
    const end = this.toMinutes(schedule.endTime);
    if (start >= end) throw new BadRequestException("startTime must be before endTime");
    if (start < branch.agendaStartHour * 60 || end > branch.agendaEndHour * 60) {
      throw new BadRequestException("Schedule must be inside branch agenda hours");
    }
    const fixedEnd = FIXED_END_TIMES_BY_DAY[schedule.dayOfWeek];
    if (fixedEnd && fixedEnd !== schedule.endTime) {
      throw new BadRequestException(`endTime must be ${fixedEnd} for selected day`);
    }
    if ((schedule.breakStartTime && !schedule.breakEndTime) || (!schedule.breakStartTime && schedule.breakEndTime)) {
      throw new BadRequestException("Both breakStartTime and breakEndTime are required");
    }
    if (schedule.dayOfWeek === 6 && (schedule.breakStartTime || schedule.breakEndTime)) {
      throw new BadRequestException("Saturday schedules must not include a break");
    }
    if (schedule.breakStartTime && schedule.breakEndTime) {
      const breakStart = this.toMinutes(schedule.breakStartTime);
      const breakEnd = this.toMinutes(schedule.breakEndTime);
      if (breakStart >= breakEnd || breakStart < start || breakEnd > end) {
        throw new BadRequestException("Break must be inside the schedule range");
      }
    }
    if (chairId) {
      const existing = await this.prisma.professionalSchedule.findMany({
        where: { chairId, branchId, dayOfWeek: schedule.dayOfWeek, isActive: true, professional: { organizationId: actor.organizationId } }
      });
      if (existing.some((item) => start < this.toMinutes(item.endTime) && end > this.toMinutes(item.startTime))) {
        throw new BadRequestException("Overlapping schedule for chair");
      }
    }
  }

  private toMinutes(value: string) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) throw new BadRequestException(`Invalid time format: ${value}. Expected HH:mm`);
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private can(actor: AuthUser, permission: string) {
    return actor.permissions.includes("organization.manage_all") || actor.permissions.includes(permission);
  }

  private ensurePermission(actor: AuthUser, permission: string) {
    if (!this.can(actor, permission)) throw new ForbiddenException("Insufficient permissions");
  }
}
