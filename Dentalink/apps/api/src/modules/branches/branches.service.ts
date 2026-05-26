import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, search?: string, status?: string, page?: number, pageSize?: number) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const where: Prisma.BranchWhereInput = {
      deletedAt: null,
      ...this.organizationScope(actor),
      id: { in: actor.branchIds },
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

    return this.prisma.branch.findMany({ where, skip, take, orderBy: { name: "asc" } });
  }

  async findOne(actor: AuthUser, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: { equals: id, in: actor.branchIds }, deletedAt: null, ...this.organizationScope(actor) }
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  async create(actor: AuthUser, dto: CreateBranchDto) {
    const branch = await this.prisma.branch.create({
      data: {
        organizationId: actor.organizationId,
        code: this.normalizeCode(dto.code),
        name: dto.name.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.toLowerCase().trim(),
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        state: dto.state?.trim(),
        country: dto.country?.trim() ?? "MX",
        timezone: dto.timezone?.trim() ?? "America/Mexico_City",
        createdById: actor.id
      }
    });

    await this.prisma.userBranch.upsert({
      where: { userId_branchId: { userId: actor.id, branchId: branch.id } },
      create: { userId: actor.id, branchId: branch.id, isPrimary: actor.branchIds.length === 0 },
      update: {}
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        entity: "Branch",
        entityId: branch.id,
        action: "create",
        after: { code: branch.code, name: branch.name }
      }
    });

    return branch;
  }

  async update(actor: AuthUser, id: string, dto: UpdateBranchDto) {
    const current = await this.prisma.branch.findFirst({
      where: { id: { equals: id, in: actor.branchIds }, deletedAt: null, ...this.organizationScope(actor) }
    });
    if (!current) throw new NotFoundException("Branch not found");

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.toLowerCase().trim(),
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        state: dto.state?.trim(),
        country: dto.country?.trim(),
        timezone: dto.timezone?.trim(),
        status: dto.status,
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
    const assignedUsers = await this.prisma.userBranch.count({ where: { branchId: id } });
    if (assignedUsers > 0) {
      throw new BadRequestException("Cannot deactivate a branch assigned to users");
    }
    return this.update(actor, id, { status: "INACTIVE" });
  }

  private organizationScope(actor: AuthUser): Prisma.BranchWhereInput {
    return actor.permissions.includes("system.manage_all") ? {} : { organizationId: actor.organizationId };
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "_");
  }
}
