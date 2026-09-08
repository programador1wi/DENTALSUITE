import { ForbiddenException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";

export type UserDiscountCapability = {
  userId: string;
  active: boolean;
  hasPermission: boolean;
  configuredMaximumPercent: Prisma.Decimal;
  effectiveMaximumPercent: Prisma.Decimal;
  policyVersion: number | null;
  permissionKeys: string[];
};

@Injectable()
export class DiscountAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserCapability(
    actor: Pick<AuthUser, "id" | "organizationId">,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.prisma;
    const user = await db.user.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId, deletedAt: null },
      include: {
        discountPolicy: true,
        permissions: { include: { permission: true } },
        role: { include: { permissions: { include: { permission: true } } } },
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }
      }
    });
    if (!user) {
      throw new ForbiddenException({ code: "USER_INACTIVE", message: "El usuario no está activo." });
    }

    const keys = new Set<string>();
    for (const entry of user.permissions) {
      if (entry.permission.isActive && !entry.permission.deletedAt) keys.add(entry.permission.key);
    }
    for (const entry of user.role?.permissions ?? []) {
      if (entry.permission.isActive && !entry.permission.deletedAt) keys.add(entry.permission.key);
    }
    for (const userRole of user.roles) {
      for (const entry of userRole.role.permissions) {
        if (entry.permission.isActive && !entry.permission.deletedAt) keys.add(entry.permission.key);
      }
    }

    const active = user.isActive && user.status === UserStatus.ACTIVE;
    const hasPermission = keys.has("organization.manage_all") || keys.has("treatment_discount.apply");
    const configuredMaximumPercent = user.discountPolicy?.maximumDiscountPercent ?? new Prisma.Decimal(0);
    const effectiveMaximumPercent =
      active && hasPermission && user.discountPolicy?.active ? configuredMaximumPercent : new Prisma.Decimal(0);

    return {
      userId: user.id,
      active,
      hasPermission,
      configuredMaximumPercent,
      effectiveMaximumPercent,
      policyVersion: user.discountPolicy?.version ?? null,
      permissionKeys: [...keys]
    } satisfies UserDiscountCapability;
  }

  async validateRequestedDiscount(input: {
    actor: Pick<AuthUser, "id" | "organizationId">;
    procedureAllowsDiscount: boolean;
    procedureMaximumPercent: Prisma.Decimal.Value;
    requestedPercent: Prisma.Decimal.Value;
    tx?: Prisma.TransactionClient;
  }) {
    const requestedPercent = new Prisma.Decimal(input.requestedPercent);
    if (requestedPercent.lt(0)) {
      this.ruleError("DISCOUNT_BELOW_ZERO", "El porcentaje no puede ser negativo.");
    }
    if (requestedPercent.gt(100)) {
      this.ruleError("DISCOUNT_ABOVE_ONE_HUNDRED", "El porcentaje no puede superar 100 %.");
    }

    const capability = await this.getUserCapability(input.actor, input.tx);
    if (!capability.active) {
      throw new ForbiddenException({ code: "USER_INACTIVE", message: "El usuario no está activo." });
    }
    if (!capability.hasPermission) {
      throw new ForbiddenException({
        code: "DISCOUNT_PERMISSION_REQUIRED",
        message: "El usuario no tiene permiso para aplicar descuentos."
      });
    }
    if (capability.effectiveMaximumPercent.lte(0)) {
      this.ruleError(
        "USER_DISCOUNT_LIMIT_NOT_CONFIGURED",
        "El usuario no tiene configurado un límite de descuento mayor a 0 %."
      );
    }
    if (!input.procedureAllowsDiscount) {
      this.ruleError("PROCEDURE_DOES_NOT_ALLOW_DISCOUNT", "Esta prestación no admite descuentos.");
    }

    const procedureMaximumPercent = new Prisma.Decimal(input.procedureMaximumPercent ?? 0);
    if (procedureMaximumPercent.lte(0)) {
      this.ruleError(
        "PROCEDURE_DISCOUNT_LIMIT_NOT_CONFIGURED",
        "La prestación no tiene configurado un máximo de descuento mayor a 0 %."
      );
    }
    const effectiveMaximumPercent = Prisma.Decimal.min(
      capability.effectiveMaximumPercent,
      procedureMaximumPercent
    );
    if (requestedPercent.gt(effectiveMaximumPercent)) {
      this.ruleError(
        "DISCOUNT_EXCEEDS_EFFECTIVE_MAXIMUM",
        `El descuento solicitado es de ${requestedPercent.toFixed(2)} %, pero esta prestación permite un máximo efectivo de ${effectiveMaximumPercent.toFixed(2)} %.`,
        {
          requestedPercent: requestedPercent.toFixed(2),
          userMaximumPercent: capability.effectiveMaximumPercent.toFixed(2),
          procedureMaximumPercent: procedureMaximumPercent.toFixed(2),
          effectiveMaximumPercent: effectiveMaximumPercent.toFixed(2)
        }
      );
    }

    return {
      requestedPercent,
      userMaximumPercent: capability.effectiveMaximumPercent,
      procedureMaximumPercent,
      effectiveMaximumPercent
    };
  }

  private ruleError(code: string, message: string, details?: Record<string, string>): never {
    throw new UnprocessableEntityException({ code, message, ...(details ? { details } : {}) });
  }
}
