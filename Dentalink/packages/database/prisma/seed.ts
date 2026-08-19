import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { permissionDefinitions, roleDefinitions } from "@dentalwarner/shared";
import { APPOINTMENT_REASON_SEEDS_BY_SPECIALTY } from "./appointment-reasons";
import { seedProductionClinic } from "./seed-production-clinic";
import { verifyProductionClinic } from "./verify-production-clinic";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const predefinedBranches = [
  {
    code: "TUXTLA",
    name: "Dental + Suc. Tuxtla",
    phone: "+52 961 000 1012",
    email: "tuxtla@warnersuite.local",
    address: "Blvd. Belisario Dominguez 1024",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "TAPACHULA",
    name: "Dental + Suc. Tapachula",
    phone: "+52 962 000 1001",
    email: "tapachula@warnersuite.local",
    address: "Av. Central 245, Col. Centro",
    city: "Tapachula",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "ATLIXCO",
    name: "Dental + Suc. Atlixco",
    phone: "+52 244 000 1002",
    email: "atlixco@warnersuite.local",
    address: "Blvd. Atlixco 112, Col. Centro",
    city: "Atlixco",
    state: "Puebla",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "CAMPECHE",
    name: "Dental + Suc. Campeche",
    phone: "+52 981 000 1003",
    email: "campeche@warnersuite.local",
    address: "Calle 59 187, Zona Centro",
    city: "Campeche",
    state: "Campeche",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "COMITAN",
    name: "Dental + Suc. Comitán",
    phone: "+52 963 000 1004",
    email: "comitan@warnersuite.local",
    address: "Av. Primera Sur 508, Centro",
    city: "Comitán",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "CORDOBA_VER",
    name: "Dental + Suc. Córdoba Veracruz",
    phone: "+52 271 000 1005",
    email: "cordoba@warnersuite.local",
    address: "Av. 3 915, Centro",
    city: "Córdoba",
    state: "Veracruz",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "GUADALAJARA",
    name: "Dental + Suc. Guadalajara",
    phone: "+52 33 0000 1006",
    email: "guadalajara@warnersuite.local",
    address: "Av. Chapultepec 395, Americana",
    city: "Guadalajara",
    state: "Jalisco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "MERIDA",
    name: "Dental + Suc. Mérida",
    phone: "+52 999 000 1007",
    email: "merida@warnersuite.local",
    address: "Paseo de Montejo 278, Centro",
    city: "Mérida",
    state: "Yucatán",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "PACHUCA",
    name: "Dental + Suc. Pachuca",
    phone: "+52 771 000 1008",
    email: "pachuca@warnersuite.local",
    address: "Blvd. Felipe Angeles 401, Centro",
    city: "Pachuca",
    state: "Hidalgo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "SAN_CRISTOBAL",
    name: "Dental + Suc. San Cristóbal",
    phone: "+52 967 000 1009",
    email: "sancristobal@warnersuite.local",
    address: "Real de Guadalupe 142, Centro",
    city: "San Cristóbal de las Casas",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "TONALA",
    name: "Dental + Suc. Tonalá",
    phone: "+52 33 0000 1010",
    email: "tonala@warnersuite.local",
    address: "Av. Tonaltecas 510, Centro",
    city: "Tonalá",
    state: "Jalisco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "TUXPAN",
    name: "Dental + Suc. Tuxpan",
    phone: "+52 783 000 1011",
    email: "tuxpan@warnersuite.local",
    address: "Av. Juarez 620, Centro",
    city: "Tuxpan",
    state: "Veracruz",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "VILLAHERMOSA",
    name: "Dental + Suc. Villahermosa",
    phone: "+52 993 000 1013",
    email: "villahermosa@warnersuite.local",
    address: "Av. Universidad 336, Atasta",
    city: "Villahermosa",
    state: "Tabasco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "XALAPA",
    name: "Dental + Suc. Xalapa",
    phone: "+52 228 000 1014",
    email: "xalapa@warnersuite.local",
    address: "Av. Lazaro Cardenas 891, Centro",
    city: "Xalapa",
    state: "Veracruz",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "DXRAY_TUXTLA",
    name: "Dx-Ray Tuxtla",
    phone: "+52 961 000 1015",
    email: "dxray-tuxtla@warnersuite.local",
    address: "Periferico Sur 120, Tuxtla",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DX_RAY",
    zoneCode: "SUR"
  },
  {
    code: "AGUASCALIENTES",
    name: "Dental + Suc. Aguascalientes",
    phone: "+52 000 000 1016",
    email: "aguascalientes@warnersuite.local",
    address: "Sucursal Aguascalientes",
    city: "Aguascalientes",
    state: "Aguascalientes",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "CANCUN",
    name: "Dental + Suc. Cancún",
    phone: "+52 000 000 1017",
    email: "cancun@warnersuite.local",
    address: "Sucursal Cancún",
    city: "Cancún",
    state: "Quintana Roo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "CONDESA",
    name: "Dental + Suc. Condesa",
    phone: "+52 000 000 1018",
    email: "condesa@warnersuite.local",
    address: "Sucursal Condesa",
    city: "Ciudad de México",
    state: "Ciudad de México",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "DURANGO",
    name: "Dental + Suc. Durango",
    phone: "+52 000 000 1019",
    email: "durango@warnersuite.local",
    address: "Sucursal Durango",
    city: "Durango",
    state: "Durango",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "LEON",
    name: "Dental + Suc. León",
    phone: "+52 000 000 1020",
    email: "leon@warnersuite.local",
    address: "Sucursal León",
    city: "León",
    state: "Guanajuato",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "LEON_VALLE",
    name: "Dental + Suc. León Valle",
    phone: "+52 000 000 1021",
    email: "leon-valle@warnersuite.local",
    address: "Sucursal León Valle",
    city: "León",
    state: "Guanajuato",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "MEXICALI",
    name: "Dental + Suc. Mexicali",
    phone: "+52 000 000 1022",
    email: "mexicali@warnersuite.local",
    address: "Sucursal Mexicali",
    city: "Mexicali",
    state: "Baja California",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "PLAYA_DEL_CARMEN",
    name: "Dental + Suc. Playa Del Carmen",
    phone: "+52 000 000 1023",
    email: "playa-del-carmen@warnersuite.local",
    address: "Sucursal Playa Del Carmen",
    city: "Playa Del Carmen",
    state: "Quintana Roo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "PUERTO_VALLARTA",
    name: "Dental + Suc. Puerto Vallarta",
    phone: "+52 000 000 1024",
    email: "puerto-vallarta@warnersuite.local",
    address: "Sucursal Puerto Vallarta",
    city: "Puerto Vallarta",
    state: "Jalisco",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "SAN_LUIS_POTOSI",
    name: "Dental + Suc. San Luis Potosí",
    phone: "+52 000 000 1025",
    email: "san-luis-potosi@warnersuite.local",
    address: "Sucursal San Luis Potosí",
    city: "San Luis Potosí",
    state: "San Luis Potosí",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "SAN_LUIS_RIO",
    name: "Dental + Suc. San Luis Río",
    phone: "+52 000 000 1026",
    email: "san-luis-rio@warnersuite.local",
    address: "Sucursal San Luis Río",
    city: "San Luis Río",
    state: "Sonora",
    brandCode: "DENTAL_PLUS",
    zoneCode: "NORTE"
  },
  {
    code: "JWARNER_9NA_SUR",
    name: "Dental J.Warner 9na Sur",
    phone: "+52 000 000 1027",
    email: "jwarner-9na-sur@warnersuite.local",
    address: "9na Sur",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "REAL_DEL_BOSQUE",
    name: "Dental + Real Del Bosque",
    phone: "+52 000 000 1028",
    email: "real-del-bosque@warnersuite.local",
    address: "Real Del Bosque",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "LAURELES",
    name: "Dental + Suc Laureles",
    phone: "+52 000 000 1029",
    email: "laureles@warnersuite.local",
    address: "Sucursal Laureles",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "VILLAFLORES",
    name: "Dental + Suc. Villaflores",
    phone: "+52 000 000 1030",
    email: "villaflores@warnersuite.local",
    address: "Sucursal Villaflores",
    city: "Villaflores",
    state: "Chiapas",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  },
  {
    code: "JWARNER_ESPECIALIDADES_TUXTLA",
    name: "Dental J.Warner Especialidades Tuxtla",
    phone: "+52 000 000 1031",
    email: "jwarner-especialidades-tuxtla@warnersuite.local",
    address: "Especialidades Tuxtla",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "JWARNER_PAULINO_NAVARRO",
    name: "Dental J.Warner Paulino Navarro",
    phone: "+52 000 000 1032",
    email: "jwarner-paulino-navarro@warnersuite.local",
    address: "Paulino Navarro",
    city: "Tuxtla Gutierrez",
    state: "Chiapas",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "JWARNER_VILLAHERMOSA",
    name: "Dental J.Warner Villahermosa",
    phone: "+52 000 000 1033",
    email: "jwarner-villahermosa@warnersuite.local",
    address: "Sucursal Villahermosa",
    city: "Villahermosa",
    state: "Tabasco",
    brandCode: "DENTAL_JWARNER",
    zoneCode: "SUR"
  },
  {
    code: "PACHUCA_SELECT",
    name: "Dental+ Pachuca Select",
    phone: "+52 000 000 1034",
    email: "pachuca-select@warnersuite.local",
    address: "Pachuca Select",
    city: "Pachuca",
    state: "Hidalgo",
    brandCode: "DENTAL_PLUS",
    zoneCode: "SUR"
  }
] as const;

const predefinedBranchBrands = [
  { code: "DENTAL_PLUS", name: "Dental+" },
  { code: "DX_RAY", name: "Dx-Ray" },
  { code: "DENTAL_JWARNER", name: "Dental J.Warner" }
] as const;

const predefinedBranchZones = [
  { code: "NORTE", name: "Norte" },
  { code: "SUR", name: "Sur" }
] as const;

const baseArancelCategories = [
  "APARATOLOGIA 2026",
  "CIRUGIA 2026",
  "ENDODONCIA 2026",
  "ESTETICO 2026",
  "ESTUDIOS DENTALES 2026",
  "EXODONCIA 2026",
  "ODONTOPEDIATRIA 2026",
  "OPERATORIA 2026",
  "ORTODONCIA 2026",
  "PERIODONCIA 2026",
  "POLIZA DENTAL 2026",
  "PREVENTIVO BASICO 2026",
  "PRODUCTOR GUM 2026",
  "PROMOCION INTERNA 2026",
  "PROTESIS FIJA 20266",
  "PROTESIS REMOVIBLE 20266",
  "REDES SOCIALES 2026"
] as const;

const polizaDentalCategories = [
  "APARATOLOGIA 2026",
  "CIRUGIA 2026",
  "ENDODONCIA 2026",
  "ESTETICO 2026",
  "ESTUDIOS DENTALES 2026",
  "EXODONCIA 2026",
  "ODONTOPEDIATRIA 2026",
  "OPERATORIA",
  "ORTODONCIA 2026",
  "PERIODONCIA2026",
  "POLIZA DENTAL 2026",
  "PREVENTIVO BASICO 2026",
  "PRODUCTOS GUM 2026",
  "PROMOCIONES INTERNAS 2026",
  "PROTESIS FIJA 20266",
  "PROTESIS REMOVIBLE 20266",
  "REDES SOCIALES 2026"
] as const;

const seededPriceLists = [
  {
    name: "ARANCEL BASE SUR 2026",
    description: "Arancel base para sucursales zona Sur 2026",
    zoneCode: "SUR",
    type: "BASE",
    isDefault: true,
    categories: baseArancelCategories
  },
  {
    name: "POLIZA DENTAL SUR 2026",
    description: "Poliza dental para sucursales zona Sur 2026",
    zoneCode: "SUR",
    type: "POLIZA",
    isDefault: false,
    categories: polizaDentalCategories
  },
  {
    name: "ARANCEL BASE NORTE 2026",
    description: "Arancel base para sucursales zona Norte 2026",
    zoneCode: "NORTE",
    type: "BASE",
    isDefault: false,
    categories: baseArancelCategories
  },
  {
    name: "POLIZA DENTAL NORTE 2026",
    description: "Poliza dental para sucursales zona Norte 2026",
    zoneCode: "NORTE",
    type: "POLIZA",
    isDefault: false,
    categories: polizaDentalCategories
  }
] as const;

const allowedSpecialtySeeds = [
  {
    name: "Odontología General (Integral)",
    aliases: ["Odontología General y Estética", "Odontología General"]
  },
  { name: "Ortodoncia", aliases: [] }
] as const;

function normalizeCode(name: string) {
  return name.toLowerCase();
}

function normalizeSpecialtyKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSeedAllowedSpecialtyName(value: string) {
  const normalized = normalizeSpecialtyKey(value);
  for (const specialty of allowedSpecialtySeeds) {
    if (normalizeSpecialtyKey(specialty.name) === normalized) return specialty.name;
    if (specialty.aliases.some((alias) => normalizeSpecialtyKey(alias) === normalized)) return specialty.name;
  }
  if (normalized === "general" || normalized === "integral" || normalized === "general integral") {
    return allowedSpecialtySeeds[0].name;
  }
  return null;
}

function normalizeAppointmentReasonKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type SeededAppointmentReasonRecord = {
  id: string;
  legacyId: number | null;
  name: string;
};

async function seedSpecialtyAppointmentReasons(specialtyIdsByName: Map<string, string>) {
  for (const [specialtyName, reasons] of Object.entries(APPOINTMENT_REASON_SEEDS_BY_SPECIALTY)) {
    const specialtyId = specialtyIdsByName.get(specialtyName);
    if (!specialtyId) continue;

    const existingReasons = await (prisma as any).specialtyAppointmentReason.findMany({
      where: { specialtyId }
    });
    const byLegacyId = new Map<number, SeededAppointmentReasonRecord>();
    const byNormalizedName = new Map<string, SeededAppointmentReasonRecord>();

    for (const existingReason of existingReasons) {
      if (typeof existingReason.legacyId === "number")
        byLegacyId.set(existingReason.legacyId, existingReason);
      byNormalizedName.set(normalizeAppointmentReasonKey(existingReason.name), existingReason);
    }

    for (const reason of reasons) {
      const candidateNames = [reason.name, ...(reason.legacyNames ?? [])];
      const existingReason =
        byLegacyId.get(reason.legacyId) ??
        candidateNames.map((name) => byNormalizedName.get(normalizeAppointmentReasonKey(name))).find(Boolean);

      if (existingReason) {
        const updatedReason = await (prisma as any).specialtyAppointmentReason.update({
          where: { id: existingReason.id },
          data: {
            legacyId: reason.legacyId,
            name: reason.name,
            durationMinutes: reason.durationMinutes,
            color: reason.color
          }
        });
        byLegacyId.set(reason.legacyId, updatedReason);
        byNormalizedName.set(normalizeAppointmentReasonKey(reason.name), updatedReason);
      } else {
        const createdReason = await (prisma as any).specialtyAppointmentReason.create({
          data: {
            legacyId: reason.legacyId,
            specialtyId,
            name: reason.name,
            durationMinutes: reason.durationMinutes,
            color: reason.color,
            isActive: true
          }
        });
        byLegacyId.set(reason.legacyId, createdReason);
        byNormalizedName.set(normalizeAppointmentReasonKey(reason.name), createdReason);
      }
    }
  }
}

async function main() {
  const orgSlug = process.env.SEED_ORGANIZATION_SLUG ?? "dentalwarner";

  const organization = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {
      name: process.env.SEED_ORGANIZATION_NAME ?? "Dentalwarner Corporate",
      isActive: true,
      status: "ACTIVE"
    },
    create: {
      name: process.env.SEED_ORGANIZATION_NAME ?? "Dentalwarner Corporate",
      legalName: process.env.SEED_ORGANIZATION_NAME ?? "Dentalwarner Corporate",
      slug: orgSlug,
      isActive: true,
      status: "ACTIVE"
    }
  });

  const branchCatalog = new Map(predefinedBranches.map((branch) => [branch.code, branch]));
  const requestedDefaultBranchCode = process.env.SEED_DEFAULT_BRANCH_CODE ?? "TUXTLA";
  const defaultBranchCode = requestedDefaultBranchCode;
  const defaultBranchName = process.env.SEED_DEFAULT_BRANCH_NAME ?? "Dental + Suc. Tuxtla";
  if (!branchCatalog.has(defaultBranchCode)) {
    branchCatalog.set(defaultBranchCode, {
      code: defaultBranchCode,
      name: defaultBranchName,
      phone: "+52 000 000 0000",
      email: `${defaultBranchCode.toLowerCase()}@warnersuite.local`,
      address: "Direccion principal",
      city: "Ciudad",
      state: "Estado"
    });
  }

  const activeBranchCodes = [...branchCatalog.keys()];
  await prisma.userBranch.deleteMany({
    where: {
      branch: {
        organizationId: organization.id,
        code: { notIn: activeBranchCodes }
      }
    }
  });
  await prisma.branch.updateMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      code: { notIn: activeBranchCodes }
    },
    data: {
      status: "INACTIVE",
      isActive: false,
      deletedAt: new Date()
    }
  });

  const branchBrands = new Map<string, string>();
  for (const brandSeed of predefinedBranchBrands) {
    const brand = await prisma.branchBrand.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: brandSeed.code
        }
      },
      update: {
        name: brandSeed.name,
        isActive: true
      },
      create: {
        organizationId: organization.id,
        code: brandSeed.code,
        slug: brandSeed.code.toLowerCase().replace(/_/g, "-"),
        name: brandSeed.name
      }
    });
    branchBrands.set(brand.code, brand.id);
  }

  const branchZones = new Map<string, string>();
  for (const zoneSeed of predefinedBranchZones) {
    const zone = await prisma.branchZone.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: zoneSeed.code
        }
      },
      update: {
        name: zoneSeed.name,
        isActive: true
      },
      create: {
        organizationId: organization.id,
        code: zoneSeed.code,
        name: zoneSeed.name
      }
    });
    branchZones.set(zone.code, zone.id);
  }

  for (const branchSeed of branchCatalog.values()) {
    const brandId = "brandCode" in branchSeed ? branchBrands.get(branchSeed.brandCode) : undefined;
    const zoneCode = "zoneCode" in branchSeed ? branchSeed.zoneCode : "SUR";
    const zoneId = branchZones.get(zoneCode);

    await prisma.branch.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: branchSeed.code
        }
      },
      update: {
        brandId,
        zoneId,
        name: branchSeed.name,
        phone: branchSeed.phone,
        email: branchSeed.email,
        address: branchSeed.address,
        city: branchSeed.city,
        state: branchSeed.state,
        country: "MX",
        timezone: "America/Mexico_City",
        agendaStartHour: 10,
        agendaEndHour: 19,
        isActive: true,
        status: "ACTIVE"
      },
      create: {
        organizationId: organization.id,
        brandId,
        zoneId,
        code: branchSeed.code,
        name: branchSeed.name,
        phone: branchSeed.phone,
        email: branchSeed.email,
        address: branchSeed.address,
        city: branchSeed.city,
        state: branchSeed.state,
        country: "MX",
        timezone: "America/Mexico_City",
        agendaStartHour: 10,
        agendaEndHour: 19,
        isActive: true,
        status: "ACTIVE"
      }
    });
  }

  const canonicalKeys = permissionDefinitions.map(([key]) => key);
  await prisma.permission.updateMany({
    where: { key: { notIn: canonicalKeys } },
    data: { isActive: false }
  });

  for (const [key, name, description, module] of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { key },
      update: {
        name,
        description,
        module,
        code: key,
        action: key.split(".")[1] ?? "read",
        resource: key.split(".")[0] ?? module,
        isActive: true,
        isSystem: true
      },
      create: {
        key,
        name,
        description,
        module,
        code: key,
        action: key.split(".")[1] ?? "read",
        resource: key.split(".")[0] ?? module,
        isActive: true,
        isSystem: true
      }
    });
  }

  for (const roleDefinition of roleDefinitions) {
    const roleCode = normalizeCode(roleDefinition.name);
    const [roleByName, roleByCode] = await Promise.all([
      prisma.role.findUnique({
        where: { organizationId_name: { organizationId: organization.id, name: roleDefinition.name } }
      }),
      prisma.role.findUnique({
        where: { organizationId_code: { organizationId: organization.id, code: roleCode } }
      })
    ]);
    // Older seed versions created role codes independently from role names. The
    // role name is the stable business identity; never rename a different row
    // merely because it owns the desired normalized code.
    const existingRole = roleByName ?? roleByCode;

    const role = existingRole
      ? await prisma.role.update({
          where: { id: existingRole.id },
          data: {
            name: roleDefinition.name,
            description: roleDefinition.description,
            isSystem: true,
            isActive: true,
            ...(!roleByCode || roleByCode.id === existingRole.id ? { code: roleCode } : {})
          }
        })
      : await prisma.role.create({
          data: {
            organizationId: organization.id,
            name: roleDefinition.name,
            description: roleDefinition.description,
            isSystem: true,
            isActive: true,
            code: roleCode
          }
        });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...roleDefinition.permissionKeys] } },
      select: { id: true }
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true
    });
  }

  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: {
      organizationId: organization.id,
      OR: [
        { code: "super_admin" },
        { name: "Super Administrador" },
        { name: "SUPER_ADMIN" }
      ]
    }
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@dentalwarner.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      organizationId: organization.id,
      firstName: "System",
      lastName: "Admin",
      passwordHash,
      roleId: superAdminRole.id,
      isActive: true,
      status: "ACTIVE"
    },
    create: {
      organizationId: organization.id,
      firstName: "System",
      lastName: "Admin",
      email: adminEmail,
      passwordHash,
      roleId: superAdminRole.id,
      isActive: true,
      status: "ACTIVE"
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: superAdminRole.id }
  });

  const branches = await prisma.branch.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      status: "ACTIVE"
    },
    select: { id: true, code: true }
  });

  for (const assignedBranch of branches) {
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: admin.id, branchId: assignedBranch.id } },
      update: { isPrimary: assignedBranch.code === defaultBranchCode },
      create: {
        userId: admin.id,
        branchId: assignedBranch.id,
        isPrimary: assignedBranch.code === defaultBranchCode
      }
    });
  }

  const existingSpecialties = await prisma.specialty.findMany({
    where: { organizationId: organization.id }
  });
  const allowedSpecialties: Array<{ id: string; name: string }> = [];
  for (const specialtySeed of allowedSpecialtySeeds) {
    const matchingSpecialties = existingSpecialties.filter(
      (specialty) => resolveSeedAllowedSpecialtyName(specialty.name) === specialtySeed.name
    );
    const existing =
      matchingSpecialties.find((specialty) => specialty.name === specialtySeed.name) ??
      matchingSpecialties[0];
    const specialty = existing
      ? await prisma.specialty.update({
          where: { id: existing.id },
          data: { name: specialtySeed.name, isActive: true }
        })
      : await prisma.specialty.create({
          data: { organizationId: organization.id, name: specialtySeed.name, isActive: true }
        });
    allowedSpecialties.push(specialty);
  }

  await prisma.specialty.updateMany({
    where: {
      organizationId: organization.id,
      id: { notIn: allowedSpecialties.map((specialty) => specialty.id) }
    },
    data: { isActive: false }
  });

  await seedSpecialtyAppointmentReasons(
    new Map(allowedSpecialties.map((specialty) => [specialty.name, specialty.id]))
  );

  for (const priceListSeed of seededPriceLists) {
    const priceList = await prisma.priceList.upsert({
      where: {
        organizationId_name: { organizationId: organization.id, name: priceListSeed.name }
      },
      update: {
        description: priceListSeed.description,
        isDefault: priceListSeed.isDefault,
        isActive: true
      },
      create: {
        organizationId: organization.id,
        name: priceListSeed.name,
        description: priceListSeed.description,
        isDefault: priceListSeed.isDefault,
        isActive: true
      }
    });

    for (const [index, categoryName] of priceListSeed.categories.entries()) {
      const procedureCategory = await prisma.procedureCategory.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: categoryName
          }
        },
        update: {
          sortOrder: index + 1,
          isActive: true
        },
        create: {
          organizationId: organization.id,
          name: categoryName,
          sortOrder: index + 1,
          isActive: true
        }
      });

      const existingPriceListCategory = await prisma.priceListCategory.findFirst({
        where: { priceListId: priceList.id, procedureCategoryId: procedureCategory.id }
      });
      if (existingPriceListCategory) {
        await prisma.priceListCategory.update({
          where: { id: existingPriceListCategory.id },
          data: { name: categoryName, sortOrder: index + 1, isActive: true }
        });
      } else {
        await prisma.priceListCategory.create({
          data: {
          organizationId: organization.id,
          priceListId: priceList.id,
          procedureCategoryId: procedureCategory.id,
          name: categoryName,
          sortOrder: index + 1,
          isActive: true
          }
        });
      }
    }

    const assignedBranches = await prisma.branch.findMany({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        status: "ACTIVE",
        zone: { code: priceListSeed.zoneCode }
      },
      select: { id: true }
    });

    if (assignedBranches.length) {
      for (const branch of assignedBranches) {
        await prisma.branchPriceList.upsert({
          where: { branchId_priceListId: { branchId: branch.id, priceListId: priceList.id } },
          update: { type: priceListSeed.type, isDefault: priceListSeed.type === "BASE", isActive: true },
          create: {
            organizationId: organization.id,
            branchId: branch.id,
            priceListId: priceList.id,
            type: priceListSeed.type,
            isDefault: priceListSeed.type === "BASE",
            isActive: true
          }
        });
      }
    }
  }

  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? "Usuario123!";
  const staffPasswordHash = await bcrypt.hash(staffPassword, 12);
  const defaultStaffBranch = branches.find((branch) => branch.code === defaultBranchCode) ?? branches[0];
  if (!defaultStaffBranch) {
    throw new Error("No active branch found for staff users");
  }

  const staffDefinitions = [
    {
      email: "recepcion.matriz@dentalwarner.local",
      firstName: "Recepcion",
      lastName: "Matriz",
      phone: "+520000000101",
      roleCode: "recepcion",
      roleName: "Recepción"
    },
    {
      email: "caja.matriz@dentalwarner.local",
      firstName: "Caja",
      lastName: "Matriz",
      phone: "+520000000102",
      roleCode: "caja",
      roleName: "Caja"
    },
    {
      email: "ceye.matriz@dentalwarner.local",
      firstName: "CEYE",
      lastName: "Matriz",
      phone: "+520000000103",
      roleCode: "ceye",
      roleName: "CEYE"
    }
  ] as const;

  for (const staff of staffDefinitions) {
    const role = await prisma.role.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        OR: [
          { code: staff.roleCode },
          { name: staff.roleName }
        ]
      }
    });

    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        organizationId: organization.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        phone: staff.phone,
        passwordHash: staffPasswordHash,
        roleId: role.id,
        permissionsOverride: false,
        isActive: true,
        status: "ACTIVE"
      },
      create: {
        organizationId: organization.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone,
        passwordHash: staffPasswordHash,
        roleId: role.id,
        permissionsOverride: false,
        isActive: true,
        status: "ACTIVE"
      }
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await prisma.userPermission.deleteMany({ where: { userId: user.id } });
    await prisma.userBranch.deleteMany({ where: { userId: user.id } });
    await prisma.userBranch.create({
      data: {
        userId: user.id,
        branchId: defaultStaffBranch.id,
        isPrimary: true
      }
    });
  }

  await seedProductionClinic(prisma, organization.id, admin.id);
  await verifyProductionClinic(prisma, organization.id);

  console.log(`Seed completed. Admin: ${adminEmail}. Staff password: ${staffPassword}`);
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
