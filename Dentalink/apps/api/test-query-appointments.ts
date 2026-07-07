import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new (require('@prisma/adapter-pg').PrismaPg)(pool) });

  try {
    const prof = await prisma.professional.findFirst({
      where: { lastName: { contains: "León Valle" }, firstName: "Alejandro" }
    });
    console.log("PROFESSIONAL:", prof);

    if (prof) {
      const apps = await prisma.appointment.findMany({
        where: {
          professionalId: prof.id,
          startAt: {
            gte: new Date("2026-07-06T00:00:00Z"),
            lt: new Date("2026-07-07T00:00:00Z")
          }
        },
        orderBy: { startAt: "asc" }
      });
      console.log("APPOINTMENTS:", JSON.stringify(apps, null, 2));
    }
  } catch (err) {
    console.error("Prisma error:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
