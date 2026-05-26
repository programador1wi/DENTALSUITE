import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateChairDto } from "./dto/create-chair.dto";
import { UpdateChairDto } from "./dto/update-chair.dto";

@Injectable()
export class ChairsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, active?: string, branchId?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    return this.prisma.chair.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, branchId),
        ...(active !== undefined ? { isActive: active === "true" } : {}),
        ...(search
          ? {
              OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }]
            }
          : {})
      },
      skip,
      take,
      include: { branch: true },
      orderBy: [{ branchId: "asc" }, { name: "asc" }]
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const chair = await this.prisma.chair.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: { in: actor.branchIds } },
      include: { branch: true }
    });
    if (!chair) throw new NotFoundException("Chair not found");
    return chair;
  }

  async create(actor: AuthUser, dto: CreateChairDto) {
    await this.validateBranch(actor, dto.branchId);
    const chair = await this.prisma.chair.create({
      data: {
        organizationId: actor.organizationId,
        branchId: dto.branchId,
        name: dto.name.trim(),
        description: dto.description?.trim()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Chair",
        entityId: chair.id,
        action: "create",
        after: { name: chair.name, branchId: chair.branchId }
      }
    });

    return this.findOne(actor, chair.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateChairDto) {
    await this.findOne(actor, id);
    if (dto.branchId) await this.validateBranch(actor, dto.branchId);

    await this.prisma.chair.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive
      }
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Chair",
        entityId: id,
        action: "update",
        after: {
          branchId: dto.branchId,
          name: dto.name,
          isActive: dto.isActive
        }
      }
    });

    return this.findOne(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  private async validateBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        organizationId: actor.organizationId,
        id: branchScope(actor, branchId),
        status: "ACTIVE",
        deletedAt: null
      }
    });

    if (!branch) throw new BadRequestException("Invalid branchId");
  }
}
