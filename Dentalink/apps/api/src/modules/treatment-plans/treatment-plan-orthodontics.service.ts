import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  CreateOrthodonticOptionDto,
  SortOrthodonticOptionsDto,
  UpdateOrthodonticOptionDto
} from "./dto/treatment-plan.dto";

@Injectable()
export class TreatmentPlanOrthodonticsService {
  constructor(private readonly prisma: PrismaService) {}

  cleanOptionLabel(label: string): string {
    const clean = label.trim().replace(/\s+/g, " ");
    if (!clean) throw new BadRequestException("Option label is required");
    return clean;
  }

  normalizeOptionLabel(label: string): string {
    return this.cleanOptionLabel(label).toLowerCase();
  }

  optionCode(label: string): string {
    return this.cleanOptionLabel(label)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  optionalString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    return str || null;
  }

  optionalDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  async audit(
    actor: AuthUser,
    entity: string,
    entityId: string,
    action: string,
    before: Prisma.InputJsonValue = {},
    after: Prisma.InputJsonValue = {}
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity,
        entityId,
        action,
        before,
        after
      }
    });
  }

  async listOrthodonticOptionFields(actor: AuthUser) {
    await this.ensureOrthodonticCatalogSeed(actor.organizationId, actor.id);
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async createOrthodonticFieldOption(actor: AuthUser, fieldId: string, dto: CreateOrthodonticOptionDto) {
    const label = this.cleanOptionLabel(dto.label);
    const field = await (this.prisma as any).orthodonticOptionField.findFirst({
      where: { id: fieldId, organizationId: actor.organizationId }
    });
    if (!field) throw new NotFoundException("Orthodontic option field not found");
    const normalizedLabel = this.normalizeOptionLabel(label);
    const existing = await (this.prisma as any).orthodonticFieldOption.findUnique({
      where: { fieldId_normalizedLabel: { fieldId, normalizedLabel } }
    });
    if (existing) throw new BadRequestException("An equivalent option already exists for this field");
    const max = await (this.prisma as any).orthodonticFieldOption.aggregate({
      where: { fieldId },
      _max: { sortOrder: true }
    });
    const created = await (this.prisma as any).orthodonticFieldOption.create({
      data: {
        fieldId,
        code: this.optionCode(label),
        label,
        normalizedLabel,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        createdById: actor.id,
        updatedById: actor.id
      }
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      created.id,
      "create",
      {},
      created as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async updateOrthodonticFieldOption(actor: AuthUser, optionId: string, dto: UpdateOrthodonticOptionDto) {
    const current = await this.findOrthodonticOptionForActor(actor, optionId);
    const data: Record<string, unknown> = {
      updatedById: actor.id,
      version: { increment: 1 }
    };
    if (dto.label !== undefined) {
      const label = this.cleanOptionLabel(dto.label);
      const normalizedLabel = this.normalizeOptionLabel(label);
      const usedCount = await this.countOrthodonticOptionUsage(optionId);
      if (usedCount > 0 && normalizedLabel !== current.normalizedLabel) {
        throw new BadRequestException(
          "Used options cannot be renamed; create a new option and deactivate the previous one"
        );
      }
      data.label = label;
      data.normalizedLabel = normalizedLabel;
      data.code = this.optionCode(label);
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const updated = await (this.prisma as any).orthodonticFieldOption.update({
      where: { id: optionId },
      data
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      optionId,
      "update",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async deactivateOrthodonticFieldOption(actor: AuthUser, optionId: string, reason?: string) {
    const current = await this.findOrthodonticOptionForActor(actor, optionId);
    const updated = await (this.prisma as any).orthodonticFieldOption.update({
      where: { id: optionId },
      data: {
        isActive: false,
        deactivatedById: actor.id,
        deactivatedAt: new Date(),
        deactivationReason: reason?.trim() || null,
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      optionId,
      "deactivate",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async reactivateOrthodonticFieldOption(actor: AuthUser, optionId: string) {
    const current = await this.findOrthodonticOptionForActor(actor, optionId);
    const activeEquivalent = await (this.prisma as any).orthodonticFieldOption.findFirst({
      where: {
        fieldId: current.fieldId,
        normalizedLabel: current.normalizedLabel,
        isActive: true,
        id: { not: optionId }
      }
    });
    if (activeEquivalent) throw new BadRequestException("An active equivalent option already exists");
    const updated = await (this.prisma as any).orthodonticFieldOption.update({
      where: { id: optionId },
      data: {
        isActive: true,
        reactivatedById: actor.id,
        reactivatedAt: new Date(),
        updatedById: actor.id,
        version: { increment: 1 }
      }
    });
    await this.audit(
      actor,
      "OrthodonticFieldOption",
      optionId,
      "reactivate",
      current as Prisma.InputJsonValue,
      updated as Prisma.InputJsonValue
    );
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async sortOrthodonticFieldOptions(actor: AuthUser, fieldId: string, dto: SortOrthodonticOptionsDto) {
    const field = await (this.prisma as any).orthodonticOptionField.findFirst({
      where: { id: fieldId, organizationId: actor.organizationId },
      include: { options: true }
    });
    if (!field) throw new NotFoundException("Orthodontic option field not found");
    const knownIds = new Set((field.options as Array<{ id: string }>).map((option) => option.id));
    if (dto.optionIds.some((id: string) => !knownIds.has(id))) {
      throw new BadRequestException("One or more options do not belong to this field");
    }
    await this.prisma.$transaction(
      dto.optionIds.map((id: string, index: number) =>
        (this.prisma as any).orthodonticFieldOption.update({
          where: { id },
          data: { sortOrder: index, updatedById: actor.id, version: { increment: 1 } }
        })
      )
    );
    await this.audit(actor, "OrthodonticOptionField", fieldId, "sort_options", {}, {
      optionIds: dto.optionIds
    } as Prisma.InputJsonValue);
    return this.findOrthodonticOptionFields(actor.organizationId, true);
  }

  async findOrthodonticOptionFields(organizationId: string, includeInactive = false) {
    const fields = await (this.prisma as any).orthodonticOptionField.findMany({
      where: { organizationId, isActive: true },
      include: {
        options: {
          where: includeInactive ? undefined : { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return fields.map((field: any) => ({
      id: field.id,
      code: field.code,
      name: field.name,
      description: field.description,
      options: (field.options ?? []).map((option: any) => ({
        id: option.id,
        code: option.code,
        label: option.label,
        normalizedLabel: option.normalizedLabel,
        sortOrder: option.sortOrder,
        isActive: option.isActive,
        deactivationReason: option.deactivationReason,
        usageCount: 0
      }))
    }));
  }

  async findOrthodonticOptionForActor(actor: AuthUser, optionId: string) {
    const option = await (this.prisma as any).orthodonticFieldOption.findFirst({
      where: { id: optionId },
      include: { field: true }
    });
    if (!option || option.field.organizationId !== actor.organizationId) {
      throw new NotFoundException("Orthodontic field option not found");
    }
    return option;
  }

  async countOrthodonticOptionUsage(optionId: string): Promise<number> {
    const [singleCount, multipleCount] = await Promise.all([
      (this.prisma as any).orthodonticPlanFieldValue.count({ where: { optionId } }),
      (this.prisma as any).orthodonticPlanOptionValue.count({ where: { optionId } })
    ]);
    return singleCount + multipleCount;
  }

  async ensureOrthodonticCatalogSeed(organizationId: string, userId: string) {
    const count = await (this.prisma as any).orthodonticOptionField.count({ where: { organizationId } });
    if (count > 0) return;
    const defaults = [
      {
        code: "BRACKET_TYPES",
        name: "Tipos de brackets",
        options: ["Metálicos estándar", "Metálicos autoligados", "Cerámicos", "Zafiro"]
      },
      {
        code: "ARC_TYPES",
        name: "Tipos de arcos",
        options: ["NiTi 0.012", "NiTi 0.014", "NiTi 0.016", "Acero 0.016x0.022", "TMA 0.017x0.025"]
      },
      {
        code: "BAND_TYPES",
        name: "Tipos de bandas",
        options: ["Estándar primer molar", "Estándar segundo molar", "Con tubo convertible", "Con tubo doble"]
      },
      {
        code: "MOLAR_TUBES",
        name: "Tubos molares",
        options: ["Simple cementado", "Doble cementado", "Con gancho", "Sin gancho"]
      },
      {
        code: "RETAINERS",
        name: "Retenedores",
        options: ["Hawley superior", "Hawley inferior", "Essix transparente", "Fijo lingual 3-3"]
      }
    ];

    for (let fIndex = 0; fIndex < defaults.length; fIndex++) {
      const fieldDef = defaults[fIndex];
      const field = await (this.prisma as any).orthodonticOptionField.create({
        data: {
          organizationId,
          code: fieldDef.code,
          name: fieldDef.name,
          sortOrder: fIndex,
          createdById: userId,
          updatedById: userId
        }
      });

      for (let oIndex = 0; oIndex < fieldDef.options.length; oIndex++) {
        const label = fieldDef.options[oIndex];
        await (this.prisma as any).orthodonticFieldOption.create({
          data: {
            fieldId: field.id,
            code: this.optionCode(label),
            label,
            normalizedLabel: this.normalizeOptionLabel(label),
            sortOrder: oIndex,
            createdById: userId,
            updatedById: userId
          }
        });
      }
    }
  }
}
