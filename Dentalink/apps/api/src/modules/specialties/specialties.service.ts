import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
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
      ...(active !== undefined ? { isActive: active === "true" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return this.prisma.specialty.findMany({ where, skip, take, orderBy: { name: "asc" } });
  }

  async findOne(actor: AuthUser, id: string) {
    const specialty = await this.prisma.specialty.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!specialty) throw new NotFoundException("Specialty not found");
    return specialty;
  }

  async create(actor: AuthUser, dto: CreateSpecialtyDto) {
    const specialty = await this.prisma.specialty.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim()
      }
    });

    await this.audit(actor, "create", specialty.id, { name: specialty.name });
    return specialty;
  }

  async update(actor: AuthUser, id: string, dto: UpdateSpecialtyDto) {
    const current = await this.findOne(actor, id);
    const specialty = await this.prisma.specialty.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "update", id, { before: current, after: specialty });
    return specialty;
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  async listClinicalTemplates(actor: AuthUser, specialtyId: string, type?: "PRESCRIPTION" | "EVOLUTION", active?: string) {
    await this.findOne(actor, specialtyId);

    return (this.prisma as any).specialtyClinicalTemplate.findMany({
      where: {
        specialtyId,
        ...(type ? { type } : {}),
        ...(active !== undefined ? { isActive: active === "true" } : {})
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
        content: dto.content.trim()
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

    return (this.prisma as any).specialtyAppointmentReason.findMany({
      where: {
        specialtyId,
        ...(active !== undefined ? { isActive: active === "true" } : {})
      },
      orderBy: { name: "asc" }
    });
  }

  async createAppointmentReason(actor: AuthUser, specialtyId: string, dto: CreateSpecialtyAppointmentReasonDto) {
    await this.findOne(actor, specialtyId);

    const reason = await (this.prisma as any).specialtyAppointmentReason.create({
      data: {
        specialtyId,
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
}
