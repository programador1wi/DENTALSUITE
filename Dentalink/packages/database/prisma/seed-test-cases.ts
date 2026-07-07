import {
  AppointmentStatus,
  PatientStatus,
  PrismaClient,
  ProfessionalBranchStatus,
  UserStatus
} from "@prisma/client";
import type { Branch, Patient, Professional, Role, Specialty, User, Chair } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const SEED_DOMAIN = "test-cases.dentalwarner.local";
const PATIENT_DOMAIN = "test-cases.patient.dentalwarner.local";
const APPOINTMENT_PREFIX = "[TEST]";
const GENERAL_SPECIALTY_NAME = "Odontología General (Integral)";
const ORTHODONTICS_SPECIALTY_NAME = "Ortodoncia";
const SLOT_MINUTES = 20;
const ASSIGNMENT_START = new Date("2025-01-01T00:00:00.000Z");
const PASSWORD = "Dentist123!";

type BranchSeed = Pick<Branch, "id" | "organizationId" | "name" | "code" | "city" | "state">;

type ProfessionalSeed = {
  roleSlug: string;
  specialty: "general" | "ortho";
  firstName: string;
  lastName: string;
  color: string;
  schedule: {
    days: number[]; // 0-6 (Sun-Sat)
    start: string;
    end: string;
    breakStart?: string;
    breakEnd?: string;
  }[];
  chairName: string;
};

const PROFESSIONALS: ProfessionalSeed[] = [
  {
    roleSlug: "dr-fuentes",
    specialty: "general",
    firstName: "Ricardo",
    lastName: "Fuentes",
    color: "#0284c7",
    chairName: "Sillón General 1",
    schedule: [
      { days: [1, 2, 3, 4, 5], start: "09:00", end: "19:00", breakStart: "14:00", breakEnd: "15:00" },
      { days: [6], start: "09:00", end: "14:00" }
    ]
  },
  {
    roleSlug: "dra-solis",
    specialty: "general",
    firstName: "Patricia",
    lastName: "Solís",
    color: "#059669",
    chairName: "Sillón General 2",
    schedule: [
      { days: [1, 2, 3, 4, 5], start: "10:00", end: "18:00", breakStart: "14:00", breakEnd: "15:00" },
      { days: [6], start: "10:00", end: "14:00" }
    ]
  },
  {
    roleSlug: "dr-vega",
    specialty: "ortho",
    firstName: "Alejandro",
    lastName: "Vega",
    color: "#7c3aed",
    chairName: "Sillón Ortodoncia 1",
    schedule: [
      { days: [1, 2, 3, 4, 5], start: "11:00", end: "19:00", breakStart: "14:00", breakEnd: "15:00" }
    ]
  },
  {
    roleSlug: "dra-duarte",
    specialty: "general",
    firstName: "Gabriela",
    lastName: "Duarte",
    color: "#dc2626",
    chairName: "Sillón General 3",
    schedule: [
      { days: [1, 2, 3, 4, 5], start: "08:00", end: "16:00", breakStart: "14:00", breakEnd: "15:00" }
    ]
  },
  {
    roleSlug: "dr-castaneda",
    specialty: "ortho",
    firstName: "Fernando",
    lastName: "Castañeda",
    color: "#d97706",
    chairName: "Sillón Ortodoncia 2",
    schedule: [
      { days: [1, 3, 5], start: "14:00", end: "20:00" }
    ]
  },
  {
    roleSlug: "dra-quintero",
    specialty: "general",
    firstName: "Lorena",
    lastName: "Quintero",
    color: "#ec4899",
    chairName: "Sillón Quirúrgico",
    schedule: [
      { days: [2, 4], start: "09:00", end: "14:00" },
      { days: [6], start: "09:00", end: "13:00" }
    ]
  }
];

const CHAIR_NAMES = Array.from(new Set(PROFESSIONALS.map(p => p.chairName)));

const PATIENTS_DATA = [
  { firstName: "Ana Lucía", lastName: "Mendoza", status: PatientStatus.ACTIVE },
  { firstName: "Roberto Carlos", lastName: "Jiménez", status: PatientStatus.IN_TREATMENT },
  { firstName: "María del Carmen", lastName: "Ortiz", status: PatientStatus.ACTIVE },
  { firstName: "Diego Armando", lastName: "Salazar", status: PatientStatus.ACTIVE },
  { firstName: "Valentina", lastName: "Herrera Ruiz", status: PatientStatus.IN_TREATMENT },
  { firstName: "José Luis", lastName: "Morales", status: PatientStatus.ACTIVE },
  { firstName: "Sofía", lastName: "Ramírez Torres", status: PatientStatus.NEW },
  { firstName: "Miguel Ángel", lastName: "Contreras", status: PatientStatus.IN_TREATMENT },
  { firstName: "Gabriela", lastName: "Flores Vega", status: PatientStatus.ACTIVE },
  { firstName: "Fernando", lastName: "Gutiérrez López", status: PatientStatus.ACTIVE },
  { firstName: "Lucía", lastName: "Hernández Díaz", status: PatientStatus.ACTIVE },
  { firstName: "Carlos Eduardo", lastName: "Peña", status: PatientStatus.NEW },
  { firstName: "Mariana", lastName: "Castillo Rojas", status: PatientStatus.IN_TREATMENT },
  { firstName: "Pedro", lastName: "Sánchez Aguilar", status: PatientStatus.ACTIVE },
  { firstName: "Isabella", lastName: "Cruz Montes", status: PatientStatus.IN_TREATMENT },
  { firstName: "Raúl", lastName: "Martínez Soto", status: PatientStatus.ACTIVE },
  { firstName: "Carmen", lastName: "Vargas Luna", status: PatientStatus.ACTIVE },
  { firstName: "Andrés Felipe", lastName: "Ríos", status: PatientStatus.ACTIVE },
  { firstName: "Diana Patricia", lastName: "Leal", status: PatientStatus.IN_TREATMENT },
  { firstName: "Emilio", lastName: "Navarro Cruz", status: PatientStatus.ACTIVE }
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const [branches, specialties, dentistRole] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true, status: "ACTIVE", deletedAt: null },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        organizationId: true,
        name: true,
        code: true,
        city: true,
        state: true
      }
    }),
    prisma.specialty.findMany({ where: { isActive: true } }),
    prisma.role.findFirst({ where: { name: "DENTIST" } })
  ]);

  if (!branches.length) throw new Error("No hay sucursales activas.");
  if (!dentistRole) throw new Error("No existe el rol DENTIST.");

  const generalSpecialty = resolveSpecialty(specialties, "general");
  const orthodonticsSpecialty = resolveSpecialty(specialties, "ortho");

  const plan = {
    branches: branches.length,
    professionalsPerBranch: PROFESSIONALS.length,
    chairsPerBranch: CHAIR_NAMES.length,
    patientsPerBranch: PATIENTS_DATA.length,
  };

  if (dryRun) {
    console.log("Dry Run Plan:", JSON.stringify(plan, null, 2));
    return;
  }

  console.log("Iniciando seed de Test Cases...", plan);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  
  // Use a fixed week for predictable testing, e.g., next week from current date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7));
  if (nextMonday.getTime() === today.getTime()) nextMonday.setDate(today.getDate() + 7);

  const seedDates = [];
  for (let i = -2; i < 6; i++) { // From 2 days ago to 5 days in the future relative to nextMonday
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    seedDates.push(d);
  }

  for (const branch of branches) {
    console.log(`Procesando sucursal: ${branch.name}`);
    await seedBranchTestCases({
      branch,
      dentistRole,
      generalSpecialty,
      orthodonticsSpecialty,
      passwordHash,
      seedDates
    });
  }

  console.log("Seed completado exitosamente.");
}

async function seedBranchTestCases(input: {
  branch: BranchSeed;
  dentistRole: Role;
  generalSpecialty: Specialty;
  orthodonticsSpecialty: Specialty;
  passwordHash: string;
  seedDates: Date[];
}) {
  const { branch, dentistRole, generalSpecialty, orthodonticsSpecialty, passwordHash, seedDates } = input;
  const branchSlug = slugify(branch.code || branch.name);

  // 1. Cleanup old data for this branch and domain
  await cleanupBranchData(branch.id);

  // 2. Setup branch agenda config
  await prisma.branch.update({
    where: { id: branch.id },
    data: {
      agendaSlotMinutes: SLOT_MINUTES,
      agendaStartHour: 8,
      agendaEndHour: 20
    }
  });

  // 3. Create Chairs
  const chairsMap = new Map<string, Chair>();
  for (const name of CHAIR_NAMES) {
    const chairName = `${APPOINTMENT_PREFIX} ${name}`;
    const chair = await prisma.chair.upsert({
      where: {
        branchId_name: {
          branchId: branch.id,
          name: chairName
        }
      },
      update: { isActive: true },
      create: {
        organizationId: branch.organizationId,
        branchId: branch.id,
        name: chairName,
        isActive: true
      }
    });
    chairsMap.set(name, chair);
  }

  // 4. Create Patients
  const patients = await seedPatients(branch, branchSlug);

  // 5. Create Professionals and Appointments
  for (const [index, template] of PROFESSIONALS.entries()) {
    const specialty = template.specialty === "general" ? generalSpecialty : orthodonticsSpecialty;
    const chair = chairsMap.get(template.chairName)!;
    
    const user = await upsertDentistUser({ branch, role: dentistRole, template, branchSlug, passwordHash, index });
    const professional = await upsertProfessional({ branch, user, template, specialty, branchSlug, index });
    
    await resetProfessionalLinks(professional.id, branch.id, specialty.id);
    await seedSchedules(professional.id, branch.id, chair.id, template.schedule);
    
    await generateDenseAppointments({
      branch,
      professional,
      specialty,
      chair,
      user,
      patients,
      template,
      seedDates
    });
  }
}

async function cleanupBranchData(branchId: string) {
  // Appointments
  await prisma.appointment.deleteMany({
    where: {
      branchId,
      title: { startsWith: APPOINTMENT_PREFIX }
    }
  });

  // Since we use a specific domain, we can delete users/patients by email
  const emailsToDelete = { endsWith: `@${SEED_DOMAIN}` };
  const patientEmailsToDelete = { endsWith: `@${PATIENT_DOMAIN}` };

  const profs = await prisma.professional.findMany({
    where: { email: emailsToDelete, branches: { some: { branchId } } }
  });
  
  for (const p of profs) {
    await prisma.professionalSchedule.deleteMany({ where: { professionalId: p.id } });
    await prisma.professionalBranch.deleteMany({ where: { professionalId: p.id } });
    await prisma.professionalSpecialty.deleteMany({ where: { professionalId: p.id } });
  }

  // Not deleting Users or Professionals entirely because they might be linked elsewhere in a multi-branch setup if not careful, 
  // but since we upsert with deterministic emails, it's safe to just reuse them. 
  // We already deleted the appointments and schedules.
}

async function seedPatients(branch: BranchSeed, branchSlug: string) {
  const patients: Patient[] = [];
  for (const [index, data] of PATIENTS_DATA.entries()) {
    const email = `test.paciente.${String(index + 1).padStart(2, "0")}.${branchSlug}@${PATIENT_DOMAIN}`;
    const existing = await prisma.patient.findFirst({
      where: { organizationId: branch.organizationId, branchId: branch.id, email, deletedAt: null }
    });

    const patientData = {
      organizationId: branch.organizationId,
      branchId: branch.id,
      firstName: data.firstName,
      lastName: `${data.lastName} ${branchNameSuffix(branch)}`,
      email,
      phone: `+52999${String(index + 1).padStart(2, "0")}${numericToken(branchSlug).slice(0, 6)}`,
      source: "Test Cases",
      status: data.status
    };

    const patient = existing
      ? await prisma.patient.update({ where: { id: existing.id }, data: patientData })
      : await prisma.patient.create({ data: patientData });

    patients.push(patient);
  }
  return patients;
}

async function upsertDentistUser(input: {
  branch: BranchSeed;
  role: Role;
  template: ProfessionalSeed;
  branchSlug: string;
  passwordHash: string;
  index: number;
}) {
  const email = `${input.template.roleSlug}.${input.branchSlug}@${SEED_DOMAIN}`;
  const firstName = input.template.firstName;
  const lastName = `${input.template.lastName} ${branchNameSuffix(input.branch)}`;
  const phone = `+52888${String(input.index + 1).padStart(2, "0")}${numericToken(input.branchSlug).slice(0, 6)}`;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      organizationId: input.branch.organizationId,
      firstName, lastName, phone,
      passwordHash: input.passwordHash,
      roleId: input.role.id,
      permissionsOverride: false,
      isActive: true, status: UserStatus.ACTIVE
    },
    create: {
      organizationId: input.branch.organizationId,
      firstName, lastName, email, phone,
      passwordHash: input.passwordHash,
      roleId: input.role.id,
      permissionsOverride: false,
      isActive: true, status: UserStatus.ACTIVE
    }
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: input.role.id } });
  await prisma.userBranch.deleteMany({ where: { userId: user.id, branchId: input.branch.id } });
  await prisma.userBranch.create({
    data: { userId: user.id, branchId: input.branch.id, isPrimary: true }
  });

  return user;
}

async function upsertProfessional(input: {
  branch: BranchSeed;
  user: User;
  template: ProfessionalSeed;
  specialty: Specialty;
  branchSlug: string;
  index: number;
}) {
  const email = `${input.template.roleSlug}.${input.branchSlug}@${SEED_DOMAIN}`;
  const licenseNumber = `TEST-${input.template.roleSlug.toUpperCase()}-${input.branchSlug.slice(0, 5).toUpperCase()}`;

  return prisma.professional.upsert({
    where: {
      organizationId_email: {
        organizationId: input.branch.organizationId,
        email
      }
    },
    update: {
      userId: input.user.id,
      firstName: input.template.firstName,
      lastName: `${input.template.lastName} ${branchNameSuffix(input.branch)}`,
      licenseNumber,
      color: input.template.color,
      isActive: true
    },
    create: {
      organizationId: input.branch.organizationId,
      userId: input.user.id,
      firstName: input.template.firstName,
      lastName: `${input.template.lastName} ${branchNameSuffix(input.branch)}`,
      email,
      licenseNumber,
      color: input.template.color,
      isActive: true
    }
  });
}

async function resetProfessionalLinks(professionalId: string, branchId: string, specialtyId: string) {
  await prisma.professionalBranch.deleteMany({ where: { professionalId, branchId } });
  await prisma.professionalSpecialty.deleteMany({ where: { professionalId, specialtyId } });

  await prisma.professionalSpecialty.create({
    data: { professionalId, specialtyId }
  });
  await prisma.professionalBranch.create({
    data: {
      professionalId,
      branchId,
      isPrimary: true,
      agendaSlotMinutes: SLOT_MINUTES,
      defaultAppointmentDurationMinutes: 40,
      status: ProfessionalBranchStatus.ACTIVE,
      startsAt: ASSIGNMENT_START
    }
  });
}

async function seedSchedules(professionalId: string, branchId: string, chairId: string, scheduleDefs: ProfessionalSeed["schedule"]) {
  const schedulesToCreate = [];
  for (const def of scheduleDefs) {
    for (const dayOfWeek of def.days) {
      schedulesToCreate.push({
        professionalId,
        branchId,
        chairId,
        dayOfWeek,
        startTime: def.start,
        endTime: def.end,
        breakStartTime: def.breakStart || null,
        breakEndTime: def.breakEnd || null,
        isActive: true
      });
    }
  }
  await prisma.professionalSchedule.createMany({ data: schedulesToCreate });
}

async function generateDenseAppointments(input: {
  branch: BranchSeed;
  professional: Professional;
  specialty: Specialty;
  chair: Chair;
  user: User;
  patients: Patient[];
  template: ProfessionalSeed;
  seedDates: Date[];
}) {
  const { branch, professional, specialty, chair, user, patients, template, seedDates } = input;
  
  const allStatuses = Object.values(AppointmentStatus);
  let patientIdx = 0;
  let statusIdx = 0;
  
  const appointmentsData = [];

  for (const date of seedDates) {
    const dayOfWeek = date.getDay();
    const daySchedule = template.schedule.find(s => s.days.includes(dayOfWeek));
    if (!daySchedule) continue;

    const [startH, startM] = daySchedule.start.split(":").map(Number);
    const [endH, endM] = daySchedule.end.split(":").map(Number);
    
    let currentSlot = new Date(date);
    currentSlot.setHours(startH, startM, 0, 0);
    const endTime = new Date(date);
    endTime.setHours(endH, endM, 0, 0);

    let bStart = null, bEnd = null;
    if (daySchedule.breakStart && daySchedule.breakEnd) {
      const [bsH, bsM] = daySchedule.breakStart.split(":").map(Number);
      const [beH, beM] = daySchedule.breakEnd.split(":").map(Number);
      bStart = new Date(date); bStart.setHours(bsH, bsM, 0, 0);
      bEnd = new Date(date); bEnd.setHours(beH, beM, 0, 0);
    }

    // Fill the day densely
    while (currentSlot < endTime) {
      // Check break
      if (bStart && bEnd && currentSlot >= bStart && currentSlot < bEnd) {
        currentSlot = new Date(bEnd);
        continue;
      }

      // Determine duration (1, 2, or 3 slots)
      const slotsCount = Math.floor(Math.random() * 3) + 1;
      const durationMinutes = slotsCount * SLOT_MINUTES;
      const apptEnd = new Date(currentSlot.getTime() + durationMinutes * 60000);
      
      // Stop if it goes past end time or into break
      if (apptEnd > endTime) break;
      if (bStart && bEnd && currentSlot < bStart && apptEnd > bStart) {
        // Just do 1 slot to fit before break if possible
        if (new Date(currentSlot.getTime() + SLOT_MINUTES * 60000) <= bStart) {
           // will process 1 slot
        } else {
          currentSlot = new Date(bStart);
          continue;
        }
      }

      const patient = patients[patientIdx % patients.length];
      const status = allStatuses[statusIdx % allStatuses.length];
      
      let reason = "Revisión";
      if (durationMinutes === 40) reason = "Tratamiento regular";
      if (durationMinutes === 60) reason = "Procedimiento extenso";

      // If status is BLOCKED, patientId is null
      const isBlocked = status === AppointmentStatus.BLOCKED;

      appointmentsData.push({
        organizationId: branch.organizationId,
        branchId: branch.id,
        patientId: isBlocked ? null : patient.id,
        professionalId: professional.id,
        chairId: chair.id,
        specialtyId: specialty.id,
        title: `${APPOINTMENT_PREFIX} ${isBlocked ? 'Bloqueo Admin' : reason}`,
        reason: isBlocked ? 'Reunión' : reason,
        status: status,
        startAt: new Date(currentSlot),
        endAt: new Date(apptEnd),
        durationMinutes: durationMinutes,
        notes: `Generado por Test Cases. Slots: ${slotsCount}`,
        createdById: user.id,
        updatedById: user.id
      });

      patientIdx++;
      statusIdx++;
      currentSlot = apptEnd;
    }
  }

  // Create in batches
  const batchSize = 100;
  for (let i = 0; i < appointmentsData.length; i += batchSize) {
    const batch = appointmentsData.slice(i, i + batchSize);
    await prisma.appointment.createMany({ data: batch });
  }
}

function resolveSpecialty(specialties: Specialty[], key: "general" | "ortho") {
  const match = specialties.find((specialty) => {
    const normalized = normalizeText(specialty.name);
    return key === "general"
      ? normalized.includes("general") || normalized.includes("integral")
      : normalized.includes("ortodoncia");
  });
  if (!match) throw new Error(`Especialidad no encontrada para ${key}`);
  return match;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ".").slice(0, 48);
}

function branchNameSuffix(branch: BranchSeed) {
  return branch.name.replace(/^Dental\s*\+\s*/i, "").replace(/^Suc\.?\s*/i, "").trim();
}

function numericToken(value: string) {
  const digits = Array.from(value).map((char) => String(char.charCodeAt(0) % 10)).join("");
  return (digits + "000000").slice(0, 8);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
