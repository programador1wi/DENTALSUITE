import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { assertTestDatabase } from "../test/assert-test-database";

const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
assertTestDatabase(databaseUrl);

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const fixtureOrganizations = [
  { id: "security-org-a", name: "Security Fixture A", slug: "security-fixture-a" },
  { id: "security-org-b", name: "Security Fixture B", slug: "security-fixture-b" }
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("SecurityFixture-Only-2026!", 12);
  await prisma.$transaction(async (tx) => {
    await tx.organization.deleteMany({ where: { id: { in: fixtureOrganizations.map((item) => item.id) } } });

    const manageAll = await tx.permission.upsert({
      where: { key: "organization.manage_all" },
      update: { isActive: true, deletedAt: null },
      create: {
        id: "security-permission-organization-manage-all",
        key: "organization.manage_all",
        code: "organization.manage_all",
        name: "Administrar toda la organización",
        description: "Fixture de aislamiento",
        module: "organization",
        action: "manage_all",
        resource: "organization",
        isSystem: true
      }
    });

    for (const organization of fixtureOrganizations) {
      await tx.organization.create({
        data: { ...organization, isActive: true, status: "ACTIVE" }
      });
      const branches = await Promise.all([1, 2].map((number) => tx.branch.create({
        data: {
          id: `${organization.id}-branch-${number}`,
          organizationId: organization.id,
          name: `${organization.name} Sucursal ${number}`,
          code: `S${number}`,
          isActive: true,
          status: "ACTIVE",
          timezone: "America/Mexico_City"
        }
      })));

      const superRole = await tx.role.create({
        data: {
          id: `${organization.id}-super-role`,
          organizationId: organization.id,
          name: "Super Administrador",
          code: "super_admin",
          isSystem: true,
          permissions: { create: { permissionId: manageAll.id } }
        }
      });
      const localRole = await tx.role.create({
        data: {
          id: `${organization.id}-local-role`,
          organizationId: organization.id,
          name: "Administrador de sucursal",
          code: "branch_admin",
          isSystem: true
        }
      });
      const restrictedRole = await tx.role.create({
        data: {
          id: `${organization.id}-restricted-role`,
          organizationId: organization.id,
          name: "Usuario restringido",
          code: "restricted_test"
        }
      });

      for (const [kind, roleId, branchIds] of [
        ["super", superRole.id, [branches[0].id]],
        ["local", localRole.id, [branches[0].id]],
        ["restricted", restrictedRole.id, [branches[1].id]]
      ] as const) {
        const user = await tx.user.create({
          data: {
            id: `${organization.id}-${kind}-user`,
            organizationId: organization.id,
            firstName: kind,
            lastName: organization.id,
            email: `${kind}.${organization.id}@security.invalid`,
            passwordHash,
            roleId,
            status: "ACTIVE",
            isActive: true,
            roles: { create: { roleId } },
            branches: {
              create: branchIds.map((branchId, index) => ({ branchId, isPrimary: index === 0 }))
            }
          }
        });
        if (!user.id) throw new Error("No se pudo crear fixture de usuario");
      }
    }
  }, { timeout: 60_000 });

  process.stdout.write(`${JSON.stringify({
    database: new URL(databaseUrl).pathname.slice(1),
    organizations: fixtureOrganizations.map((organization) => organization.id),
    users: 6,
    branches: 4
  }, null, 2)}\n`);
}

void main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Error creando fixtures"}\n`);
    process.exitCode = 1;
  });
