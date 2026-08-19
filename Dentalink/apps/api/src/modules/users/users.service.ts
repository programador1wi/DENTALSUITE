import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { Permission, Prisma } from "@prisma/client";
import { canDelegatePermission } from "@dentalwarner/shared";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUserPermissionsDto } from "./dto/update-user-permissions.dto";
import { ApplyProfileDto } from "./dto/apply-profile.dto";
import { CopyPermissionsDto } from "./dto/copy-permissions.dto";
import { UpdateUserBranchesDto } from "./dto/update-user-branches.dto";

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
          permissionsOverride: false,
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

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: created.id,
          action: "create",
          after: { email: created.email, roleId: created.roleId }
        }
      });

      return created;
    });

    return this.findOne(actor, user.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) },
      include: { branches: true }
    });
    if (!current) throw new NotFoundException("User not found");
    if (actor.id === id && dto.status && dto.status !== "ACTIVE") {
      throw new BadRequestException("Users cannot deactivate themselves");
    }

    if (dto.roleId) await this.validateRole(actor, dto.roleId);
    if (dto.branchIds) await this.validateBranches(actor, dto.branchIds, dto.primaryBranchId);

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;
    const nextIsActive = dto.status === undefined ? undefined : dto.status === "ACTIVE";

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
          isActive: nextIsActive,
          permissionsOverride: false,
          updatedById: actor.id
        }
      });

      if (dto.status && dto.status !== "ACTIVE") {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }

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

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: id,
          action: "update",
          before: {
            status: current.status,
            roleId: current.roleId
          },
          after: { status: dto.status, roleId: dto.roleId }
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

  async reactivate(actor: AuthUser, id: string) {
    return this.update(actor, id, { status: "ACTIVE" });
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
          isActive: false,
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

  async getUserPermissions(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) },
      include: this.includeRelations()
    });
    if (!user) throw new NotFoundException("User not found");

    const serialized = this.serialize(user);
    return {
      rolePermissions: serialized.permissions,
      userPermissions: serialized.userPermissions
    };
  }

  async updateUserPermissions(actor: AuthUser, id: string, dto: UpdateUserPermissionsDto) {
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) }
    });
    if (!current) throw new NotFoundException("User not found");

    const uniqueIds = [...new Set(dto.permissionIds)];
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: uniqueIds }, isActive: true, deletedAt: null },
      select: { id: true, key: true }
    });

    if (permissions.length !== uniqueIds.length) {
      throw new BadRequestException("One or more permissions are invalid");
    }
    if (permissions.some((permission) => !canDelegatePermission(actor.permissions, permission.key))) {
      throw new ForbiddenException("PERMISSION_DELEGATION_DENIED");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id } });
      
      if (dto.permissionIds.length > 0) {
        await tx.userPermission.createMany({
          data: dto.permissionIds.map(permissionId => ({ userId: id, permissionId })),
          skipDuplicates: true
        });
      }

      const permissionsOverride = dto.permissionsOverride ?? true;

      await tx.user.update({
        where: { id },
        data: { permissionsOverride, updatedById: actor.id }
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: id,
          action: "update_permissions",
          after: { permissionIds: dto.permissionIds, permissionsOverride }
        }
      });
    });

    return this.findOne(actor, id);
  }

  async applyProfile(actor: AuthUser, id: string, dto: ApplyProfileDto) {
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) }
    });
    if (!current) throw new NotFoundException("User not found");

    const profile = await this.prisma.permissionProfile.findFirst({
      where: { 
        id: dto.profileId, 
        isActive: true, 
        organizationId: actor.organizationId
      },
      include: { permissions: { include: { permission: true } } }
    });
    if (!profile) throw new NotFoundException("Profile not found");

    const activePermissions = profile.permissions.filter(
      (entry) => entry.permission.isActive && !entry.permission.deletedAt
    );
    
    if (activePermissions.some((entry) => !canDelegatePermission(actor.permissions, entry.permission.key))) {
      throw new ForbiddenException("PERMISSION_DELEGATION_DENIED");
    }

    const permissionIds = activePermissions.map((entry) => entry.permissionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id } });
      
      if (permissionIds.length > 0) {
        await tx.userPermission.createMany({
          data: permissionIds.map(permissionId => ({ userId: id, permissionId })),
          skipDuplicates: true
        });
      }

      await tx.user.update({
        where: { id },
        data: { permissionsOverride: true, updatedById: actor.id }
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: id,
          action: "apply_profile",
          after: { profileId: dto.profileId, permissionIds }
        }
      });
    });

    return this.findOne(actor, id);
  }

  async copyPermissions(actor: AuthUser, id: string, dto: CopyPermissionsDto) {
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) }
    });
    if (!current) throw new NotFoundException("User not found");

    const source = await this.prisma.user.findFirst({
      where: { id: dto.sourceUserId, deletedAt: null, ...this.organizationScope(actor) },
      include: this.includeRelations()
    });
    if (!source) throw new NotFoundException("Source user not found");

    const sourcePermissions = this.serialize(source);
    
    // Collect both role permissions and user overrides
    const allPermissions = [
      ...sourcePermissions.permissions,
      ...sourcePermissions.userPermissions
    ];
    
    // Get unique keys and IDs
    const uniqueKeys = new Set(allPermissions.map(p => p.key));
    const uniqueIds = [...new Set(allPermissions.map(p => p.id))];

    if ([...uniqueKeys].some(key => !canDelegatePermission(actor.permissions, key))) {
      throw new ForbiddenException("PERMISSION_DELEGATION_DENIED");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id } });
      
      if (uniqueIds.length > 0) {
        await tx.userPermission.createMany({
          data: uniqueIds.map(permissionId => ({ userId: id, permissionId })),
          skipDuplicates: true
        });
      }

      await tx.user.update({
        where: { id },
        data: { permissionsOverride: true, updatedById: actor.id }
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: id,
          action: "copy_permissions",
          after: { sourceUserId: dto.sourceUserId, permissionIds: uniqueIds }
        }
      });
    });

    return this.findOne(actor, id);
  }

  async updateBranches(actor: AuthUser, id: string, dto: UpdateUserBranchesDto) {
    const current = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, ...this.organizationScope(actor) }
    });
    if (!current) throw new NotFoundException("User not found");

    await this.validateBranches(actor, dto.branchIds, dto.primaryBranchId);

    await this.prisma.$transaction(async (tx) => {
      await tx.userBranch.deleteMany({ where: { userId: id } });
      
      await tx.userBranch.createMany({
        data: dto.branchIds.map((branchId) => ({
          userId: id,
          branchId,
          isPrimary: branchId === (dto.primaryBranchId ?? dto.branchIds[0])
        })),
        skipDuplicates: true
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "User",
          entityId: id,
          action: "update_branches",
          after: { branchIds: dto.branchIds, primaryBranchId: dto.primaryBranchId }
        }
      });
    });

    return this.findOne(actor, id);
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
      },
      include: { permissions: { include: { permission: true } } }
    });
    if (!role) throw new BadRequestException("Invalid role");
    if (actor.permissions.includes("system.manage_all")) return;

    const exceedsActor = role.permissions.some(
      ({ permission }) =>
        permission.isActive &&
        !permission.deletedAt &&
        !canDelegatePermission(actor.permissions, permission.key)
    );
    if (exceedsActor) throw new ForbiddenException("ROLE_ASSIGNMENT_EXCEEDS_ACTOR");
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
      branches: { include: { branch: true } },
      professional: {
        select: {
          id: true,
          commissionRate: true,
          isActive: true
        }
      },
      permissions: { include: { permission: true } }
    } as const;
  }

  private serialize(user: Prisma.UserGetPayload<{ include: ReturnType<UsersService["includeRelations"]> }>) {
    const rolePermissions = new Map<string, Permission>();

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

    const selectedPermissions = [...rolePermissions.values()];

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
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
      userPermissions: user.permissions?.map(({ permission }) => ({
        id: permission.id,
        key: permission.key,
        code: permission.code,
        name: permission.name,
        module: permission.module
      })) ?? [],
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
