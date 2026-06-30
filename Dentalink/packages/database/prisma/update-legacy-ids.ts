import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const reasons = await prisma.specialtyAppointmentReason.findMany({
    orderBy: { createdAt: 'asc' }
  });
  
  let seq = 1;
  for (const reason of reasons) {
    await prisma.specialtyAppointmentReason.update({
      where: { id: reason.id },
      data: { legacyId: seq }
    });
    seq++;
  }
  console.log(`Updated ${reasons.length} reasons with sequential legacyIds.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
