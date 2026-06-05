import {
  AppointmentStatus,
  BranchPriceListType,
  BudgetStatus,
  CashMovementType,
  CashRegisterStatus,
  CollectionCaseStatus,
  ConsentStatus,
  CurrencyCode,
  InstallmentFrequency,
  InstallmentPlanStatus,
  InstallmentStatus,
  InventoryMovementType,
  LabOrderStatus,
  PatientStatus,
  PaymentLinkStatus,
  PaymentMethodType,
  PaymentStatus,
  PrismaClient,
  ProfessionalBranchStatus,
  ToothProcedureStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
  UserStatus
} from "@prisma/client";
import type {
  Agreement,
  Branch,
  ClinicalDocumentTemplate,
  ConsentTemplate,
  ExpenseCategory,
  FinancialInstitution,
  LabProvider,
  Patient,
  PaymentMethod,
  PriceList,
  Procedure,
  Professional,
  Specialty,
  Supplier,
  TreatmentPlan,
  TreatmentPlanItem,
  User
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";
import { APPOINTMENT_REASON_SEEDS_BY_SPECIALTY } from "./appointment-reasons";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const FULL_DEMO_DOMAIN = "fulldemo.dentalwarner.local";
const FULL_DEMO_EMAIL_SUFFIX = `@${FULL_DEMO_DOMAIN}`;
const FULL_DEMO_PREFIX = "[FULLDEMO]";
const FULL_DEMO_ASSIGNMENT_START = new Date("2025-01-01T00:00:00.000Z");
const GENERAL_SPECIALTY_NAME = "Odontología General (Integral)";
const ORTHO_SPECIALTY_NAME = "Ortodoncia";

type BranchSeed = Pick<
  Branch,
  "id" | "organizationId" | "name" | "code" | "city" | "state" | "agendaSlotMinutes" | "agendaStartHour" | "agendaEndHour"
>;

type SpecialtyContext = {
  general: Specialty;
  ortho: Specialty;
};

type ProcedureSeed = {
  key: string;
  categoryKey: string;
  code: string;
  name: string;
  description: string;
  defaultDuration: number;
  price: number;
  labCost?: number;
  requiresTooth?: boolean;
  requiresSurface?: boolean;
  requiresLab?: boolean;
};

type ProcedureItemSeed = {
  procedureCode: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  toothNumber?: string;
  surface?: string;
  status?: TreatmentPlanItemStatus;
  notes?: string;
};

type CatalogContext = {
  paymentMethods: {
    cash: PaymentMethod;
    card: PaymentMethod;
    transfer: PaymentMethod;
    deposit: PaymentMethod;
  };
  institutions: {
    bbva: FinancialInstitution;
    santander: FinancialInstitution;
  };
  priceLists: {
    base: PriceList;
    policy: PriceList;
    additional: PriceList;
  };
  agreement: Agreement;
  procedures: Map<string, Procedure>;
  procedurePrices: Map<string, number>;
  supplier: Supplier;
  labProvider: LabProvider;
  expenseCategory: ExpenseCategory;
  clinicalTemplate: ClinicalDocumentTemplate;
  consentTemplate: ConsentTemplate;
};

type BranchTeam = {
  receptionist: User;
  cashier: User;
  generalUser: User;
  general2User: User;
  orthoUser: User;
  generalProfessional: Professional;
  general2Professional: Professional;
  orthoProfessional: Professional;
  generalChairId: string;
  general2ChairId: string;
  orthoChairId: string;
  urgentChairId: string;
};

const procedureCategories = [
  {
    key: "diagnostic",
    name: "FULL DEMO Diagnóstico integral",
    description: "Valoraciones, radiografías y primeras consultas.",
    sortOrder: 10
  },
  {
    key: "preventive",
    name: "FULL DEMO Preventivo integral",
    description: "Profilaxis, flúor y controles preventivos.",
    sortOrder: 20
  },
  {
    key: "operative",
    name: "FULL DEMO Operatoria y urgencias",
    description: "Resinas, extracciones y tratamientos de mínima invasión.",
    sortOrder: 30
  },
  {
    key: "rehab",
    name: "FULL DEMO Rehabilitación integral",
    description: "Coronas, retenedores y tratamientos con laboratorio.",
    sortOrder: 40
  },
  {
    key: "ortho",
    name: "FULL DEMO Ortodoncia",
    description: "Brackets, controles y ajustes de ortodoncia.",
    sortOrder: 50
  }
] as const;

const procedureSeeds: ProcedureSeed[] = [
  {
    key: "consultation",
    categoryKey: "diagnostic",
    code: "FD-CONS-GEN",
    name: "Consulta integral",
    description: "Consulta de diagnóstico general integral.",
    defaultDuration: 40,
    price: 500
  },
  {
    key: "xray",
    categoryKey: "diagnostic",
    code: "FD-RX-PAN",
    name: "Radiografía panorámica",
    description: "Radiografía panorámica para diagnóstico inicial.",
    defaultDuration: 20,
    price: 650
  },
  {
    key: "prophylaxis",
    categoryKey: "preventive",
    code: "FD-PROF-GEN",
    name: "Profilaxis adultos",
    description: "Limpieza dental integral para adulto.",
    defaultDuration: 40,
    price: 700
  },
  {
    key: "fluoride",
    categoryKey: "preventive",
    code: "FD-FLUOR",
    name: "Aplicación de flúor",
    description: "Aplicación preventiva de flúor.",
    defaultDuration: 20,
    price: 450
  },
  {
    key: "resin",
    categoryKey: "operative",
    code: "FD-RES-COMP",
    name: "Resina compuesta",
    description: "Restauración con resina fotocurable.",
    defaultDuration: 40,
    price: 1200,
    requiresTooth: true,
    requiresSurface: true
  },
  {
    key: "extraction",
    categoryKey: "operative",
    code: "FD-EXO-SIMPLE",
    name: "Extracción simple",
    description: "Extracción dental simple.",
    defaultDuration: 40,
    price: 1500,
    requiresTooth: true
  },
  {
    key: "crown",
    categoryKey: "rehab",
    code: "FD-COR-ZIR",
    name: "Corona zirconia",
    description: "Corona de zirconia con laboratorio externo.",
    defaultDuration: 60,
    price: 6500,
    labCost: 2800,
    requiresTooth: true,
    requiresLab: true
  },
  {
    key: "retainer",
    categoryKey: "rehab",
    code: "FD-RET-ACR",
    name: "Retenedor acrílico",
    description: "Retenedor acrílico posterior a ortodoncia.",
    defaultDuration: 40,
    price: 2200,
    labCost: 900,
    requiresLab: true
  },
  {
    key: "brackets",
    categoryKey: "ortho",
    code: "FD-BRK-MET",
    name: "Brackets metálicos",
    description: "Instalación de brackets metálicos.",
    defaultDuration: 60,
    price: 18000
  },
  {
    key: "bracketsAutoligado",
    categoryKey: "ortho",
    code: "FD-BRK-AUTO",
    name: "Brackets autoligado",
    description: "Instalación de brackets autoligados.",
    defaultDuration: 60,
    price: 25000
  },
  {
    key: "orthoControl",
    categoryKey: "ortho",
    code: "FD-CTRL-ORTO",
    name: "Control ortodoncia",
    description: "Control mensual de ortodoncia.",
    defaultDuration: 30,
    price: 1200
  },
  {
    key: "orthoAdjust",
    categoryKey: "ortho",
    code: "FD-AJUST-ORTO",
    name: "Ajuste ortodoncia",
    description: "Ajuste puntual de aparatología.",
    defaultDuration: 30,
    price: 900
  }
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function demoDateAt(hours: number, minutes = 0, dayOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.|\.$)/g, "");
}

function branchToken(branch: BranchSeed, index: number) {
  const base = normalizeToken(branch.code ?? branch.name);
  return `${String(index + 1).padStart(2, "0")}.${base || "sucursal"}`;
}

function branchLabel(branch: BranchSeed) {
  return branch.city ?? branch.code ?? branch.name;
}

function licenseFor(prefix: string, index: number) {
  return `FD-${prefix}-${String(index + 1).padStart(3, "0")}`;
}

async function upsertSystemUser(input: {
  organizationId: string;
  branchId: string;
  roleName: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  passwordHash: string;
}) {
  const role = await prisma.role.findUniqueOrThrow({
    where: {
      organizationId_name: {
        organizationId: input.organizationId,
        name: input.roleName
      }
    }
  });

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      organizationId: input.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      passwordHash: input.passwordHash,
      roleId: role.id,
      permissionsOverride: false,
      isActive: true,
      status: UserStatus.ACTIVE,
      deletedAt: null
    },
    create: {
      organizationId: input.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
      roleId: role.id,
      permissionsOverride: false,
      isActive: true,
      status: UserStatus.ACTIVE
    }
  });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  await prisma.userPermission.deleteMany({ where: { userId: user.id } });
  await prisma.userBranch.deleteMany({ where: { userId: user.id } });
  await prisma.userBranch.create({
    data: {
      userId: user.id,
      branchId: input.branchId,
      isPrimary: true
    }
  });

  return user;
}

async function cleanFullDemoData() {
  console.log("Limpiando datos FULLDEMO anteriores...");

  await prisma.documentSignature.deleteMany({
    where: {
      consent: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.consent.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.collectionActivity.deleteMany({
    where: {
      collectionCase: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.collectionCase.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.installment.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.installmentPlan.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.paymentAllocation.deleteMany({
    where: {
      treatmentPlanItem: {
        treatmentPlan: {
          patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
        }
      }
    }
  });
  await prisma.cashMovement.deleteMany({
    where: {
      OR: [
        { description: { startsWith: FULL_DEMO_PREFIX } },
        { createdBy: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } },
        { cashRegister: { openedBy: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } } },
        { payment: { patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } } },
        { expense: { description: { startsWith: FULL_DEMO_PREFIX } } }
      ]
    }
  });
  await prisma.refund.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.payment.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.budgetItem.deleteMany({
    where: {
      budget: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.budget.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.paymentLink.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.labOrderItem.deleteMany({
    where: {
      labOrder: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.labOrder.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.appointmentStatusHistory.deleteMany({
    where: {
      appointment: {
        OR: [
          { patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } },
          { title: { startsWith: FULL_DEMO_PREFIX } }
        ]
      }
    }
  });
  await prisma.appointmentNote.deleteMany({
    where: {
      appointment: {
        OR: [
          { patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } },
          { title: { startsWith: FULL_DEMO_PREFIX } }
        ]
      }
    }
  });
  await prisma.appointmentReminder.deleteMany({
    where: {
      appointment: {
        OR: [
          { patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } },
          { title: { startsWith: FULL_DEMO_PREFIX } }
        ]
      }
    }
  });
  await prisma.clinicalDocument.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.prescriptionItem.deleteMany({
    where: {
      prescription: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.prescription.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.toothProcedure.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.toothCondition.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.odontogramRecord.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.periodontalMeasurement.deleteMany({
    where: {
      periodontalChart: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.periodontalChart.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.clinicalEvolution.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.appointment.deleteMany({
    where: {
      OR: [
        { patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } },
        { title: { startsWith: FULL_DEMO_PREFIX } }
      ]
    }
  });
  await prisma.treatmentPlanAlternative.deleteMany({
    where: {
      OR: [
        {
          parentTreatmentPlan: {
            patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
          }
        },
        {
          alternativeTreatmentPlan: {
            patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
          }
        }
      ]
    }
  });
  await prisma.treatmentPlanItem.deleteMany({
    where: {
      treatmentPlan: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.treatmentPlanSection.deleteMany({
    where: {
      treatmentPlan: {
        patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
      }
    }
  });
  await prisma.treatmentPlan.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.allergy.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.medication.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.medicalCondition.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.medicalHistory.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.patientMedicalAlert.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.patientNote.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.patientContact.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.patientAddress.deleteMany({
    where: {
      patient: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.patient.deleteMany({
    where: {
      email: { endsWith: FULL_DEMO_EMAIL_SUFFIX }
    }
  });
  await prisma.expense.deleteMany({
    where: {
      OR: [
        { description: { startsWith: FULL_DEMO_PREFIX } },
        { createdBy: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } }
      ]
    }
  });
  await prisma.cashRegister.deleteMany({
    where: {
      openedBy: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { inventoryItem: { sku: { startsWith: "FD-" } } },
        { createdBy: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } } }
      ]
    }
  });
  await prisma.inventoryItem.deleteMany({
    where: {
      sku: { startsWith: "FD-" }
    }
  });
  await prisma.professionalSchedule.deleteMany({
    where: {
      professional: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.professionalBranch.deleteMany({
    where: {
      professional: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.professionalSpecialty.deleteMany({
    where: {
      professional: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.professional.deleteMany({
    where: {
      email: { endsWith: FULL_DEMO_EMAIL_SUFFIX }
    }
  });
  await prisma.userBranch.deleteMany({
    where: {
      user: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.userRole.deleteMany({
    where: {
      user: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.userPermission.deleteMany({
    where: {
      user: { email: { endsWith: FULL_DEMO_EMAIL_SUFFIX } }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: { endsWith: FULL_DEMO_EMAIL_SUFFIX }
    }
  });
}

async function seedSpecialtyAppointmentReasons(specialtyIdsByName: Map<string, string>) {
  for (const [specialtyName, reasons] of Object.entries(APPOINTMENT_REASON_SEEDS_BY_SPECIALTY)) {
    const specialtyId = specialtyIdsByName.get(specialtyName);
    if (!specialtyId) continue;

    for (const reason of reasons) {
      for (const legacyName of reason.legacyNames ?? []) {
        const existingReason = await (prisma as any).specialtyAppointmentReason.findUnique({
          where: {
            specialtyId_name: {
              specialtyId,
              name: legacyName
            }
          }
        });

        if (!existingReason) continue;

        const targetReason = await (prisma as any).specialtyAppointmentReason.findUnique({
          where: {
            specialtyId_name: {
              specialtyId,
              name: reason.name
            }
          }
        });

        if (targetReason) {
          await (prisma as any).specialtyAppointmentReason.update({
            where: { id: existingReason.id },
            data: { isActive: false }
          });
        } else {
          await (prisma as any).specialtyAppointmentReason.update({
            where: { id: existingReason.id },
            data: {
              name: reason.name,
              durationMinutes: reason.durationMinutes,
              color: reason.color,
              isActive: true
            }
          });
        }
      }

      await (prisma as any).specialtyAppointmentReason.upsert({
        where: {
          specialtyId_name: {
            specialtyId,
            name: reason.name
          }
        },
        update: {
          durationMinutes: reason.durationMinutes,
          color: reason.color,
          isActive: true
        },
        create: {
          specialtyId,
          name: reason.name,
          durationMinutes: reason.durationMinutes,
          color: reason.color,
          isActive: true
        }
      });
    }
  }
}

async function ensureSpecialties(organizationId: string): Promise<SpecialtyContext> {
  const general = await prisma.specialty.upsert({
    where: {
      organizationId_name: { organizationId, name: GENERAL_SPECIALTY_NAME }
    },
    update: {
      isActive: true,
      description: "Atención odontológica general e integral"
    },
    create: {
      organizationId,
      name: GENERAL_SPECIALTY_NAME,
      description: "Atención odontológica general e integral",
      isActive: true
    }
  });

  const ortho = await prisma.specialty.upsert({
    where: {
      organizationId_name: { organizationId, name: ORTHO_SPECIALTY_NAME }
    },
    update: {
      isActive: true,
      description: "Corrección dentofacial, brackets y controles de ortodoncia"
    },
    create: {
      organizationId,
      name: ORTHO_SPECIALTY_NAME,
      description: "Corrección dentofacial, brackets y controles de ortodoncia",
      isActive: true
    }
  });

  await prisma.specialty.updateMany({
    where: {
      organizationId,
      id: { notIn: [general.id, ortho.id] }
    },
    data: { isActive: false }
  });

  await seedSpecialtyAppointmentReasons(
    new Map([
      [GENERAL_SPECIALTY_NAME, general.id],
      [ORTHO_SPECIALTY_NAME, ortho.id]
    ])
  );

  return { general, ortho };
}

async function ensurePaymentMethod(organizationId: string, name: string, type: PaymentMethodType) {
  return prisma.paymentMethod.upsert({
    where: {
      organizationId_name: { organizationId, name }
    },
    update: { type, isActive: true },
    create: { organizationId, name, type, isActive: true }
  });
}

async function ensureCatalog(organizationId: string, branches: BranchSeed[]): Promise<CatalogContext> {
  console.log("Configurando aranceles, precios, laboratorios e inventario base...");

  const paymentMethods = {
    cash: await ensurePaymentMethod(organizationId, "Efectivo", PaymentMethodType.CASH),
    card: await ensurePaymentMethod(organizationId, "Tarjeta bancaria", PaymentMethodType.CARD),
    transfer: await ensurePaymentMethod(organizationId, "Transferencia", PaymentMethodType.TRANSFER),
    deposit: await ensurePaymentMethod(organizationId, "Depósito", PaymentMethodType.DEPOSIT)
  };

  const institutions = {
    bbva: await prisma.financialInstitution.upsert({
      where: { organizationId_name: { organizationId, name: "BBVA" } },
      update: { isActive: true },
      create: { organizationId, name: "BBVA", isActive: true }
    }),
    santander: await prisma.financialInstitution.upsert({
      where: { organizationId_name: { organizationId, name: "Santander" } },
      update: { isActive: true },
      create: { organizationId, name: "Santander", isActive: true }
    })
  };

  const supplier = await prisma.supplier.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO Dental Supply" }
    },
    update: {
      phone: "+529610000900",
      email: `supply@${FULL_DEMO_DOMAIN}`,
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO Dental Supply",
      phone: "+529610000900",
      email: `supply@${FULL_DEMO_DOMAIN}`,
      address: "Bodega central demo",
      isActive: true
    }
  });

  const labProvider = await prisma.labProvider.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO Laboratorio Warner" }
    },
    update: {
      phone: "+529610000901",
      email: `laboratorio@${FULL_DEMO_DOMAIN}`,
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO Laboratorio Warner",
      phone: "+529610000901",
      email: `laboratorio@${FULL_DEMO_DOMAIN}`,
      address: "Laboratorio externo demo",
      details: "Proveedor demo para coronas, retenedores y aparatología.",
      isActive: true
    }
  });

  const expenseCategory = await prisma.expenseCategory.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO Insumos clínicos" }
    },
    update: { isActive: true },
    create: {
      organizationId,
      name: "FULL DEMO Insumos clínicos",
      isActive: true
    }
  });

  const categoryByKey = new Map<string, string>();
  for (const categorySeed of procedureCategories) {
    const category = await prisma.procedureCategory.upsert({
      where: {
        organizationId_name: { organizationId, name: categorySeed.name }
      },
      update: {
        description: categorySeed.description,
        sortOrder: categorySeed.sortOrder,
        isActive: true
      },
      create: {
        organizationId,
        name: categorySeed.name,
        description: categorySeed.description,
        sortOrder: categorySeed.sortOrder,
        isActive: true
      }
    });
    categoryByKey.set(categorySeed.key, category.id);
  }

  const maxDisplayId = await prisma.procedure.aggregate({
    where: { organizationId },
    _max: { displayId: true }
  });
  let nextDisplayId = Math.max(maxDisplayId._max.displayId ?? 0, 9000);
  const procedures = new Map<string, Procedure>();
  const procedurePrices = new Map<string, number>();

  for (const procedureSeed of procedureSeeds) {
    const categoryId = categoryByKey.get(procedureSeed.categoryKey);
    if (!categoryId) {
      throw new Error(`Categoría no encontrada para procedimiento ${procedureSeed.code}`);
    }

    const existing = await prisma.procedure.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: procedureSeed.code
        }
      }
    });

    const procedure = existing
      ? await prisma.procedure.update({
          where: { id: existing.id },
          data: {
            categoryId,
            name: procedureSeed.name,
            description: procedureSeed.description,
            defaultDuration: procedureSeed.defaultDuration,
            requiresTooth: procedureSeed.requiresTooth ?? false,
            requiresSurface: procedureSeed.requiresSurface ?? false,
            requiresLab: procedureSeed.requiresLab ?? false,
            isActive: true
          }
        })
      : await prisma.procedure.create({
          data: {
            organizationId,
            categoryId,
            displayId: ++nextDisplayId,
            code: procedureSeed.code,
            name: procedureSeed.name,
            description: procedureSeed.description,
            defaultDuration: procedureSeed.defaultDuration,
            requiresTooth: procedureSeed.requiresTooth ?? false,
            requiresSurface: procedureSeed.requiresSurface ?? false,
            requiresLab: procedureSeed.requiresLab ?? false,
            isActive: true
          }
        });

    procedures.set(procedure.code, procedure);
    procedurePrices.set(procedure.code, procedureSeed.price);

    if (procedureSeed.requiresLab) {
      await prisma.labProcedureAssignment.upsert({
        where: {
          procedureId_labProviderId: {
            procedureId: procedure.id,
            labProviderId: labProvider.id
          }
        },
        update: {
          patientPrice: procedureSeed.labCost ?? 0,
          currency: CurrencyCode.MXN,
          isActive: true
        },
        create: {
          organizationId,
          procedureId: procedure.id,
          labProviderId: labProvider.id,
          patientPrice: procedureSeed.labCost ?? 0,
          currency: CurrencyCode.MXN,
          isActive: true
        }
      });
    }
  }

  const base = await prisma.priceList.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO ARANCEL BASE 2026" }
    },
    update: {
      description: "Arancel base demo con precios completos para agenda, tratamientos y cobros.",
      isDefault: true,
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO ARANCEL BASE 2026",
      description: "Arancel base demo con precios completos para agenda, tratamientos y cobros.",
      isDefault: true,
      isActive: true
    }
  });

  const policy = await prisma.priceList.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO PÓLIZA DENTAL 2026" }
    },
    update: {
      description: "Lista demo para pólizas y convenios.",
      isDefault: false,
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO PÓLIZA DENTAL 2026",
      description: "Lista demo para pólizas y convenios.",
      isDefault: false,
      isActive: true
    }
  });

  const additional = await prisma.priceList.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO ADICIONAL 2026" }
    },
    update: {
      description: "Lista demo para precios adicionales y ajustes especiales.",
      isDefault: false,
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO ADICIONAL 2026",
      description: "Lista demo para precios adicionales y ajustes especiales.",
      isDefault: false,
      isActive: true
    }
  });

  const priceListConfigs = [
    { priceList: base, multiplier: 1, type: BranchPriceListType.BASE, isDefault: true },
    { priceList: policy, multiplier: 0.85, type: BranchPriceListType.POLIZA, isDefault: false },
    { priceList: additional, multiplier: 1.15, type: BranchPriceListType.ADICIONAL, isDefault: false }
  ];

  for (const config of priceListConfigs) {
    const priceListCategoryByCategoryKey = new Map<string, string>();
    for (const categorySeed of procedureCategories) {
      const categoryId = categoryByKey.get(categorySeed.key);
      const priceListCategory = await prisma.priceListCategory.upsert({
        where: {
          priceListId_name: {
            priceListId: config.priceList.id,
            name: categorySeed.name
          }
        },
        update: {
          organizationId,
          procedureCategoryId: categoryId,
          description: categorySeed.description,
          sortOrder: categorySeed.sortOrder,
          isActive: true
        },
        create: {
          organizationId,
          priceListId: config.priceList.id,
          procedureCategoryId: categoryId,
          name: categorySeed.name,
          description: categorySeed.description,
          sortOrder: categorySeed.sortOrder,
          isActive: true
        }
      });
      priceListCategoryByCategoryKey.set(categorySeed.key, priceListCategory.id);
    }

    for (const procedureSeed of procedureSeeds) {
      const procedure = procedures.get(procedureSeed.code);
      const priceListCategoryId = priceListCategoryByCategoryKey.get(procedureSeed.categoryKey);
      if (!procedure) {
        throw new Error(`Procedimiento no encontrado en catálogo: ${procedureSeed.code}`);
      }
      await prisma.priceListItem.upsert({
        where: {
          priceListId_procedureId: {
            priceListId: config.priceList.id,
            procedureId: procedure.id
          }
        },
        update: {
          priceListCategoryId,
          price: roundMoney(procedureSeed.price * config.multiplier),
          labCost: procedureSeed.labCost ?? 0,
          allowsDiscount: true,
          currency: CurrencyCode.MXN
        },
        create: {
          priceListId: config.priceList.id,
          priceListCategoryId,
          procedureId: procedure.id,
          price: roundMoney(procedureSeed.price * config.multiplier),
          labCost: procedureSeed.labCost ?? 0,
          allowsDiscount: true,
          currency: CurrencyCode.MXN
        }
      });
    }
  }

  for (const branch of branches) {
    for (const config of priceListConfigs) {
      await prisma.branchPriceList.upsert({
        where: {
          branchId_priceListId: {
            branchId: branch.id,
            priceListId: config.priceList.id
          }
        },
        update: {
          organizationId,
          type: config.type,
          isDefault: config.isDefault,
          isActive: true
        },
        create: {
          organizationId,
          branchId: branch.id,
          priceListId: config.priceList.id,
          type: config.type,
          isDefault: config.isDefault,
          isActive: true
        }
      });
    }
  }

  const agreement = await prisma.agreement.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO Convenio integral" }
    },
    update: {
      priceListId: policy.id,
      discountPercent: 5,
      appliesToLabs: true,
      appliesToOtherCategories: true,
      payrollDiscount: false,
      isPublic: true,
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO Convenio integral",
      description: "Convenio demo para probar póliza, descuentos y cobranza.",
      priceListId: policy.id,
      discountPercent: 5,
      appliesToLabs: true,
      appliesToOtherCategories: true,
      payrollDiscount: false,
      isPublic: true,
      isActive: true
    }
  });

  const clinicalTemplate = await prisma.clinicalDocumentTemplate.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO Historia clínica integral" }
    },
    update: {
      content: "Motivo de consulta:\nAntecedentes:\nExploración:\nDiagnóstico:\nPlan:",
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO Historia clínica integral",
      description: "Plantilla demo para historia clínica inicial.",
      content: "Motivo de consulta:\nAntecedentes:\nExploración:\nDiagnóstico:\nPlan:",
      isActive: true
    }
  });

  const consentTemplate = await prisma.consentTemplate.upsert({
    where: {
      organizationId_name: { organizationId, name: "FULL DEMO Consentimiento tratamiento dental" }
    },
    update: {
      content:
        "Acepto el diagnóstico, plan de tratamiento, costos, riesgos y alternativas explicadas por el profesional.",
      isActive: true
    },
    create: {
      organizationId,
      name: "FULL DEMO Consentimiento tratamiento dental",
      content:
        "Acepto el diagnóstico, plan de tratamiento, costos, riesgos y alternativas explicadas por el profesional.",
      isActive: true
    }
  });

  return {
    paymentMethods,
    institutions,
    priceLists: { base, policy, additional },
    agreement,
    procedures,
    procedurePrices,
    supplier,
    labProvider,
    expenseCategory,
    clinicalTemplate,
    consentTemplate
  };
}

async function ensureChair(branch: BranchSeed, name: string, description: string) {
  return prisma.chair.upsert({
    where: {
      branchId_name: {
        branchId: branch.id,
        name
      }
    },
    update: {
      description,
      isActive: true
    },
    create: {
      organizationId: branch.organizationId,
      branchId: branch.id,
      name,
      description,
      isActive: true
    }
  });
}

async function upsertProfessional(input: {
  organizationId: string;
  branchId: string;
  user: User;
  email: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string;
  color: string;
  specialtyId: string;
}) {
  const professional = await prisma.professional.upsert({
    where: {
      organizationId_email: {
        organizationId: input.organizationId,
        email: input.email
      }
    },
    update: {
      userId: input.user.id,
      firstName: input.firstName,
      lastName: input.lastName,
      licenseNumber: input.licenseNumber,
      phone: input.phone,
      color: input.color,
      isActive: true
    },
    create: {
      organizationId: input.organizationId,
      userId: input.user.id,
      firstName: input.firstName,
      lastName: input.lastName,
      licenseNumber: input.licenseNumber,
      phone: input.phone,
      email: input.email,
      color: input.color,
      isActive: true
    }
  });

  await prisma.professionalSpecialty.deleteMany({ where: { professionalId: professional.id } });
  await prisma.professionalSpecialty.create({
    data: {
      professionalId: professional.id,
      specialtyId: input.specialtyId
    }
  });

  await prisma.professionalBranch.upsert({
    where: {
      professionalId_branchId: {
        professionalId: professional.id,
        branchId: input.branchId
      }
    },
    update: {
      isPrimary: true,
      agendaSlotMinutes: 20,
      defaultAppointmentDurationMinutes: 40,
      status: ProfessionalBranchStatus.ACTIVE,
      startsAt: FULL_DEMO_ASSIGNMENT_START,
      endsAt: null,
      endedReason: null
    },
    create: {
      professionalId: professional.id,
      branchId: input.branchId,
      isPrimary: true,
      agendaSlotMinutes: 20,
      defaultAppointmentDurationMinutes: 40,
      status: ProfessionalBranchStatus.ACTIVE,
      startsAt: FULL_DEMO_ASSIGNMENT_START
    }
  });

  return professional;
}

async function seedProfessionalSchedule(input: {
  professionalId: string;
  branchId: string;
  chairId: string;
  startTime: string;
  endTime: string;
  breakStartTime: string;
  breakEndTime: string;
}) {
  await prisma.professionalSchedule.deleteMany({
    where: {
      professionalId: input.professionalId,
      branchId: input.branchId
    }
  });

  for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
    await prisma.professionalSchedule.create({
      data: {
        professionalId: input.professionalId,
        branchId: input.branchId,
        chairId: input.chairId,
        dayOfWeek,
        startTime: input.startTime,
        endTime: dayOfWeek === 6 ? "15:00" : input.endTime,
        breakStartTime: dayOfWeek === 6 ? null : input.breakStartTime,
        breakEndTime: dayOfWeek === 6 ? null : input.breakEndTime,
        isActive: true
      }
    });
  }
}

async function seedBranchTeam(
  branch: BranchSeed,
  index: number,
  specialties: SpecialtyContext,
  passwordHash: string
): Promise<BranchTeam> {
  const token = branchToken(branch, index);
  const label = branchLabel(branch);
  const basePhone = `+52961${String(index + 1).padStart(3, "0")}`;

  const receptionist = await upsertSystemUser({
    organizationId: branch.organizationId,
    branchId: branch.id,
    roleName: "RECEPTIONIST",
    email: `recepcion.full.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Recepción",
    lastName: label,
    phone: `${basePhone}001`,
    passwordHash
  });
  const cashier = await upsertSystemUser({
    organizationId: branch.organizationId,
    branchId: branch.id,
    roleName: "CASHIER",
    email: `caja.full.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Caja",
    lastName: label,
    phone: `${basePhone}002`,
    passwordHash
  });
  const generalUser = await upsertSystemUser({
    organizationId: branch.organizationId,
    branchId: branch.id,
    roleName: "DENTIST",
    email: `dr.general.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Doctor General",
    lastName: label,
    phone: `${basePhone}003`,
    passwordHash
  });
  const orthoUser = await upsertSystemUser({
    organizationId: branch.organizationId,
    branchId: branch.id,
    roleName: "DENTIST",
    email: `dr.ortodoncia.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Doctor Ortodoncia",
    lastName: label,
    phone: `${basePhone}004`,
    passwordHash
  });
  const general2User = await upsertSystemUser({
    organizationId: branch.organizationId,
    branchId: branch.id,
    roleName: "DENTIST",
    email: `dr.general2.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Doctor General 2",
    lastName: label,
    phone: `${basePhone}005`,
    passwordHash
  });

  const generalChair = await ensureChair(branch, "Box General FULLDEMO", "Box demo para odontología integral.");
  const general2Chair = await ensureChair(branch, "Box General 2 FULLDEMO", "Box demo para segunda odontologia integral.");
  const orthoChair = await ensureChair(branch, "Box Ortodoncia FULLDEMO", "Box demo para ortodoncia.");
  const urgentChair = await ensureChair(branch, "Box Urgencias FULLDEMO", "Box demo para bloqueos y urgencias.");

  const generalProfessional = await upsertProfessional({
    organizationId: branch.organizationId,
    branchId: branch.id,
    user: generalUser,
    email: `dr.general.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Dr. General",
    lastName: label,
    licenseNumber: licenseFor("GEN", index),
    phone: `${basePhone}003`,
    color: "#0f766e",
    specialtyId: specialties.general.id
  });
  const orthoProfessional = await upsertProfessional({
    organizationId: branch.organizationId,
    branchId: branch.id,
    user: orthoUser,
    email: `dr.ortodoncia.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Dr. Ortodoncia",
    lastName: label,
    licenseNumber: licenseFor("ORT", index),
    phone: `${basePhone}004`,
    color: "#7c3aed",
    specialtyId: specialties.ortho.id
  });
  const general2Professional = await upsertProfessional({
    organizationId: branch.organizationId,
    branchId: branch.id,
    user: general2User,
    email: `dr.general2.${token}${FULL_DEMO_EMAIL_SUFFIX}`,
    firstName: "Dr. General 2",
    lastName: label,
    licenseNumber: licenseFor("GN2", index),
    phone: `${basePhone}005`,
    color: "#0284c7",
    specialtyId: specialties.general.id
  });

  await seedProfessionalSchedule({
    professionalId: generalProfessional.id,
    branchId: branch.id,
    chairId: generalChair.id,
    startTime: "10:00",
    endTime: "19:00",
    breakStartTime: "14:00",
    breakEndTime: "15:00"
  });
  await seedProfessionalSchedule({
    professionalId: general2Professional.id,
    branchId: branch.id,
    chairId: general2Chair.id,
    startTime: "10:00",
    endTime: "19:00",
    breakStartTime: "14:00",
    breakEndTime: "15:00"
  });
  await seedProfessionalSchedule({
    professionalId: orthoProfessional.id,
    branchId: branch.id,
    chairId: orthoChair.id,
    startTime: "10:00",
    endTime: "19:00",
    breakStartTime: "14:00",
    breakEndTime: "15:00"
  });

  return {
    receptionist,
    cashier,
    generalUser,
    general2User,
    orthoUser,
    generalProfessional,
    general2Professional,
    orthoProfessional,
    generalChairId: generalChair.id,
    general2ChairId: general2Chair.id,
    orthoChairId: orthoChair.id,
    urgentChairId: urgentChair.id
  };
}

async function seedPatient(input: {
  branch: BranchSeed;
  token: string;
  kind: "general" | "ortho" | "saldo";
  firstName: string;
  lastName: string;
  phone: string;
  status: PatientStatus;
  agreementId?: string;
  createdById: string;
}) {
  const patient = await prisma.patient.create({
    data: {
      organizationId: input.branch.organizationId,
      branchId: input.branch.id,
      agreementId: input.agreementId,
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: demoDateAt(9, 0, -12000),
      gender: input.kind === "ortho" ? "Femenino" : "Masculino",
      documentType: "INE",
      documentNumber: `FD-${input.token.toUpperCase()}-${input.kind.toUpperCase()}`,
      email: `${input.kind}.${input.token}${FULL_DEMO_EMAIL_SUFFIX}`,
      phone: input.phone,
      alternatePhone: `${input.phone}9`,
      occupation: input.kind === "saldo" ? "Administración" : "Comercio",
      referredBy: "Seed FULLDEMO",
      source: "FULLDEMO",
      status: input.status
    }
  });

  await prisma.patientAddress.create({
    data: {
      patientId: patient.id,
      street: "Calle Demo 123",
      city: input.branch.city ?? "Ciudad demo",
      state: input.branch.state ?? "MX",
      country: "MX",
      zipCode: "29000"
    }
  });

  await prisma.patientContact.create({
    data: {
      patientId: patient.id,
      name: `Contacto ${input.firstName}`,
      relationship: "Familiar",
      phone: `${input.phone}8`,
      email: `contacto.${input.kind}.${input.token}${FULL_DEMO_EMAIL_SUFFIX}`,
      isEmergencyContact: true
    }
  });

  await prisma.medicalHistory.create({
    data: {
      patientId: patient.id,
      bloodType: input.kind === "ortho" ? "O+" : "A+",
      hasDiabetes: false,
      hasHypertension: input.kind === "saldo",
      hasHeartDisease: false,
      isPregnant: false,
      smokes: input.kind === "saldo",
      drinksAlcohol: false,
      notes: `${FULL_DEMO_PREFIX} Historia médica sembrada para pruebas.`
    }
  });

  await prisma.patientMedicalAlert.create({
    data: {
      patientId: patient.id,
      type: input.kind === "saldo" ? "Hipertensión" : "Alergia",
      description:
        input.kind === "saldo"
          ? "Controlar presión antes de procedimientos quirúrgicos."
          : "Evitar automedicación y confirmar anestésico previo.",
      severity: input.kind === "saldo" ? "HIGH" : "MEDIUM",
      isActive: true
    }
  });

  await prisma.patientNote.create({
    data: {
      patientId: patient.id,
      userId: input.createdById,
      note: `${FULL_DEMO_PREFIX} Paciente demo con flujo completo para agenda, clínica y cobranza.`,
      isPrivate: false
    }
  });

  await prisma.allergy.create({
    data: {
      patientId: patient.id,
      name: input.kind === "ortho" ? "Látex" : "Penicilina",
      reaction: "Irritación",
      severity: "MEDIUM",
      notes: `${FULL_DEMO_PREFIX} Dato clínico demo.`
    }
  });

  await prisma.medicalCondition.create({
    data: {
      patientId: patient.id,
      name: input.kind === "saldo" ? "Hipertensión controlada" : "Sin condición sistémica relevante",
      notes: `${FULL_DEMO_PREFIX} Condición sembrada para validación clínica.`,
      isActive: true
    }
  });

  await prisma.medication.create({
    data: {
      patientId: patient.id,
      name: input.kind === "saldo" ? "Losartán" : "Ninguno",
      dosage: input.kind === "saldo" ? "50 mg" : undefined,
      frequency: input.kind === "saldo" ? "Cada 24 horas" : undefined,
      notes: `${FULL_DEMO_PREFIX} Medicamento demo.`
    }
  });

  return patient;
}

async function createTreatmentPlan(input: {
  organizationId: string;
  branchId: string;
  patient: Patient;
  professional: Professional;
  name: string;
  description: string;
  status: TreatmentPlanStatus;
  items: ProcedureItemSeed[];
  catalog: CatalogContext;
}) {
  const treatmentPlan = await prisma.treatmentPlan.create({
    data: {
      organizationId: input.organizationId,
      branchId: input.branchId,
      patientId: input.patient.id,
      professionalId: input.professional.id,
      name: input.name,
      description: input.description,
      status: input.status,
      acceptedAt:
        input.status === TreatmentPlanStatus.ACCEPTED ||
        input.status === TreatmentPlanStatus.IN_PROGRESS ||
        input.status === TreatmentPlanStatus.COMPLETED
          ? demoDateAt(10, 0, -1)
          : undefined,
      completedAt: input.status === TreatmentPlanStatus.COMPLETED ? demoDateAt(18, 0, -1) : undefined
    }
  });

  const section = await prisma.treatmentPlanSection.create({
    data: {
      treatmentPlanId: treatmentPlan.id,
      name: "Tratamiento principal",
      sortOrder: 1
    }
  });

  const createdItems: TreatmentPlanItem[] = [];
  for (const itemSeed of input.items) {
    const procedure = input.catalog.procedures.get(itemSeed.procedureCode);
    if (!procedure) {
      throw new Error(`Procedimiento no encontrado: ${itemSeed.procedureCode}`);
    }

    const quantity = itemSeed.quantity ?? 1;
    const unitPrice = itemSeed.unitPrice ?? input.catalog.procedurePrices.get(itemSeed.procedureCode) ?? 0;
    const discount = itemSeed.discount ?? 0;
    const total = roundMoney(quantity * unitPrice - discount);

    const item = await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: treatmentPlan.id,
        sectionId: section.id,
        procedureId: procedure.id,
        toothNumber: itemSeed.toothNumber,
        surface: itemSeed.surface,
        quantity,
        unitPrice,
        discount,
        total,
        status: itemSeed.status ?? TreatmentPlanItemStatus.ACCEPTED,
        notes: itemSeed.notes,
        plannedAt: demoDateAt(9, 0, -1),
        completedAt:
          itemSeed.status === TreatmentPlanItemStatus.COMPLETED || itemSeed.status === TreatmentPlanItemStatus.PAID
            ? demoDateAt(12, 0, -1)
            : undefined
      }
    });
    createdItems.push(item);
  }

  return { treatmentPlan, items: createdItems };
}

async function createBudget(input: {
  organizationId: string;
  treatmentPlan: TreatmentPlan;
  patient: Patient;
  professional: Professional;
  items: TreatmentPlanItem[];
  status: BudgetStatus;
  notes: string;
}) {
  const subtotal = input.items.reduce((sum, item) => sum + Number(item.total), 0);
  const budget = await prisma.budget.create({
    data: {
      treatmentPlanId: input.treatmentPlan.id,
      patientId: input.patient.id,
      professionalId: input.professional.id,
      organizationId: input.organizationId,
      subtotal,
      discountTotal: 0,
      total: subtotal,
      status: input.status,
      expiresAt: addDays(new Date(), 15),
      notes: input.notes,
      sentAt:
        input.status === BudgetStatus.SENT || input.status === BudgetStatus.ACCEPTED
          ? demoDateAt(11, 0, -1)
          : undefined,
      acceptedAt: input.status === BudgetStatus.ACCEPTED ? demoDateAt(11, 30, -1) : undefined
    }
  });

  for (const item of input.items) {
    await prisma.budgetItem.create({
      data: {
        budgetId: budget.id,
        treatmentPlanItemId: item.id,
        description: `${FULL_DEMO_PREFIX} ${item.notes ?? "Tratamiento"}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total
      }
    });
  }

  return budget;
}

async function createPayment(input: {
  organizationId: string;
  branchId: string;
  patient: Patient;
  receivedBy: User;
  amount: number;
  paymentMethod: PaymentMethod;
  financialInstitutionId?: string;
  reference: string;
  notes: string;
  paidAt: Date;
  allocations?: Array<{ item: TreatmentPlanItem; amount: number }>;
  cashRegisterId: string;
}) {
  const payment = await prisma.payment.create({
    data: {
      organizationId: input.organizationId,
      branchId: input.branchId,
      patientId: input.patient.id,
      receivedById: input.receivedBy.id,
      amount: input.amount,
      currency: CurrencyCode.MXN,
      paymentMethodId: input.paymentMethod.id,
      financialInstitutionId: input.financialInstitutionId,
      status: input.allocations?.length ? PaymentStatus.ALLOCATED : PaymentStatus.RECEIVED,
      reference: input.reference,
      notes: input.notes,
      paidAt: input.paidAt
    }
  });

  for (const allocation of input.allocations ?? []) {
    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        treatmentPlanItemId: allocation.item.id,
        amount: allocation.amount
      }
    });
  }

  await prisma.cashMovement.create({
    data: {
      cashRegisterId: input.cashRegisterId,
      type: CashMovementType.INCOME,
      amount: input.amount,
      paymentId: payment.id,
      description: `${FULL_DEMO_PREFIX} Ingreso ${input.reference}`,
      createdById: input.receivedBy.id,
      createdAt: input.paidAt
    }
  });

  return payment;
}

async function seedCashAndExpense(input: {
  branch: BranchSeed;
  cashier: User;
  expenseCategory: ExpenseCategory;
}) {
  const cashRegister = await prisma.cashRegister.create({
    data: {
      organizationId: input.branch.organizationId,
      branchId: input.branch.id,
      openedById: input.cashier.id,
      openingAmount: 1500,
      status: CashRegisterStatus.OPEN,
      openedAt: demoDateAt(7, 45)
    }
  });

  await prisma.cashMovement.create({
    data: {
      cashRegisterId: cashRegister.id,
      type: CashMovementType.OPENING,
      amount: 1500,
      description: `${FULL_DEMO_PREFIX} Apertura de caja`,
      createdById: input.cashier.id,
      createdAt: demoDateAt(7, 45)
    }
  });

  const expense = await prisma.expense.create({
    data: {
      organizationId: input.branch.organizationId,
      branchId: input.branch.id,
      categoryId: input.expenseCategory.id,
      description: `${FULL_DEMO_PREFIX} Compra de insumos clínicos`,
      quantity: 1,
      unitCost: 850,
      total: 850,
      paidAt: demoDateAt(8, 10),
      notes: "Compra demo para validar caja y gastos.",
      createdById: input.cashier.id
    }
  });

  await prisma.cashMovement.create({
    data: {
      cashRegisterId: cashRegister.id,
      type: CashMovementType.EXPENSE,
      amount: 850,
      expenseId: expense.id,
      description: `${FULL_DEMO_PREFIX} Gasto insumos`,
      createdById: input.cashier.id,
      createdAt: demoDateAt(8, 10)
    }
  });

  return cashRegister;
}

async function seedInventory(input: {
  branch: BranchSeed;
  token: string;
  supplier: Supplier;
  createdBy: User;
}) {
  const skuToken = input.token.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  const inventorySeeds = [
    {
      sku: `FD-${skuToken}-GUANTES`,
      name: "FULL DEMO Guantes nitrilo",
      category: "Desechables",
      unit: "Caja",
      stock: 24,
      minStock: 8
    },
    {
      sku: `FD-${skuToken}-RESINA`,
      name: "FULL DEMO Resina compuesta A2",
      category: "Operatoria",
      unit: "Jeringa",
      stock: 12,
      minStock: 4
    },
    {
      sku: `FD-${skuToken}-BRACKETS`,
      name: "FULL DEMO Kit brackets metálicos",
      category: "Ortodoncia",
      unit: "Kit",
      stock: 6,
      minStock: 2
    }
  ];

  for (const itemSeed of inventorySeeds) {
    const item = await prisma.inventoryItem.upsert({
      where: {
        organizationId_sku_branchId: {
          organizationId: input.branch.organizationId,
          sku: itemSeed.sku,
          branchId: input.branch.id
        }
      },
      update: {
        name: itemSeed.name,
        category: itemSeed.category,
        unit: itemSeed.unit,
        stock: itemSeed.stock,
        minStock: itemSeed.minStock,
        supplierId: input.supplier.id,
        isActive: true
      },
      create: {
        organizationId: input.branch.organizationId,
        branchId: input.branch.id,
        supplierId: input.supplier.id,
        sku: itemSeed.sku,
        name: itemSeed.name,
        category: itemSeed.category,
        unit: itemSeed.unit,
        stock: itemSeed.stock,
        minStock: itemSeed.minStock,
        isActive: true
      }
    });

    await prisma.inventoryMovement.create({
      data: {
        inventoryItemId: item.id,
        branchId: input.branch.id,
        type: InventoryMovementType.IN,
        quantity: itemSeed.stock,
        reason: `${FULL_DEMO_PREFIX} Entrada inicial por seed`,
        createdById: input.createdBy.id,
        createdAt: demoDateAt(8, 20)
      }
    });
  }
}

async function createAppointment(input: {
  branch: BranchSeed;
  patient?: Patient;
  professional: Professional;
  chairId: string;
  specialtyId: string;
  treatmentPlanId?: string;
  title: string;
  reason: string;
  status: AppointmentStatus;
  startAt: Date;
  durationMinutes: number;
  createdBy: User;
  note?: string;
}) {
  const appointment = await prisma.appointment.create({
    data: {
      organizationId: input.branch.organizationId,
      branchId: input.branch.id,
      patientId: input.patient?.id,
      professionalId: input.professional.id,
      chairId: input.chairId,
      specialtyId: input.specialtyId,
      treatmentPlanId: input.treatmentPlanId,
      title: `${FULL_DEMO_PREFIX} ${input.title}`,
      reason: input.reason,
      status: input.status,
      startAt: input.startAt,
      endAt: addMinutes(input.startAt, input.durationMinutes),
      durationMinutes: input.durationMinutes,
      notes: input.note,
      cancellationReason:
        input.status === AppointmentStatus.CANCELLED_BY_PATIENT ||
        input.status === AppointmentStatus.CANCELLED_BY_CLINIC
          ? "Motivo demo de cancelación"
          : undefined,
      createdById: input.createdBy.id,
      updatedById: input.createdBy.id
    }
  });

  await prisma.appointmentStatusHistory.create({
    data: {
      appointmentId: appointment.id,
      previousStatus: input.status === AppointmentStatus.SCHEDULED ? null : AppointmentStatus.SCHEDULED,
      newStatus: input.status,
      changedById: input.createdBy.id,
      reason: `${FULL_DEMO_PREFIX} Estado inicial demo`
    }
  });

  await prisma.appointmentNote.create({
    data: {
      appointmentId: appointment.id,
      userId: input.createdBy.id,
      note: input.note ?? `${FULL_DEMO_PREFIX} Nota operativa de agenda.`,
      isPrivate: false
    }
  });

  await prisma.appointmentReminder.create({
    data: {
      appointmentId: appointment.id,
      channel: "WHATSAPP",
      scheduledAt: addMinutes(input.startAt, -1440),
      sentAt: input.status === AppointmentStatus.CONFIRMED ? addMinutes(input.startAt, -1200) : undefined,
      status: input.status === AppointmentStatus.CONFIRMED ? "SENT" : "PENDING"
    }
  });

  return appointment;
}

async function seedClinicalArtifacts(input: {
  patient: Patient;
  appointmentId: string;
  treatmentPlanId: string;
  professional: Professional;
  signedBy: User;
  createdBy: User;
  clinicalTemplate: ClinicalDocumentTemplate;
  consentTemplate: ConsentTemplate;
  completedProcedure: Procedure;
}) {
  const evolution = await prisma.clinicalEvolution.create({
    data: {
      patientId: input.patient.id,
      appointmentId: input.appointmentId,
      professionalId: input.professional.id,
      treatmentPlanId: input.treatmentPlanId,
      subjective: "Paciente acude a control y refiere evolución favorable.",
      objective: "Exploración intraoral sin hallazgos de alarma.",
      assessment: "Tratamiento integral en evolución adecuada.",
      plan: "Continuar plan y reforzar higiene.",
      notes: `${FULL_DEMO_PREFIX} Evolución clínica demo firmada.`,
      signedAt: demoDateAt(12, 15),
      signedById: input.signedBy.id
    }
  });

  const odontogram = await prisma.odontogramRecord.create({
    data: {
      patientId: input.patient.id,
      professionalId: input.professional.id,
      appointmentId: input.appointmentId,
      toothNumber: "16",
      surface: "O",
      condition: "Restauración",
      diagnosis: "Caries oclusal controlada",
      procedureId: input.completedProcedure.id,
      status: ToothProcedureStatus.COMPLETED,
      notes: `${FULL_DEMO_PREFIX} Registro odontograma demo.`
    }
  });

  await prisma.toothCondition.create({
    data: {
      patientId: input.patient.id,
      odontogramRecordId: odontogram.id,
      toothNumber: "16",
      surface: "O",
      condition: "Restaurado",
      diagnosis: "Control post operatorio",
      notes: `${FULL_DEMO_PREFIX} Condición dental demo.`
    }
  });

  await prisma.toothProcedure.create({
    data: {
      patientId: input.patient.id,
      professionalId: input.professional.id,
      appointmentId: input.appointmentId,
      procedureId: input.completedProcedure.id,
      odontogramRecordId: odontogram.id,
      clinicalEvolutionId: evolution.id,
      treatmentPlanId: input.treatmentPlanId,
      toothNumber: "16",
      surface: "O",
      diagnosis: "Restauración completada",
      status: ToothProcedureStatus.COMPLETED,
      notes: `${FULL_DEMO_PREFIX} Procedimiento dental demo completado.`,
      completedAt: demoDateAt(12, 10)
    }
  });

  await prisma.clinicalDocument.create({
    data: {
      patientId: input.patient.id,
      templateId: input.clinicalTemplate.id,
      title: `${FULL_DEMO_PREFIX} Historia clínica inicial`,
      content: "Motivo de consulta: revisión integral.\nDiagnóstico: plan preventivo y restaurador.",
      status: "SIGNED",
      createdById: input.createdBy.id
    }
  });

  const consent = await prisma.consent.create({
    data: {
      patientId: input.patient.id,
      templateId: input.consentTemplate.id,
      treatmentPlanId: input.treatmentPlanId,
      appointmentId: input.appointmentId,
      contentSnapshot: input.consentTemplate.content,
      status: ConsentStatus.SIGNED,
      signedAt: demoDateAt(12, 20)
    }
  });

  await prisma.documentSignature.create({
    data: {
      consentId: consent.id,
      signerName: `${input.patient.firstName} ${input.patient.lastName}`,
      signerType: "PATIENT",
      signatureData: "FULLDEMO-SIGNATURE",
      ipAddress: "127.0.0.1",
      signedAt: demoDateAt(12, 20)
    }
  });
}

async function seedBranchFlow(
  branch: BranchSeed,
  index: number,
  specialties: SpecialtyContext,
  catalog: CatalogContext,
  passwordHash: string
) {
  const token = branchToken(branch, index);
  const label = branchLabel(branch);
  console.log(`Sembrando flujo FULLDEMO en sucursal: ${branch.name}`);

  const team = await seedBranchTeam(branch, index, specialties, passwordHash);
  const cashRegister = await seedCashAndExpense({
    branch,
    cashier: team.cashier,
    expenseCategory: catalog.expenseCategory
  });

  await seedInventory({
    branch,
    token,
    supplier: catalog.supplier,
    createdBy: team.cashier
  });

  const phoneBase = `+52962${String(index + 1).padStart(3, "0")}`;
  const generalPatient = await seedPatient({
    branch,
    token,
    kind: "general",
    firstName: "Demo General",
    lastName: label,
    phone: `${phoneBase}101`,
    status: PatientStatus.IN_TREATMENT,
    agreementId: catalog.agreement.id,
    createdById: team.receptionist.id
  });
  const orthoPatient = await seedPatient({
    branch,
    token,
    kind: "ortho",
    firstName: "Demo Ortodoncia",
    lastName: label,
    phone: `${phoneBase}102`,
    status: PatientStatus.IN_TREATMENT,
    agreementId: catalog.agreement.id,
    createdById: team.receptionist.id
  });
  const debtorPatient = await seedPatient({
    branch,
    token,
    kind: "saldo",
    firstName: "Demo Saldo",
    lastName: label,
    phone: `${phoneBase}103`,
    status: PatientStatus.DEBTOR,
    createdById: team.receptionist.id
  });

  const generalPlan = await createTreatmentPlan({
    organizationId: branch.organizationId,
    branchId: branch.id,
    patient: generalPatient,
    professional: team.generalProfessional,
    name: `${FULL_DEMO_PREFIX} Plan integral ${label}`,
    description: "Plan demo con profilaxis pagada y resina pendiente.",
    status: TreatmentPlanStatus.IN_PROGRESS,
    catalog,
    items: [
      {
        procedureCode: "FD-PROF-GEN",
        status: TreatmentPlanItemStatus.COMPLETED,
        notes: "Profilaxis completada"
      },
      {
        procedureCode: "FD-RES-COMP",
        toothNumber: "16",
        surface: "O",
        status: TreatmentPlanItemStatus.ACCEPTED,
        notes: "Resina pendiente"
      }
    ]
  });
  await createBudget({
    organizationId: branch.organizationId,
    treatmentPlan: generalPlan.treatmentPlan,
    patient: generalPatient,
    professional: team.generalProfessional,
    items: generalPlan.items,
    status: BudgetStatus.ACCEPTED,
    notes: `${FULL_DEMO_PREFIX} Presupuesto integral aceptado.`
  });
  await createPayment({
    organizationId: branch.organizationId,
    branchId: branch.id,
    patient: generalPatient,
    receivedBy: team.cashier,
    amount: 700,
    paymentMethod: catalog.paymentMethods.cash,
    reference: `FD-${token}-GEN-001`,
    notes: "Pago de profilaxis demo.",
    paidAt: demoDateAt(10, 40),
    allocations: [{ item: generalPlan.items[0], amount: 700 }],
    cashRegisterId: cashRegister.id
  });

  const orthoPlan = await createTreatmentPlan({
    organizationId: branch.organizationId,
    branchId: branch.id,
    patient: orthoPatient,
    professional: team.orthoProfessional,
    name: `${FULL_DEMO_PREFIX} Plan ortodoncia ${label}`,
    description: "Plan demo con enganche, mensualidades y cobranza.",
    status: TreatmentPlanStatus.IN_PROGRESS,
    catalog,
    items: [
      {
        procedureCode: "FD-BRK-MET",
        status: TreatmentPlanItemStatus.IN_PROGRESS,
        notes: "Brackets metálicos en tratamiento"
      },
      {
        procedureCode: "FD-CTRL-ORTO",
        quantity: 2,
        status: TreatmentPlanItemStatus.ACCEPTED,
        notes: "Controles mensuales programados"
      }
    ]
  });
  await createBudget({
    organizationId: branch.organizationId,
    treatmentPlan: orthoPlan.treatmentPlan,
    patient: orthoPatient,
    professional: team.orthoProfessional,
    items: orthoPlan.items,
    status: BudgetStatus.ACCEPTED,
    notes: `${FULL_DEMO_PREFIX} Presupuesto ortodoncia aceptado.`
  });
  const orthoDownPayment = await createPayment({
    organizationId: branch.organizationId,
    branchId: branch.id,
    patient: orthoPatient,
    receivedBy: team.cashier,
    amount: 5000,
    paymentMethod: catalog.paymentMethods.card,
    financialInstitutionId: catalog.institutions.bbva.id,
    reference: `FD-${token}-ORT-ENG`,
    notes: "Enganche de ortodoncia demo.",
    paidAt: demoDateAt(15, 0),
    allocations: [{ item: orthoPlan.items[0], amount: 5000 }],
    cashRegisterId: cashRegister.id
  });
  const installmentAmount = roundMoney((18000 - 5000) / 6);
  const firstInstallmentPayment = await createPayment({
    organizationId: branch.organizationId,
    branchId: branch.id,
    patient: orthoPatient,
    receivedBy: team.cashier,
    amount: installmentAmount,
    paymentMethod: catalog.paymentMethods.transfer,
    financialInstitutionId: catalog.institutions.santander.id,
    reference: `FD-${token}-ORT-M01`,
    notes: "Primera mensualidad de ortodoncia demo.",
    paidAt: demoDateAt(15, 20, -20),
    allocations: [{ item: orthoPlan.items[0], amount: installmentAmount }],
    cashRegisterId: cashRegister.id
  });

  const installmentPlan = await prisma.installmentPlan.create({
    data: {
      organizationId: branch.organizationId,
      patientId: orthoPatient.id,
      treatmentPlanId: orthoPlan.treatmentPlan.id,
      totalAmount: 18000,
      downPayment: Number(orthoDownPayment.amount),
      financedAmount: 13000,
      numberOfInstallments: 6,
      frequency: InstallmentFrequency.MONTHLY,
      startDate: addDays(new Date(), -30),
      status: InstallmentPlanStatus.ACTIVE
    }
  });

  let overdueInstallmentId: string | undefined;
  for (let installmentNumber = 1; installmentNumber <= 6; installmentNumber += 1) {
    const isPaid = installmentNumber === 1;
    const isOverdue = installmentNumber === 2;
    const installment = await prisma.installment.create({
      data: {
        installmentPlanId: installmentPlan.id,
        patientId: orthoPatient.id,
        number: installmentNumber,
        dueDate: isPaid ? addDays(new Date(), -20) : isOverdue ? addDays(new Date(), -5) : addDays(new Date(), 30 * installmentNumber),
        amount: installmentAmount,
        paidAmount: isPaid ? installmentAmount : 0,
        status: isPaid ? InstallmentStatus.PAID : isOverdue ? InstallmentStatus.OVERDUE : InstallmentStatus.PENDING,
        paymentId: isPaid ? firstInstallmentPayment.id : undefined,
        paidAt: isPaid ? demoDateAt(15, 20, -20) : undefined
      }
    });

    if (isOverdue) {
      overdueInstallmentId = installment.id;
    }
  }

  if (overdueInstallmentId) {
    const collectionCase = await prisma.collectionCase.create({
      data: {
        patientId: orthoPatient.id,
        installmentId: overdueInstallmentId,
        treatmentPlanId: orthoPlan.treatmentPlan.id,
        amountDue: installmentAmount,
        daysOverdue: 5,
        status: CollectionCaseStatus.CONTACTED,
        assignedToId: team.receptionist.id,
        lastContactAt: demoDateAt(9, 45),
        nextContactAt: addDays(new Date(), 2)
      }
    });
    await prisma.collectionActivity.create({
      data: {
        collectionCaseId: collectionCase.id,
        userId: team.receptionist.id,
        channel: "WhatsApp",
        result: "Promesa de pago",
        notes: `${FULL_DEMO_PREFIX} Paciente promete pago esta semana.`,
        nextActionAt: addDays(new Date(), 2)
      }
    });
  }

  const debtorPlan = await createTreatmentPlan({
    organizationId: branch.organizationId,
    branchId: branch.id,
    patient: debtorPatient,
    professional: team.generalProfessional,
    name: `${FULL_DEMO_PREFIX} Plan rehabilitación ${label}`,
    description: "Plan demo con presupuesto enviado, laboratorio y link de pago.",
    status: TreatmentPlanStatus.PRESENTED,
    catalog,
    items: [
      {
        procedureCode: "FD-COR-ZIR",
        toothNumber: "26",
        status: TreatmentPlanItemStatus.PLANNED,
        notes: "Corona zirconia por confirmar"
      },
      {
        procedureCode: "FD-RET-ACR",
        status: TreatmentPlanItemStatus.PLANNED,
        notes: "Retenedor acrílico por confirmar"
      }
    ]
  });
  const debtorBudget = await createBudget({
    organizationId: branch.organizationId,
    treatmentPlan: debtorPlan.treatmentPlan,
    patient: debtorPatient,
    professional: team.generalProfessional,
    items: debtorPlan.items,
    status: BudgetStatus.SENT,
    notes: `${FULL_DEMO_PREFIX} Presupuesto enviado con saldo pendiente.`
  });

  await prisma.paymentLink.create({
    data: {
      organizationId: branch.organizationId,
      patientId: debtorPatient.id,
      treatmentPlanId: debtorPlan.treatmentPlan.id,
      amount: Number(debtorBudget.total),
      url: `https://pagos.demo.dentalwarner.local/${token}/rehabilitacion`,
      status: PaymentLinkStatus.CREATED,
      expiresAt: addDays(new Date(), 7)
    }
  });

  const labOrder = await prisma.labOrder.create({
    data: {
      organizationId: branch.organizationId,
      patientId: debtorPatient.id,
      treatmentPlanId: debtorPlan.treatmentPlan.id,
      professionalId: team.generalProfessional.id,
      labProviderId: catalog.labProvider.id,
      status: LabOrderStatus.SENT,
      sentAt: demoDateAt(13, 10),
      expectedAt: addDays(new Date(), 5),
      cost: 3700,
      notes: `${FULL_DEMO_PREFIX} Orden de laboratorio demo para corona y retenedor.`
    }
  });
  await prisma.labOrderItem.create({
    data: {
      labOrderId: labOrder.id,
      description: "Corona zirconia 26",
      quantity: 1,
      unitCost: 2800,
      toothNumber: "26",
      notes: "Color A2"
    }
  });
  await prisma.labOrderItem.create({
    data: {
      labOrderId: labOrder.id,
      description: "Retenedor acrílico",
      quantity: 1,
      unitCost: 900,
      notes: "Superior"
    }
  });

  const completedAppointment = await createAppointment({
    branch,
    patient: generalPatient,
    professional: team.generalProfessional,
    chairId: team.generalChairId,
    specialtyId: specialties.general.id,
    treatmentPlanId: generalPlan.treatmentPlan.id,
    title: "Profilaxis completada",
    reason: "Profilaxis adultos",
    status: AppointmentStatus.COMPLETED,
    startAt: demoDateAt(10, 0),
    durationMinutes: 40,
    createdBy: team.receptionist,
    note: "Cita completada con evolución clínica."
  });

  await seedClinicalArtifacts({
    patient: generalPatient,
    appointmentId: completedAppointment.id,
    treatmentPlanId: generalPlan.treatmentPlan.id,
    professional: team.generalProfessional,
    signedBy: team.generalUser,
    createdBy: team.receptionist,
    clinicalTemplate: catalog.clinicalTemplate,
    consentTemplate: catalog.consentTemplate,
    completedProcedure: catalog.procedures.get("FD-PROF-GEN")!
  });

  await createAppointment({
    branch,
    patient: generalPatient,
    professional: team.generalProfessional,
    chairId: team.generalChairId,
    specialtyId: specialties.general.id,
    treatmentPlanId: generalPlan.treatmentPlan.id,
    title: "Resina programada",
    reason: "Resina compuesta",
    status: AppointmentStatus.SCHEDULED,
    startAt: demoDateAt(8, 20),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
  await createAppointment({
    branch,
    patient: debtorPatient,
    professional: team.generalProfessional,
    chairId: team.urgentChairId,
    specialtyId: specialties.general.id,
    treatmentPlanId: debtorPlan.treatmentPlan.id,
    title: "Valoración rehabilitación",
    reason: "Corona zirconia",
    status: AppointmentStatus.WAITING_ROOM,
    startAt: demoDateAt(11, 20),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
  await createAppointment({
    branch,
    patient: generalPatient,
    professional: team.generalProfessional,
    chairId: team.generalChairId,
    specialtyId: specialties.general.id,
    treatmentPlanId: generalPlan.treatmentPlan.id,
    title: "Control integral confirmado",
    reason: "Consulta integral",
    status: AppointmentStatus.CONFIRMED,
    startAt: demoDateAt(12, 20),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
  await createAppointment({
    branch,
    patient: orthoPatient,
    professional: team.orthoProfessional,
    chairId: team.orthoChairId,
    specialtyId: specialties.ortho.id,
    treatmentPlanId: orthoPlan.treatmentPlan.id,
    title: "Confirmación control ortodoncia",
    reason: "Control ortodoncia",
    status: AppointmentStatus.PENDING_CONFIRMATION,
    startAt: demoDateAt(14, 20),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
  await createAppointment({
    branch,
    patient: orthoPatient,
    professional: team.orthoProfessional,
    chairId: team.orthoChairId,
    specialtyId: specialties.ortho.id,
    treatmentPlanId: orthoPlan.treatmentPlan.id,
    title: "Paciente llegó ortodoncia",
    reason: "Ajuste ortodoncia",
    status: AppointmentStatus.ARRIVED,
    startAt: demoDateAt(15, 20),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
  await createAppointment({
    branch,
    patient: orthoPatient,
    professional: team.orthoProfessional,
    chairId: team.orthoChairId,
    specialtyId: specialties.ortho.id,
    treatmentPlanId: orthoPlan.treatmentPlan.id,
    title: "En atención ortodoncia",
    reason: "Control ortodoncia",
    status: AppointmentStatus.IN_PROGRESS,
    startAt: demoDateAt(16, 20),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
  await createAppointment({
    branch,
    patient: orthoPatient,
    professional: team.orthoProfessional,
    chairId: team.orthoChairId,
    specialtyId: specialties.ortho.id,
    treatmentPlanId: orthoPlan.treatmentPlan.id,
    title: "No asistió ortodoncia",
    reason: "Control ortodoncia",
    status: AppointmentStatus.NO_SHOW,
    startAt: demoDateAt(17, 40),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
  await createAppointment({
    branch,
    professional: team.orthoProfessional,
    chairId: team.urgentChairId,
    specialtyId: specialties.ortho.id,
    title: "Bloqueo administrativo",
    reason: "Bloqueo de sillón",
    status: AppointmentStatus.BLOCKED,
    startAt: demoDateAt(18, 20),
    durationMinutes: 40,
    createdBy: team.receptionist,
    note: "Bloqueo demo para validar disponibilidad."
  });
  await createAppointment({
    branch,
    patient: orthoPatient,
    professional: team.orthoProfessional,
    chairId: team.orthoChairId,
    specialtyId: specialties.ortho.id,
    treatmentPlanId: orthoPlan.treatmentPlan.id,
    title: "Control futuro ortodoncia",
    reason: "Control ortodoncia",
    status: AppointmentStatus.RESCHEDULED,
    startAt: demoDateAt(14, 20, 1),
    durationMinutes: 40,
    createdBy: team.receptionist
  });
}

async function main() {
  console.log("Iniciando seed FULLDEMO por sucursal...");

  const orgSlug = process.env.SEED_ORGANIZATION_SLUG ?? "dentalwarner";
  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug }
  });
  if (!organization) {
    throw new Error(`Organización no encontrada con slug: ${orgSlug}. Ejecuta primero el seed principal.`);
  }

  const branches = await prisma.branch.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      isActive: true,
      status: "ACTIVE"
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    select: {
      id: true,
      organizationId: true,
      name: true,
      code: true,
      city: true,
      state: true,
      agendaSlotMinutes: true,
      agendaStartHour: true,
      agendaEndHour: true
    }
  });

  if (!branches.length) {
    throw new Error("No hay sucursales activas para sembrar FULLDEMO.");
  }

  await cleanFullDemoData();
  const specialties = await ensureSpecialties(organization.id);
  const catalog = await ensureCatalog(organization.id, branches);
  const password = process.env.SEED_STAFF_PASSWORD ?? "Usuario123!";
  const passwordHash = await bcrypt.hash(password, 12);

  for (const [index, branch] of branches.entries()) {
    await seedBranchFlow(branch, index, specialties, catalog, passwordHash);
  }

  console.log("Seed FULLDEMO completada.");
  console.log(`Sucursales sembradas: ${branches.length}`);
  console.log(`Usuarios demo: recepcion.full.<sucursal>${FULL_DEMO_EMAIL_SUFFIX}`);
  console.log(`Contraseña demo: ${password}`);
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
