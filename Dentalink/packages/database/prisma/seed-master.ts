import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

import { seedTier1Infra } from "./factories/tier1-infra";
import { seedTier2Catalogs } from "./factories/tier2-catalogs";
import { seedTier3Staff } from "./factories/tier3-staff";
import { seedTier4PatientsClinical } from "./factories/tier4-patients-clinical";
import { seedTier5Financial } from "./factories/tier5-financial";
import { seedTier6Operations } from "./factories/tier6-operations";
import { seedTier7Templates } from "./factories/tier7-templates";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Iniciando Seed Master (Orquestación Completa)...");
  try {
    const { org, branches } = await seedTier1Infra(prisma);
    const branchIds = branches.map(b => b.id);
    
    const { specialties, procedures, priceLists, paymentMethods } = await seedTier2Catalogs(prisma, org.id, branchIds);
    const { professionals } = await seedTier3Staff(prisma, org.id, branches, specialties);
    
    const { patients } = await seedTier4PatientsClinical(prisma, org.id, branches, professionals, procedures);
    await seedTier5Financial(prisma, org.id, patients, professionals, procedures, priceLists, paymentMethods);
    await seedTier6Operations(prisma, org.id, branches, patients, professionals);
    await seedTier7Templates(prisma, org.id, specialties);

    console.log("✅ Proceso de Seed Master completado exitosamente.");
  } catch (error) {
    console.error("❌ Error durante la ejecución del Seed Master:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
