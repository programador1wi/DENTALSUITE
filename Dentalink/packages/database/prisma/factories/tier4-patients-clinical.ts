import { 
  PrismaClient, Branch, Professional, PatientStatus, AppointmentStatus, ToothProcedureStatus, PeriodontalPosition, Procedure
} from "@prisma/client";

export async function seedTier4PatientsClinical(
  prisma: PrismaClient, 
  orgId: string, 
  branches: Branch[], 
  professionals: Professional[],
  procedures: Procedure[]
) {
  console.log("🌱 [Tier 4] Seeding Patients & Clinical Data...");

  const createdPatients = [];
  const createdAppointments = [];
  const now = new Date();
  const pastDate = new Date(now); pastDate.setDate(pastDate.getDate() - 15);
  const futureDate = new Date(now); futureDate.setDate(futureDate.getDate() + 5);

  const patientNames = [
    { f: "Juan", l: "Pérez" }, { f: "María", l: "López" }, { f: "Carlos", l: "García" }, { f: "Ana", l: "Martínez" },
    { f: "Luis", l: "Rodríguez" }, { f: "Elena", l: "Hernández" }, { f: "José", l: "González" }, { f: "Laura", l: "Gómez" },
    { f: "Pedro", l: "Díaz" }, { f: "Sofía", l: "Fernández" }
  ];

  for (const branch of branches) {
    const branchProfs = professionals.filter(p => p.branches?.some(pb => pb.branchId === branch.id) || true); // simplify lookup
    
    for (let i = 0; i < 10; i++) {
      const name = patientNames[i];
      const email = `${name.f.toLowerCase()}.${name.l.toLowerCase()}.${branch.code.toLowerCase()}@example.com`;
      
      let patient = await prisma.patient.findFirst({ where: { organizationId: orgId, email }});
      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            organizationId: orgId,
            branchId: branch.id,
            firstName: name.f,
            lastName: name.l,
            email,
            phone: `55${Math.floor(10000000 + Math.random() * 90000000)}`,
            status: PatientStatus.IN_TREATMENT,
            address: {
              create: { street: "Calle Falsa 123", city: "Ciudad", state: "Estado", country: "MX", zipCode: "12345" }
            },
            medicalHistory: {
              create: { bloodType: "O+", hasDiabetes: false, hasHypertension: i % 3 === 0, isPregnant: false, smokes: i % 4 === 0, drinksAlcohol: true }
            },
            allergies: i % 5 === 0 ? { create: [{ name: "Penicilina", reaction: "Erupción", severity: "HIGH" }] } : undefined,
            medicalAlerts: i % 5 === 0 ? { create: [{ type: "ALLERGY", description: "Alérgico a Penicilina", severity: "HIGH", isActive: true }] } : undefined,
          }
        });
      }
      createdPatients.push(patient);

      // Clinical Data (Odontogram)
      const diagnosisProc = procedures.find(p => p.code === "D0150");
      if (diagnosisProc && !await prisma.odontogramRecord.findFirst({ where: { patientId: patient.id }})) {
        await prisma.odontogramRecord.create({
          data: {
            patientId: patient.id,
            professionalId: branchProfs[0].id,
            toothNumber: "11",
            condition: "Caries",
            status: ToothProcedureStatus.PLANNED,
            toothConditions: { create: [{ patientId: patient.id, toothNumber: "11", condition: "Caries", surface: "Oclusal" }] }
          }
        });
        
        await prisma.odontogramRecord.create({
          data: {
            patientId: patient.id,
            professionalId: branchProfs[0].id,
            toothNumber: "26",
            condition: "Restauración defectuosa",
            status: ToothProcedureStatus.PLANNED,
            toothConditions: { create: [{ patientId: patient.id, toothNumber: "26", condition: "Amalgama filtrada", surface: "Mesial" }] }
          }
        });
      }

      // Periodontal Chart
      if (!await prisma.periodontalChart.findFirst({ where: { patientId: patient.id }})) {
        await prisma.periodontalChart.create({
          data: {
            patientId: patient.id,
            professionalId: branchProfs[0].id,
            chartDate: pastDate,
            measurements: {
              create: [
                { toothNumber: "11", position: PeriodontalPosition.MB, probingDepth: 3, bleeding: true, plaque: false },
                { toothNumber: "11", position: PeriodontalPosition.B, probingDepth: 2, bleeding: false, plaque: false },
                { toothNumber: "11", position: PeriodontalPosition.DB, probingDepth: 4, bleeding: true, plaque: true },
              ]
            }
          }
        });
      }

      // Appointments
      const prof1 = branchProfs[i % branchProfs.length];
      const prof2 = branchProfs[(i + 1) % branchProfs.length];

      // Past Appointment
      if (!await prisma.appointment.findFirst({ where: { patientId: patient.id, status: AppointmentStatus.COMPLETED }})) {
        const pastAppt = await prisma.appointment.create({
          data: {
            organizationId: orgId,
            branchId: branch.id,
            patientId: patient.id,
            professionalId: prof1.id,
            title: "Evaluación inicial",
            status: AppointmentStatus.COMPLETED,
            startAt: pastDate,
            endAt: new Date(pastDate.getTime() + 45 * 60000),
            durationMinutes: 45,
            notes: "Paciente acude a valoración",
            createdById: prof1.userId!,
          }
        });
        createdAppointments.push(pastAppt);

        // Evolution for past appointment
        await prisma.clinicalEvolution.create({
          data: {
            patientId: patient.id,
            appointmentId: pastAppt.id,
            professionalId: prof1.id,
            subjective: "Dolor leve al frío",
            objective: "Caries oclusal en 11",
            assessment: "Caries dentinaria",
            plan: "Resina compuesta",
            signedAt: pastDate,
          }
        });
      }

      // Future Appointment
      if (!await prisma.appointment.findFirst({ where: { patientId: patient.id, status: AppointmentStatus.SCHEDULED }})) {
        const futureAppt = await prisma.appointment.create({
          data: {
            organizationId: orgId,
            branchId: branch.id,
            patientId: patient.id,
            professionalId: prof2.id,
            title: "Tratamiento de resina",
            status: AppointmentStatus.SCHEDULED,
            startAt: futureDate,
            endAt: new Date(futureDate.getTime() + 60 * 60000),
            durationMinutes: 60,
            createdById: prof2.userId!,
          }
        });
        createdAppointments.push(futureAppt);
      }
      
      // TODAY Appointment (To guarantee visibility on current agenda)
      const today = new Date();
      // Set time to something random between 9am and 5pm
      today.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
      
      if (!await prisma.appointment.findFirst({ where: { patientId: patient.id, title: "Consulta de seguimiento (Hoy)" }})) {
        const todayAppt = await prisma.appointment.create({
          data: {
            organizationId: orgId,
            branchId: branch.id,
            patientId: patient.id,
            professionalId: prof1.id, // Assign to first professional
            title: "Consulta de seguimiento (Hoy)",
            status: AppointmentStatus.SCHEDULED,
            startAt: today,
            endAt: new Date(today.getTime() + 30 * 60000),
            durationMinutes: 30,
            notes: "Generado automáticamente para el día de hoy",
            createdById: prof1.userId!,
          }
        });
        createdAppointments.push(todayAppt);
      }
    }
  }

  return { patients: createdPatients, appointments: createdAppointments };
}
