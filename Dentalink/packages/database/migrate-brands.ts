import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting brand migration...");

  // 1. Find the brands
  const brands = await prisma.branchBrand.findMany();
  console.log("All brands in database:");
  brands.forEach(b => {
    console.log(`- ID: ${b.id}, Name: "${b.name}", Code: "${b.code}"`);
  });

  const sourceBrand = brands.find(b => b.name.toLowerCase().includes("dental warner") && !b.name.toLowerCase().includes("dental j.warner") && !b.name.toLowerCase().includes("dental j. warner"));
  const targetBrand = brands.find(b => b.name.toLowerCase().replace(/\s+/g, '').includes("dentalj.warner") || b.name.toLowerCase().includes("dental j.warner"));

  if (!sourceBrand) {
    console.error("Could not find source brand matching 'Dental Warner' (excluding Dental J.Warner)");
    return;
  }
  if (!targetBrand) {
    console.error("Could not find target brand matching 'Dental J.Warner'");
    return;
  }

  console.log(`Migrating branches from "${sourceBrand.name}" (${sourceBrand.id}) to "${targetBrand.name}" (${targetBrand.id})`);

  // 2. Count branches
  const branchesToMigrate = await prisma.branch.findMany({
    where: { brandId: sourceBrand.id }
  });

  console.log(`Found ${branchesToMigrate.length} branches to migrate:`, branchesToMigrate.map(b => b.name));

  if (branchesToMigrate.length === 0) {
    console.log("No branches to migrate. Done.");
    return;
  }

  // 3. Update branches
  const updateResult = await prisma.branch.updateMany({
    where: { brandId: sourceBrand.id },
    data: { brandId: targetBrand.id }
  });

  console.log(`Successfully migrated ${updateResult.count} branches.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
