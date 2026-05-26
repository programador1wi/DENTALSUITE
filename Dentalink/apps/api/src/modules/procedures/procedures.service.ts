import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateProcedureDto } from "./dto/create-procedure.dto";
import { UpdateProcedureDto } from "./dto/update-procedure.dto";

@Injectable()
export class ProceduresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actor: AuthUser,
    search?: string,
    active?: string,
    categoryId?: string,
    page?: number,
    pageSize?: number
  ) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.procedure.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(active !== undefined ? { isActive: active === "true" } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: { category: true },
      skip,
      take,
      orderBy: [{ categoryId: "asc" }, { code: "asc" }]
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.procedure.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { category: true }
    });
    if (!row) throw new NotFoundException("Procedure not found");
    return row;
  }

  async create(actor: AuthUser, dto: CreateProcedureDto) {
    await this.validateCategory(actor, dto.categoryId);

    const existsCode = await this.prisma.procedure.findFirst({
      where: {
        organizationId: actor.organizationId,
        code: dto.code.trim().toUpperCase()
      }
    });

    if (existsCode) {
      throw new BadRequestException("Procedure code already exists in organization");
    }

    const row = await this.prisma.procedure.create({
      data: {
        organizationId: actor.organizationId,
        categoryId: dto.categoryId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        defaultDuration: dto.defaultDuration,
        requiresTooth: dto.requiresTooth ?? false,
        requiresSurface: dto.requiresSurface ?? false,
        requiresLab: dto.requiresLab ?? false
      }
    });

    await this.audit(actor, "create", row.id, { code: row.code, name: row.name });
    return this.findOne(actor, row.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateProcedureDto) {
    const current = await this.findOne(actor, id);

    if (dto.categoryId) await this.validateCategory(actor, dto.categoryId);

    if (dto.code) {
      const newCode = dto.code.trim().toUpperCase();
      const existsCode = await this.prisma.procedure.findFirst({
        where: {
          organizationId: actor.organizationId,
          code: newCode,
          id: { not: id }
        }
      });
      if (existsCode) {
        throw new BadRequestException("Procedure code already exists in organization");
      }
    }

    await this.prisma.procedure.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        code: dto.code?.trim().toUpperCase(),
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        defaultDuration: dto.defaultDuration,
        requiresTooth: dto.requiresTooth,
        requiresSurface: dto.requiresSurface,
        requiresLab: dto.requiresLab,
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "update", id, {
      code: dto.code,
      name: dto.name,
      isActive: dto.isActive,
      previousCode: current.code
    });

    return this.findOne(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  private async validateCategory(actor: AuthUser, categoryId: string) {
    const category = await this.prisma.procedureCategory.findFirst({
      where: { id: categoryId, organizationId: actor.organizationId }
    });
    if (!category) throw new BadRequestException("Invalid categoryId");
  }

  private audit(actor: AuthUser, action: string, entityId: string, payload: unknown) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Procedure",
        entityId,
        action,
        after: payload as Prisma.InputJsonValue
      }
    });
  }
}
