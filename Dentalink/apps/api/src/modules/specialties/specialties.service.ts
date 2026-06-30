import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  SPECIALTY_POLICY_MESSAGE,
  matchesAllowedSpecialtySearch,
  resolveAllowedSpecialtyName,
  withAllowedSpecialtyName
} from "../../common/utils/specialty-policy.util";
import { CreateSpecialtyDto } from "./dto/create-specialty.dto";
import {
  CreateSpecialtyAppointmentReasonDto,
  CreateSpecialtyClinicalTemplateDto,
  UpdateSpecialtyAppointmentReasonDto,
  UpdateSpecialtyClinicalTemplateDto
} from "./dto/specialty-workflows.dto";
import { UpdateSpecialtyDto } from "./dto/update-specialty.dto";

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const where: Prisma.SpecialtyWhereInput = {
      organizationId: actor.organizationId,
      ...(active !== undefined ? { isActive: active === "true" } : {})
    };

    const specialties = await this.prisma.specialty.findMany({ where, orderBy: { name: "asc" } });
    return specialties
      .map((specialty) => withAllowedSpecialtyName(specialty))
      .filter((specialty): specialty is NonNullable<typeof specialty> => Boolean(specialty))
      .filter((specialty) => matchesAllowedSpecialtySearch(specialty, search))
      .slice(skip, skip + take);
  }

  async findOne(actor: AuthUser, id: string) {
    const specialty = await this.prisma.specialty.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!specialty) throw new NotFoundException("Specialty not found");
    const allowedSpecialty = withAllowedSpecialtyName(specialty);
    if (!allowedSpecialty) throw new NotFoundException("Specialty not found");
    return allowedSpecialty;
  }

  async create(actor: AuthUser, dto: CreateSpecialtyDto) {
    const name = this.resolveInputName(dto.name);
    const existing = await this.findExistingAllowedSpecialty(actor, name);
    if (existing) {
      const specialty = await this.prisma.specialty.update({
        where: { id: existing.id },
        data: {
          name,
          description: dto.description?.trim(),
          isActive: true
        }
      });
      await this.audit(actor, "reactivate", specialty.id, { name: specialty.name });
      return this.findOne(actor, specialty.id);
    }

    const specialty = await this.prisma.specialty.create({
      data: {
        organizationId: actor.organizationId,
        name,
        description: dto.description?.trim()
      }
    });

    await this.audit(actor, "create", specialty.id, { name: specialty.name });
    return specialty;
  }

  async update(actor: AuthUser, id: string, dto: UpdateSpecialtyDto) {
    const current = await this.findOne(actor, id);
    const name = dto.name ? this.resolveInputName(dto.name) : undefined;
    if (name) {
      const existing = await this.findExistingAllowedSpecialty(actor, name);
      if (existing && existing.id !== id) throw new BadRequestException("La especialidad ya existe");
    }

    const specialty = await this.prisma.specialty.update({
      where: { id },
      data: {
        name,
        description: dto.description?.trim(),
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "update", id, { before: current, after: specialty });
    return this.findOne(actor, specialty.id);
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  async listClinicalTemplates(actor: AuthUser, specialtyId: string, type?: "PRESCRIPTION" | "EVOLUTION", active?: string) {
    // Forzando reinicio para que NestJS cargue el nuevo cliente Prisma con createdBy
    await this.findOne(actor, specialtyId);

    return (this.prisma as any).specialtyClinicalTemplate.findMany({
      where: {
        specialtyId,
        ...(type ? { type } : {}),
        ...(active !== undefined ? { isActive: active === "true" } : {})
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });
  }

  async createClinicalTemplate(actor: AuthUser, specialtyId: string, dto: CreateSpecialtyClinicalTemplateDto) {
    await this.findOne(actor, specialtyId);

    const template = await (this.prisma as any).specialtyClinicalTemplate.create({
      data: {
        specialtyId,
        type: dto.type,
        name: dto.name.trim(),
        content: dto.content.trim(),
        createdById: actor.id
      }
    });

    await this.audit(actor, "create_template", specialtyId, { templateId: template.id, type: template.type, name: template.name });
    return template;
  }

  async updateClinicalTemplate(
    actor: AuthUser,
    specialtyId: string,
    templateId: string,
    dto: UpdateSpecialtyClinicalTemplateDto
  ) {
    await this.findOne(actor, specialtyId);
    const current = await (this.prisma as any).specialtyClinicalTemplate.findFirst({ where: { id: templateId, specialtyId } });
    if (!current) throw new NotFoundException("Specialty clinical template not found");

    const template = await (this.prisma as any).specialtyClinicalTemplate.update({
      where: { id: templateId },
      data: {
        name: dto.name?.trim(),
        content: dto.content?.trim(),
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "update_template", specialtyId, { before: current, after: template });
    return template;
  }

  async listAppointmentReasons(actor: AuthUser, specialtyId: string, active?: string) {
    await this.findOne(actor, specialtyId);

    // TEMPORARY: Delete reasons containing doctors
    await (this.prisma as any).specialtyAppointmentReason.deleteMany({
      where: {
        name: { contains: " - " }
      }
    });

    const reasons = await (this.prisma as any).specialtyAppointmentReason.findMany({
      where: {
        specialtyId,
        ...(active !== undefined ? { isActive: active === "true" } : {})
      }
    });
    return reasons.sort((left: { legacyId: number | null; name: string }, right: { legacyId: number | null; name: string }) => {
      const leftLegacyId = left.legacyId ?? Number.MAX_SAFE_INTEGER;
      const rightLegacyId = right.legacyId ?? Number.MAX_SAFE_INTEGER;
      if (leftLegacyId !== rightLegacyId) return leftLegacyId - rightLegacyId;
      return left.name.localeCompare(right.name, "es");
    });
  }

  async createAppointmentReason(actor: AuthUser, specialtyId: string, dto: CreateSpecialtyAppointmentReasonDto) {
    await this.findOne(actor, specialtyId);
    await this.assertAppointmentReasonNameAvailable(specialtyId, dto.name);

    const lastReason = await (this.prisma as any).specialtyAppointmentReason.findFirst({
      orderBy: { legacyId: 'desc' }
    });
    const nextLegacyId = (lastReason?.legacyId ?? 0) + 1;

    const reason = await (this.prisma as any).specialtyAppointmentReason.create({
      data: {
        specialtyId,
        legacyId: nextLegacyId,
        name: dto.name.trim(),
        durationMinutes: dto.durationMinutes,
        color: dto.color
      }
    });

    await this.audit(actor, "create_appointment_reason", specialtyId, { reasonId: reason.id, name: reason.name });
    return reason;
  }

  async updateAppointmentReason(
    actor: AuthUser,
    specialtyId: string,
    reasonId: string,
    dto: UpdateSpecialtyAppointmentReasonDto
  ) {
    await this.findOne(actor, specialtyId);
    const current = await (this.prisma as any).specialtyAppointmentReason.findFirst({ where: { id: reasonId, specialtyId } });
    if (!current) throw new NotFoundException("Specialty appointment reason not found");
    if (dto.name) await this.assertAppointmentReasonNameAvailable(specialtyId, dto.name, reasonId);

    const reason = await (this.prisma as any).specialtyAppointmentReason.update({
      where: { id: reasonId },
      data: {
        name: dto.name?.trim(),
        durationMinutes: dto.durationMinutes,
        color: dto.color,
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "update_appointment_reason", specialtyId, { before: current, after: reason });
    return reason;
  }

  private audit(actor: AuthUser, action: string, entityId: string, payload: unknown) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Specialty",
        entityId,
        action,
        after: payload as Prisma.InputJsonValue
      }
    });
  }

  private resolveInputName(name: string) {
    const allowedName = resolveAllowedSpecialtyName(name);
    if (!allowedName) throw new BadRequestException(SPECIALTY_POLICY_MESSAGE);
    return allowedName;
  }

  private async findExistingAllowedSpecialty(actor: AuthUser, allowedName: string) {
    const specialties = await this.prisma.specialty.findMany({
      where: { organizationId: actor.organizationId }
    });
    const matches = specialties.filter((specialty) => resolveAllowedSpecialtyName(specialty.name) === allowedName);
    return matches.find((specialty) => specialty.name === allowedName) ?? matches[0] ?? null;
  }

  private async assertAppointmentReasonNameAvailable(specialtyId: string, name: string, currentReasonId?: string) {
    const normalizedName = this.normalizeAppointmentReasonName(name);
    const reasons = await (this.prisma as any).specialtyAppointmentReason.findMany({
      where: { specialtyId },
      select: { id: true, name: true }
    });
    const conflict = reasons.find(
      (reason: { id: string; name: string }) =>
        reason.id !== currentReasonId && this.normalizeAppointmentReasonName(reason.name) === normalizedName
    );
    if (conflict) throw new BadRequestException("Ya existe un motivo de atención con ese nombre en esta especialidad");
  }

  private normalizeAppointmentReasonName(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
