import { PrismaClient, TreatmentPlanKind } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
  const org = await prisma.organization.findFirst();
  const branch = await prisma.branch.findFirst();
  const patient = await prisma.patient.findFirst();
  const pro = await prisma.professional.findFirst({
    where: { specialties: { some: { specialty: { name: 'Ortodoncia' } } } },
    include: { specialties: { include: { specialty: true } } }
  });

  if (!org || !branch || !patient || !pro) {
    console.log('Missing data:', { org: !!org, branch: !!branch, patient: !!patient, pro: !!pro });
    return;
  }

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const plan = await tx.treatmentPlan.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          patientId: patient.id,
          professionalId: pro.id,
          kind: TreatmentPlanKind.ORTHODONTICS,
          name: 'Test Plan',
          status: 'DRAFT',
          isAlternative: false,
        }
      });
      await tx.orthodonticTreatmentProfile.create({
        data: { treatmentPlanId: plan.id }
      });
      return plan;
    });
    console.log('Success:', plan.id);
  } catch (e) {
    console.error('Error creating plan:', e);
  }
}

main().finally(() => prisma.$disconnect());
