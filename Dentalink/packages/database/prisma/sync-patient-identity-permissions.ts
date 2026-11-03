import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { permissionDefinitions, roleDefinitions } from "./factories/permissions";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const PREFIXES = ["patient_identity.", "contact_points.", "family_groups.", "patient_duplicates.", "booking_identity."];
const EXACT_KEYS = new Set(["patients.merge"]);

function isIdentityPermission(key: string) {
  return EXACT_KEYS.has(key) || PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function main() {
  const definitions = permissionDefinitions.filter(([key]) => isIdentityPermission(key));
  const permissionIds = new Map<string, string>();
  for (const [key, name, description, module] of definitions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      create: { key, code: key, name, description, module, resource: key.split(".")[0], action: key.split(".")[1] ?? "read", isSystem: true, isActive: true },
      update: { code: key, name, description, module, resource: key.split(".")[0], action: key.split(".")[1] ?? "read", isSystem: true, isActive: true }
    });
    permissionIds.set(key, permission.id);
  }

  let roleLinks = 0;
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  for (const organization of organizations) {
    for (const roleDefinition of roleDefinitions) {
      const role = await prisma.role.findFirst({
        where: { organizationId: organization.id, OR: [{ name: roleDefinition.name }, { code: roleDefinition.name.toLowerCase() }] },
        select: { id: true }
      });
      if (!role) continue;
      const keys = roleDefinition.permissionKeys.filter((key) => isIdentityPermission(key));
      if (!keys.length) continue;
      const rows = keys.flatMap((key) => {
        const permissionId = permissionIds.get(key);
        return permissionId ? [{ roleId: role.id, permissionId }] : [];
      });
      const result = await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
      roleLinks += result.count;
    }
  }
  console.log(JSON.stringify({ permissions: definitions.length, organizations: organizations.length, roleLinks }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
