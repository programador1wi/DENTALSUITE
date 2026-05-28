import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListUsersQueryDto) {
    const { search, status, branchId } = query;
    const { skip, take } = resolvePagination(query);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...this.organizationScope(actor),
      ...(status ? { status: status as Prisma.EnumUserStatusFilter["equals"] } : {}),
      branches: { some: { branchId: branchScope(actor, branchId) } },
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const users = await this.prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: this.includeRelations()
    });

    return users.map((user) => this.serialize(user));
  }

  async findOne(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) },
      include: this.includeRelations()
    });
    if (!user) throw new NotFoundException("User not found");
    return this.serialize(user);
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    await this.validateRole(actor, dto.roleId);
    await this.validateBranches(actor, dto.branchIds, dto.primaryBranchId);
    if (dto.permissionIds !== undefined) await this.validatePermissions(dto.permissionIds);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone?.trim(),
          roleId: dto.roleId,
          permissionsOverride: dto.permissionIds !== undefined,
          createdById: actor.id
        }
      });

      await tx.userRole.create({ data: { userId: created.id, roleId: dto.roleId } });

      await tx.userBranch.createMany({
        data: dto.branchIds.map((branchId) => ({
          userId: created.id,
          branchId,
          isPrimary: branchId === (dto.primaryBranchId ?? dto.branchIds[0])
        })),
        skipDuplicates: true
      });

      if (dto.permissionIds !== undefined) {
        await tx.userPermission.createMany({
          data: [...new Set(dto.permissionIds)].map((permissionId) => ({ userId: created.id, permissionId })),
          skipDuplicates: true
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: created.id,
          action: "create",
          after: { email: created.email, roleId: created.roleId, permissionIds: dto.permissionIds }
        }
      });

      return created;
    });

    return this.findOne(actor, user.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) },
      include: { branches: true, permissions: true }
    });
    if (!current) throw new NotFoundException("User not found");

    if (dto.roleId) await this.validateRole(actor, dto.roleId);
    if (dto.branchIds) await this.validateBranches(actor, dto.branchIds, dto.primaryBranchId);
    if (dto.permissionIds !== undefined) await this.validatePermissions(dto.permissionIds);

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          firstName: dto.firstName?.trim(),
          lastName: dto.lastName?.trim(),
          phone: dto.phone?.trim(),
          roleId: dto.roleId,
          passwordHash,
          status: dto.status,
          permissionsOverride: dto.permissionIds !== undefined ? true : undefined,
          updatedById: actor.id
        }
      });

      if (dto.roleId) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({ data: { userId: id, roleId: dto.roleId } });
      }

      if (dto.branchIds) {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        await tx.userBranch.createMany({
          data: dto.branchIds.map((branchId) => ({
            userId: id,
            branchId,
            isPrimary: branchId === (dto.primaryBranchId ?? dto.branchIds?.[0])
          })),
          skipDuplicates: true
        });
      }

      if (dto.permissionIds !== undefined) {
        await tx.userPermission.deleteMany({ where: { userId: id } });
        await tx.userPermission.createMany({
          data: [...new Set(dto.permissionIds)].map((permissionId) => ({ userId: id, permissionId })),
          skipDuplicates: true
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: id,
          action: "update",
          before: {
            status: current.status,
            roleId: current.roleId,
            permissionIds: current.permissions.map((permission) => permission.permissionId)
          },
          after: { status: dto.status, roleId: dto.roleId, permissionIds: dto.permissionIds }
        }
      });
    });

    return this.findOne(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    if (actor.id === id) {
      throw new BadRequestException("Users cannot deactivate themselves");
    }
    return this.update(actor, id, { status: "INACTIVE" });
  }

  async lockAccess(actor: AuthUser) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          organizationId: actor.organizationId,
          deletedAt: null,
          id: { not: actor.id },
          status: "ACTIVE"
        },
        data: {
          status: "LOCKED",
          updatedById: actor.id
        }
      });

      await tx.session.updateMany({
        where: {
          user: { organizationId: actor.organizationId, id: { not: actor.id } },
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: actor.organizationId,
          action: "lock_access",
          after: { updated: result.count }
        }
      });

      return result.count;
    });

    return { updated };
  }

  private organizationScope(actor: AuthUser): Prisma.UserWhereInput {
    return actor.permissions.includes("system.manage_all") ? {} : { organizationId: actor.organizationId };
  }

  private async validateRole(actor: AuthUser, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        isActive: true,
        deletedAt: null,
        OR: [{ organizationId: actor.organizationId }, { organizationId: null }]
      }
    });
    if (!role) throw new BadRequestException("Invalid role");
  }

  private async validateBranches(actor: AuthUser, branchIds: string[], primaryBranchId?: string) {
    if (!branchIds.length) throw new BadRequestException("At least one branch is required");
    if (primaryBranchId && !branchIds.includes(primaryBranchId)) {
      throw new BadRequestException("Primary branch must be included in branchIds");
    }

    const count = await this.prisma.branch.count({
      where: {
        id: { in: branchIds },
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });

    if (count !== new Set(branchIds).size) {
      throw new BadRequestException("One or more branches are invalid");
    }
  }

  private async validatePermissions(permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    if (!uniqueIds.length) return;

    const count = await this.prisma.permission.count({
      where: { id: { in: uniqueIds }, isActive: true, deletedAt: null }
    });

    if (count !== uniqueIds.length) {
      throw new BadRequestException("One or more permissions are invalid");
    }
  }

  private includeRelations() {
    return {
      role: {
        include: {
          permissions: { include: { permission: true } }
        }
      },
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } }
            }
          }
        }
      },
      permissions: { include: { permission: true } },
      branches: { include: { branch: true } },
      professional: {
        select: {
          id: true,
          commissionRate: true,
          isActive: true
        }
      }
    } as const;
  }

  private serialize(user: Prisma.UserGetPayload<{ include: ReturnType<UsersService["includeRelations"]> }>) {
    const rolePermissions = new Map<string, (typeof user.permissions)[number]["permission"]>();

    for (const rolePermission of user.role?.permissions ?? []) {
      if (rolePermission.permission.isActive && !rolePermission.permission.deletedAt) {
        rolePermissions.set(rolePermission.permission.id, rolePermission.permission);
      }
    }

    for (const userRole of user.roles) {
      for (const rolePermission of userRole.role.permissions) {
        if (rolePermission.permission.isActive && !rolePermission.permission.deletedAt) {
          rolePermissions.set(rolePermission.permission.id, rolePermission.permission);
        }
      }
    }

    const directPermissions = user.permissions
      .map(({ permission }) => permission)
      .filter((permission) => permission.isActive && !permission.deletedAt);
    const selectedPermissions = user.permissionsOverride ? directPermissions : [...rolePermissions.values()];

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      permissionsOverride: user.permissionsOverride,
      permissions: selectedPermissions.map((permission) => ({
        id: permission.id,
        key: permission.key,
        code: permission.code,
        name: permission.name,
        module: permission.module,
        action: permission.action,
        resource: permission.resource
      })),
      role: user.role ? { id: user.role.id, code: user.role.code, name: user.role.name } : null,
      branches: user.branches.map(({ branch, isPrimary }) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        isPrimary
      })),
      professional: user.professional,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
