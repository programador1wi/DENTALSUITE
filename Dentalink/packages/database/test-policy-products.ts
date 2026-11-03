import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
loadEnv({ path: resolve(__dirname, "../../.env") });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  console.log("Consultando PolicyProducts...");
  const products = await prisma.policyProduct.findMany();
  console.log("PolicyProducts encontrados:", JSON.stringify(products, null, 2));

  console.log("Consultando Organizaciones...");
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  console.log("Organizaciones:", orgs);
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
