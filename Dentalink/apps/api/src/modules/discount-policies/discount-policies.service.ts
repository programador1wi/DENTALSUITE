import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import { ListUserDiscountPoliciesQueryDto, UpsertUserDiscountPolicyDto } from "./dto/discount-policy.dto";

type PermissionEntry = {
  permission: { key: string; isActive: boolean; deletedAt: Date | null };
};

type UserPermissionGraph = {
  permissions: PermissionEntry[];
  role: { permissions: PermissionEntry[] } | null;
  roles: Array<{ role: { permissions: PermissionEntry[] } }>;
};

const permissionKeys = (user: UserPermissionGraph) => {
  const keys = new Set<string>();
  const add = (row: PermissionEntry) => {
    if (row.permission.isActive && !row.permission.deletedAt) keys.add(row.permission.key);
  };
  for (const row of user.permissions ?? []) add(row);
  for (const row of user.role?.permissions ?? []) add(row);
  for (const userRole of user.roles ?? []) {
    for (const row of userRole.role.permissions ?? []) add(row);
  }
  return keys;
};

@Injectable()
export class DiscountPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(actor: AuthUser, query: ListUserDiscountPoliciesQueryDto) {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        ...(query.active === "all" ? {} : { isActive: query.active !== "false" }),
        ...(query.search?.trim()
          ? {
              OR: [
                { firstName: { contains: query.search.trim(), mode: "insensitive" } },
                { lastName: { contains: query.search.trim(), mode: "insensitive" } },
                { email: { contains: query.search.trim(), mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        discountPolicy: true,
        branches: { include: { branch: { select: { id: true, name: true } } } },
        permissions: { include: { permission: true } },
        role: { include: { permissions: { include: { permission: true } } } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    });
    const updaterIds = [...new Set(users.map((user) => user.discountPolicy?.updatedById).filter(Boolean))] as string[];
    const updaters = updaterIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: updaterIds }, organizationId: actor.organizationId },
          select: { id: true, firstName: true, lastName: true }
        })
      : [];
    const updaterNames = new Map(
      updaters.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()])
    );

    return users
      .map((user) => {
        const keys = permissionKeys(user);
        const hasPermission = keys.has("organization.manage_all") || keys.has("treatment_discount.apply");
        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          role: user.role?.name ?? user.roles[0]?.role.name ?? "Sin rol",
          branches: user.branches.map(({ branch }) => branch),
          isActive: user.isActive && user.status === "ACTIVE",
          hasPermission,
          maximumDiscountPercent: user.discountPolicy?.maximumDiscountPercent.toFixed(2) ?? "0.00",
          policyVersion: user.discountPolicy?.version ?? null,
          updatedAt: user.discountPolicy?.updatedAt ?? null,
          updatedById: user.discountPolicy?.updatedById ?? null,
          updatedByName: user.discountPolicy?.updatedById
            ? updaterNames.get(user.discountPolicy.updatedById) ?? "Usuario no disponible"
            : null
        };
      })
      .filter((user) => {
        if (query.permission === "ALL") return true;
        if (query.permission === "WITHOUT_PERMISSION") return !user.hasPermission;
        return user.hasPermission;
      });
  }

  async upsertUser(actor: AuthUser, userId: string, dto: UpsertUserDiscountPolicyDto) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
      include: {
        permissions: { include: { permission: true } },
        role: { include: { permissions: { include: { permission: true } } } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
      }
    });
    if (!target) throw new NotFoundException("Usuario no encontrado.");
    const keys = permissionKeys(target);
    if (!keys.has("organization.manage_all") && !keys.has("treatment_discount.apply")) {
      throw new ForbiddenException({
        code: "DISCOUNT_PERMISSION_REQUIRED",
        message: "Asigna el permiso Permitir descuento para configurar un límite."
      });
    }

    const current = await this.prisma.userDiscountPolicy.findUnique({ where: { userId } });
    if (dto.expectedVersion && current && current.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: "DISCOUNT_VERSION_CONFLICT",
        message: "La configuración fue modificada por otro usuario. Actualiza la información."
      });
    }

    const maximum = new Prisma.Decimal(dto.maximumDiscountPercent).toDecimalPlaces(2);
    const saved = await this.prisma.$transaction(async (tx) => {
      const policy = await tx.userDiscountPolicy.upsert({
        where: { userId },
        create: {
          organizationId: actor.organizationId,
          userId,
          maximumDiscountPercent: maximum,
          createdById: actor.id,
          updatedById: actor.id
        },
        update: {
          maximumDiscountPercent: maximum,
          active: true,
          updatedById: actor.id,
          version: { increment: 1 }
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          userId: actor.id,
          actorUserId: actor.id,
          entity: "UserDiscountPolicy",
          entityId: policy.id,
          action: current ? "update" : "create",
          before: current
            ? ({ maximumDiscountPercent: current.maximumDiscountPercent.toFixed(2), version: current.version } as Prisma.InputJsonValue)
            : undefined,
          after: {
            targetUserId: userId,
            maximumDiscountPercent: policy.maximumDiscountPercent.toFixed(2),
            version: policy.version
          }
        }
      });
      return policy;
    });

    return {
      userId,
      maximumDiscountPercent: saved.maximumDiscountPercent.toFixed(2),
      version: saved.version,
      updatedAt: saved.updatedAt
    };
  }
}
