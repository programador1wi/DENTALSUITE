import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { assertBranchAccess, branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { RolesService } from "../roles/roles.service";

describe("Tenant & Branch Security Isolation", () => {
  describe("Branch Scoping & Isolation (branchScope & assertBranchAccess)", () => {
    const actorBranch1: AuthUser = {
      id: "user-1",
      organizationId: "org-1",
      email: "user1@dentalwarner.com",
      firstName: "User",
      lastName: "One",
      permissions: ["patients.read", "patients.write"],
      roleIds: ["role-1"],
      roleNames: ["Doctor"],
      branchIds: ["branch-1"]
    };

    const actorMultiBranch: AuthUser = {
      id: "user-2",
      organizationId: "org-1",
      email: "user2@dentalwarner.com",
      firstName: "User",
      lastName: "Two",
      permissions: ["patients.read"],
      roleIds: ["role-2"],
      roleNames: ["Recepcionista"],
      branchIds: ["branch-1", "branch-2"]
    };

    it("allows access when requesting an authorized branch", () => {
      expect(() => assertBranchAccess(actorBranch1, "branch-1")).not.toThrow();
      expect(branchScope(actorBranch1, "branch-1")).toEqual("branch-1");
    });

    it("strictly forbids access when requesting an unauthorized branch in the same organization", () => {
      expect(() => assertBranchAccess(actorBranch1, "branch-2")).toThrow(ForbiddenException);
      expect(() => branchScope(actorBranch1, "branch-2")).toThrow("Branch access denied");
    });

    it("strictly forbids access when requesting a branch from another organization", () => {
      expect(() => assertBranchAccess(actorBranch1, "branch-org2-xyz")).toThrow(ForbiddenException);
      expect(() => branchScope(actorBranch1, "branch-org2-xyz")).toThrow("Branch access denied");
    });

    it("defaults to filtering by all authorized branches when no specific branch is requested", () => {
      const scope = branchScope(actorMultiBranch);
      expect(scope).toEqual({ in: ["branch-1", "branch-2"] });
    });
  });

  describe("Privilege Escalation & Role Security Isolation", () => {
    const limitedActor: AuthUser = {
      id: "limited-user",
      organizationId: "org-1",
      email: "limited@dentalwarner.com",
      firstName: "Limited",
      lastName: "Admin",
      permissions: ["roles.read", "roles.write", "patients.read"],
      roleIds: ["role-limited"],
      roleNames: ["Admin Sucursal"],
      branchIds: ["branch-1"]
    };

    it("prevents assigning system.manage_all to any custom role", async () => {
      const prisma = {
        permission: {
          findMany: jest.fn().mockResolvedValue([
            { id: "perm-sys", key: "system.manage_all", isActive: true, deletedAt: null }
          ])
        }
      };
      const rolesService = new RolesService(prisma as never);

      await expect(
        rolesService.create(limitedActor, {
          name: "Rol Super Elevado",
          permissionIds: ["perm-sys"]
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("prevents delegating permissions that the creator does not possess", async () => {
      const prisma = {
        permission: {
          findMany: jest.fn().mockResolvedValue([
            { id: "perm-payments", key: "payments.create", isActive: true, deletedAt: null }
          ])
        }
      };
      const rolesService = new RolesService(prisma as never);

      await expect(
        rolesService.create(limitedActor, {
          name: "Rol Con Pagos",
          permissionIds: ["perm-payments"]
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("protects system and super admin roles from modification or deactivation", async () => {
      const prisma = {
        role: {
          findFirst: jest.fn().mockResolvedValue({
            id: "role-super-admin",
            code: "super_admin",
            name: "Super Administrador",
            isSystem: true,
            isActive: true,
            organizationId: "org-1"
          })
        }
      };
      const rolesService = new RolesService(prisma as never);

      await expect(
        rolesService.update(limitedActor, "role-super-admin", {
          name: "Super Admin Modificado"
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
