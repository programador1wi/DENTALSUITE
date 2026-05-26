import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateProcedureCategoryDto } from "./dto/create-procedure-category.dto";
import { UpdateProcedureCategoryDto } from "./dto/update-procedure-category.dto";

@Injectable()
export class ProcedureCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.procedureCategory.findMany({
      where: {
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
      },
      skip,
      take,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const row = await this.prisma.procedureCategory.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!row) throw new NotFoundException("Procedure category not found");
    return row;
  }

  async create(actor: AuthUser, dto: CreateProcedureCategoryDto) {
    const row = await this.prisma.procedureCategory.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        sortOrder: dto.sortOrder ?? 0
      }
    });

    await this.audit(actor, "create", row.id, { name: row.name });
    return row;
  }

  async update(actor: AuthUser, id: string, dto: UpdateProcedureCategoryDto) {
    await this.findOne(actor, id);
    const row = await this.prisma.procedureCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        sortOrder: dto.sortOrder,
        isActive: dto.isActive
      }
    });

    await this.audit(actor, "update", id, {
      name: dto.name,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive
    });

    return row;
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  private audit(actor: AuthUser, action: string, entityId: string, payload: unknown) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "ProcedureCategory",
        entityId,
        action,
        after: payload as Prisma.InputJsonValue
      }
    });
  }
}
