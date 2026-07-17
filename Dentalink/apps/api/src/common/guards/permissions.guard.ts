import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AuthUser } from "../types/auth-user";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Authenticated user is required");
    }

    if (user.permissions.includes("system.manage_all")) {
      return true;
    }

    const legacyAliases: Record<string, string[]> = {
      "price_list.view": ["price_lists.read"],
      "price_list.create": ["price_lists.create"],
      "price_list.edit_draft": ["price_lists.update"],
      "price_list.publish": ["price_lists.update"],
      "price_list.schedule": ["price_lists.update"],
      "price_list.deactivate": ["price_lists.deactivate"],
      "price_list.compare_versions": ["price_lists.read"],
      "price_list.import": ["price_lists.update"],
      "price_list.export": ["price_lists.read"],
      "procedure.view": ["procedures.read"],
      "procedure.create": ["procedures.create"],
      "procedure.edit": ["procedures.update"],
      "procedure.deactivate": ["procedures.deactivate"],
      "price_template.view": ["price_lists.read"],
      "price_template.manage": ["price_lists.update"],
      "price_override.apply": ["price_lists.override_manual"],
      "laboratory_price.view": ["price_lists.read"],
      "laboratory_price.edit": ["price_lists.update"],
      "price_audit.view": ["price_lists.read"],
      "treatment_discount.apply": ["treatment_plans.update"],
      "treatment_discount.view": ["treatment_plans.read"]
    };
    const allowed = required.every(
      (permission) =>
        user.permissions.includes(permission) ||
        (legacyAliases[permission] ?? []).some((alias) => user.permissions.includes(alias))
    );
    if (!allowed) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
