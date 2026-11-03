import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BranchAccessGuard } from "./branch-access.guard";

describe("BranchAccessGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(() => "branchId")
  } as unknown as Reflector;

  const createMockContext = (user: any, params: any = {}, query: any = {}, body: any = {}) =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          query,
          body
        })
      })
    }) as unknown as ExecutionContext;

  const guard = new BranchAccessGuard(reflector);

  it("allows super admin regardless of branch assignment", () => {
    const context = createMockContext(
      { permissions: ["organization.manage_all"], branchIds: ["branch-1"] },
      { branchId: "branch-99" }
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows user assigned to the requested branch from params", () => {
    const context = createMockContext(
      { permissions: ["patients.read"], branchIds: ["branch-1", "branch-2"] },
      { branchId: "branch-1" }
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows user assigned to the requested branch from query", () => {
    const context = createMockContext(
      { permissions: ["patients.read"], branchIds: ["branch-1", "branch-2"] },
      {},
      { branchId: "branch-2" }
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows user assigned to the requested branch from body", () => {
    const context = createMockContext(
      { permissions: ["patients.read"], branchIds: ["branch-1", "branch-2"] },
      {},
      {},
      { branchId: "branch-1" }
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("throws ForbiddenException when user accesses unauthorized branch", () => {
    const context = createMockContext(
      { permissions: ["patients.read"], branchIds: ["branch-1"] },
      { branchId: "branch-2" }
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows pass-through when no branchId is present in request", () => {
    const context = createMockContext(
      { permissions: ["patients.read"], branchIds: ["branch-1"] },
      {},
      {},
      {}
    );
    expect(guard.canActivate(context)).toBe(true);
  });
});
