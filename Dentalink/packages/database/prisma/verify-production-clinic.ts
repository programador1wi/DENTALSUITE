import { PrismaClient } from "@prisma/client";

const SCENARIO = "SEED_PRODUCTION_CLINIC_2026";
const EXCLUDED_APPOINTMENT_STATUSES = [
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "CANCELLED_CONFLICT",
  "CANCELLED_RESCHEDULED",
  "NO_SHOW",
  "RESCHEDULED"
];

export async function verifyProductionClinic(prisma: PrismaClient | any, organizationId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfCoverage = new Date(startOfToday);
  endOfCoverage.setDate(endOfCoverage.getDate() + 31);
  const activeBranches = await prisma.branch.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true }
  });
  const patients = await prisma.patient.findMany({
    where: { organizationId, source: SCENARIO },
    select: { id: true, branchId: true }
  });
  if (patients.length < 60) throw new Error(`Expected at least 60 production-clinic patients; found ${patients.length}.`);

  const patientIds = patients.map((patient: { id: string }) => patient.id);
  const [plans, payments, appointments, inventoryItems, labs, surveys, campaigns, patientCoverage, agendaCoverage, professionalCoverage, paymentCoverage, labCoverage, inventoryCoverage, cashCoverage] = await Promise.all([
    prisma.treatmentPlan.findMany({
      where: { patientId: { in: patientIds }, name: { startsWith: "Plan SEED_PRODUCTION_CLINIC_2026" } },
      include: { patient: true, professional: true, items: { include: { paymentAllocations: true } } }
    }),
    prisma.payment.findMany({
      where: { organizationId, paymentNumber: { gte: 900_000, lte: 900_100 } },
      include: { allocations: true, splits: true, cashMovements: true, patient: true }
    }),
    prisma.appointment.findMany({
      where: { patientId: { in: patientIds } },
      select: { id: true, professionalId: true, chairId: true, startAt: true, endAt: true, status: true }
    }),
    prisma.inventoryItem.count({ where: { organizationId, sku: { startsWith: "SEED-" } } }),
    prisma.labOrder.count({ where: { organizationId, patientId: { in: patientIds } } }),
    prisma.surveyDefinition.count({ where: { organizationId, name: "Satisfacción posterior a consulta" } }),
    prisma.emailCampaign.count({ where: { organizationId, idempotencyKey: "seed-campaign-2026" } }),
    prisma.patient.groupBy({
      by: ["branchId"],
      where: { organizationId, source: SCENARIO },
      _count: { _all: true }
    }),
    prisma.appointment.groupBy({
      by: ["branchId"],
      where: { organizationId, patientId: { in: patientIds }, startAt: { gte: startOfToday, lt: endOfCoverage } },
      _count: { _all: true }
    }),
    prisma.professionalBranch.findMany({
      where: {
        branchId: { in: activeBranches.map((branch: { id: string }) => branch.id) },
        status: "ACTIVE",
        professional: { user: { email: { startsWith: "seed.coverage." } } }
      },
      select: { branchId: true }
    }),
    prisma.payment.groupBy({
      by: ["branchId"],
      where: { organizationId, patientId: { in: patientIds } },
      _count: { _all: true }
    }),
    prisma.labOrder.findMany({
      where: { organizationId, patientId: { in: patientIds } },
      select: { patient: { select: { branchId: true } } }
    }),
    prisma.inventoryItem.groupBy({
      by: ["branchId"],
      where: { organizationId, sku: { startsWith: "SEED-" } },
      _count: { _all: true }
    }),
    prisma.cashRegister.groupBy({
      by: ["branchId"],
      where: { organizationId },
      _count: { _all: true }
    })
  ]);

  const failures: string[] = [];
  const patientCountByBranch = new Map(patientCoverage.map((row: any) => [row.branchId, row._count._all]));
  const agendaCountByBranch = new Map(agendaCoverage.map((row: any) => [row.branchId, row._count._all]));
  const professionalBranches = new Set(professionalCoverage.map((row: any) => row.branchId));
  const planBranches = new Set(plans.map((plan: any) => plan.branchId));
  const paymentCountByBranch = new Map(paymentCoverage.map((row: any) => [row.branchId, row._count._all]));
  const labBranches = new Set(labCoverage.map((row: any) => row.patient.branchId));
  const inventoryCountByBranch = new Map(inventoryCoverage.map((row: any) => [row.branchId, row._count._all]));
  const cashCountByBranch = new Map(cashCoverage.map((row: any) => [row.branchId, row._count._all]));
  for (const branch of activeBranches) {
    if ((patientCountByBranch.get(branch.id) ?? 0) < 8)
      failures.push(`Branch ${branch.name} does not have eight seeded patients.`);
    if (!professionalBranches.has(branch.id))
      failures.push(`Branch ${branch.name} does not have its dedicated active coverage professional.`);
    if (!(agendaCountByBranch.get(branch.id) ?? 0))
      failures.push(`Branch ${branch.name} does not have seeded agenda coverage for the next 30 days.`);
    if (!planBranches.has(branch.id))
      failures.push(`Branch ${branch.name} does not have a seeded treatment plan.`);
    if (!(paymentCountByBranch.get(branch.id) ?? 0))
      failures.push(`Branch ${branch.name} does not have a seeded payment.`);
    if (!labBranches.has(branch.id))
      failures.push(`Branch ${branch.name} does not have a seeded laboratory order.`);
    if ((inventoryCountByBranch.get(branch.id) ?? 0) < 4)
      failures.push(`Branch ${branch.name} does not have its complete seeded inventory.`);
    if (!(cashCountByBranch.get(branch.id) ?? 0))
      failures.push(`Branch ${branch.name} does not have a seeded cash-register session.`);
  }
  for (const plan of plans) {
    if (plan.patient.organizationId !== organizationId || plan.professional.organizationId !== organizationId)
      failures.push(`Treatment plan ${plan.id} crosses organization scope.`);
    for (const item of plan.items) {
      const allocated = item.paymentAllocations.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
      if (allocated - Number(item.total) > 0.01) failures.push(`Item ${item.id} is over-allocated.`);
    }
  }
  for (const payment of payments) {
    const allocated = payment.allocations.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
    const splitTotal = payment.splits.reduce((sum: number, row: any) => sum + Number(row.amount), 0);
    if (allocated - Number(payment.amount) > 0.01) failures.push(`Payment ${payment.id} allocates more than received.`);
    if (payment.splits.length && Math.abs(splitTotal - Number(payment.amount)) > 0.01)
      failures.push(`Payment ${payment.id} has splits that do not equal its amount.`);
    if (!payment.cashMovements.length) failures.push(`Payment ${payment.id} is missing its cash movement.`);
  }

  const schedulable = appointments
    .filter((appointment: any) => !EXCLUDED_APPOINTMENT_STATUSES.includes(appointment.status))
    .sort((a: any, b: any) => a.startAt.getTime() - b.startAt.getTime());
  for (let left = 0; left < schedulable.length; left++) {
    for (let right = left + 1; right < schedulable.length && schedulable[right].startAt < schedulable[left].endAt; right++) {
      const a = schedulable[left];
      const b = schedulable[right];
      if (a.professionalId === b.professionalId || (a.chairId && a.chairId === b.chairId))
        failures.push(`Agenda overlap between ${a.id} and ${b.id}.`);
    }
  }

  const ledger = await prisma.patientLedgerEntry.findMany({
    where: { organizationId, patientId: { in: patientIds } },
    select: { entryType: true, debitAmount: true, creditAmount: true }
  });
  const ledgerTotals = ledger.reduce(
    (totals: { debit: number; credit: number }, entry: any) => ({
      debit: totals.debit + Number(entry.debitAmount),
      credit: totals.credit + Number(entry.creditAmount)
    }),
    { debit: 0, credit: 0 }
  );
  if (!ledger.length || ledgerTotals.debit <= 0 || ledgerTotals.credit <= 0)
    failures.push("Patient ledger does not contain both charges and payments.");
  if (inventoryItems < 12) failures.push(`Expected inventory in every branch; found ${inventoryItems} items.`);
  if (!labs || !surveys || !campaigns) failures.push("CRM, survey, or laboratory scenario is incomplete.");
  if (failures.length) throw new Error(`Production-clinic verification failed:\n- ${failures.join("\n- ")}`);

  const summary = {
    activeBranches: activeBranches.length,
    patients: patients.length,
    plans: plans.length,
    baselinePayments: payments.length,
    appointments: appointments.length,
    inventoryItems,
    labOrders: labs,
    branchesWithPlans: planBranches.size,
    branchesWithPayments: paymentCountByBranch.size,
    branchesWithLaboratoryOrders: labBranches.size,
    branchesWithCashRegisters: cashCountByBranch.size,
    ledgerDebit: ledgerTotals.debit.toFixed(2),
    ledgerCredit: ledgerTotals.credit.toFixed(2)
  };
  console.log(`Production clinic verification passed: ${JSON.stringify(summary)}`);
  return summary;
}
