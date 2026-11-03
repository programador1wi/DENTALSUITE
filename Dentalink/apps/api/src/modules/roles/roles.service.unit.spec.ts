import { RolesService } from "./roles.service";

describe("RolesService permission delegation", () => {
  const actor = (permissions: string[]) =>
    ({ id: "actor", organizationId: "org", permissions }) as never;

  it("never allows organization.manage_all in an ordinary profile", async () => {
    const prisma = {
      permission: {
        findMany: jest.fn().mockResolvedValue([{ id: "manage-all", key: "organization.manage_all" }])
      }
    };
    const service = new RolesService(prisma as never);

    await expect(
      (service as unknown as { validatePermissions: (actor: unknown, ids: string[]) => Promise<void> })
        .validatePermissions(actor(["organization.manage_all"]), ["manage-all"])
    ).rejects.toMatchObject({ response: { message: "PROTECTED_PERMISSION" } });
  });

  it("rejects permissions above the actor and accepts an effective alias", async () => {
    const prisma = {
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: "void", key: "payments.void" }])
          .mockResolvedValueOnce([{ id: "price", key: "price_list.view" }])
      }
    };
    const service = new RolesService(prisma as never);
    const validate = (service as unknown as { validatePermissions: (actor: unknown, ids: string[]) => Promise<void> })
      .validatePermissions.bind(service);

    await expect(validate(actor(["payments.read"]), ["void"])).rejects.toMatchObject({
      response: { message: "PERMISSION_DELEGATION_DENIED" }
    });
    await expect(validate(actor(["price_lists.read"]), ["price"])).resolves.toBeUndefined();
  });
});
