import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('--- DATABASE COUNTS ---');
  console.log('Patients:', await prisma.patient.count());
  console.log('Organizations:', await prisma.organization.count());
  console.log('Appointments:', await prisma.appointment.count());
  console.log('TreatmentPlans:', await prisma.treatmentPlan.count());
  console.log('TreatmentPlanItems:', await prisma.treatmentPlanItem.count());
  
  const orgs = await prisma.organization.findMany({ select: { slug: true } });
  console.log('Organizations slugs:', orgs);
}
main().finally(() => prisma.$disconnect());
