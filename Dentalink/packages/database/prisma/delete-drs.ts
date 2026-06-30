import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.specialtyAppointmentReason.deleteMany({
    where: {
      name: {
        contains: ' - '
      }
    }
  });
  console.log(`Deleted ${result.count} reasons containing doctor names.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
