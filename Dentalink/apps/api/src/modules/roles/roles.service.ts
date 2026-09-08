import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canDelegatePermission } from "@dentalwarner/shared";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { ListRolesQueryDto } from "./dto/list-roles-query.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListRolesQueryDto) {
    const { search, active } = query;
    const { skip, take } = resolvePagination(query);

    const where: Prisma.RoleWhereInput = {
      deletedAt: null,
      ...this.organizationScope(actor),
      ...(active !== undefined ? { isActive: active === "true" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const roles = await this.prisma.role.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "asc" },
      include: this.includeRelations()
    });

    return roles.map((role) => this.serialize(role));
  }

  async findOne(actor: AuthUser, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) },
      include: this.includeRelations()
    });
    if (!role) throw new NotFoundException("Role not found");
    return this.serialize(role);
  }

  async create(actor: AuthUser, dto: CreateRoleDto) {
    await this.validatePermissions(actor, dto.permissionIds);

    const role = await this.prisma.$transaction(async (tx) => {
      const code = await this.generateRoleCode(actor.organizationId, dto.name);
      const created = await tx.role.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          code,
          description: dto.description?.trim(),
          createdById: actor.id
        }
      });

      await tx.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: created.id, permissionId })),
        skipDuplicates: true
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Role",
          entityId: created.id,
          action: "create",
          after: { code: created.code, permissionIds: dto.permissionIds }
        }
      });

      return created;
    });

    return this.findOne(actor, role.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateRoleDto) {
    const current = await this.prisma.role.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) }
    });
    if (!current) throw new NotFoundException("Role not found");
    if (this.isSuperAdminRole(current)) {
      throw new BadRequestException("Super admin role cannot be edited");
    }
    if (dto.permissionIds) await this.validatePermissions(actor, dto.permissionIds);
    if (current.isActive && dto.isActive === false) {
      await this.assertRoleNotAssignedToActiveUsers(id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          isActive: dto.isActive,
          updatedById: actor.id
        }
      });

      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
          skipDuplicates: true
        });
      }

      await tx.user.updateMany({
        where: {
          organizationId: actor.organizationId,
          OR: [{ roleId: id }, { roles: { some: { roleId: id } } }]
        },
        data: { authorizationVersion: { increment: 1 } }
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "Role",
          entityId: id,
          action: "update",
          before: { isActive: current.isActive },
          after: { isActive: dto.isActive, permissionIds: dto.permissionIds }
        }
      });
    });

    return this.findOne(actor, id);
  }

  async deactivate(actor: AuthUser, id: string) {
    await this.assertRoleNotAssignedToActiveUsers(id);
    return this.update(actor, id, { isActive: false });
  }

  private organizationScope(actor: AuthUser): Prisma.RoleWhereInput {
    return { organizationId: actor.organizationId };
  }

  private async validatePermissions(actor: AuthUser, permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: uniqueIds }, isActive: true, deletedAt: null },
      select: { id: true, key: true, isSystem: true }
    });
    if (permissions.length !== uniqueIds.length) {
      throw new BadRequestException("One or more permissions are invalid");
    }
    if (permissions.some((permission) => permission.key === "organization.manage_all")) {
      throw new ForbiddenException("PROTECTED_PERMISSION");
    }
    if (
      permissions.some(
        (permission) => !canDelegatePermission(actor.permissions, permission.key, permission.isSystem)
      )
    ) {
      throw new ForbiddenException("PERMISSION_DELEGATION_DENIED");
    }
  }

  private normalizeCode(code: string) {
    const normalized = code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized || "perfil";
  }

  private async assertRoleNotAssignedToActiveUsers(roleId: string) {
    const usersWithRole = await this.prisma.user.count({ where: { roleId, deletedAt: null, status: "ACTIVE" } });
    if (usersWithRole > 0) {
      throw new BadRequestException("Cannot deactivate a role assigned to active users");
    }
  }

  private isSuperAdminRole(role: { code: string | null; name: string }) {
    return (
      role.code === "super_admin" ||
      role.code === "super_administrador" ||
      role.name === "SUPER_ADMIN" ||
      role.name === "Super Administrador"
    );
  }

  private async generateRoleCode(organizationId: string, name: string) {
    const base = this.normalizeCode(name);
    const existing = await this.prisma.role.findMany({
      where: {
        organizationId,
        code: {
          startsWith: base
        }
      },
      select: { code: true }
    });
    const used = new Set(existing.map((role) => role.code).filter(Boolean));

    if (!used.has(base)) return base;

    let suffix = 2;
    let candidate = `${base}_${suffix}`;
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}_${suffix}`;
    }

    return candidate;
  }

  private includeRelations() {
    return {
      permissions: {
        where: {
          permission: {
            isActive: true,
            deletedAt: null
          }
        },
        include: { permission: true }
      }
    } as const;
  }

  private serialize(role: Prisma.RoleGetPayload<{ include: ReturnType<RolesService["includeRelations"]> }>) {
    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      code: role.code,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions.map(({ permission }) => ({
        id: permission.id,
        code: permission.code,
        module: permission.module,
        action: permission.action,
        resource: permission.resource
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }
}
