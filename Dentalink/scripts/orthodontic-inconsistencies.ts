import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runInconsistenciesReport() {
  console.log('--- Reporte de Inconsistencias Ortodónticas ---');
  
  // 1. Tratamientos activos demasiado antiguos (ej. más de 6 años)
  const sixYearsAgo = new Date();
  sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

  const oldTreatments = await prisma.treatmentPlan.findMany({
    where: {
      kind: 'ORTHODONTICS',
      status: { in: ['IN_PROGRESS'] },
      orthodonticProfile: {
        startDate: { lt: sixYearsAgo }
      }
    },
    select: { id: true, patientId: true }
  });
  console.log(`[!] Tratamientos activos demasiado antiguos (> 6 años): ${oldTreatments.length}`);

  // 2. Progreso calendario mayor de 100% no se puede consultar directo sin snapshot
  const invalidSnapshots = await prisma.orthodonticProgressSnapshot.findMany({
    where: {
      calendarProgress: { gt: 100 }
    }
  });
  console.log(`[!] Snapshots con progreso calendario > 100%: ${invalidSnapshots.length}`);

  // 3. Controles planificados en cero
  const zeroControls = await prisma.treatmentPlan.findMany({
    where: {
      kind: 'ORTHODONTICS',
      orthodonticProfile: {
        plannedControls: 0
      }
    }
  });
  console.log(`[!] Tratamientos con controles planificados en 0: ${zeroControls.length}`);

  // 4. Pacientes sin fecha de nacimiento
  const patientsNoBirthDate = await prisma.patient.count({
    where: { birthDate: null, status: 'IN_TREATMENT' }
  });
  console.log(`[!] Pacientes activos sin fecha de nacimiento: ${patientsNoBirthDate}`);

  // 5. Tratamientos sin profesional
  const noProfessional = await prisma.treatmentPlan.count({
    where: {
      kind: 'ORTHODONTICS',
      professionalId: null
    }
  });
  console.log(`[!] Tratamientos ortodónticos sin profesional: ${noProfessional}`);

  // Finish
  console.log('--- Fin del Reporte ---');
}

runInconsistenciesReport()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
