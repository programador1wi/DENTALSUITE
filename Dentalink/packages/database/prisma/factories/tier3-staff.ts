import { PrismaClient, Branch, Specialty, ProfessionalBranchStatus, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function seedTier3Staff(prisma: PrismaClient, orgId: string, branches: Branch[], specialties: Specialty[]) {
  console.log("🌱 [Tier 3] Seeding Staff (Chairs & Professionals)...");

  const dentistRole = await prisma.role.findFirst({ where: { organizationId: orgId, name: "DENTIST" } });
  const receptionistRole = await prisma.role.findFirst({ where: { organizationId: orgId, name: "RECEPTIONIST" } });

  const createdProfessionals = [];
  const createdChairs = [];

  for (const branch of branches) {
    // 1. Chairs
    const chairNames = ["Box General 1", "Box General 2", "Box Ortodoncia", "Box Especialidades"];
    const branchChairs = [];
    for (const cName of chairNames) {
      const chair = await prisma.chair.findFirst({ where: { organizationId: orgId, branchId: branch.id, name: cName }})
        ?? await prisma.chair.create({ data: { organizationId: orgId, branchId: branch.id, name: cName, isActive: true }});
      branchChairs.push(chair);
      createdChairs.push(chair);
    }

    // 2. Receptionist
    const recEmail = `recepcion.${branch.code.toLowerCase()}@dentalwarner.local`;
    let receptionist = await prisma.user.findUnique({ where: { email: recEmail } });
    if (!receptionist) {
      receptionist = await prisma.user.create({
        data: {
          organizationId: orgId,
          firstName: "Recepción",
          lastName: branch.name,
          email: recEmail,
          passwordHash: await bcrypt.hash("Admin123!", 10),
          isActive: true,
          status: UserStatus.ACTIVE,
          roleId: receptionistRole?.id,
          branches: { create: { branchId: branch.id, isPrimary: true } }
        }
      });
    }

    // 3. Professionals
    const profs = [
      { first: "Carlos", last: "Mendoza", spec: "Odontología General", chair: branchChairs[0], slot: 30 },
      { first: "Laura", last: "Gómez", spec: "Odontología General", chair: branchChairs[1], slot: 30 },
      { first: "Roberto", last: "Vega", spec: "Ortodoncia", chair: branchChairs[2], slot: 20 },
      { first: "Ana", last: "Ruiz", spec: "Endodoncia", chair: branchChairs[3], slot: 45 },
    ];

    for (const p of profs) {
      const email = `${p.first.toLowerCase()}.${p.last.toLowerCase()}.${branch.code.toLowerCase()}@dentalwarner.local`;
      const spec = specialties.find(s => s.name === p.spec);
      
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            organizationId: orgId,
            firstName: `Dr. ${p.first}`,
            lastName: p.last,
            email,
            passwordHash: await bcrypt.hash("Admin123!", 10),
            isActive: true,
            status: UserStatus.ACTIVE,
            roleId: dentistRole?.id,
            branches: { create: { branchId: branch.id, isPrimary: true } }
          }
        });
      }

      let prof = await prisma.professional.findFirst({ where: { organizationId: orgId, userId: user.id } });
      if (!prof) {
        prof = await prisma.professional.create({
          data: {
            organizationId: orgId,
            userId: user.id,
            firstName: `Dr. ${p.first}`,
            lastName: p.last,
            isActive: true,
            commissionRate: 30.0,
            color: p.spec === "Ortodoncia" ? "#10b981" : p.spec === "Endodoncia" ? "#f59e0b" : "#3b82f6",
            specialties: { create: { specialtyId: spec!.id } },
            branches: {
              create: {
                branchId: branch.id,
                isPrimary: true,
                status: ProfessionalBranchStatus.ACTIVE,
                agendaSlotMinutes: p.slot,
                defaultAppointmentDurationMinutes: p.slot,
                startsAt: new Date("2024-01-01T00:00:00.000Z"),
              }
            }
          }
        });

        // 4. Schedules (Mon-Sat)
        for (let day = 1; day <= 6; day++) {
          await prisma.professionalSchedule.create({
            data: {
              professionalId: prof.id,
              branchId: branch.id,
              chairId: p.chair.id,
              dayOfWeek: day,
              startTime: "09:00",
              endTime: day === 6 ? "14:00" : "19:00",
              breakStartTime: day === 6 ? null : "14:00",
              breakEndTime: day === 6 ? null : "15:00",
              isActive: true,
            }
          });
        }
      }
      createdProfessionals.push(prof);
    }
  }

  return { professionals: createdProfessionals, chairs: createdChairs };
}
