/**
 * seed-dentists.ts
 *
 * Agrega dentistas exclusivos por sucursal (1 dentista por sucursal)
 * y 2 dentistas multi-sucursal para probar el dropdown.
 *
 * Uso:
 *   npx ts-node packages/database/prisma/seed-dentists.ts
 * O desde la raíz del proyecto:
 *   npx prisma db seed --schema packages/database/prisma/schema.prisma
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ──────────────────────────────────────────────────────────────
// Dentistas: 1 por sucursal  →  sin dropdown al editar horarios
// ──────────────────────────────────────────────────────────────
const dentistsByBranch: Array<{
  branchCode: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  color: string;
  licenseNumber: string;
}> = [
  {
    branchCode: "TAPACHULA",
    email: "dr.perez.tapachula@dentalwarner.local",
    firstName: "Ricardo",
    lastName: "Perez",
    phone: "+529620010001",
    color: "#4CAF50",
    licenseNumber: "TAP-001"
  },
  {
    branchCode: "ATLIXCO",
    email: "dr.flores.atlixco@dentalwarner.local",
    firstName: "Mariana",
    lastName: "Flores",
    phone: "+522440010002",
    color: "#2196F3",
    licenseNumber: "ATL-001"
  },
  {
    branchCode: "CAMPECHE",
    email: "dr.garcia.campeche@dentalwarner.local",
    firstName: "Jorge",
    lastName: "Garcia",
    phone: "+529810010003",
    color: "#9C27B0",
    licenseNumber: "CAM-001"
  },
  {
    branchCode: "COMITAN",
    email: "dr.torres.comitan@dentalwarner.local",
    firstName: "Ana",
    lastName: "Torres",
    phone: "+529630010004",
    color: "#FF9800",
    licenseNumber: "COM-001"
  },
  {
    branchCode: "CORDOBA_VER",
    email: "dr.hernandez.cordoba@dentalwarner.local",
    firstName: "Luis",
    lastName: "Hernandez",
    phone: "+522710010005",
    color: "#F44336",
    licenseNumber: "COR-001"
  },
  {
    branchCode: "GUADALAJARA",
    email: "dr.ramirez.gdl@dentalwarner.local",
    firstName: "Sofia",
    lastName: "Ramirez",
    phone: "+523300010006",
    color: "#00BCD4",
    licenseNumber: "GDL-001"
  },
  {
    branchCode: "MERIDA",
    email: "dr.sanchez.merida@dentalwarner.local",
    firstName: "Carlos",
    lastName: "Sanchez",
    phone: "+529990010007",
    color: "#E91E63",
    licenseNumber: "MER-001"
  },
  {
    branchCode: "PACHUCA",
    email: "dr.morales.pachuca@dentalwarner.local",
    firstName: "Patricia",
    lastName: "Morales",
    phone: "+527710010008",
    color: "#607D8B",
    licenseNumber: "PAC-001"
  },
  {
    branchCode: "SAN_CRISTOBAL",
    email: "dr.diaz.sancristobal@dentalwarner.local",
    firstName: "Fernando",
    lastName: "Diaz",
    phone: "+529670010009",
    color: "#795548",
    licenseNumber: "SCB-001"
  },
  {
    branchCode: "TONALA",
    email: "dr.lopez.tonala@dentalwarner.local",
    firstName: "Gabriela",
    lastName: "Lopez",
    phone: "+523300010010",
    color: "#3F51B5",
    licenseNumber: "TON-001"
  },
  {
    branchCode: "TUXPAN",
    email: "dr.vargas.tuxpan@dentalwarner.local",
    firstName: "Miguel",
    lastName: "Vargas",
    phone: "+527830010011",
    color: "#009688",
    licenseNumber: "TUX-001"
  },
  {
    branchCode: "TUXTLA",
    email: "dr.reyes.tuxtla@dentalwarner.local",
    firstName: "Claudia",
    lastName: "Reyes",
    phone: "+529610010012",
    color: "#FF5722",
    licenseNumber: "TUT-001"
  },
  {
    branchCode: "VILLAHERMOSA",
    email: "dr.castillo.villahermosa@dentalwarner.local",
    firstName: "Eduardo",
    lastName: "Castillo",
    phone: "+529930010013",
    color: "#8BC34A",
    licenseNumber: "VHM-001"
  },
  {
    branchCode: "XALAPA",
    email: "dr.gutierrez.xalapa@dentalwarner.local",
    firstName: "Daniela",
    lastName: "Gutierrez",
    phone: "+522280010014",
    color: "#FFC107",
    licenseNumber: "XAL-001"
  },
  {
    branchCode: "DXRAY_TUXTLA",
    email: "dr.medina.dxray@dentalwarner.local",
    firstName: "Roberto",
    lastName: "Medina",
    phone: "+529610010015",
    color: "#673AB7",
    licenseNumber: "DXR-001"
  }
];

// ──────────────────────────────────────────────────────────────
// Dentistas multi-sucursal  →  SÍ muestran dropdown
// ──────────────────────────────────────────────────────────────
const multibranchDentists: Array<{
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  color: string;
  licenseNumber: string;
  branchCodes: string[];
}> = [
  {
    email: "dr.multibranch.norte@dentalwarner.local",
    firstName: "Hector",
    lastName: "Aguilar",
    phone: "+529610020001",
    color: "#1976D2",
    licenseNumber: "MULTI-001",
    branchCodes: ["TUXTLA", "TAPACHULA", "SAN_CRISTOBAL"]
  },
  {
    email: "dr.multibranch.sur@dentalwarner.local",
    firstName: "Valeria",
    lastName: "Montoya",
    phone: "+523300020002",
    color: "#C2185B",
    licenseNumber: "MULTI-002",
    branchCodes: ["GUADALAJARA", "TONALA"]
  }
];

async function main() {
  const orgSlug = process.env.SEED_ORGANIZATION_SLUG ?? "dentalwarner";
  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? "Usuario123!";
  const staffPasswordHash = await bcrypt.hash(staffPassword, 12);

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { slug: orgSlug }
  });

  const dentistRole = await prisma.role.findUniqueOrThrow({
    where: { organizationId_name: { organizationId: organization.id, name: "DENTIST" } }
  });

  // Obtener especialidades para asignar a los dentistas
  const specialties = await prisma.specialty.findMany({
    where: { organizationId: organization.id, isActive: true },
    take: 2
  });

  const allBranches = await prisma.branch.findMany({
    where: { organizationId: organization.id, status: "ACTIVE", deletedAt: null },
    select: { id: true, code: true, name: true }
  });

  const branchByCode = new Map(allBranches.map((b) => [b.code, b]));

  // ── Dentistas uno por sucursal ──────────────────────────────
  let createdSingle = 0;
  let skippedSingle = 0;

  for (const def of dentistsByBranch) {
    const branch = branchByCode.get(def.branchCode);
    if (!branch) {
      console.warn(`⚠  Sucursal no encontrada: ${def.branchCode} — omitiendo ${def.email}`);
      skippedSingle++;
      continue;
    }

    // Crear usuario
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {
        organizationId: organization.id,
        firstName: def.firstName,
        lastName: def.lastName,
        phone: def.phone,
        passwordHash: staffPasswordHash,
        roleId: dentistRole.id,
        isActive: true,
        status: "ACTIVE"
      },
      create: {
        organizationId: organization.id,
        firstName: def.firstName,
        lastName: def.lastName,
        email: def.email,
        phone: def.phone,
        passwordHash: staffPasswordHash,
        roleId: dentistRole.id,
        isActive: true,
        status: "ACTIVE"
      }
    });

    // Asignar rol y sucursal al usuario
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: dentistRole.id } },
      update: {},
      create: { userId: user.id, roleId: dentistRole.id }
    });

    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      update: { isPrimary: true },
      create: { userId: user.id, branchId: branch.id, isPrimary: true }
    });

    // Crear el profesional vinculado al usuario
    const existingProfessional = await prisma.professional.findFirst({
      where: { userId: user.id, organizationId: organization.id }
    });

    const professional = existingProfessional
      ? await prisma.professional.update({
          where: { id: existingProfessional.id },
          data: {
            firstName: def.firstName,
            lastName: def.lastName,
            email: def.email,
            phone: def.phone,
            color: def.color,
            licenseNumber: def.licenseNumber,
            isActive: true
          }
        })
      : await prisma.professional.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            firstName: def.firstName,
            lastName: def.lastName,
            email: def.email,
            phone: def.phone,
            color: def.color,
            licenseNumber: def.licenseNumber,
            isActive: true
          }
        });

    // Limpiar y re-asignar SOLO esta sucursal al profesional
    await prisma.professionalBranch.deleteMany({ where: { professionalId: professional.id } });
    await prisma.professionalBranch.create({
      data: { professionalId: professional.id, branchId: branch.id, isPrimary: true }
    });

    // Asignar especialidad si hay disponibles
    if (specialties.length > 0) {
      await prisma.professionalSpecialty.deleteMany({ where: { professionalId: professional.id } });
      await prisma.professionalSpecialty.create({
        data: {
          professionalId: professional.id,
          specialtyId: specialties[0].id
        }
      });
    }

    console.log(`✅  [SINGLE-BRANCH] ${def.firstName} ${def.lastName} → ${branch.name}`);
    createdSingle++;
  }

  // ── Dentistas multi-sucursal ────────────────────────────────
  let createdMulti = 0;

  for (const def of multibranchDentists) {
    const branches = def.branchCodes
      .map((code) => branchByCode.get(code))
      .filter(Boolean) as Array<{ id: string; code: string; name: string }>;

    if (branches.length === 0) {
      console.warn(`⚠  No se encontraron sucursales para ${def.email} — omitiendo`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {
        organizationId: organization.id,
        firstName: def.firstName,
        lastName: def.lastName,
        phone: def.phone,
        passwordHash: staffPasswordHash,
        roleId: dentistRole.id,
        isActive: true,
        status: "ACTIVE"
      },
      create: {
        organizationId: organization.id,
        firstName: def.firstName,
        lastName: def.lastName,
        email: def.email,
        phone: def.phone,
        passwordHash: staffPasswordHash,
        roleId: dentistRole.id,
        isActive: true,
        status: "ACTIVE"
      }
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: dentistRole.id } },
      update: {},
      create: { userId: user.id, roleId: dentistRole.id }
    });

    // Asignar TODAS sus sucursales al usuario
    await prisma.userBranch.deleteMany({ where: { userId: user.id } });
    for (let i = 0; i < branches.length; i++) {
      await prisma.userBranch.create({
        data: { userId: user.id, branchId: branches[i].id, isPrimary: i === 0 }
      });
    }

    const existingProfessional = await prisma.professional.findFirst({
      where: { userId: user.id, organizationId: organization.id }
    });

    const professional = existingProfessional
      ? await prisma.professional.update({
          where: { id: existingProfessional.id },
          data: {
            firstName: def.firstName,
            lastName: def.lastName,
            email: def.email,
            phone: def.phone,
            color: def.color,
            licenseNumber: def.licenseNumber,
            isActive: true
          }
        })
      : await prisma.professional.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            firstName: def.firstName,
            lastName: def.lastName,
            email: def.email,
            phone: def.phone,
            color: def.color,
            licenseNumber: def.licenseNumber,
            isActive: true
          }
        });

    // Limpiar y asignar TODAS sus sucursales al profesional
    await prisma.professionalBranch.deleteMany({ where: { professionalId: professional.id } });
    for (let i = 0; i < branches.length; i++) {
      await prisma.professionalBranch.create({
        data: { professionalId: professional.id, branchId: branches[i].id, isPrimary: i === 0 }
      });
    }

    if (specialties.length > 0) {
      await prisma.professionalSpecialty.deleteMany({ where: { professionalId: professional.id } });
      await prisma.professionalSpecialty.create({
        data: { professionalId: professional.id, specialtyId: specialties[0].id }
      });
    }

    const branchNames = branches.map((b) => b.name).join(", ");
    console.log(`✅  [MULTI-BRANCH]  ${def.firstName} ${def.lastName} → ${branchNames}`);
    createdMulti++;
  }

  console.log("\n──────────────────────────────────────────────────────");
  console.log(`Seed completado:`);
  console.log(`  ✅ ${createdSingle} dentistas de sucursal única creados`);
  if (skippedSingle > 0) console.log(`  ⚠  ${skippedSingle} omitidos (sucursal no encontrada)`);
  console.log(`  ✅ ${createdMulti} dentistas multi-sucursal creados`);
  console.log(`  🔑 Contraseña: ${staffPassword}`);
  console.log("──────────────────────────────────────────────────────\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
