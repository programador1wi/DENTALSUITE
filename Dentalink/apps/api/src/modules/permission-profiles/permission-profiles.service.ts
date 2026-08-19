import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canDelegatePermission } from "@dentalwarner/shared";
import { resolvePagination } from "../../common/utils/pagination.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { ListProfilesQueryDto } from "./dto/list-profiles-query.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class PermissionProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListProfilesQueryDto) {
    const { search, active } = query;
    const { skip, take } = resolvePagination(query);

    const where: Prisma.PermissionProfileWhereInput = {
      ...this.organizationScope(actor),
      ...(active !== undefined ? { isActive: active === "true" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const profiles = await this.prisma.permissionProfile.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "asc" },
      include: this.includeRelations()
    });

    return profiles.map((profile) => this.serialize(profile));
  }

  async findOne(actor: AuthUser, id: string) {
    const profile = await this.prisma.permissionProfile.findFirst({
      where: { id, ...this.organizationScope(actor) },
      include: this.includeRelations()
    });
    if (!profile) throw new NotFoundException("Permission profile not found");
    return this.serialize(profile);
  }

  async create(actor: AuthUser, dto: CreateProfileDto) {
    await this.validatePermissions(actor, dto.permissionIds);

    const profile = await this.prisma.$transaction(async (tx) => {
      const created = await tx.permissionProfile.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          createdById: actor.id
        }
      });

      await tx.permissionProfileEntry.createMany({
        data: dto.permissionIds.map((permissionId) => ({ profileId: created.id, permissionId })),
        skipDuplicates: true
      });

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PermissionProfile",
          entityId: created.id,
          action: "create",
          after: { permissionIds: dto.permissionIds }
        }
      });

      return created;
    });

    return this.findOne(actor, profile.id);
  }

  async update(actor: AuthUser, id: string, dto: UpdateProfileDto) {
    const current = await this.prisma.permissionProfile.findFirst({
      where: { id, ...this.organizationScope(actor) }
    });
    if (!current) throw new NotFoundException("Permission profile not found");
    
    if (dto.permissionIds) await this.validatePermissions(actor, dto.permissionIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.permissionProfile.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          isActive: dto.isActive,
          updatedById: actor.id
        }
      });

      if (dto.permissionIds) {
        await tx.permissionProfileEntry.deleteMany({ where: { profileId: id } });
        await tx.permissionProfileEntry.createMany({
          data: dto.permissionIds.map((permissionId) => ({ profileId: id, permissionId })),
          skipDuplicates: true
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.id,
          entity: "PermissionProfile",
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
    return this.update(actor, id, { isActive: false });
  }

  private organizationScope(actor: AuthUser): Prisma.PermissionProfileWhereInput {
    return actor.permissions.includes("system.manage_all") ? {} : { organizationId: actor.organizationId };
  }

  private async validatePermissions(actor: AuthUser, permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: uniqueIds }, isActive: true, deletedAt: null },
      select: { id: true, key: true }
    });
    if (permissions.length !== uniqueIds.length) {
      throw new BadRequestException("One or more permissions are invalid");
    }
    if (permissions.some((permission) => permission.key === "system.manage_all")) {
      throw new ForbiddenException("PROTECTED_PERMISSION");
    }
    if (permissions.some((permission) => !canDelegatePermission(actor.permissions, permission.key))) {
      throw new ForbiddenException("PERMISSION_DELEGATION_DENIED");
    }
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

  private serialize(profile: Prisma.PermissionProfileGetPayload<{ include: ReturnType<PermissionProfilesService["includeRelations"]> }>) {
    return {
      id: profile.id,
      organizationId: profile.organizationId,
      name: profile.name,
      description: profile.description,
      isActive: profile.isActive,
      permissions: profile.permissions.map(({ permission }) => ({
        id: permission.id,
        code: permission.code,
        module: permission.module,
        action: permission.action,
        resource: permission.resource
      })),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };
  }
}
