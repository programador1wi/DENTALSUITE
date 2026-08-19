import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";

describe("PermissionsGuard", () => {
  const contextFor = (permissions: string[]) =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) })
    }) as unknown as ExecutionContext;

  it("accepts a canonical permission through its compatibility alias", () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === "permissions" ? ["price_list.view"] : "all"))
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(guard.canActivate(contextFor(["price_lists.read"]))).toBe(true);
  });

  it("rejects a permission absent from the effective permission set", () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === "permissions" ? ["payments.void"] : "all"))
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(contextFor(["payments.read"]))).toThrow(ForbiddenException);
  });
});
