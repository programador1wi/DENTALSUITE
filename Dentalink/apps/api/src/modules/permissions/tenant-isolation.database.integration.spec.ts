import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { assertTestDatabase } from "../../test/assert-test-database";
import { authUserInclude, isActiveAuthUser, serializeAuthUser } from "../auth/auth-user.resolver";
import { UsersService } from "../users/users.service";

describe("database tenant isolation", () => {
  const databaseUrl = assertTestDatabase(process.env.SECURITY_TEST_DATABASE_URL ?? process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  afterAll(async () => {
    await prisma.branch.deleteMany({ where: { id: "security-org-a-branch-created-after-login" } });
    await prisma.$disconnect();
    await pool.end();
  });

  async function actor(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: authUserInclude });
    if (!isActiveAuthUser(user)) throw new Error("Fixture user is inactive");
    return serializeAuthUser(user);
  }

  it("resolves every current and future branch for the organization administrator", async () => {
    const before = await actor("security-org-a-super-user");
    expect(before.branchIds).toEqual(expect.arrayContaining([
      "security-org-a-branch-1",
      "security-org-a-branch-2"
    ]));

    await prisma.branch.create({
      data: {
        id: "security-org-a-branch-created-after-login",
        organizationId: "security-org-a",
        name: "Sucursal creada después del inicio",
        code: "S3",
        timezone: "America/Mexico_City",
        status: "ACTIVE",
        isActive: true
      }
    });
    const after = await actor("security-org-a-super-user");
    expect(after.branchIds).toContain("security-org-a-branch-created-after-login");
  });

  it("keeps a local administrator in the assigned branch", async () => {
    const local = await actor("security-org-a-local-user");
    expect(local.branchIds).toEqual(["security-org-a-branch-1"]);
    const service = new UsersService(prisma as never, { del: jest.fn() } as never);
    const validateBranches = (service as unknown as {
      validateBranches: (value: typeof local, ids: string[]) => Promise<void>;
    }).validateBranches.bind(service);
    await expect(validateBranches(local, ["security-org-a-branch-2"]))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns not found when an id belongs to another organization", async () => {
    const local = await actor("security-org-a-local-user");
    const service = new UsersService(prisma as never, { del: jest.fn() } as never);
    await expect(service.findOne(local, "security-org-b-restricted-user"))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("removes the legacy global grant from all assignments", async () => {
    const legacy = await prisma.permission.findUnique({ where: { key: "system.manage_all" } });
    expect(legacy).toMatchObject({ isActive: false });
    const assignmentCount = legacy
      ? await prisma.rolePermission.count({ where: { permissionId: legacy.id } })
      : 0;
    expect(assignmentCount).toBe(0);
  });
});
