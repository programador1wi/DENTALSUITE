import { UsersService } from "./users.service";

describe("UsersService role delegation", () => {
  const role = (keys: string[]) => ({
    id: "role",
    permissions: keys.map((key) => ({
      permission: { key, isActive: true, deletedAt: null }
    }))
  });

  it("rejects assigning a role above the actor authority", async () => {
    const prisma = { role: { findFirst: jest.fn().mockResolvedValue(role(["payments.void"])) } };
    const service = new UsersService(prisma as never);
    const validate = (service as unknown as { validateRole: (actor: unknown, roleId: string) => Promise<void> })
      .validateRole.bind(service);

    await expect(
      validate({ id: "actor", organizationId: "org", permissions: ["payments.read"] }, "role")
    ).rejects.toMatchObject({ response: { message: "ROLE_ASSIGNMENT_EXCEEDS_ACTOR" } });
  });

  it("allows a super administrator to assign the protected profile", async () => {
    const prisma = { role: { findFirst: jest.fn().mockResolvedValue(role(["system.manage_all"])) } };
    const service = new UsersService(prisma as never);
    const validate = (service as unknown as { validateRole: (actor: unknown, roleId: string) => Promise<void> })
      .validateRole.bind(service);

    await expect(
      validate({ id: "actor", organizationId: "org", permissions: ["system.manage_all"] }, "role")
    ).resolves.toBeUndefined();
  });
});
