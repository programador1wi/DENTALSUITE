import {
  AppointmentStatus,
  PatientStatus,
  PrismaClient,
  ProfessionalBranchStatus,
  UserStatus
} from "@prisma/client";
import type { Branch, Patient, Professional, Role, Specialty, User } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const SEED_DOMAIN = "agenda-reset.dentalwarner.local";
const PATIENT_DOMAIN = "agenda-reset.patient.dentalwarner.local";
const APPOINTMENT_PREFIX = "[AGENDA RESET]";
const GENERAL_SPECIALTY_NAME = "OdontologÃ­a General (Integral)";
const ORTHODONTICS_SPECIALTY_NAME = "Ortodoncia";
const WORK_START_TIME = "10:00";
const WORK_END_TIME = "21:00";
const BREAK_START_TIME = "14:00";
const BREAK_END_TIME = "15:00";
const SLOT_MINUTES = 20;
const DEFAULT_APPOINTMENT_DURATION = 40;
const ASSIGNMENT_START = new Date("2026-01-01T00:00:00.000Z");
const PASSWORD = "Dentist123!";

type BranchSeed = Pick<Branch, "id" | "organizationId" | "name" | "code" | "city" | "state">;

type ProfessionalRole = "general-a" | "general-b" | "ortho-a" | "ortho-b";

type ProfessionalSeed = {
  role: ProfessionalRole;
  specialty: "general" | "ortho";
  firstName: string;
  lastName: string;
  color: string;
  startTime: string;
  reason: string;
};

const PROFESSIONAL_TEMPLATES: ProfessionalSeed[] = [
  {
    role: "general-a",
    specialty: "general",
    firstName: "Valeria",
    lastName: "Rios",
    color: "#0284c7",
    startTime: "10:00",
    reason: "Consulta diagnostico general"
  },
  {
    role: "general-b",
    specialty: "general",
    firstName: "Mateo",
    lastName: "Ibarra",
    color: "#0f766e",
    startTime: "11:00",
    reason: "Limpieza dental profunda"
  },
  {
    role: "ortho-a",
    specialty: "ortho",
    firstName: "Renata",
    lastName: "Salazar",
    color: "#7c3aed",
    startTime: "15:00",
    reason: "Consulta diagnostico ortodoncia"
  },
  {
    role: "ortho-b",
    specialty: "ortho",
    firstName: "Emilio",
    lastName: "Luna",
    color: "#c026d3",
    startTime: "16:00",
    reason: "Control mensual ortodoncia"
  }
];

const PATIENT_NAMES = [
  ["Daniel", "Montes"],
  ["Camila", "Nava"],
  ["Santiago", "Paz"],
  ["Mariana", "Leal"],
  ["Regina", "Soto"],
  ["Hector", "Vargas"],
  ["Lucia", "Campos"],
  ["Tomas", "Arias"]
] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.env.AGENDA_SEED_DRY_RUN === "true";
  const seedStart = resolveSeedStartDate();
  const seedDates = datesUntilEndOfMonth(seedStart);

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

  if (!branches.length) throw new Error("No hay sucursales activas para sembrar profesionales.");
  if (!dentistRole) throw new Error("No existe el rol DENTIST.");

  const generalSpecialty = resolveSpecialty(specialties, "general");
  const orthodonticsSpecialty = resolveSpecialty(specialties, "ortho");

  const plan = {
    branches: branches.length,
    professionals: branches.length * PROFESSIONAL_TEMPLATES.length,
    schedules: branches.length * PROFESSIONAL_TEMPLATES.length * 7,
    patientsCreatedOrReused: branches.length * PATIENT_NAMES.length,
    appointments: branches.length * PROFESSIONAL_TEMPLATES.length * seedDates.length,
    startDate: toDateInputValue(seedDates[0]),
    endDate: toDateInputValue(seedDates[seedDates.length - 1])
  };

  if (dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  console.log("Sembrando profesionales y agenda nueva...");
  console.log(JSON.stringify(plan, null, 2));

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const branch of branches) {
    await seedBranchAgenda({
      branch,
      dentistRole,
      generalSpecialty,
      orthodonticsSpecialty,
      passwordHash,
      seedDates
    });
  }

  console.log("Seed de profesionales y agenda completado.");
}

async function seedBranchAgenda(input: {
  branch: BranchSeed;
  dentistRole: Role;
  generalSpecialty: Specialty;
  orthodonticsSpecialty: Specialty;
  passwordHash: string;
  seedDates: Date[];
}) {
  const { branch, dentistRole, generalSpecialty, orthodonticsSpecialty, passwordHash, seedDates } = input;
  const branchSlug = slugify(branch.code || branch.name);

  await prisma.branch.update({
    where: { id: branch.id },
    data: {
      agendaSlotMinutes: SLOT_MINUTES,
      agendaStartHour: 10,
      agendaEndHour: 21
    }
  });

  const patients = await seedPatientsForBranch(branch, branchSlug);

  for (const [index, template] of PROFESSIONAL_TEMPLATES.entries()) {
    const specialty = template.specialty === "general" ? generalSpecialty : orthodonticsSpecialty;
    const user = await upsertDentistUser({
      branch,
      role: dentistRole,
      template,
      branchSlug,
      passwordHash,
      index
    });
    const professional = await upsertProfessional({
      branch,
      user,
      template,
      specialty,
      branchSlug,
      index
    });

    await resetProfessionalLinks(professional.id, branch.id, specialty.id);
    await seedSchedules(professional.id, branch.id);
    await seedAppointments({
      branch,
      professional,
      specialty,
      user,
      patients,
      template,
      seedDates
    });
  }
}

async function upsertDentistUser(input: {
  branch: BranchSeed;
  role: Role;
  template: ProfessionalSeed;
  branchSlug: string;
  passwordHash: string;
  index: number;
}) {
  const email = professionalEmail(input.template.role, input.branchSlug);
  const firstName = input.template.firstName;
  const lastName = `${input.template.lastName} ${branchNameSuffix(input.branch)}`;
  const phone = `+52961${String(input.index + 1).padStart(2, "0")}${numericToken(input.branchSlug).slice(0, 6)}`;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      organizationId: input.branch.organizationId,
      firstName,
      lastName,
      phone,
      passwordHash: input.passwordHash,
      roleId: input.role.id,
      permissionsOverride: false,
      isActive: true,
      status: UserStatus.ACTIVE
    },
    create: {
      organizationId: input.branch.organizationId,
      firstName,
      lastName,
      email,
      phone,
      passwordHash: input.passwordHash,
      roleId: input.role.id,
      permissionsOverride: false,
      isActive: true,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: input.role.id } });
  await prisma.userBranch.deleteMany({ where: { userId: user.id } });
  await prisma.userBranch.create({
    data: {
      userId: user.id,
      branchId: input.branch.id,
      isPrimary: true
    }
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
  const email = professionalEmail(input.template.role, input.branchSlug);
  const firstName = input.template.firstName;
  const lastName = `${input.template.lastName} ${branchNameSuffix(input.branch)}`;
  const phone = `+52962${String(input.index + 1).padStart(2, "0")}${numericToken(input.branchSlug).slice(0, 6)}`;
  const licenseNumber = `${input.template.role.toUpperCase()}-${input.branchSlug.slice(0, 10).toUpperCase()}-${String(input.index + 1).padStart(2, "0")}`;

  return prisma.professional.upsert({
    where: {
      organizationId_email: {
        organizationId: input.branch.organizationId,
        email
      }
    },
    update: {
      userId: input.user.id,
      firstName,
      lastName,
      licenseNumber,
      phone,
      color: input.template.color,
      isActive: true
    },
    create: {
      organizationId: input.branch.organizationId,
      userId: input.user.id,
      firstName,
      lastName,
      email,
      licenseNumber,
      phone,
      color: input.template.color,
      isActive: true
    }
  });
}

async function resetProfessionalLinks(professionalId: string, branchId: string, specialtyId: string) {
  await prisma.appointment.deleteMany({
    where: {
      professionalId,
      title: { startsWith: APPOINTMENT_PREFIX }
    }
  });
  await prisma.professionalSchedule.deleteMany({ where: { professionalId } });
  await prisma.professionalBranch.deleteMany({ where: { professionalId } });
  await prisma.professionalSpecialty.deleteMany({ where: { professionalId } });

  await prisma.professionalSpecialty.create({
    data: { professionalId, specialtyId }
  });
  await prisma.professionalBranch.create({
    data: {
      professionalId,
      branchId,
      isPrimary: true,
      agendaSlotMinutes: SLOT_MINUTES,
      defaultAppointmentDurationMinutes: DEFAULT_APPOINTMENT_DURATION,
      status: ProfessionalBranchStatus.ACTIVE,
      startsAt: ASSIGNMENT_START,
      endsAt: null,
      endedReason: null
    }
  });
}

async function seedSchedules(professionalId: string, branchId: string) {
  await prisma.professionalSchedule.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      professionalId,
      branchId,
      dayOfWeek,
      startTime: WORK_START_TIME,
      endTime: WORK_END_TIME,
      breakStartTime: BREAK_START_TIME,
      breakEndTime: BREAK_END_TIME,
      isActive: true
    }))
  });
}

async function seedPatientsForBranch(branch: BranchSeed, branchSlug: string) {
  const patients: Patient[] = [];

  for (const [index, [firstName, lastName]] of PATIENT_NAMES.entries()) {
    const email = `paciente.${String(index + 1).padStart(2, "0")}.${branchSlug}@${PATIENT_DOMAIN}`;
    const existing = await prisma.patient.findFirst({
      where: {
        organizationId: branch.organizationId,
        branchId: branch.id,
        email,
        deletedAt: null
      }
    });

    const data = {
      organizationId: branch.organizationId,
      branchId: branch.id,
      firstName,
      lastName: `${lastName} ${branchNameSuffix(branch)}`,
      email,
      phone: `+52963${String(index + 1).padStart(2, "0")}${numericToken(branchSlug).slice(0, 6)}`,
      source: "Seed agenda profesionales",
      status: PatientStatus.ACTIVE
    };

    const patient = existing
      ? await prisma.patient.update({ where: { id: existing.id }, data })
      : await prisma.patient.create({ data });

    patients.push(patient);
  }

  return patients;
}

async function seedAppointments(input: {
  branch: BranchSeed;
  professional: Professional;
  specialty: Specialty;
  user: User;
  patients: Patient[];
  template: ProfessionalSeed;
  seedDates: Date[];
}) {
  const { branch, professional, specialty, user, patients, template, seedDates } = input;
  const statusCycle = [
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.PENDING_CONFIRMATION
  ];

  await prisma.appointment.createMany({
    data: seedDates.map((date, index) => {
      const patient = patients[index % patients.length];
      const startAt = atTime(date, template.startTime);
      const endAt = new Date(startAt.getTime() + DEFAULT_APPOINTMENT_DURATION * 60 * 1000);
      const reason = template.reason;

      return {
        organizationId: branch.organizationId,
        branchId: branch.id,
        patientId: patient.id,
        professionalId: professional.id,
        specialtyId: specialty.id,
        title: `${APPOINTMENT_PREFIX} ${reason} - ${patient.firstName} ${patient.lastName}`,
        reason,
        status: statusCycle[index % statusCycle.length],
        startAt,
        endAt,
        durationMinutes: DEFAULT_APPOINTMENT_DURATION,
        notes: "Cita generada por seed de profesionales por sucursal.",
        createdById: user.id,
        updatedById: user.id
      };
    })
  });
}

function resolveSpecialty(specialties: Specialty[], key: "general" | "ortho") {
  const match = specialties.find((specialty) => {
    const normalized = normalizeText(specialty.name);
    return key === "general"
      ? normalized.includes("general") || normalized.includes("integral")
      : normalized.includes("ortodoncia");
  });

  if (!match) {
    throw new Error(
      key === "general"
        ? `No existe la especialidad ${GENERAL_SPECIALTY_NAME}.`
        : `No existe la especialidad ${ORTHODONTICS_SPECIALTY_NAME}.`
    );
  }

  return match;
}

function resolveSeedStartDate() {
  const explicitDate = process.env.AGENDA_SEED_START_DATE;
  if (explicitDate) return parseDateInput(explicitDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function datesUntilEndOfMonth(startDate: Date) {
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  const end = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 0, 0, 0, 0);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("AGENDA_SEED_START_DATE debe tener formato YYYY-MM-DD.");
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
}

function atTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function professionalEmail(role: ProfessionalRole, branchSlug: string) {
  return `${role}.${branchSlug}@${SEED_DOMAIN}`;
}

function branchNameSuffix(branch: BranchSeed) {
  return normalizeDisplayToken(branch.name || branch.code || branch.city);
}

function normalizeDisplayToken(value: string) {
  return value
    .replace(/^Dental\s*\+\s*/i, "")
    .replace(/^Suc\.?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "")
    .slice(0, 48);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ã/g, "a")
    .replace(/Ã/g, "a")
    .replace(/í/g, "i")
    .replace(/Ã­/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
