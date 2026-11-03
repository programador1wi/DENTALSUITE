import {
  PrismaClient,
  Patient,
  Professional,
  Procedure,
  PriceList,
  PaymentMethod,
  TreatmentPlanStatus,
  TreatmentPlanItemStatus,
  BudgetStatus,
  PaymentStatus,
  TreatmentPriceSource,
  CashRegisterStatus,
  CashMovementType,
  CashMovementDirection,
  InstallmentFrequency,
  InstallmentPlanStatus,
  InstallmentStatus
} from "@prisma/client";

export async function seedTier5Financial(
  prisma: PrismaClient,
  orgId: string,
  patients: Patient[],
  professionals: Professional[],
  procedures: Procedure[],
  priceLists: PriceList[],
  paymentMethods: PaymentMethod[]
) {
  console.log("🌱 [Tier 5] Seeding Financial Data (Plans, Budgets, Payments)...");

  const cashMethod = paymentMethods.find((p) => p.type === "CASH")!;
  const cardMethod = paymentMethods.find((p) => p.type === "CARD")!;
  const baseList = priceLists.find((p) => p.isDefault)!;
  const now = new Date();

  // Create a Cash Register per branch
  const branches = [...new Set(patients.map((p) => p.branchId))];
  const cashRegisters = new Map();
  for (const [branchIndex, branchId] of branches.entries()) {
    let cr = await prisma.cashRegister.findFirst({ where: { branchId, status: CashRegisterStatus.OPEN } });
    if (!cr) {
      cr = await prisma.cashRegister.create({
        data: {
          organizationId: orgId,
          publicNumber: 900000 + branchIndex,
          branchId,
          openedById: professionals[0].userId!, // using first professional user
          responsibleUserId: professionals[0].userId!,
          openingAmount: 1000,
          status: CashRegisterStatus.OPEN,
          openedAt: new Date(now.setHours(8, 0, 0, 0))
        }
      });
    }
    cashRegisters.set(branchId, cr);
  }

  // Pre-fetch price list items for quick lookup
  const priceListItems = await prisma.priceListItem.findMany({ where: { priceListId: baseList.id } });

  const getPrice = (procedureId: string) => {
    return priceListItems.find((p) => p.procedureId === procedureId)?.price || 0;
  };

  const getProc = (code: string) => procedures.find((p) => p.code === code)!;
  const diagProc = getProc("D0150");
  const resinProc = getProc("D2391");
  const endoProc = getProc("D3310");

  for (const patient of patients) {
    // Avoid re-seeding if plans exist
    if (await prisma.treatmentPlan.findFirst({ where: { patientId: patient.id } })) {
      continue;
    }

    const branchId = patient.branchId;
    const profId = professionals.find((p) => p.branches?.some((pb) => pb.branchId === branchId) || true)!.id;
    const cr = cashRegisters.get(branchId)!;

    // 1. DRAFT Plan
    const draftPlan = await prisma.treatmentPlan.create({
      data: {
        organizationId: orgId,
        branchId,
        patientId: patient.id,
        professionalId: profId,
        name: "Plan de Diagnóstico",
        status: TreatmentPlanStatus.DRAFT
      }
    });

    const draftSection = await prisma.treatmentPlanSection.create({
      data: {
        treatmentPlanId: draftPlan.id,
        name: "Fase Inicial",
        sortOrder: 1
      }
    });

    await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: draftPlan.id,
        sectionId: draftSection.id,
        procedureId: diagProc.id,
        quantity: 1,
        unitPrice: getPrice(diagProc.id),
        discount: 0,
        total: getPrice(diagProc.id),
        status: TreatmentPlanItemStatus.PLANNED,
        priceSource: TreatmentPriceSource.PRICE_LIST,
        priceListId: baseList.id
      }
    });

    // 2. IN_PROGRESS Plan (Complex)
    const inProgressPlan = await prisma.treatmentPlan.create({
      data: {
        organizationId: orgId,
        branchId,
        patientId: patient.id,
        professionalId: profId,
        name: "Rehabilitación Integral",
        status: TreatmentPlanStatus.IN_PROGRESS,
        acceptedAt: new Date(now.getTime() - 10 * 86400000) // 10 days ago
      }
    });

    const endoSection = await prisma.treatmentPlanSection.create({
      data: {
        treatmentPlanId: inProgressPlan.id,
        name: "Fase Endodoncia",
        sortOrder: 1
      }
    });

    const resinSection = await prisma.treatmentPlanSection.create({
      data: {
        treatmentPlanId: inProgressPlan.id,
        name: "Fase Operatoria",
        sortOrder: 2
      }
    });

    await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: inProgressPlan.id,
        sectionId: endoSection.id,
        procedureId: endoProc.id,
        toothNumber: "11",
        quantity: 1,
        unitPrice: getPrice(endoProc.id),
        discount: 0,
        total: getPrice(endoProc.id),
        status: TreatmentPlanItemStatus.PAID,
        priceSource: TreatmentPriceSource.PRICE_LIST,
        priceListId: baseList.id
      }
    });

    await prisma.treatmentPlanItem.create({
      data: {
        treatmentPlanId: inProgressPlan.id,
        sectionId: resinSection.id,
        procedureId: resinProc.id,
        toothNumber: "12",
        quantity: 1,
        unitPrice: getPrice(resinProc.id),
        discount: 0,
        total: getPrice(resinProc.id),
        status: TreatmentPlanItemStatus.ACCEPTED,
        priceSource: TreatmentPriceSource.PRICE_LIST,
        priceListId: baseList.id
      }
    });

    const inProgressPlanWithItems = await prisma.treatmentPlan.findUniqueOrThrow({
      where: { id: inProgressPlan.id },
      include: { items: true }
    });

    // 3. Budget for IN_PROGRESS
    const totalAmount = Number(getPrice(endoProc.id)) + Number(getPrice(resinProc.id));
    await prisma.budget.create({
      data: {
        organizationId: orgId,
        treatmentPlanId: inProgressPlan.id,
        patientId: patient.id,
        professionalId: profId,
        status: BudgetStatus.ACCEPTED,
        subtotal: totalAmount,
        discountTotal: 0,
        total: totalAmount,
        acceptedAt: inProgressPlan.acceptedAt,
        items: {
          create: inProgressPlanWithItems.items.map((item) => ({
            treatmentPlanItemId: item.id,
            description: "Procedimiento",
            quantity: 1,
            unitPrice: item.unitPrice,
            discount: 0,
            total: item.total
          }))
        }
      }
    });

    // 4. Payment for the Endodontics item (Partial or Full)
    const endoItem = inProgressPlanWithItems.items.find((i) => i.procedureId === endoProc.id)!;
    const payment = await prisma.payment.create({
      data: {
        organizationId: orgId,
        branchId,
        patientId: patient.id,
        receivedById: professionals[0].userId!, // using first professional user
        amount: endoItem.total,
        currency: "MXN",
        paymentMethodId: cardMethod.id,
        status: PaymentStatus.ALLOCATED,
        paidAt: new Date(now.getTime() - 9 * 86400000), // 9 days ago
        allocations: {
          create: [{ treatmentPlanItemId: endoItem.id, amount: endoItem.total }]
        }
      }
    });

    // 5. Cash Movement for the Payment
    await prisma.cashMovement.create({
      data: {
        cashRegisterId: cr.id,
        organizationId: orgId,
        branchId,
        type: CashMovementType.INCOME,
        direction: CashMovementDirection.IN,
        amount: payment.amount,
        paymentId: payment.id,
        paymentMethodId: cardMethod.id,
        description: `Pago por tratamiento ${inProgressPlan.id.slice(-5)}`,
        createdById: professionals[0].userId!
      }
    });

    // 6. Installment Plan (for the rest)
    if (patient.firstName === "Juan") {
      // Just for one patient to have a financing plan
      await prisma.installmentPlan.create({
        data: {
          organizationId: orgId,
          patientId: patient.id,
          treatmentPlanId: inProgressPlan.id,
          totalAmount: totalAmount,
          downPayment: endoItem.total,
          financedAmount: resinProc.basePrice,
          numberOfInstallments: 2,
          frequency: InstallmentFrequency.BIWEEKLY,
          startDate: now,
          status: InstallmentPlanStatus.ACTIVE,
          installments: {
            create: [
              {
                patientId: patient.id,
                number: 1,
                dueDate: new Date(now.getTime() + 14 * 86400000),
                amount: Number(resinProc.basePrice) / 2,
                paidAmount: 0,
                status: InstallmentStatus.PENDING
              },
              {
                patientId: patient.id,
                number: 2,
                dueDate: new Date(now.getTime() + 28 * 86400000),
                amount: Number(resinProc.basePrice) / 2,
                paidAmount: 0,
                status: InstallmentStatus.PENDING
              }
            ]
          }
        }
      });
    }
  }
}
