import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { permissionDefinitions, roleDefinitions } from "@dentalwarner/shared";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

function collectGuardPermissionKeys(): Set<string> {
  const apiSource = resolve(process.cwd(), "../../apps/api/src");
  const guardedKeys = new Set<string>();
  const decoratorPattern = /@Require(?:Permissions|AnyPermission)\s*\(([\s\S]*?)\)/g;
  const literalPattern = /["'`]([^"'`]+)["'`]/g;

  for (const filePath of collectTypeScriptFiles(apiSource)) {
    const source = readFileSync(filePath, "utf8");
    for (const decorator of source.matchAll(decoratorPattern)) {
      for (const literal of decorator[1].matchAll(literalPattern)) guardedKeys.add(literal[1]);
    }
  }

  return guardedKeys;
}

async function main() {
  const expectedKeys = new Set(permissionDefinitions.map(([key]) => key));
  if (expectedKeys.size !== permissionDefinitions.length) {
    throw new Error("El catálogo canónico contiene claves duplicadas.");
  }

  const guardedKeys = collectGuardPermissionKeys();
  const missingGuardKeys = [...guardedKeys].filter((key) => !expectedKeys.has(key));

  const [permissions, roles, directAssignments] = await Promise.all([
    prisma.permission.findMany({
      where: { deletedAt: null },
      select: { key: true, isActive: true, isSystem: true }
    }),
    prisma.role.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        name: true,
        code: true,
        permissions: { select: { permission: { select: { key: true } } } }
      }
    }),
    prisma.userPermission.count()
  ]);

  const databaseKeys = new Set(permissions.map((permission) => permission.key));
  const missing = [...expectedKeys].filter((key) => !databaseKeys.has(key));
  const inactive = permissions.filter((permission) => expectedKeys.has(permission.key) && !permission.isActive);
  const custom = permissions.filter((permission) => !expectedKeys.has(permission.key));
  const expectedRoleCodes = new Set(roleDefinitions.map((role) => role.code));
  const roleSummary = roles
    .filter((role) => role.code && expectedRoleCodes.has(role.code as (typeof roleDefinitions)[number]["code"]))
    .map((role) => ({ name: role.name, code: role.code, permissions: role.permissions.length }));

  console.log(
    JSON.stringify(
      {
        catalog: expectedKeys.size,
        database: permissions.length,
        missing,
        inactive: inactive.map((permission) => permission.key),
        custom: custom.map((permission) => permission.key),
        guardedPermissions: guardedKeys.size,
        missingGuardKeys,
        directUserAssignments: directAssignments,
        roles: roleSummary
      },
      null,
      2
    )
  );

  if (missing.length || inactive.length || missingGuardKeys.length) process.exitCode = 1;
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
