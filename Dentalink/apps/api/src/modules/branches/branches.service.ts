import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProfessionalBranchStatus } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { DEFAULT_CLINIC_AGENDA_END_HOUR, DEFAULT_CLINIC_AGENDA_START_HOUR } from "../../common/utils/clinic-hours.util";
import { ALLOWED_SPECIALTY_NAMES, resolveAllowedSpecialtyName } from "../../common/utils/specialty-policy.util";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

const MIN_BRANCH_STAFFING = [
  { specialtyName: ALLOWED_SPECIALTY_NAMES[0], minimum: 2, label: "General" },
  { specialtyName: ALLOWED_SPECIALTY_NAMES[1], minimum: 1, label: "Ortodoncia" }
] as const;

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, status?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const where: Prisma.BranchWhereInput = {
      deletedAt: null,
      ...this.organizationScope(actor),
      ...this.branchAccessScope(actor),
      ...(status ? { status: status as Prisma.EnumBranchStatusFilter["equals"] } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return this.prisma.branch.findMany({
      where,
      include: { brand: true, zone: true },
      skip,
      take,
      orderBy: { name: "asc" }
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor), ...this.branchAccessScope(actor) },
      include: { brand: true, zone: true }
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  async create(actor: AuthUser, dto: CreateBranchDto) {
    this.validateAgendaSettings(dto);
    await this.validateBranchScope(actor, dto.brandId, dto.zoneId);

    const branch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({
        data: {
          organizationId: actor.organizationId,
          brandId: dto.brandId,
          zoneId: dto.zoneId,
          code: this.normalizeCode(dto.code),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          countryCode: dto.countryCode?.trim() ?? "+52",
          phone: dto.phone?.trim(),
          secondaryPhone: dto.secondaryPhone?.trim(),
          email: dto.email?.toLowerCase().trim(),
          replyToEmail: dto.replyToEmail?.toLowerCase().trim(),
          website: dto.website?.trim(),
          address: dto.address?.trim(),
          exteriorNumber: dto.exteriorNumber?.trim(),
          interiorNumber: dto.interiorNumber?.trim(),
          neighborhood: dto.neighborhood?.trim(),
          postalCode: dto.postalCode?.trim(),
          municipality: dto.municipality?.trim(),
          references: dto.references?.trim(),
          city: dto.city?.trim(),
          state: dto.state?.trim(),
          country: dto.country?.trim() ?? "MX",
          timezone: dto.timezone?.trim() ?? "America/Mexico_City",
          showInEmails: dto.showInEmails ?? true,
          showInDocuments: dto.showInDocuments ?? true,
          showInOnlineScheduling: dto.showInOnlineScheduling ?? true,
          allowOnlineAppointments: dto.allowOnlineAppointments ?? true,
          allowNotifications: dto.allowNotifications ?? true,
          agendaSlotMinutes: dto.agendaSlotMinutes,
          agendaStartHour: dto.agendaStartHour,
          agendaEndHour: dto.agendaEndHour,
          createdById: actor.id
        }
      });

      await tx.userBranch.upsert({
        where: { userId_branchId: { userId: actor.id, branchId: created.id } },
        create: { userId: actor.id, branchId: created.id, isPrimary: actor.branchIds.length === 0 },
        update: {}
      });

      await this.ensureMinimumBranchStaffing(tx, actor.organizationId, created.id, created.code ?? created.id, created.name);

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Branch",
          entityId: created.id,
          action: "create",
          after: { code: created.code, name: created.name }
        }
      });

      return created;
    });

    return branch;
  }

  async update(actor: AuthUser, id: string, dto: UpdateBranchDto) {
    const current = await this.prisma.branch.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor), ...this.branchAccessScope(actor) }
    });
    if (!current) throw new NotFoundException("Branch not found");
    if (dto.brandId !== undefined && dto.brandId !== current.brandId && !this.canAssignBrand(actor)) {
      throw new BadRequestException("No tienes permiso para mover la sucursal de marca");
    }

    this.validateAgendaSettings(dto, {
      agendaStartHour: current.agendaStartHour,
      agendaEndHour: current.agendaEndHour
    });
    await this.validateBranchScope(actor, dto.brandId, dto.zoneId);
    if (dto.status === "ACTIVE") {
      await this.assertBranchStaffingMinimum(actor, id);
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        brandId: dto.brandId,
        zoneId: dto.zoneId,
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        countryCode: dto.countryCode?.trim(),
        phone: dto.phone?.trim(),
        secondaryPhone: dto.secondaryPhone?.trim(),
        email: dto.email?.toLowerCase().trim(),
        replyToEmail: dto.replyToEmail?.toLowerCase().trim(),
        website: dto.website?.trim(),
        address: dto.address?.trim(),
        exteriorNumber: dto.exteriorNumber?.trim(),
        interiorNumber: dto.interiorNumber?.trim(),
        neighborhood: dto.neighborhood?.trim(),
        postalCode: dto.postalCode?.trim(),
        municipality: dto.municipality?.trim(),
        references: dto.references?.trim(),
        city: dto.city?.trim(),
        state: dto.state?.trim(),
        country: dto.country?.trim(),
        timezone: dto.timezone?.trim(),
        showInEmails: dto.showInEmails,
        showInDocuments: dto.showInDocuments,
        showInOnlineScheduling: dto.showInOnlineScheduling,
        allowOnlineAppointments: dto.allowOnlineAppointments,
        allowNotifications: dto.allowNotifications,
        status: dto.status,
        agendaSlotMinutes: dto.agendaSlotMinutes,
        agendaStartHour: dto.agendaStartHour,
        agendaEndHour: dto.agendaEndHour,
        updatedById: actor.id
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Branch",
        entityId: id,
        action: "update",
        before: { status: current.status, name: current.name },
        after: { status: dto.status, name: dto.name }
      }
    });

    return branch;
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.archive(actor, id);
  }

  async archive(actor: AuthUser, id: string) {
    const assignedUsers = await this.prisma.userBranch.count({ where: { branchId: id } });
    if (assignedUsers > 0) {
      throw new BadRequestException("Cannot deactivate a branch assigned to users");
    }
    return this.update(actor, id, { status: "INACTIVE" });
  }

  async restore(actor: AuthUser, id: string) {
    return this.update(actor, id, { status: "ACTIVE" });
  }

  private organizationScope(actor: AuthUser): Prisma.BranchWhereInput {
    return { organizationId: actor.organizationId };
  }

  private branchAccessScope(actor: AuthUser): Prisma.BranchWhereInput {
    return actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("branches.view_all") ||
      actor.permissions.includes("health_center.manage")
      ? {}
      : { id: { in: actor.branchIds } };
  }

  private canAssignBrand(actor: AuthUser) {
    return (
      actor.permissions.includes("system.manage_all") ||
      actor.permissions.includes("health_center.manage") ||
      actor.permissions.includes("branches.assign_brand")
    );
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "_");
  }

  private validateAgendaSettings(
    dto: Pick<CreateBranchDto | UpdateBranchDto, "agendaStartHour" | "agendaEndHour">,
    current?: { agendaStartHour: number; agendaEndHour: number }
  ) {
    const startHour = dto.agendaStartHour ?? current?.agendaStartHour ?? DEFAULT_CLINIC_AGENDA_START_HOUR;
    const endHour = dto.agendaEndHour ?? current?.agendaEndHour ?? DEFAULT_CLINIC_AGENDA_END_HOUR;

    if (endHour <= startHour) {
      throw new BadRequestException("agendaEndHour must be greater than agendaStartHour");
    }
  }

  private async validateBranchScope(actor: AuthUser, brandId?: string | null, zoneId?: string | null) {
    if (brandId) {
      const brand = await this.prisma.branchBrand.findFirst({
        where: { id: brandId, organizationId: actor.organizationId, isActive: true }
      });
      if (!brand) throw new BadRequestException("Invalid brandId");
    }

    if (zoneId) {
      const zone = await this.prisma.branchZone.findFirst({
        where: { id: zoneId, organizationId: actor.organizationId, isActive: true }
      });
      if (!zone) throw new BadRequestException("Invalid zoneId");
    }
  }

  private async ensureMinimumBranchStaffing(
    tx: Prisma.TransactionClient,
    organizationId: string,
    branchId: string,
    branchCode: string,
    branchName: string
  ) {
    const specialties = await this.ensureStaffingSpecialties(tx, organizationId);
    const branchToken = this.normalizeCode(branchCode || branchName).toLowerCase();

    for (const rule of MIN_BRANCH_STAFFING) {
      const specialtyId = specialties.get(rule.specialtyName);
      if (!specialtyId) throw new BadRequestException(`Missing specialty ${rule.specialtyName}`);

      for (let index = 1; index <= rule.minimum; index += 1) {
        const email = `auto.${rule.label.toLowerCase()}.${index}.${branchToken}@dentalwarner.local`;
        const professional = await tx.professional.create({
          data: {
            organizationId,
            firstName: `Dr. ${rule.label}`,
            lastName: `${branchName} ${index}`,
            email,
            color: rule.label === "General" ? "#0f766e" : "#7c3aed",
            isActive: true
          }
        });

        await tx.professionalSpecialty.create({
          data: { professionalId: professional.id, specialtyId }
        });
        await tx.professionalBranch.create({
          data: {
            professionalId: professional.id,
            branchId,
            isPrimary: true,
            status: ProfessionalBranchStatus.ACTIVE
          }
        });
      }
    }
  }

  private async ensureStaffingSpecialties(tx: Prisma.TransactionClient, organizationId: string) {
    const rows = new Map<string, string>();

    for (const specialtyName of ALLOWED_SPECIALTY_NAMES) {
      const specialty = await tx.specialty.upsert({
        where: {
          organizationId_name: {
            organizationId,
            name: specialtyName
          }
        },
        update: { isActive: true },
        create: { organizationId, name: specialtyName, isActive: true }
      });
      rows.set(specialtyName, specialty.id);
    }

    return rows;
  }

  private async assertBranchStaffingMinimum(actor: AuthUser, branchId: string) {
    for (const rule of MIN_BRANCH_STAFFING) {
      const count = await this.countBranchProfessionalsBySpecialty(actor, branchId, rule.specialtyName);
      if (count < rule.minimum) {
        throw new BadRequestException(
          `Branch must have at least ${rule.minimum} active ${rule.specialtyName} professional(s) before activation`
        );
      }
    }
  }

  private async countBranchProfessionalsBySpecialty(actor: AuthUser, branchId: string, specialtyName: string) {
    const now = new Date();
    const professionals = await this.prisma.professional.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        branches: {
          some: {
            branchId,
            status: ProfessionalBranchStatus.ACTIVE,
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        }
      },
      select: { specialties: { select: { specialty: { select: { name: true } } } } }
    });

    return professionals.filter((professional) =>
      professional.specialties.some((item) => resolveAllowedSpecialtyName(item.specialty.name) === specialtyName)
    ).length;
  }
}
