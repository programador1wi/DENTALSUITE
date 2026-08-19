import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasEffectivePermission } from "@dentalwarner/shared";
import { PERMISSIONS_KEY, PERMISSIONS_MODE_KEY } from "../decorators/permissions.decorator";
import { AuthUser } from "../types/auth-user";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    const mode = this.reflector.getAllAndOverride<"all" | "any">(PERMISSIONS_MODE_KEY, [
      context.getHandler(),
      context.getClass()
    ]) ?? "all";

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

    const hasPermission = (permission: string) => hasEffectivePermission(user.permissions, permission);
    const allowed = mode === "any" ? required.some(hasPermission) : required.every(hasPermission);
    if (!allowed) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
