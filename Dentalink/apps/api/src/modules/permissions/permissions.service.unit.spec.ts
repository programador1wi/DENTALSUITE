import { PermissionsService } from "./permissions.service";

describe("PermissionsService", () => {
  it("enriches the catalog and marks protected permissions as non-delegable", async () => {
    const prisma = {
      permission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "permission-system",
            key: "organization.manage_all",
            name: "Manage all",
            description: null,
            module: "system",
            code: "organization.manage_all",
            action: "manage_all",
            resource: "system",
            isActive: true,
            isSystem: true,
            deletedAt: null
          },
          {
            id: "permission-custom",
            key: "custom_module.read",
            name: "Custom read",
            description: null,
            module: "custom_module",
            code: "custom_module.read",
            action: "read",
            resource: "custom_module",
            isActive: true,
            isSystem: false,
            deletedAt: null
          }
        ])
      }
    };
    const service = new PermissionsService(prisma as never);

    const result = await service.findAll(
      { id: "actor", organizationId: "org", permissions: ["organization.manage_all", "custom_module.read"] } as never,
      {}
    );

    expect(result[0]).toMatchObject({
      businessGroup: "Administración",
      presentationTier: "INTERNAL",
      delegable: false
    });
    expect(result[1]).toMatchObject({ presentationTier: "ADVANCED", delegable: true });
  });

  it("keeps system permission keys immutable", async () => {
    const prisma = {
      permission: {
        findFirst: jest.fn().mockResolvedValue({ id: "permission-system", isSystem: true })
      }
    };
    const service = new PermissionsService(prisma as never);

    await expect(service.update("permission-system", { name: "Changed" })).rejects.toMatchObject({
      response: { message: "PROTECTED_PERMISSION" }
    });
  });
});
