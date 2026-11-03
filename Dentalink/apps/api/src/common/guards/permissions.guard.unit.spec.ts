import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CANONICAL_PERMISSION_BUNDLES,
  getPermissionClassification,
  isAssignablePermissionKey,
  roleDefinitions
} from "@dentalwarner/shared";
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

  it("defines the nine preserved business roles with canonical codes", () => {
    expect(roleDefinitions.map(({ name, code }) => ({ name, code }))).toEqual([
      { name: "Super Administrador", code: "super_admin" },
      { name: "Administrador", code: "admin" },
      { name: "Administrador de Sucursal", code: "branch_admin" },
      { name: "Gerente de Sucursal", code: "branch_manager" },
      { name: "Caja", code: "cashier" },
      { name: "Recepcionista", code: "receptionist" },
      { name: "Recepción", code: "reception" },
      { name: "Dentista", code: "dentist" },
      { name: "CEYE", code: "ceye" }
    ]);
  });

  it("keeps internal and obsolete permissions outside the delegable catalog", () => {
    expect(getPermissionClassification({ key: "admin.users.manage", isSystem: true })).toBe("BUNDLE");
    expect(getPermissionClassification({ key: "users.read", isSystem: true })).toBe("INTERNAL");
    expect(getPermissionClassification({ key: "organization.manage_all", isSystem: true })).toBe("INTERNAL");
    expect(getPermissionClassification({ key: "legacy.unknown", isSystem: true })).toBe("OBSOLETE");
    expect(getPermissionClassification({ key: "organization.custom", isSystem: false })).toBe("CUSTOM");
    expect(isAssignablePermissionKey("admin.users.manage")).toBe(true);
    expect(isAssignablePermissionKey("users.read")).toBe(false);
    expect(isAssignablePermissionKey("organization.manage_all")).toBe(false);
  });

  it("does not contain recursive permission bundles", () => {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (key: string) => {
      if (visiting.has(key)) throw new Error(`Recursive bundle: ${key}`);
      if (visited.has(key)) return;
      visiting.add(key);
      for (const target of CANONICAL_PERMISSION_BUNDLES[key] ?? []) {
        if (Object.hasOwn(CANONICAL_PERMISSION_BUNDLES, target)) visit(target);
      }
      visiting.delete(key);
      visited.add(key);
    };

    for (const key of Object.keys(CANONICAL_PERMISSION_BUNDLES)) visit(key);
  });
});
