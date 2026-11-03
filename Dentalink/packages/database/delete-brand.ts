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
  console.log("Starting brand deletion...");

  const brands = await prisma.branchBrand.findMany();
  const sourceBrand = brands.find(b => b.name.toLowerCase().includes("dental warner") && !b.name.toLowerCase().includes("dental j.warner") && !b.name.toLowerCase().includes("dental j. warner"));

  if (!sourceBrand) {
    console.error("Could not find brand 'Dental Warner' to delete.");
    return;
  }

  // Double check branches
  const branchesCount = await prisma.branch.count({
    where: { brandId: sourceBrand.id }
  });

  if (branchesCount > 0) {
    console.error(`Error: Brand "${sourceBrand.name}" still has ${branchesCount} branches associated with it. Cannot delete.`);
    return;
  }

  console.log(`Deleting brand "${sourceBrand.name}" (${sourceBrand.id})...`);
  
  await prisma.branchBrand.delete({
    where: { id: sourceBrand.id }
  });

  console.log("Successfully deleted the brand.");
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
