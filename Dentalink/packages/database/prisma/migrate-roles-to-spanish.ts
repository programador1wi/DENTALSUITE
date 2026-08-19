import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { roleDefinitions, permissionDefinitions } from "./factories/permissions";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), "../../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface TargetRoleSpec {
  canonicalCode: string;
  canonicalName: string;
  canonicalDescription: string;
  matchCodes: string[];
  matchNames: string[];
  roleDefKey: string;
}

const TARGET_ROLES: TargetRoleSpec[] = [
  {
    canonicalCode: "super_admin",
    canonicalName: "Super Administrador",
    canonicalDescription: "Acceso total a la plataforma",
    matchCodes: ["super_admin", "super_administrador"],
    matchNames: ["SUPER_ADMIN", "Super Administrador", "super_admin"],
    roleDefKey: "SUPER_ADMIN"
  },
  {
    canonicalCode: "admin",
    canonicalName: "Administrador",
    canonicalDescription: "Acceso administrativo global",
    matchCodes: ["admin", "administrador"],
    matchNames: ["ADMIN", "Administrador", "admin"],
    roleDefKey: "ADMIN"
  },
  {
    canonicalCode: "recepcion",
    canonicalName: "Recepción",
    canonicalDescription: "Operaciones de recepción, agenda y pacientes",
    matchCodes: ["receptionist", "recepcion", "recepcionista"],
    matchNames: ["RECEPTIONIST", "RECEPTIONISTA", "Recepción", "Recepcion", "recepcion", "recepcionista"],
    roleDefKey: "RECEPTIONIST"
  },
  {
    canonicalCode: "dentista",
    canonicalName: "Dentista",
    canonicalDescription: "Acceso clínico y atención de pacientes",
    matchCodes: ["dentist", "dentista", "odontologo"],
    matchNames: ["DENTIST", "DENTISTA", "Dentista", "Odontólogo", "dentista"],
    roleDefKey: "DENTIST"
  },
  {
    canonicalCode: "caja",
    canonicalName: "Caja",
    canonicalDescription: "Operaciones y movimientos de caja",
    matchCodes: ["cashier", "caja", "cajero"],
    matchNames: ["CASHIER", "CAJA", "Caja", "Cajero", "caja"],
    roleDefKey: "CASHIER"
  },
  {
    canonicalCode: "ceye",
    canonicalName: "CEYE",
    canonicalDescription: "Central de equipos y esterilización",
    matchCodes: ["ceye"],
    matchNames: ["CEYE", "ceye"],
    roleDefKey: "CEYE"
  },
  {
    canonicalCode: "gerente",
    canonicalName: "Gerente de Sucursal",
    canonicalDescription: "Gestión operativa y administrativa de sucursal",
    matchCodes: ["manager", "gerente", "gerente_sucursal"],
    matchNames: ["MANAGER", "LEO", "Gerente", "Gerente de Sucursal", "manager", "gerente"],
    roleDefKey: "MANAGER"
  }
];

async function migrate() {
  console.log("=== INICIANDO MIGRACIÓN Y NORMALIZACIÓN DE ROLES EN ESPAÑOL ===");

  // 1. Actualizar nombres y descripciones de todos los permisos en la base de datos
  console.log("\n1. Sincronizando catálogo de permisos en español...");
  let permsUpdated = 0;
  for (const [key, defaultName, defaultDesc, module] of permissionDefinitions) {
    const existing = await prisma.permission.findUnique({ where: { key } });
    if (existing) {
      await prisma.permission.update({
        where: { key },
        data: {
          name: defaultName,
          description: defaultDesc,
          module,
          isActive: true
        }
      });
      permsUpdated++;
    } else {
      await prisma.permission.create({
        data: {
          key,
          name: defaultName,
          description: defaultDesc,
          module,
          isSystem: true,
          isActive: true
        }
      });
      permsUpdated++;
    }
  }
  console.log(`✓ ${permsUpdated} permisos sincronizados.`);

  // Cargar mapa de permisos por key
  const allDbPermissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permKeyToId = new Map(allDbPermissions.map((p) => [p.key, p.id]));

  // 2. Obtener todas las organizaciones
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log(`\n2. Procesando ${organizations.length} organización(es)...`);

  for (const org of organizations) {
    console.log(`\n--- Organización: ${org.name} (${org.id}) ---`);
    const existingRoles = await prisma.role.findMany({
      where: { organizationId: org.id },
      include: {
        users: { select: { id: true, email: true } },
        userRoles: { select: { userId: true } },
        permissions: { select: { permissionId: true } }
      }
    });

    console.log(`Roles actuales encontrados: ${existingRoles.length}`);
    for (const r of existingRoles) {
      console.log(`  - [${r.id}] Nombre: "${r.name}", Código: "${r.code}", Usuarios: ${r.users.length}, UserRoles: ${r.userRoles.length}, Permisos: ${r.permissions.length}`);
    }

    // Para cada rol objetivo
    for (const spec of TARGET_ROLES) {
      // Encontrar todos los roles existentes que coincidan con este rol objetivo
      const matchingRoles = existingRoles.filter((r) => {
        const codeMatch = r.code && spec.matchCodes.includes(r.code.toLowerCase());
        const nameMatch = spec.matchNames.map((n) => n.toLowerCase()).includes(r.name.toLowerCase());
        return codeMatch || nameMatch;
      });

      console.log(`\nObjetivo: ${spec.canonicalName} (${spec.canonicalCode}) -> Coincidencias encontradas: ${matchingRoles.length}`);

      let primaryRole = matchingRoles.find((r) => r.code === spec.canonicalCode) ||
        matchingRoles.find((r) => r.isSystem && r.users.length > 0) ||
        matchingRoles[0];

      if (!primaryRole) {
        console.log(`  Creando rol canónico ${spec.canonicalName}...`);
        primaryRole = (await prisma.role.create({
          data: {
            organizationId: org.id,
            name: spec.canonicalName,
            code: spec.canonicalCode,
            description: spec.canonicalDescription,
            isSystem: true,
            isActive: true
          },
          include: {
            users: { select: { id: true, email: true } },
            userRoles: { select: { userId: true } },
            permissions: { select: { permissionId: true } }
          }
        })) as any;
      }

      // Roles duplicados a fusionar y eliminar
      const duplicateRoles = matchingRoles.filter((r) => r.id !== primaryRole.id);

      for (const dup of duplicateRoles) {
        console.log(`  -> Fusionando rol duplicado [${dup.id}] "${dup.name}" (${dup.code}) en [${primaryRole.id}] "${spec.canonicalName}"...`);

        // 1. Reasignar primary role de los usuarios
        const reassignedUsers = await prisma.user.updateMany({
          where: { roleId: dup.id },
          data: { roleId: primaryRole.id }
        });
        console.log(`     Reasignados ${reassignedUsers.count} usuarios primarios.`);

        // 2. Reasignar UserRole
        for (const ur of dup.userRoles) {
          const alreadyHasPrimary = await prisma.userRole.findUnique({
            where: { userId_roleId: { userId: ur.userId, roleId: primaryRole.id } }
          });
          if (!alreadyHasPrimary) {
            await prisma.userRole.create({
              data: { userId: ur.userId, roleId: primaryRole.id }
            });
          }
        }
        await prisma.userRole.deleteMany({ where: { roleId: dup.id } });

        // 3. Fusionar permisos
        for (const p of dup.permissions) {
          const alreadyLinked = await prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: primaryRole.id, permissionId: p.permissionId } }
          });
          if (!alreadyLinked) {
            await prisma.rolePermission.create({
              data: { roleId: primaryRole.id, permissionId: p.permissionId }
            });
          }
        }
        await prisma.rolePermission.deleteMany({ where: { roleId: dup.id } });

        // 4. Eliminar rol duplicado
        await prisma.role.delete({ where: { id: dup.id } });
        console.log(`     ✓ Rol duplicado ${dup.id} eliminado con éxito.`);
      }

      // Obtener definición de permisos canónicos para este rol
      const roleDef = roleDefinitions.find((def) => def.name === spec.roleDefKey);
      const permKeys = roleDef ? roleDef.permissionKeys : [];
      const validPermIds = permKeys
        .map((k) => permKeyToId.get(k))
        .filter((id): id is string => Boolean(id));

      // Actualizar el rol primario con nombre, código y descripción en español
      await prisma.role.update({
        where: { id: primaryRole.id },
        data: {
          name: spec.canonicalName,
          code: spec.canonicalCode,
          description: spec.canonicalDescription,
          isSystem: true,
          isActive: true
        }
      });

      // Sincronizar permisos del rol canónico
      if (validPermIds.length > 0) {
        await prisma.rolePermission.deleteMany({ where: { roleId: primaryRole.id } });
        await prisma.rolePermission.createMany({
          data: validPermIds.map((pId) => ({ roleId: primaryRole.id, permissionId: pId })),
          skipDuplicates: true
        });
      }

      console.log(`  ✓ Rol ${spec.canonicalName} normalizado con ${validPermIds.length} permisos.`);
    }
  }

  console.log("\n=== VERIFICACIÓN FINAL ===");
  const finalRoles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      isSystem: true,
      isActive: true,
      _count: {
        select: {
          users: true,
          userRoles: true,
          permissions: true
        }
      }
    }
  });

  console.log("Roles resultantes en la base de datos:");
  console.table(
    finalRoles.map((r) => ({
      ID: r.id,
      Nombre: r.name,
      Código: r.code,
      Permisos: r._count.permissions,
      Usuarios: r._count.users,
      UserRoles: r._count.userRoles,
      Sistema: r.isSystem,
      Activo: r.isActive
    }))
  );

  const totalUsersWithRole = await prisma.user.count({ where: { roleId: { not: null }, deletedAt: null } });
  console.log(`Total usuarios activos con rol asignado: ${totalUsersWithRole}`);
}

migrate()
  .catch((err) => {
    console.error("Error durante la migración:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
