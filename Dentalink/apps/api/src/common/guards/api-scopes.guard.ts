import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { DeveloperApiScope } from "@dentalwarner/shared";
import { API_SCOPES_KEY } from "../decorators/require-api-scopes.decorator";
import { AuthM2MClient } from "../types/m2m-client.type";

@Injectable()
export class ApiScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<DeveloperApiScope[]>(API_SCOPES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required?.length) return true;
    const client = context.switchToHttp().getRequest<{ m2mClient?: AuthM2MClient }>().m2mClient;
    if (!client || !required.every((scope) => client.scopes.includes(scope))) {
      throw new ForbiddenException({
        code: "API_SCOPE_FORBIDDEN",
        message: "La credencial no autoriza esta operacion."
      });
    }
    return true;
  }
}
