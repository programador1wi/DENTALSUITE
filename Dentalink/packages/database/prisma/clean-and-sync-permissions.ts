import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { permissionDefinitions, roleDefinitions } from "@dentalwarner/shared";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("=== INICIANDO LIMPIEZA Y SINCRONIZACIÓN DE PERMISOS ===");

  const canonicalKeys = new Set(permissionDefinitions.map(([key]) => key));
  console.log(`Catálogo canónico: ${canonicalKeys.size} permisos.`);

  // 1. Sincronizar permisos canónicos en la base de datos
  const permKeyToId = new Map<string, string>();

  for (const [key, name, description, module] of permissionDefinitions) {
    const perm = await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        code: key,
        name,
        description,
        module,
        resource: key.split(".")[0] ?? module,
        action: key.split(".")[1] ?? "read",
        isSystem: true,
        isActive: true,
        deletedAt: null
      },
      update: {
        code: key,
        name,
        description,
        module,
        resource: key.split(".")[0] ?? module,
        action: key.split(".")[1] ?? "read",
        isSystem: true,
        isActive: true,
        deletedAt: null
      }
    });
    permKeyToId.set(key, perm.id);
  }
  console.log(`✓ ${permKeyToId.size} permisos canónicos activos en base de datos.`);

  // 2. Desactivar todos los permisos obsoletos / no canónicos
  const deactivated = await prisma.permission.updateMany({
    where: { key: { notIn: [...canonicalKeys] } },
    data: { isActive: false }
  });
  console.log(`✓ ${deactivated.count} permisos no canónicos marcados como inactivos.`);

  // 3. Obtener IDs de permisos inactivos o eliminados
  const inactivePerms = await prisma.permission.findMany({
    where: { OR: [{ isActive: false }, { deletedAt: { not: null } }] },
    select: { id: true }
  });
  const inactivePermIds = inactivePerms.map((p) => p.id);

  // 4. Purgar relaciones RolePermission huérfanas o inactivas
  if (inactivePermIds.length > 0) {
    const deletedRolePerms = await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: inactivePermIds } }
    });
    console.log(`✓ Eliminadas ${deletedRolePerms.count} asociaciones obsoletas en RolePermission.`);

    const deletedUserPerms = await prisma.userPermission.deleteMany({
      where: { permissionId: { in: inactivePermIds } }
    });
    console.log(`✓ Eliminadas ${deletedUserPerms.count} asociaciones obsoletas en UserPermission.`);
  }

  // 5. Sincronizar roles por organización
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });

  for (const org of organizations) {
    console.log(`\n--- Sincronizando Organización: ${org.name} (${org.id}) ---`);

    // Sincronizar roles canónicos de roleDefinitions
    for (const roleDef of roleDefinitions) {
      const targetRole = await prisma.role.findFirst({
        where: {
          organizationId: org.id,
          OR: [
            { code: roleDef.code },
            { name: roleDef.name },
            { code: roleDef.name.toLowerCase() }
          ]
        }
      });

      if (!targetRole) continue;

      const validPermIds = roleDef.permissionKeys
        .map((k) => permKeyToId.get(k))
        .filter((id): id is string => Boolean(id));

      await prisma.rolePermission.deleteMany({ where: { roleId: targetRole.id } });
      await prisma.rolePermission.createMany({
        data: validPermIds.map((permissionId) => ({ roleId: targetRole.id, permissionId })),
        skipDuplicates: true
      });

      console.log(`  ✓ Rol [${targetRole.code}] "${targetRole.name}" sincronizado con ${validPermIds.length} permisos.`);
    }

    // Sincronizar rol Administrador (admin) si existe
    const adminRole = await prisma.role.findFirst({
      where: {
        organizationId: org.id,
        OR: [{ code: "admin" }, { name: "Administrador" }]
      }
    });

    if (adminRole) {
      // El administrador tiene todos los permisos canónicos excepto organization.manage_all
      const adminPermIds = permissionDefinitions
        .filter(([k]) => k !== "organization.manage_all")
        .map(([k]) => permKeyToId.get(k))
        .filter((id): id is string => Boolean(id));

      await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
      await prisma.rolePermission.createMany({
        data: adminPermIds.map((permissionId) => ({ roleId: adminRole.id, permissionId })),
        skipDuplicates: true
      });

      console.log(`  ✓ Rol [admin] "Administrador" sincronizado con ${adminPermIds.length} permisos delegables.`);
    }
  }

  // 6. Resumen final de roles en base de datos
  console.log("\n=== ESTADO FINAL DE ROLES EN BASE DE DATOS ===");
  const finalRoles = await prisma.role.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          permissions: true,
          users: true,
          userRoles: true
        }
      }
    }
  });

  console.table(
    finalRoles.map((r) => ({
      ID: r.id,
      Nombre: r.name,
      Código: r.code,
      PermisosActivos: r._count.permissions,
      Usuarios: r._count.users,
      Sistema: r.isSystem,
      Activo: r.isActive
    }))
  );
}

main()
  .catch((err) => {
    console.error("Error en sincronización:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
