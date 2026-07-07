import {
  AppointmentStatus,
  BudgetStatus,
  CashMovementType,
  CashRegisterStatus,
  CurrencyCode,
  PaymentMethodType,
  PaymentStatus,
  Prisma,
  PrismaClient,
  ProcedureType,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus,
  TreatmentPriceSource
} from "@prisma/client";
import type { Branch, CashRegister, PaymentMethod, Procedure } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PATIENT_DOMAIN = "test-cases.patient.dentalwarner.local";
const PROFESSIONAL_DOMAIN = "test-cases.dentalwarner.local";
const APPOINTMENT_PREFIX = "[TEST]";
const SEED_PREFIX = "[TEST-TX]";
const PAYMENT_REF_PREFIX = "TEST-TX-";

type BranchSeed = Pick<Branch, "id" | "organizationId" | "name" | "code">;

const CATEGORY_SEEDS = {
  diagnostic: {
    name: `${SEED_PREFIX} Diagnostico`,
    description: "Catalogo de diagnostico para planes de tratamiento test.",
    sortOrder: 10
  },
  preventive: {
    name: `${SEED_PREFIX} Preventivo`,
    description: "Catalogo preventivo para planes de tratamiento test.",
    sortOrder: 20
  },
  operative: {
    name: `${SEED_PREFIX} Operatoria`,
    description: "Catalogo operatorio para planes de tratamiento test.",
    sortOrder: 30
  },
  endodontics: {
    name: `${SEED_PREFIX} Endodoncia`,
    description: "Catalogo endodontico para planes de tratamiento test.",
    sortOrder: 40
  },
  rehab: {
    name: `${SEED_PREFIX} Rehabilitacion`,
    description: "Catalogo rehabilitador para planes de tratamiento test.",
    sortOrder: 50
  },
  ortho: {
    name: `${SEED_PREFIX} Ortodoncia`,
    description: "Catalogo ortodontico para planes de tratamiento test.",
    sortOrder: 60
  }
} as const;

type CategoryKey = keyof typeof CATEGORY_SEEDS;

const PROCEDURE_SEEDS = [
  {
    code: "TEST-TX-CONS-GEN",
    categoryKey: "diagnostic",
    name: `${SEED_PREFIX} Consulta integral`,
    description: "Consulta inicial con diagnostico y planificacion.",
    defaultDuration: 40,
    price: 500
  },
  {
    code: "TEST-TX-PROF-GEN",
    categoryKey: "preventive",
    name: `${SEED_PREFIX} Profilaxis adultos`,
    description: "Limpieza dental integral para adulto.",
    defaultDuration: 40,
    price: 700
  },
  {
    code: "TEST-TX-RES-COMP",
    categoryKey: "operative",
    name: `${SEED_PREFIX} Resina compuesta`,
    description: "Restauracion con resina fotocurable.",
    defaultDuration: 40,
    price: 1200,
    requiresTooth: true,
    requiresSurface: true
  },
  {
    code: "TEST-TX-EXO-SIMPLE",
    categoryKey: "operative",
    name: `${SEED_PREFIX} Extraccion simple`,
    description: "Extraccion dental simple.",
    defaultDuration: 40,
    price: 1500,
    requiresTooth: true
  },
  {
    code: "TEST-TX-ENDO-MOLAR",
    categoryKey: "endodontics",
    name: `${SEED_PREFIX} Endodoncia molar`,
    description: "Tratamiento de conductos en molar.",
    defaultDuration: 60,
    price: 4500,
    requiresTooth: true
  },
  {
    code: "TEST-TX-COR-ZIR",
    categoryKey: "rehab",
    name: `${SEED_PREFIX} Corona zirconia`,
    description: "Corona de zirconia para rehabilitacion.",
    defaultDuration: 60,
    price: 6500,
    requiresTooth: true,
    requiresLab: true
  },
  {
    code: "TEST-TX-BRK-MET",
    categoryKey: "ortho",
    name: `${SEED_PREFIX} Brackets metalicos`,
    description: "Instalacion de brackets metalicos.",
    defaultDuration: 60,
    price: 18000
  },
  {
    code: "TEST-TX-CTRL-ORTO",
    categoryKey: "ortho",
    name: `${SEED_PREFIX} Control ortodoncia`,
    description: "Control mensual de ortodoncia.",
    defaultDuration: 30,
    price: 1200
  }
] as const;

type ProcedureCode = (typeof PROCEDURE_SEEDS)[number]["code"];

type AppointmentSeedRow = {
  id: string;
  organizationId: string;
  branchId: string;
  patientId: string | null;
  professionalId: string;
  startAt: Date;
  endAt: Date;
  createdById: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    specialties: Array<{ specialty: { name: string } }>;
  };
};

type TreatmentGroup = {
  key: string;
  appointments: AppointmentSeedRow[];
};

type CatalogContext = {
  procedures: Map<ProcedureCode, Procedure>;
  prices: Map<ProcedureCode, number>;
  paymentMethods: {
    cash: PaymentMethod;
    card: PaymentMethod;
    transfer: PaymentMethod;
  };
};

type ItemSeed = {
  procedureCode: ProcedureCode;
  status: TreatmentPlanItemStatus;
  quantity?: number;
  discount?: number;
  toothNumber?: string;
  surface?: string;
  notes: string;
};

type CreatedItem = {
  id: string;
  procedureName: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  status: TreatmentPlanItemStatus;
};

const PLAN_STATUSES: TreatmentPlanStatus[] = [
  TreatmentPlanStatus.DRAFT,
  TreatmentPlanStatus.PRESENTED,
  TreatmentPlanStatus.ACCEPTED,
  TreatmentPlanStatus.IN_PROGRESS,
  TreatmentPlanStatus.COMPLETED,
  TreatmentPlanStatus.CANCELLED,
  TreatmentPlanStatus.REJECTED
];

const BUDGET_STATUS_BY_PLAN: Record<TreatmentPlanStatus, BudgetStatus> = {
  [TreatmentPlanStatus.DRAFT]: BudgetStatus.DRAFT,
  [TreatmentPlanStatus.PRESENTED]: BudgetStatus.SENT,
  [TreatmentPlanStatus.ACCEPTED]: BudgetStatus.ACCEPTED,
  [TreatmentPlanStatus.IN_PROGRESS]: BudgetStatus.ACCEPTED,
  [TreatmentPlanStatus.COMPLETED]: BudgetStatus.ACCEPTED,
  [TreatmentPlanStatus.CANCELLED]: BudgetStatus.CANCELLED,
  [TreatmentPlanStatus.REJECTED]: BudgetStatus.REJECTED
};

const TEETH = ["16", "26", "36", "46", "11", "21", "24", "25", "14", "34"];
const SURFACES = ["O", "M", "D", "MO", "DO", "MOD"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const branches = await prisma.branch.findMany({
    where: { isActive: true, status: "ACTIVE", deletedAt: null },
    orderBy: [{ name: "asc" }],
    select: { id: true, organizationId: true, name: true, code: true }
  });

  if (!branches.length) throw new Error("No hay sucursales activas.");

  const testAppointmentCount = await prisma.appointment.count({
    where: {
      title: { startsWith: APPOINTMENT_PREFIX },
      status: { not: AppointmentStatus.BLOCKED },
      patientId: { not: null },
      patient: { email: { endsWith: `@${PATIENT_DOMAIN}` }, deletedAt: null },
      professional: { email: { endsWith: `@${PROFESSIONAL_DOMAIN}` } }
    }
  });

  if (!testAppointmentCount) {
    throw new Error("No hay citas [TEST] con pacientes. Ejecuta primero prisma:seed:test-cases.");
  }

  if (dryRun) {
    const treatmentGroups = await countTreatmentGroups();
    console.log(
      "Dry Run Plan:",
      JSON.stringify({ branches: branches.length, testAppointmentCount, treatmentGroups }, null, 2)
    );
    return;
  }

  console.log("Limpiando datos previos [TEST-TX]...");
  await cleanupGeneratedTreatmentData();

  const catalogByOrganization = new Map<string, CatalogContext>();
  for (const organizationId of [...new Set(branches.map((branch) => branch.organizationId))]) {
    catalogByOrganization.set(organizationId, await ensureCatalog(organizationId));
  }

  const totals = {
    branches: 0,
    treatmentPlans: 0,
    sections: 0,
    items: 0,
    budgets: 0,
    payments: 0,
    allocations: 0,
    linkedAppointments: 0,
    cashRegisters: 0
  };

  for (const branch of branches) {
    const catalog = catalogByOrganization.get(branch.organizationId);
    if (!catalog) throw new Error(`Catalogo no encontrado para organizacion ${branch.organizationId}`);

    const branchTotals = await seedBranchTreatmentPlans(branch, catalog);
    totals.branches += branchTotals.treatmentPlans > 0 ? 1 : 0;
    totals.treatmentPlans += branchTotals.treatmentPlans;
    totals.sections += branchTotals.sections;
    totals.items += branchTotals.items;
    totals.budgets += branchTotals.budgets;
    totals.payments += branchTotals.payments;
    totals.allocations += branchTotals.allocations;
    totals.linkedAppointments += branchTotals.linkedAppointments;
    totals.cashRegisters += branchTotals.cashRegisters;

    console.log(
      `Sucursal ${branch.name}: ${branchTotals.treatmentPlans} planes, ${branchTotals.items} items, ${branchTotals.linkedAppointments} citas vinculadas.`
    );
  }

  const validation = await collectValidation();
  console.log("Seed [TEST-TX] completado:", JSON.stringify({ totals, validation }, null, 2));
}

async function cleanupGeneratedTreatmentData() {
  const planIds = (
    await prisma.treatmentPlan.findMany({
      where: { name: { startsWith: SEED_PREFIX } },
      select: { id: true }
    })
  ).map((plan) => plan.id);

  const cashRegisterIds = (
    await prisma.cashRegister.findMany({
      where: {
        movements: {
          some: { description: { startsWith: SEED_PREFIX } }
        }
      },
      select: { id: true }
    })
  ).map((register) => register.id);

  if (planIds.length) {
    await prisma.appointment.updateMany({
      where: { treatmentPlanId: { in: planIds } },
      data: { treatmentPlanId: null }
    });
    await prisma.paymentAllocation.deleteMany({
      where: {
        treatmentPlanItem: {
          treatmentPlanId: { in: planIds }
        }
      }
    });
    await prisma.budget.deleteMany({
      where: { treatmentPlanId: { in: planIds } }
    });
  }

  await prisma.payment.deleteMany({
    where: {
      OR: [{ reference: { startsWith: PAYMENT_REF_PREFIX } }, { notes: { startsWith: SEED_PREFIX } }]
    }
  });

  if (cashRegisterIds.length) {
    await prisma.cashRegister.deleteMany({
      where: { id: { in: cashRegisterIds } }
    });
  }

  if (planIds.length) {
    await prisma.treatmentPlan.deleteMany({
      where: { id: { in: planIds } }
    });
  }
}

async function ensureCatalog(organizationId: string): Promise<CatalogContext> {
  const categoryByKey = new Map<CategoryKey, string>();
  for (const [key, categorySeed] of Object.entries(CATEGORY_SEEDS) as Array<
    [CategoryKey, (typeof CATEGORY_SEEDS)[CategoryKey]]
  >) {
    const category = await prisma.procedureCategory.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: categorySeed.name
        }
      },
      update: {
        description: categorySeed.description,
        type: ProcedureType.CLINICAL,
        sortOrder: categorySeed.sortOrder,
        isActive: true
      },
      create: {
        organizationId,
        name: categorySeed.name,
        description: categorySeed.description,
        type: ProcedureType.CLINICAL,
        sortOrder: categorySeed.sortOrder,
        isActive: true
      }
    });
    categoryByKey.set(key, category.id);
  }

  const maxDisplayId = await prisma.procedure.aggregate({
    where: { organizationId },
    _max: { displayId: true }
  });
  let nextDisplayId = Math.max(maxDisplayId._max.displayId ?? 0, 9100);

  const procedures = new Map<ProcedureCode, Procedure>();
  const prices = new Map<ProcedureCode, number>();
  for (const procedureSeed of PROCEDURE_SEEDS) {
    const categoryId = categoryByKey.get(procedureSeed.categoryKey);
    if (!categoryId) throw new Error(`Categoria no encontrada para ${procedureSeed.code}`);

    const existing = await prisma.procedure.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: procedureSeed.code
        }
      }
    });

    const data = {
      categoryId,
      name: procedureSeed.name,
      description: procedureSeed.description,
      type: ProcedureType.CLINICAL,
      defaultDuration: procedureSeed.defaultDuration,
      requiresTooth: procedureSeed.requiresTooth ?? false,
      requiresSurface: procedureSeed.requiresSurface ?? false,
      requiresLab: procedureSeed.requiresLab ?? false,
      isActive: true
    };

    const procedure = existing
      ? await prisma.procedure.update({ where: { id: existing.id }, data })
      : await prisma.procedure.create({
          data: {
            organizationId,
            displayId: ++nextDisplayId,
            code: procedureSeed.code,
            ...data
          }
        });

    procedures.set(procedureSeed.code, procedure);
    prices.set(procedureSeed.code, procedureSeed.price);
  }

  return {
    procedures,
    prices,
    paymentMethods: {
      cash: await ensurePaymentMethod(
        organizationId,
        `${APPOINTMENT_PREFIX} Efectivo`,
        PaymentMethodType.CASH
      ),
      card: await ensurePaymentMethod(
        organizationId,
        `${APPOINTMENT_PREFIX} Tarjeta`,
        PaymentMethodType.CARD
      ),
      transfer: await ensurePaymentMethod(
        organizationId,
        `${APPOINTMENT_PREFIX} Transferencia`,
        PaymentMethodType.TRANSFER
      )
    }
  };
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

async function seedBranchTreatmentPlans(branch: BranchSeed, catalog: CatalogContext) {
  const appointments = await prisma.appointment.findMany({
    where: {
      branchId: branch.id,
      title: { startsWith: APPOINTMENT_PREFIX },
      status: { not: AppointmentStatus.BLOCKED },
      patientId: { not: null },
      patient: { email: { endsWith: `@${PATIENT_DOMAIN}` }, deletedAt: null },
      professional: { email: { endsWith: `@${PROFESSIONAL_DOMAIN}` } }
    },
    select: {
      id: true,
      organizationId: true,
      branchId: true,
      patientId: true,
      professionalId: true,
      startAt: true,
      endAt: true,
      createdById: true,
      patient: { select: { id: true, firstName: true, lastName: true, email: true } },
      professional: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          specialties: { select: { specialty: { select: { name: true } } } }
        }
      }
    },
    orderBy: [{ patientId: "asc" }, { professionalId: "asc" }, { startAt: "asc" }]
  });

  const groups = groupAppointments(appointments);
  if (!groups.length) {
    return emptyBranchTotals();
  }

  const openedById = groups[0].appointments[0].createdById;
  const cashRegister = await createCashRegister(branch, openedById);
  const totals = { ...emptyBranchTotals(), cashRegisters: 1 };

  for (const [index, group] of groups.entries()) {
    const result = await createTreatmentGroup({
      branch,
      catalog,
      group,
      cashRegister,
      planIndex: index
    });
    totals.treatmentPlans += 1;
    totals.sections += result.sections;
    totals.items += result.items;
    totals.budgets += result.budgets;
    totals.payments += result.payments;
    totals.allocations += result.allocations;
    totals.linkedAppointments += result.linkedAppointments;
  }

  return totals;
}

function groupAppointments(appointments: AppointmentSeedRow[]): TreatmentGroup[] {
  const groups = new Map<string, TreatmentGroup>();
  for (const appointment of appointments) {
    if (!appointment.patientId || !appointment.patient) continue;
    const key = `${appointment.branchId}:${appointment.patientId}:${appointment.professionalId}`;
    const current = groups.get(key) ?? { key, appointments: [] };
    current.appointments.push(appointment);
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) => {
    const leftFirst = left.appointments[0];
    const rightFirst = right.appointments[0];
    return `${leftFirst.patient?.lastName ?? ""}-${leftFirst.professional.email ?? ""}`.localeCompare(
      `${rightFirst.patient?.lastName ?? ""}-${rightFirst.professional.email ?? ""}`
    );
  });
}

async function createCashRegister(branch: BranchSeed, openedById: string) {
  const openedAt = seedPastDate(0, 8, 0);
  const register = await prisma.cashRegister.create({
    data: {
      organizationId: branch.organizationId,
      branchId: branch.id,
      openedById,
      openingAmount: decimal(0),
      status: CashRegisterStatus.OPEN,
      openedAt
    }
  });

  await prisma.cashMovement.create({
    data: {
      cashRegisterId: register.id,
      type: CashMovementType.OPENING,
      amount: decimal(0),
      description: `${SEED_PREFIX} Apertura caja seed`,
      createdById: openedById,
      createdAt: openedAt
    }
  });

  return register;
}

async function createTreatmentGroup(input: {
  branch: BranchSeed;
  catalog: CatalogContext;
  group: TreatmentGroup;
  cashRegister: CashRegister;
  planIndex: number;
}) {
  const first = input.group.appointments[0];
  const patient = first.patient;
  if (!first.patientId || !patient) throw new Error(`Grupo sin paciente: ${input.group.key}`);

  const planStatus = PLAN_STATUSES[input.planIndex % PLAN_STATUSES.length];
  const isOrtho = isOrthodontics(first.professional);
  const itemSeeds = buildItemSeeds(planStatus, isOrtho, input.planIndex);
  const acceptedAt = planAcceptedAt(planStatus, input.planIndex);
  const completedAt =
    planStatus === TreatmentPlanStatus.COMPLETED ? seedPastDate(input.planIndex, 17, 0) : null;
  const planName =
    `${SEED_PREFIX} ${isOrtho ? "Ortodoncia" : "Integral"} ${patient.firstName} ${patient.lastName}`.slice(
      0,
      180
    );
  const appointmentIds = input.group.appointments.map((appointment) => appointment.id);

  return prisma.$transaction(async (tx) => {
    const treatmentPlan = await tx.treatmentPlan.create({
      data: {
        organizationId: input.branch.organizationId,
        branchId: input.branch.id,
        patientId: patient.id,
        professionalId: first.professionalId,
        name: planName,
        description: `${SEED_PREFIX} Plan generado desde agenda densa. Citas vinculadas: ${appointmentIds.length}.`,
        status: planStatus,
        isAlternative: false,
        acceptedAt,
        completedAt
      }
    });

    const section = await tx.treatmentPlanSection.create({
      data: {
        treatmentPlanId: treatmentPlan.id,
        name: "Tratamiento principal",
        sortOrder: 1
      }
    });

    const createdItems: CreatedItem[] = [];
    for (const [itemIndex, itemSeed] of itemSeeds.entries()) {
      const created = await createTreatmentItem({
        tx,
        catalog: input.catalog,
        treatmentPlanId: treatmentPlan.id,
        sectionId: section.id,
        itemSeed,
        planIndex: input.planIndex,
        itemIndex
      });
      createdItems.push(created);
    }

    const budget = await createBudget({
      tx,
      organizationId: input.branch.organizationId,
      treatmentPlanId: treatmentPlan.id,
      patientId: patient.id,
      professionalId: first.professionalId,
      planStatus,
      items: createdItems,
      planIndex: input.planIndex
    });

    const paymentTotals = await createPaymentsForItems({
      tx,
      branch: input.branch,
      patientId: patient.id,
      receivedById: first.createdById,
      cashRegisterId: input.cashRegister.id,
      catalog: input.catalog,
      items: createdItems,
      planIndex: input.planIndex
    });

    await tx.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: { treatmentPlanId: treatmentPlan.id }
    });

    return {
      sections: 1,
      items: createdItems.length,
      budgets: budget ? 1 : 0,
      payments: paymentTotals.payments,
      allocations: paymentTotals.allocations,
      linkedAppointments: appointmentIds.length
    };
  });
}

async function createTreatmentItem(input: {
  tx: Prisma.TransactionClient;
  catalog: CatalogContext;
  treatmentPlanId: string;
  sectionId: string;
  itemSeed: ItemSeed;
  planIndex: number;
  itemIndex: number;
}): Promise<CreatedItem> {
  const procedure = input.catalog.procedures.get(input.itemSeed.procedureCode);
  const procedureSeed = PROCEDURE_SEEDS.find((seed) => seed.code === input.itemSeed.procedureCode);
  if (!procedure || !procedureSeed)
    throw new Error(`Procedimiento no encontrado: ${input.itemSeed.procedureCode}`);

  const quantity = input.itemSeed.quantity ?? 1;
  const unitPrice = input.catalog.prices.get(input.itemSeed.procedureCode) ?? 0;
  const discount = input.itemSeed.discount ?? 0;
  const total = roundMoney(quantity * unitPrice - discount);
  const completedAt =
    input.itemSeed.status === TreatmentPlanItemStatus.COMPLETED
      ? seedPastDate(input.planIndex + input.itemIndex, 16, 30)
      : null;

  const item = await input.tx.treatmentPlanItem.create({
    data: {
      treatmentPlanId: input.treatmentPlanId,
      sectionId: input.sectionId,
      procedureId: procedure.id,
      toothNumber:
        input.itemSeed.toothNumber ??
        toothFor(input.planIndex + input.itemIndex, procedureSeed.requiresTooth ?? false),
      surface:
        input.itemSeed.surface ??
        surfaceFor(input.planIndex + input.itemIndex, procedureSeed.requiresSurface ?? false),
      quantity: decimal(quantity),
      unitPrice: decimal(unitPrice),
      discount: decimal(discount),
      total: decimal(total),
      status: input.itemSeed.status,
      priceSource: TreatmentPriceSource.MANUAL,
      priceSnapshotName: procedure.name,
      priceSnapshotCode: procedure.code,
      priceSnapshotCategory: CATEGORY_SEEDS[procedureSeed.categoryKey].name,
      priceResolvedAt: new Date(),
      notes: `${SEED_PREFIX} ${input.itemSeed.notes}`,
      plannedAt: seedPastDate(input.planIndex + input.itemIndex, 9, 30),
      completedAt
    }
  });

  return {
    id: item.id,
    procedureName: procedure.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    total: item.total,
    status: item.status
  };
}

async function createBudget(input: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  treatmentPlanId: string;
  patientId: string;
  professionalId: string;
  planStatus: TreatmentPlanStatus;
  items: CreatedItem[];
  planIndex: number;
}) {
  const subtotal = roundMoney(input.items.reduce((sum, item) => sum + Number(item.total), 0));
  const status = BUDGET_STATUS_BY_PLAN[input.planStatus];
  const sentAt =
    status === BudgetStatus.SENT || status === BudgetStatus.ACCEPTED || status === BudgetStatus.REJECTED
      ? seedPastDate(input.planIndex, 10, 0)
      : null;
  const acceptedAt = status === BudgetStatus.ACCEPTED ? seedPastDate(input.planIndex, 11, 0) : null;
  const rejectedAt = status === BudgetStatus.REJECTED ? seedPastDate(input.planIndex, 11, 30) : null;

  const budget = await input.tx.budget.create({
    data: {
      treatmentPlanId: input.treatmentPlanId,
      patientId: input.patientId,
      professionalId: input.professionalId,
      organizationId: input.organizationId,
      subtotal: decimal(subtotal),
      discountTotal: decimal(0),
      total: decimal(subtotal),
      status,
      expiresAt: addDays(new Date(), 15),
      notes: `${SEED_PREFIX} Presupuesto generado para test cases.`,
      sentAt,
      acceptedAt,
      rejectedAt
    }
  });

  for (const item of input.items) {
    await input.tx.budgetItem.create({
      data: {
        budgetId: budget.id,
        treatmentPlanItemId: item.id,
        description: item.procedureName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total
      }
    });
  }

  return budget;
}

async function createPaymentsForItems(input: {
  tx: Prisma.TransactionClient;
  branch: BranchSeed;
  patientId: string;
  receivedById: string;
  cashRegisterId: string;
  catalog: CatalogContext;
  items: CreatedItem[];
  planIndex: number;
}) {
  let payments = 0;
  let allocations = 0;

  for (const [itemIndex, item] of input.items.entries()) {
    const amount = paymentAmountForItem(item, input.planIndex + itemIndex);
    if (amount <= 0) continue;

    const paymentMethod = paymentMethodFor(input.catalog.paymentMethods, input.planIndex + itemIndex);
    const paidAt = seedPastDate(input.planIndex + itemIndex, 12, 15);
    const reference = `${PAYMENT_REF_PREFIX}${branchToken(input.branch)}-${String(input.planIndex + 1).padStart(4, "0")}-${String(
      itemIndex + 1
    ).padStart(2, "0")}`;

    const payment = await input.tx.payment.create({
      data: {
        organizationId: input.branch.organizationId,
        branchId: input.branch.id,
        patientId: input.patientId,
        receivedById: input.receivedById,
        amount: decimal(amount),
        currency: CurrencyCode.MXN,
        paymentMethodId: paymentMethod.id,
        status: PaymentStatus.ALLOCATED,
        reference,
        notes: `${SEED_PREFIX} Pago seed para plan de tratamiento.`,
        paidAt
      }
    });

    await input.tx.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        treatmentPlanItemId: item.id,
        amount: decimal(amount)
      }
    });

    await input.tx.cashMovement.create({
      data: {
        cashRegisterId: input.cashRegisterId,
        type: CashMovementType.INCOME,
        amount: decimal(amount),
        paymentId: payment.id,
        description: `${SEED_PREFIX} ${reference}`,
        createdById: input.receivedById,
        createdAt: paidAt
      }
    });

    payments += 1;
    allocations += 1;
  }

  return { payments, allocations };
}

function buildItemSeeds(planStatus: TreatmentPlanStatus, isOrtho: boolean, seed: number): ItemSeed[] {
  if (isOrtho) {
    if (planStatus === TreatmentPlanStatus.DRAFT) {
      return [
        {
          procedureCode: "TEST-TX-CONS-GEN",
          status: TreatmentPlanItemStatus.PLANNED,
          notes: "Diagnostico de ortodoncia"
        }
      ];
    }
    if (planStatus === TreatmentPlanStatus.PRESENTED) {
      return [
        {
          procedureCode: "TEST-TX-CONS-GEN",
          status: TreatmentPlanItemStatus.ACCEPTED,
          notes: "Consulta aceptada"
        },
        {
          procedureCode: "TEST-TX-BRK-MET",
          status: TreatmentPlanItemStatus.PLANNED,
          notes: "Brackets propuestos"
        }
      ];
    }
    if (planStatus === TreatmentPlanStatus.ACCEPTED) {
      return [
        {
          procedureCode: "TEST-TX-BRK-MET",
          status: TreatmentPlanItemStatus.ACCEPTED,
          notes: "Inicio de brackets aceptado"
        },
        {
          procedureCode: "TEST-TX-CTRL-ORTO",
          quantity: 2,
          status: TreatmentPlanItemStatus.PLANNED,
          notes: "Controles planeados"
        }
      ];
    }
    if (planStatus === TreatmentPlanStatus.IN_PROGRESS) {
      return [
        {
          procedureCode: "TEST-TX-BRK-MET",
          status: TreatmentPlanItemStatus.PAID,
          notes: "Brackets pagados, pendiente finalizacion"
        },
        {
          procedureCode: "TEST-TX-CTRL-ORTO",
          status: TreatmentPlanItemStatus.IN_PROGRESS,
          notes: "Control en proceso"
        }
      ];
    }
    if (planStatus === TreatmentPlanStatus.COMPLETED) {
      return [
        {
          procedureCode: "TEST-TX-BRK-MET",
          status: TreatmentPlanItemStatus.COMPLETED,
          notes: "Brackets completados"
        },
        {
          procedureCode: "TEST-TX-CTRL-ORTO",
          status: TreatmentPlanItemStatus.COMPLETED,
          notes: "Control completado"
        }
      ];
    }
    if (planStatus === TreatmentPlanStatus.CANCELLED) {
      return [
        {
          procedureCode: "TEST-TX-BRK-MET",
          status: TreatmentPlanItemStatus.CANCELLED,
          notes: "Tratamiento cancelado"
        }
      ];
    }
    return [
      {
        procedureCode: "TEST-TX-CONS-GEN",
        status: TreatmentPlanItemStatus.PLANNED,
        notes: "Propuesta rechazada"
      },
      {
        procedureCode: "TEST-TX-CTRL-ORTO",
        status: TreatmentPlanItemStatus.CANCELLED,
        notes: "Control cancelado por rechazo"
      }
    ];
  }

  const restorativeCode: ProcedureCode =
    seed % 3 === 0 ? "TEST-TX-RES-COMP" : seed % 3 === 1 ? "TEST-TX-ENDO-MOLAR" : "TEST-TX-COR-ZIR";
  if (planStatus === TreatmentPlanStatus.DRAFT) {
    return [
      {
        procedureCode: "TEST-TX-CONS-GEN",
        status: TreatmentPlanItemStatus.PLANNED,
        notes: "Consulta de diagnostico"
      },
      {
        procedureCode: "TEST-TX-PROF-GEN",
        status: TreatmentPlanItemStatus.PLANNED,
        notes: "Profilaxis planeada"
      }
    ];
  }
  if (planStatus === TreatmentPlanStatus.PRESENTED) {
    return [
      {
        procedureCode: "TEST-TX-CONS-GEN",
        status: TreatmentPlanItemStatus.ACCEPTED,
        notes: "Consulta aceptada"
      },
      {
        procedureCode: restorativeCode,
        status: TreatmentPlanItemStatus.PLANNED,
        notes: "Procedimiento presentado"
      }
    ];
  }
  if (planStatus === TreatmentPlanStatus.ACCEPTED) {
    return [
      {
        procedureCode: "TEST-TX-PROF-GEN",
        status: TreatmentPlanItemStatus.ACCEPTED,
        notes: "Profilaxis aceptada"
      },
      {
        procedureCode: restorativeCode,
        status: TreatmentPlanItemStatus.PLANNED,
        notes: "Restauracion pendiente"
      }
    ];
  }
  if (planStatus === TreatmentPlanStatus.IN_PROGRESS) {
    return [
      { procedureCode: "TEST-TX-PROF-GEN", status: TreatmentPlanItemStatus.PAID, notes: "Profilaxis pagada" },
      {
        procedureCode: restorativeCode,
        status: TreatmentPlanItemStatus.IN_PROGRESS,
        notes: "Procedimiento en proceso"
      }
    ];
  }
  if (planStatus === TreatmentPlanStatus.COMPLETED) {
    return [
      {
        procedureCode: "TEST-TX-PROF-GEN",
        status: TreatmentPlanItemStatus.COMPLETED,
        notes: "Profilaxis completada"
      },
      {
        procedureCode: restorativeCode,
        status: TreatmentPlanItemStatus.COMPLETED,
        notes: "Procedimiento completado"
      }
    ];
  }
  if (planStatus === TreatmentPlanStatus.CANCELLED) {
    return [
      {
        procedureCode: "TEST-TX-CONS-GEN",
        status: TreatmentPlanItemStatus.CANCELLED,
        notes: "Consulta cancelada"
      },
      {
        procedureCode: restorativeCode,
        status: TreatmentPlanItemStatus.CANCELLED,
        notes: "Procedimiento cancelado"
      }
    ];
  }
  return [
    {
      procedureCode: "TEST-TX-CONS-GEN",
      status: TreatmentPlanItemStatus.PLANNED,
      notes: "Propuesta rechazada"
    },
    {
      procedureCode: "TEST-TX-EXO-SIMPLE",
      status: TreatmentPlanItemStatus.CANCELLED,
      notes: "Procedimiento cancelado por rechazo"
    }
  ];
}

function paymentAmountForItem(item: CreatedItem, seed: number) {
  const total = Number(item.total);
  if (item.status === TreatmentPlanItemStatus.COMPLETED || item.status === TreatmentPlanItemStatus.PAID)
    return total;
  if (item.status === TreatmentPlanItemStatus.IN_PROGRESS && seed % 3 === 0) return roundMoney(total * 0.5);
  if (item.status === TreatmentPlanItemStatus.ACCEPTED && seed % 5 === 0) return roundMoney(total * 0.3);
  return 0;
}

function paymentMethodFor(methods: CatalogContext["paymentMethods"], seed: number) {
  const values = [methods.cash, methods.card, methods.transfer];
  return values[seed % values.length];
}

function isOrthodontics(professional: AppointmentSeedRow["professional"]) {
  return professional.specialties.some((entry) => normalizeText(entry.specialty.name).includes("ortodoncia"));
}

function planAcceptedAt(status: TreatmentPlanStatus, seed: number) {
  if (
    status === TreatmentPlanStatus.ACCEPTED ||
    status === TreatmentPlanStatus.IN_PROGRESS ||
    status === TreatmentPlanStatus.COMPLETED
  ) {
    return seedPastDate(seed, 10, 30);
  }
  return null;
}

function toothFor(seed: number, required: boolean) {
  if (!required) return null;
  return TEETH[seed % TEETH.length];
}

function surfaceFor(seed: number, required: boolean) {
  if (!required) return null;
  return SURFACES[seed % SURFACES.length];
}

function decimal(value: number) {
  return new Prisma.Decimal(roundMoney(value).toFixed(2));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function seedPastDate(seed: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() - (seed % 10));
  date.setHours(hour, minute, 0, 0);
  return date;
}

function branchToken(branch: BranchSeed) {
  return (
    normalizeText(branch.code || branch.name)
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 24) || branch.id.slice(-8)
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function emptyBranchTotals() {
  return {
    treatmentPlans: 0,
    sections: 0,
    items: 0,
    budgets: 0,
    payments: 0,
    allocations: 0,
    linkedAppointments: 0,
    cashRegisters: 0
  };
}

async function countTreatmentGroups() {
  const appointments = await prisma.appointment.findMany({
    where: {
      title: { startsWith: APPOINTMENT_PREFIX },
      status: { not: AppointmentStatus.BLOCKED },
      patientId: { not: null },
      patient: { email: { endsWith: `@${PATIENT_DOMAIN}` }, deletedAt: null },
      professional: { email: { endsWith: `@${PROFESSIONAL_DOMAIN}` } }
    },
    select: { branchId: true, patientId: true, professionalId: true }
  });
  return new Set(
    appointments.map(
      (appointment) => `${appointment.branchId}:${appointment.patientId}:${appointment.professionalId}`
    )
  ).size;
}

async function collectValidation() {
  const [
    patients,
    appointments,
    nonBlockedAppointments,
    linkedAppointments,
    plans,
    sections,
    items,
    budgets,
    payments,
    allocations
  ] = await Promise.all([
    prisma.patient.count({ where: { email: { endsWith: `@${PATIENT_DOMAIN}` }, deletedAt: null } }),
    prisma.appointment.count({ where: { title: { startsWith: APPOINTMENT_PREFIX } } }),
    prisma.appointment.count({
      where: {
        title: { startsWith: APPOINTMENT_PREFIX },
        status: { not: AppointmentStatus.BLOCKED },
        patientId: { not: null },
        patient: { email: { endsWith: `@${PATIENT_DOMAIN}` }, deletedAt: null }
      }
    }),
    prisma.appointment.count({
      where: {
        title: { startsWith: APPOINTMENT_PREFIX },
        status: { not: AppointmentStatus.BLOCKED },
        treatmentPlan: { name: { startsWith: SEED_PREFIX } }
      }
    }),
    prisma.treatmentPlan.count({ where: { name: { startsWith: SEED_PREFIX } } }),
    prisma.treatmentPlanSection.count({ where: { treatmentPlan: { name: { startsWith: SEED_PREFIX } } } }),
    prisma.treatmentPlanItem.count({ where: { treatmentPlan: { name: { startsWith: SEED_PREFIX } } } }),
    prisma.budget.count({ where: { treatmentPlan: { name: { startsWith: SEED_PREFIX } } } }),
    prisma.payment.count({ where: { notes: { startsWith: SEED_PREFIX } } }),
    prisma.paymentAllocation.count({
      where: { treatmentPlanItem: { treatmentPlan: { name: { startsWith: SEED_PREFIX } } } }
    })
  ]);

  const completedItems = await prisma.treatmentPlanItem.findMany({
    where: {
      treatmentPlan: { name: { startsWith: SEED_PREFIX } },
      status: TreatmentPlanItemStatus.COMPLETED
    },
    select: {
      total: true,
      paymentAllocations: {
        where: {
          payment: {
            status: {
              in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED]
            }
          }
        },
        select: { amount: true }
      }
    }
  });
  const payrollReadyItems = completedItems.filter((item) => {
    const paid = item.paymentAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    return roundMoney(paid) >= Number(item.total);
  }).length;

  return {
    patients,
    appointments,
    nonBlockedAppointments,
    linkedAppointments,
    plans,
    sections,
    items,
    budgets,
    payments,
    allocations,
    payrollReadyItems
  };
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
