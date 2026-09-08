import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canDelegatePermission, getPermissionMetadata } from "@dentalwarner/shared";
import { resolvePagination } from "../../common/utils/pagination.util";
import { PrismaService } from "../../database/prisma.service";
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { ListPermissionsQueryDto } from "./dto/list-permissions-query.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { AuthUser } from "../../common/types/auth-user";

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListPermissionsQueryDto) {
    const { search, module, active } = query;
    const { skip, take } = resolvePagination(query);

    const where: Prisma.PermissionWhereInput = {
      deletedAt: null,
      ...(active !== undefined ? { isActive: active === "true" } : {}),
      ...(module ? { module } : {}),
      ...(search
        ? {
            OR: [
              { key: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { resource: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const permissions = await this.prisma.permission.findMany({
      where,
      skip,
      take,
      orderBy: [{ module: "asc" }, { action: "asc" }]
    });

    return permissions.map((permission) => ({
      ...permission,
      ...getPermissionMetadata(permission),
      delegable: canDelegatePermission(actor.permissions, permission.key, permission.isSystem)
    }));
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findFirst({ where: { id, deletedAt: null } });
    if (!permission) throw new NotFoundException("Permission not found");
    return permission;
  }

  async create(dto: CreatePermissionDto) {
    const permissionKey = this.normalizeCode(dto.key ?? dto.code ?? `${dto.module}.${dto.action ?? "read"}`);
    const permissionName = dto.name?.trim() || permissionKey;

    return this.prisma.permission.create({
      data: {
        key: permissionKey,
        name: permissionName,
        code: permissionKey,
        module: dto.module.trim(),
        action: dto.action?.trim() ?? permissionKey.split(".")[1] ?? "read",
        resource: dto.resource?.trim() ?? permissionKey.split(".")[0] ?? dto.module.trim(),
        description: dto.description?.trim(),
        isSystem: false
      }
    });
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const current = await this.prisma.permission.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException("Permission not found");
    if (current.isSystem) throw new BadRequestException("PROTECTED_PERMISSION");

    const nextKey = dto.key ? this.normalizeCode(dto.key) : undefined;

    return this.prisma.permission.update({
      where: { id },
      data: {
        key: nextKey,
        code: nextKey,
        name: dto.name?.trim(),
        module: dto.module?.trim(),
        action: dto.action?.trim(),
        resource: dto.resource?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive
      }
    });
  }

  async deactivate(id: string) {
    const current = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
      include: { roles: true }
    });
    if (!current) throw new NotFoundException("Permission not found");
    if (current.isSystem) throw new BadRequestException("System permissions cannot be deactivated");
    return this.update(id, { isActive: false });
  }

  private normalizeCode(code: string) {
    return code.trim().toLowerCase().replace(/[^a-z0-9_.]+/g, "_");
  }
}
