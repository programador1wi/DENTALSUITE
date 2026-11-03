import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiScopesGuard } from "./api-scopes.guard";
import { AuthM2MClient } from "../types/m2m-client.type";

describe("ApiScopesGuard", () => {
  let guard: ApiScopesGuard;
  let reflector: Reflector;

  const buildContext = (scopes: string[] | undefined, client?: Partial<AuthM2MClient>): ExecutionContext => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(scopes);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          m2mClient: client
        })
      })
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ApiScopesGuard(reflector);
  });

  it("permite acceso cuando no hay scopes requeridos", () => {
    const context = buildContext(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it("permite acceso cuando el cliente posee todos los scopes requeridos", () => {
    const context = buildContext(["patients:read", "appointments:write"], {
      scopes: ["patients:read", "appointments:write", "budgets:read"]
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rechaza wildcard global '*'", () => {
    const context = buildContext(["patients:read", "appointments:write"], {
      scopes: ["*" as never]
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rechaza wildcard de dominio 'patients:*'", () => {
    const context = buildContext(["patients:read"], {
      scopes: ["patients:*" as never]
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rechaza peticion cuando el cliente no esta autenticado", () => {
    const context = buildContext(["patients:read"], undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rechaza peticion cuando falta algun scope requerido", () => {
    const context = buildContext(["patients:read", "appointments:write"], {
      scopes: ["patients:read"]
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
