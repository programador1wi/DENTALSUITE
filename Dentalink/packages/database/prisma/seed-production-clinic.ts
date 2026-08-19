import { PrismaClient } from "@prisma/client";

/**
 * Datos deterministas para una clínica operativa. No sustituye catálogos ni
 * elimina registros: si la simulación completa ya existe, termina sin duplicar.
 * Los importes financieros se escriben con los mismos snapshots y ledger que
 * utiliza PaymentsService, para que cartera, caja y reportes partan de hechos
 * contables consistentes.
 */
const SCENARIO = "SEED_PRODUCTION_CLINIC_2026";
const DAY = 86_400_000;

type Db = PrismaClient | any;

const at = (daysFromToday: number, hour = 10, minute = 0) => {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  value.setDate(value.getDate() + daysFromToday);
  return value;
};

const money = (value: number) => Math.round(value * 100) / 100;

async function firstOrCreate(db: Db, model: string, where: any, data: any) {
  const current = await db[model].findFirst({ where });
  return current ?? db[model].create({ data });
}

export async function seedProductionClinic(db: Db, organizationId: string, adminId: string) {
  const seededPatients = await db.patient.count({
    where: { organizationId, source: SCENARIO }
  });
  if (seededPatients >= 60) {
    const coverage = await ensureAllBranchCoverage(db, organizationId, adminId);
    console.log(`Production clinic seed already available (${seededPatients} patients); ${coverage.branches} branches reconciled.`);
    return { skipped: true, patients: seededPatients, ...coverage };
  }

  if (seededPatients > 0) {
    throw new Error(
      "Production clinic seed is incomplete. It was rolled back neither fully nor safely; review the demo namespace before retrying."
    );
  }

  return db.$transaction(async (tx: Db) => {
    const branches = await tx.branch.findMany({
      where: { organizationId, isActive: true, status: "ACTIVE", deletedAt: null },
      orderBy: { code: "asc" }
    });
    if (!branches.length) throw new Error("The base seed did not provide active branches.");

    const specialties = new Map<string, any>();
    for (const name of [
      "Odontología General",
      "Ortodoncia",
      "Endodoncia",
      "Rehabilitación Oral",
      "Periodoncia",
      "Odontopediatría"
    ]) {
      const specialty = await firstOrCreate(tx, "specialty", { organizationId, name }, {
        organizationId,
        name,
        isActive: true
      });
      specialties.set(name, specialty);
    }

    const categoryDefinitions = [
      ["Diagnóstico", "DIAGNOSTICO", "CLINICAL"],
      ["Preventiva", "PREVENTIVA", "CLINICAL"],
      ["Operatoria", "OPERATORIA", "CLINICAL"],
      ["Endodoncia", "ENDODONCIA", "CLINICAL"],
      ["Rehabilitación", "REHABILITACION", "MIXED"],
      ["Ortodoncia", "ORTODONCIA", "CLINICAL"]
    ] as const;
    const categories = new Map<string, any>();
    for (const [name, code, type] of categoryDefinitions) {
      const category = await tx.procedureCategory.upsert({
        where: { organizationId_name: { organizationId, name } },
        update: { code, type, isActive: true },
        create: { organizationId, name, code, type, isActive: true, sortOrder: categories.size + 1 }
      });
      categories.set(name, category);
    }

    const procedureDefinitions = [
      ["D001", "Valoración integral", "Diagnóstico", 45, 800, false, false, false],
      ["P001", "Profilaxis adulto", "Preventiva", 45, 750, false, false, false],
      ["R001", "Resina compuesta", "Operatoria", 60, 1350, true, false, false],
      ["E001", "Endodoncia premolar", "Endodoncia", 90, 5200, true, false, false],
      ["C001", "Corona cerámica", "Rehabilitación", 90, 7800, true, true, false],
      ["O001", "Ortodoncia integral", "Ortodoncia", 60, 18500, false, false, true],
      ["O002", "Control ortodóntico", "Ortodoncia", 30, 950, false, false, true]
    ] as const;
    const procedures = new Map<string, any>();
    for (const [code, name, categoryName, duration, price, requiresTooth, requiresLab, ortho] of procedureDefinitions) {
      const category = categories.get(categoryName)!;
      const procedure = await tx.procedure.upsert({
        where: { organizationId_code: { organizationId, code } },
        update: { name, categoryId: category.id, defaultDuration: duration, isActive: true },
        create: {
          organizationId,
          categoryId: category.id,
          displayId: 90_000 + procedures.size,
          code,
          name,
          type: category.type,
          defaultDuration: duration,
          requiresTooth,
          requiresSurface: requiresTooth,
          requiresLab,
          procedureType: ortho ? "ORTHODONTIC_CONTROL" : "GENERAL",
          allowsProgress: ortho,
          countsTowardOrthodonticProgress: ortho,
          consumesInventory: ["R001", "E001", "C001"].includes(code),
          isActive: true
        }
      });
      procedures.set(code, { ...procedure, price });
    }

    const priceList = await firstOrCreate(tx, "priceList", { organizationId, name: "Tarifario operación simulada" }, {
      organizationId,
      name: "Tarifario operación simulada",
      code: "SEED-OPERACION-2026",
      description: "Tarifario para la simulación clínica anual",
      status: "ACTIVE",
      isDefault: false,
      isActive: true,
      validFrom: at(-365)
    });
    for (const procedure of procedures.values()) {
      await tx.priceListItem.upsert({
        where: { priceListId_procedureId: { priceListId: priceList.id, procedureId: procedure.id } },
        update: { price: procedure.price, labCost: procedure.code === "C001" ? 2400 : 0, allowsDiscount: true },
        create: {
          priceListId: priceList.id,
          procedureId: procedure.id,
          price: procedure.price,
          labCost: procedure.code === "C001" ? 2400 : 0,
          allowsDiscount: true,
          maxDiscountPercent: 15
        }
      });
    }

    const paymentMethods = new Map<string, any>();
    for (const definition of [
      ["Efectivo", "SEED-CASH", "CASH", true, false],
      ["Tarjeta débito", "SEED-DEBIT", "CARD", false, true],
      ["Tarjeta crédito", "SEED-CREDIT", "CARD", false, true],
      ["Transferencia", "SEED-TRANSFER", "TRANSFER", false, true]
    ] as const) {
      const [name, publicCode, type, physicalCash, reference] = definition;
      const method = await tx.paymentMethod.upsert({
        where: { organizationId_name: { organizationId, name } },
        update: { isActive: true },
        create: {
          organizationId,
          name,
          publicCode,
          type,
          source: "SYSTEM",
          allowsRefund: true,
          requiresReference: reference,
          requiresFinancialInstitution: reference,
          includeInPhysicalCashBalance: physicalCash,
          isActive: true,
          createdById: adminId
        }
      });
      paymentMethods.set(publicCode, method);
    }
    const bank = await firstOrCreate(tx, "financialInstitution", { organizationId, name: "BBVA México" }, {
      organizationId, name: "BBVA México", isActive: true
    });

    const clinicalRole = (await tx.role.findFirst({
      where: {
        organizationId,
        OR: [
          { code: "dentista" },
          { name: "Dentista" },
          { name: "PROFESSIONAL" },
          { code: "super_admin" },
          { name: "Super Administrador" },
          { name: "SUPER_ADMIN" }
        ]
      }
    }))!;
    const professionals: any[] = [];
    const professionalSeeds = [
      ["Ana", "Morales", "Ortodoncia", "#7C3AED"],
      ["Bruno", "López", "Endodoncia", "#2563EB"],
      ["Carla", "Santos", "Odontología General", "#059669"],
      ["Diego", "Vega", "Rehabilitación Oral", "#D97706"],
      ["Elena", "Ríos", "Periodoncia", "#DB2777"],
      ["Fabio", "Méndez", "Odontopediatría", "#0891B2"]
    ];
    for (const [index, [firstName, lastName, specialtyName, color]] of professionalSeeds.entries()) {
      const email = `seed.professional.${index + 1}@dentalwarner.local`;
      const user = await firstOrCreate(tx, "user", { email }, {
        organizationId, firstName, lastName, email, passwordHash: "seed-not-for-login", roleId: clinicalRole.id,
        isActive: true, status: "ACTIVE"
      });
      const professional = await firstOrCreate(tx, "professional", { organizationId, email }, {
        organizationId, userId: user.id, firstName, lastName, email, licenseNumber: `CED-SEED-${index + 1}`,
        color, commissionRate: 30, isActive: true
      });
      await tx.userBranch.upsert({
        where: { userId_branchId: { userId: user.id, branchId: branches[index % branches.length].id } },
        update: { isPrimary: true },
        create: { userId: user.id, branchId: branches[index % branches.length].id, isPrimary: true }
      });
      await tx.professionalSpecialty.upsert({
        where: { professionalId_specialtyId: { professionalId: professional.id, specialtyId: specialties.get(specialtyName)!.id } },
        update: {}, create: { professionalId: professional.id, specialtyId: specialties.get(specialtyName)!.id }
      });
      const branch = branches[index % branches.length];
      await tx.professionalBranch.upsert({
        where: { professionalId_branchId: { professionalId: professional.id, branchId: branch.id } },
        update: { status: "ACTIVE", isPrimary: true },
        create: { professionalId: professional.id, branchId: branch.id, status: "ACTIVE", isPrimary: true, startsAt: at(-365) }
      });
      const contract = await firstOrCreate(tx, "professionalContract", { organizationId, professionalId: professional.id, isActive: true }, {
        organizationId, professionalId: professional.id, contractType: "PERFORMED_AND_PAID", commissionRate: 30,
        startsAt: at(-365), createdById: adminId, isActive: true
      });
      await tx.professionalContractBranch.upsert({
        where: { contractId_branchId: { contractId: contract.id, branchId: branch.id } },
        update: {}, create: { contractId: contract.id, branchId: branch.id }
      });
      const chair = await firstOrCreate(tx, "chair", { branchId: branch.id, name: `Consultorio ${index % 3 + 1}` }, {
        organizationId, branchId: branch.id, name: `Consultorio ${index % 3 + 1}`, isActive: true
      });
      for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
        await firstOrCreate(tx, "professionalSchedule", { professionalId: professional.id, branchId: branch.id, dayOfWeek }, {
          professionalId: professional.id, branchId: branch.id, chairId: chair.id, dayOfWeek,
          startTime: "10:00", endTime: "19:00", breakStartTime: "14:00", breakEndTime: "15:00", isActive: true
        });
      }
      professionals.push({ professional, user, branch, chair, specialty: specialties.get(specialtyName), contract });
    }

    const consentTemplate = await firstOrCreate(tx, "consentTemplate", { organizationId, name: "Consentimiento informado - procedimiento dental" }, {
      organizationId,
      name: "Consentimiento informado - procedimiento dental",
      content: "El paciente declara haber recibido explicación sobre diagnóstico, alternativas, riesgos y cuidados posteriores.",
      isActive: true
    });
    const lab = await firstOrCreate(tx, "labProvider", { organizationId, name: "Laboratorio Dental Central" }, {
      organizationId, name: "Laboratorio Dental Central", phone: "+525500000201", email: "ordenes@labseed.local", isActive: true
    });
    await tx.labProcedureAssignment.upsert({
      where: { procedureId_labProviderId: { procedureId: procedures.get("C001").id, labProviderId: lab.id } },
      update: { patientPrice: 7800, isActive: true },
      create: { organizationId, procedureId: procedures.get("C001").id, labProviderId: lab.id, patientPrice: 7800, isActive: true }
    });

    const supplier = await firstOrCreate(tx, "supplier", { organizationId, name: "Distribuidora Odontológica del Centro" }, {
      organizationId, name: "Distribuidora Odontológica del Centro", phone: "+525500000301", isActive: true
    });
    const warehouses: any[] = [];
    const inventoryItems: any[] = [];
    for (const branch of branches) {
      const warehouse = await firstOrCreate(tx, "inventoryWarehouse", { organizationId, branchId: branch.id, name: "Almacén clínico" }, {
        organizationId, branchId: branch.id, name: "Almacén clínico", isDefault: true, isActive: true
      });
      warehouses.push(warehouse);
      for (const [sku, name, category, unit, sellable] of [
        ["SEED-RES-A2", "Resina compuesta A2", "Operatoria", "Jeringa", false],
        ["SEED-ANES", "Anestesia local", "Anestesia", "Cartucho", false],
        ["SEED-GLOVE", "Guantes nitrilo", "Bioseguridad", "Caja", false],
        ["SEED-KIT-ORT", "Kit higiene ortodoncia", "Venta", "Kit", true]
      ] as const) {
        const item = await firstOrCreate(tx, "inventoryItem", { organizationId, branchId: branch.id, sku }, {
          organizationId, branchId: branch.id, supplierId: supplier.id, sku, name, category, unit,
          stock: 120, minStock: 20, isSellable: sellable, salePrice: sellable ? 220 : null, isActive: true
        });
        inventoryItems.push({ item, warehouse, branch });
        await tx.inventoryStock.upsert({
          where: { inventoryItemId_warehouseId: { inventoryItemId: item.id, warehouseId: warehouse.id } },
          update: { stock: 120, averageCost: 85 },
          create: { organizationId, inventoryItemId: item.id, warehouseId: warehouse.id, stock: 120, minStock: 20, averageCost: 85 }
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id, branchId: branch.id, warehouseId: warehouse.id, type: "IN", quantity: 120,
            unitCost: 85, source: SCENARIO, reason: "Inventario inicial de simulación", createdById: adminId,
            stockBefore: 0, stockAfter: 120, createdAt: at(-360)
          }
        });
      }
    }

    const patients: any[] = [];
    const firstNames = ["Sofía", "Mateo", "Valentina", "Emilio", "Camila", "Santiago", "Regina", "Daniel", "Ximena", "Gabriel"];
    const lastNames = ["Hernández", "García", "Martínez", "Pérez", "Ramírez", "Torres", "Castro", "Flores", "Mendoza", "Navarro"];
    for (let index = 0; index < 72; index++) {
      const branch = branches[index % branches.length];
      const status = index < 8 ? "NEW" : index < 14 ? "INACTIVE" : index < 22 ? "DEBTOR" : index < 30 ? "COMPLETED" : index < 52 ? "IN_TREATMENT" : "ACTIVE";
      const patient = await tx.patient.create({
        data: {
          organizationId, branchId: branch.id,
          firstName: firstNames[index % firstNames.length], lastName: `${lastNames[index % lastNames.length]} ${lastNames[(index + 3) % lastNames.length]}`,
          birthDate: at(-(18 + (index % 45)) * 365), gender: index % 2 ? "FEMALE" : "MALE",
          documentType: "CURP", documentNumber: `SEED${String(index + 1).padStart(14, "0")}`,
          email: `seed.patient.${String(index + 1).padStart(3, "0")}@clinic.local`, phone: `+525500${String(100000 + index).slice(-6)}`,
          source: SCENARIO, referredBy: index % 4 === 0 ? "Campaña de recomendación" : "Búsqueda orgánica",
          marketingConsent: index % 7 === 0 ? "DENIED" : "GRANTED", marketingConsentedAt: at(-300 + index), status,
          createdAt: at(-360 + index * 4), updatedAt: at(-2)
        }
      });
      patients.push({ patient, branch, status });
      await tx.medicalHistory.create({
        data: { patientId: patient.id, hasDiabetes: index % 19 === 0, hasHypertension: index % 17 === 0, smokes: index % 9 === 0, notes: index % 13 === 0 ? "Requiere valoración médica previa." : null, createdAt: at(-350 + index * 4) }
      });
      if (index % 5 === 0) await tx.patientMedicalAlert.create({ data: { patientId: patient.id, type: "ALLERGY", description: "Alergia referida a penicilina", severity: "HIGH", isActive: true } });
      await tx.patientNote.create({ data: { patientId: patient.id, userId: adminId, note: "Paciente incorporado a la simulación de operación clínica.", createdAt: at(-300 + index * 3) } });
    }

    const registers = new Map<string, any>();
    for (const branch of branches) {
      const closed = await tx.cashRegister.create({
        data: {
          organizationId, branchId: branch.id, publicNumber: 810_000 + registers.size, openedById: adminId, responsibleUserId: adminId,
          openingAmount: 1500, initialDeposit: 1500, expectedCashBalance: 3950, declaredCashBalance: 3950, closingAmount: 3950,
          status: "CLOSED", openedAt: at(-30, 9), closedAt: at(-30, 19), closedById: adminId, closingNotes: "Cierre histórico conciliado"
        }
      });
      const open = await tx.cashRegister.create({
        data: { organizationId, branchId: branch.id, publicNumber: 811_000 + registers.size, openedById: adminId, responsibleUserId: adminId, openingAmount: 1500, initialDeposit: 1500, status: "OPEN", openedAt: at(0, 9) }
      });
      registers.set(branch.id, { closed, open });
    }

    const completedItems: Array<{ item: any; professional: any; paymentAmount: number }> = [];
    for (const [index, entry] of patients.entries()) {
      if (index >= 60) break;
      const professionalEntry = professionals[index % professionals.length];
      const procedureCode = index % 9 === 0 ? "O001" : index % 6 === 0 ? "C001" : index % 4 === 0 ? "E001" : index % 3 === 0 ? "R001" : "P001";
      const procedure = procedures.get(procedureCode)!;
      const planStatus = entry.status === "COMPLETED" ? "COMPLETED" : entry.status === "INACTIVE" ? "CANCELLED" : index % 10 === 0 ? "PRESENTED" : "IN_PROGRESS";
      const planDate = at(-330 + index * 5, 11);
      const plan = await tx.treatmentPlan.create({
        data: {
          organizationId, branchId: entry.branch.id, patientId: entry.patient.id, professionalId: professionalEntry.professional.id,
          specialtyId: professionalEntry.specialty.id, specialtySnapshotName: professionalEntry.specialty.name,
          kind: procedureCode.startsWith("O") ? "ORTHODONTICS" : "GENERAL", name: `Plan ${SCENARIO} ${index + 1}`,
          description: "Plan clínico con seguimiento financiero y operativo.", status: planStatus,
          acceptedAt: planStatus === "PRESENTED" ? null : planDate, completedAt: planStatus === "COMPLETED" ? at(-20) : null, createdAt: planDate
        }
      });
      const section = await tx.treatmentPlanSection.create({ data: { treatmentPlanId: plan.id, name: "Fase clínica", sortOrder: 1 } });
      const total = procedure.price;
      const completed = planStatus === "COMPLETED" || (planStatus === "IN_PROGRESS" && index % 4 === 0);
      const item = await tx.treatmentPlanItem.create({
        data: {
          treatmentPlanId: plan.id, sectionId: section.id, procedureId: procedure.id, toothNumber: procedure.requiresTooth ? String(11 + (index % 10)) : null,
          quantity: 1, unitPrice: total, originalPrice: total, total, finalPrice: total, priceListId: priceList.id,
          priceSource: "PRICE_LIST", priceSnapshotName: priceList.name, priceSnapshotCode: procedure.code, procedureCodeSnapshot: procedure.code,
          procedureNameSnapshot: procedure.name, status: completed ? "COMPLETED" : planStatus === "PRESENTED" ? "PLANNED" : "IN_PROGRESS",
          completionPercentage: completed ? 100 : planStatus === "IN_PROGRESS" ? 40 : 0, performedAmount: completed ? total : money(total * 0.4),
          plannedAt: planDate, completedAt: completed ? at(-30 + index) : null
        }
      });
      await tx.patientLedgerEntry.create({
        data: { organizationId, branchId: entry.branch.id, patientId: entry.patient.id, occurredAt: planDate, entryType: "CHARGE", sourceType: "TREATMENT", sourceId: item.id, planId: plan.id, debitAmount: total, descriptionSnapshot: `Cargo por ${procedure.name}` }
      });

      const historicStart = at(-300 + index * 4, 10 + (index % 7));
      const appointment = await tx.appointment.create({
        data: {
          organizationId, branchId: entry.branch.id, patientId: entry.patient.id, professionalId: professionalEntry.professional.id,
          chairId: professionalEntry.chair.id, specialtyId: professionalEntry.specialty.id, treatmentPlanId: plan.id,
          title: procedure.name, reason: "Atención de tratamiento", status: completed ? "COMPLETED" : "CONFIRMED",
          startAt: historicStart, endAt: new Date(historicStart.getTime() + procedure.defaultDuration * 60_000), durationMinutes: procedure.defaultDuration,
          createdById: adminId, createdAt: historicStart
        }
      });
      await tx.appointmentStatusHistory.createMany({ data: [
        { appointmentId: appointment.id, newStatus: "SCHEDULED", changedById: adminId, reason: "Agendada", createdAt: at(-301 + index * 4) },
        { appointmentId: appointment.id, previousStatus: "SCHEDULED", newStatus: completed ? "COMPLETED" : "CONFIRMED", changedById: adminId, reason: completed ? "Atención finalizada" : "Confirmada", createdAt: historicStart }
      ] });
      if (completed) {
        const evolution = await tx.clinicalEvolution.create({
          data: { patientId: entry.patient.id, appointmentId: appointment.id, professionalId: professionalEntry.professional.id, treatmentPlanId: plan.id, treatmentPlanItemId: item.id, branchId: entry.branch.id, createdById: professionalEntry.user.id, signedById: professionalEntry.user.id, signedAt: historicStart, subjective: "Paciente sin molestia posterior.", objective: "Procedimiento realizado sin complicaciones.", assessment: "Evolución favorable.", plan: "Control según indicación.", completionPercentage: 100, performedAmountSnapshot: total, createdAt: historicStart }
        });
        if (procedure.requiresTooth) {
          const record = await tx.odontogramRecord.create({ data: { patientId: entry.patient.id, professionalId: professionalEntry.professional.id, appointmentId: appointment.id, toothNumber: item.toothNumber!, condition: "RESTORED", procedureId: procedure.id, status: "COMPLETED", createdAt: historicStart } });
          await tx.toothProcedure.create({ data: { patientId: entry.patient.id, professionalId: professionalEntry.professional.id, appointmentId: appointment.id, procedureId: procedure.id, odontogramRecordId: record.id, clinicalEvolutionId: evolution.id, treatmentPlanId: plan.id, treatmentPlanItemId: item.id, toothNumber: item.toothNumber!, status: "COMPLETED", completedAt: historicStart } });
        }
        completedItems.push({ item, professional: professionalEntry, paymentAmount: total });
      }
      if (index % 3 === 0) await tx.consent.create({ data: { patientId: entry.patient.id, templateId: consentTemplate.id, treatmentPlanId: plan.id, appointmentId: appointment.id, contentSnapshot: consentTemplate.content, status: "SIGNED", signedAt: historicStart } });
      if (index % 5 === 0) {
        const chart = await tx.periodontalChart.create({ data: { patientId: entry.patient.id, professionalId: professionalEntry.professional.id, appointmentId: appointment.id, chartDate: historicStart, notes: "Control periodontal inicial." } });
        await tx.periodontalMeasurement.createMany({ data: ["16", "11", "26"].map((toothNumber, pos) => ({ periodontalChartId: chart.id, toothNumber, position: pos === 0 ? "B" : "L", probingDepth: 2 + (index % 3), bleeding: index % 10 === 0, plaque: index % 7 === 0 })) });
      }
      if (procedure.requiresLab) await tx.labOrder.create({ data: { organizationId, patientId: entry.patient.id, treatmentPlanId: plan.id, professionalId: professionalEntry.professional.id, labProviderId: lab.id, status: completed ? "DELIVERED" : "IN_PROCESS", sentAt: historicStart, expectedAt: at(5), receivedAt: completed ? at(-15) : null, cost: 2400, notes: "Corona cerámica tono A2", items: { create: { description: procedure.name, toothNumber: item.toothNumber, quantity: 1, unitCost: 2400 } } } });

      const scenario = index % 8;
      const paymentAmount = scenario === 0 ? total + 250 : scenario === 1 ? money(total * 0.45) : scenario === 2 ? money(total * 0.7) : completed ? total : 0;
      if (paymentAmount > 0) {
        const method = scenario === 2 ? paymentMethods.get("SEED-TRANSFER") : scenario === 1 ? paymentMethods.get("SEED-DEBIT") : paymentMethods.get("SEED-CASH");
        const paidAt = at(-290 + index * 4, 16);
        const payment = await tx.payment.create({ data: { organizationId, branchId: entry.branch.id, patientId: entry.patient.id, receivedById: adminId, paymentNumber: 900_000 + index, amount: paymentAmount, grossAmount: paymentAmount, netAmount: paymentAmount, paymentMethodId: method.id, financialInstitutionId: method.requiresFinancialInstitution ? bank.id : null, paymentMethodSnapshot: { publicCode: method.publicCode, name: method.name, type: method.type }, status: paymentAmount >= total ? "ALLOCATED" : "PARTIALLY_ALLOCATED", paidAt, reference: method.requiresReference ? `SEED-${index + 1}` : null, notes: scenario === 0 ? "Pago con saldo a favor" : "Cobro de tratamiento" } });
        await tx.paymentMethodSplit.create({ data: { paymentId: payment.id, paymentMethodId: method.id, amount: paymentAmount, grossAmount: paymentAmount, netAmount: paymentAmount, paymentMethodCodeSnapshot: method.publicCode, paymentMethodNameSnapshot: method.name, paymentMethodTypeSnapshot: method.type, financialInstitutionId: method.requiresFinancialInstitution ? bank.id : null, reference: method.requiresReference ? `SEED-${index + 1}` : null } });
        const allocated = Math.min(paymentAmount, total);
        await tx.paymentAllocation.create({ data: { paymentId: payment.id, treatmentPlanItemId: item.id, amount: allocated } });
        await tx.patientLedgerEntry.create({ data: { organizationId, branchId: entry.branch.id, patientId: entry.patient.id, occurredAt: paidAt, entryType: "PAYMENT", sourceType: "PAYMENT", sourceId: payment.id, planId: plan.id, creditAmount: paymentAmount, descriptionSnapshot: `Pago #${payment.paymentNumber}` } });
        const register = registers.get(entry.branch.id).closed;
        await tx.cashMovement.create({ data: { organizationId, branchId: entry.branch.id, cashRegisterId: register.id, type: "INCOME", direction: "IN", amount: paymentAmount, paymentId: payment.id, paymentMethodId: method.id, paymentMethodNameSnapshot: method.name, paymentMethodTypeSnapshot: method.type, includeInCollectionReportsSnapshot: true, includeInPhysicalCashBalanceSnapshot: method.type === "CASH", includeInCashFlowReportsSnapshot: true, includeInClosingSummarySnapshot: true, includeInGraphicalReportsSnapshot: true, description: `Ingreso por pago #${payment.paymentNumber}`, createdById: adminId, createdAt: paidAt } });
        if (scenario === 7) {
          const refundAt = at(-280 + index * 4, 17);
          const refund = await tx.refund.create({ data: { organizationId, branchId: entry.branch.id, patientId: entry.patient.id, paymentId: payment.id, amount: 150, paymentMethodId: method.id, originalPaymentMethodId: method.id, status: "PROCESSED", reason: "Ajuste por servicio no realizado", processedById: adminId, processedAt: refundAt } });
          await tx.patientLedgerEntry.create({ data: { organizationId, branchId: entry.branch.id, patientId: entry.patient.id, occurredAt: refundAt, entryType: "REFUND", sourceType: "REFUND", sourceId: refund.id, planId: plan.id, debitAmount: 150, descriptionSnapshot: "Devolución procesada" } });
          await tx.cashMovement.create({ data: { organizationId, branchId: entry.branch.id, cashRegisterId: register.id, type: "REFUND", direction: "OUT", amount: 150, refundId: refund.id, paymentMethodId: method.id, description: "Devolución procesada", createdById: adminId, createdAt: refundAt } });
        }
      }
    }

    // Agenda con 30 días completos: una cita por profesional cada hora hábil, sin solapes de sillón ni agenda profesional.
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const day = at(dayOffset, 10);
      if (day.getDay() === 0) continue;
      for (const [professionalIndex, entry] of professionals.entries()) {
        for (const hour of [10, 11, 12, 13, 15, 16, 17, 18]) {
          const patientEntry = patients[(dayOffset * professionals.length * 8 + professionalIndex * 8 + hour) % patients.length];
          const startAt = at(dayOffset, hour);
          const status = dayOffset === 0 && hour < new Date().getHours() ? "CONFIRMED" : dayOffset === 0 ? "ARRIVED" : "SCHEDULED";
          const appointment = await tx.appointment.create({ data: { organizationId, branchId: entry.branch.id, patientId: patientEntry.patient.id, professionalId: entry.professional.id, chairId: entry.chair.id, specialtyId: entry.specialty.id, title: "Consulta de seguimiento", reason: "Seguimiento clínico", status, startAt, endAt: new Date(startAt.getTime() + 45 * 60_000), durationMinutes: 45, createdById: adminId, notes: "Agenda operativa generada sin traslapes." } });
          await tx.appointmentReminder.create({ data: { appointmentId: appointment.id, channel: "WHATSAPP", scheduledAt: new Date(startAt.getTime() - DAY), status: dayOffset <= 1 ? "SENT" : "PENDING", sentAt: dayOffset <= 1 ? new Date(startAt.getTime() - DAY) : null } });
        }
      }
    }

    // Variantes de agenda histórica: cancelación, no asistencia y reprogramación con trazabilidad.
    for (const [index, status] of ["CANCELLED_BY_PATIENT", "NO_SHOW", "CANCELLED_RESCHEDULED"].entries()) {
      const entry = professionals[index];
      const patientEntry = patients[65 + index];
      const startAt = at(-7 - index, 11);
      const appointment = await tx.appointment.create({ data: { organizationId, branchId: entry.branch.id, patientId: patientEntry.patient.id, professionalId: entry.professional.id, chairId: entry.chair.id, specialtyId: entry.specialty.id, title: "Cita de control", status, startAt, endAt: new Date(startAt.getTime() + 30 * 60_000), durationMinutes: 30, cancellationReason: status.startsWith("CANCELLED") ? "Paciente solicitó cambio de horario" : null, createdById: adminId } });
      await tx.appointmentStatusHistory.create({ data: { appointmentId: appointment.id, previousStatus: "SCHEDULED", newStatus: status, changedById: adminId, reason: status === "NO_SHOW" ? "Paciente no asistió" : "Cancelación registrada", createdAt: startAt } });
    }

    const overduePatient = patients.find((entry) => entry.status === "DEBTOR")!;
    const overduePlan = await tx.treatmentPlan.findFirstOrThrow({ where: { patientId: overduePatient.patient.id } });
    const installmentPlan = await tx.installmentPlan.create({ data: { organizationId, patientId: overduePatient.patient.id, treatmentPlanId: overduePlan.id, totalAmount: 5200, downPayment: 1000, financedAmount: 4200, numberOfInstallments: 3, frequency: "MONTHLY", startDate: at(-120), status: "ACTIVE" } });
    const installment = await tx.installment.create({ data: { installmentPlanId: installmentPlan.id, patientId: overduePatient.patient.id, number: 1, dueDate: at(-60), amount: 1400, paidAmount: 0, status: "OVERDUE" } });
    const caseRecord = await tx.collectionCase.create({ data: { patientId: overduePatient.patient.id, installmentId: installment.id, treatmentPlanId: overduePlan.id, amountDue: 1400, daysOverdue: 60, status: "CONTACTED", assignedToId: adminId, lastContactAt: at(-2), nextContactAt: at(3) } });
    await tx.collectionActivity.create({ data: { collectionCaseId: caseRecord.id, userId: adminId, channel: "WHATSAPP", result: "PROMISE_TO_PAY", notes: "Paciente confirma pago parcial el viernes.", nextActionAt: at(3), createdAt: at(-2) } });

    const marketingSettings = await tx.marketingSettings.upsert({ where: { organizationId }, update: {}, create: { organizationId, requireMarketingConsent: true } });
    void marketingSettings;
    const segment = await tx.marketingSegment.create({ data: { organizationId, branchId: branches[0].id, reportCode: "active_patients", parametersJson: { scenario: SCENARIO }, name: "Pacientes activos - simulación", resultCount: 40, eligibleCount: 34, createdById: adminId } });
    const template = await tx.emailTemplate.create({ data: { organizationId, name: "Control preventivo 2026", category: "RETENTION", subject: "Tu revisión dental está lista", html: "<p>Agenda tu control preventivo.</p>", text: "Agenda tu control preventivo.", status: "ACTIVE", createdById: adminId } });
    const campaign = await tx.emailCampaign.create({ data: { organization: { connect: { id: organizationId } }, createdBy: { connect: { id: adminId } }, branch: { connect: { id: branches[0].id } }, segment: { connect: { id: segment.id } }, template: { connect: { id: template.id } }, name: "Recordatorio de prevención", subject: template.subject, fromName: "Dental Warner", fromAddress: "hola@dentalwarner.local", contentHtmlSnapshot: template.html, contentTextSnapshot: template.text, status: "SENT", idempotencyKey: "seed-campaign-2026", startedAt: at(-15), completedAt: at(-15) } });
    for (const [index, entry] of patients.slice(0, 12).entries()) {
      const delivered = index < 9;
      await tx.emailCampaignRecipient.create({ data: { campaignId: campaign.id, patientId: entry.patient.id, branchId: entry.branch.id, emailSnapshot: entry.patient.email!, normalizedEmail: entry.patient.email!.toLowerCase(), nameSnapshot: `${entry.patient.firstName} ${entry.patient.lastName}`, eligibilityStatus: "ELIGIBLE", deliveryStatus: delivered ? "DELIVERED" : "BOUNCED", idempotencyKey: `seed-campaign-recipient-${index}`, sentAt: at(-15), deliveredAt: delivered ? at(-15) : null, bouncedAt: delivered ? null : at(-14), attempts: 1 } });
    }

    const survey = await tx.surveyDefinition.create({ data: { organizationId, branchId: branches[0].id, name: "Satisfacción posterior a consulta", type: "SATISFACTION", channel: "EMAIL", status: "ACTIVE", createdById: adminId, updatedById: adminId, activatedAt: at(-90) } });
    const version = await tx.surveyVersion.create({ data: { surveyId: survey.id, version: 1, status: "PUBLISHED", publishedById: adminId, publishedAt: at(-90) } });
    await tx.surveyDefinition.update({ where: { id: survey.id }, data: { activeVersionId: version.id } });
    const section = await tx.surveySection.create({ data: { versionId: version.id, name: "Atención", position: 1 } });
    const question = await tx.surveyQuestion.create({ data: { sectionId: section.id, text: "¿Cómo califica su experiencia?", type: "NPS_10", isRequired: true, position: 1 } });
    const surveyAppointment = await tx.appointment.findFirstOrThrow({ where: { status: "COMPLETED" } });
    const invitation = await tx.surveyInvitation.create({ data: { organizationId, branchId: surveyAppointment.branchId, surveyId: survey.id, surveyVersionId: version.id, patientId: surveyAppointment.patientId!, appointmentId: surveyAppointment.id, professionalId: surveyAppointment.professionalId, recipientEmail: patients[0].patient.email!, tokenHash: "seed-survey-token-2026", tokenExpiresAt: at(30), status: "RESPONDED", scheduledAt: at(-10), sentAt: at(-10), respondedAt: at(-9) } });
    const response = await tx.surveyResponse.create({ data: { organizationId, branchId: surveyAppointment.branchId, surveyId: survey.id, surveyVersionId: version.id, invitationId: invitation.id, patientId: surveyAppointment.patientId!, appointmentId: surveyAppointment.id, professionalId: surveyAppointment.professionalId, status: "SUBMITTED", startedAt: at(-9), submittedAt: at(-9) } });
    await tx.surveyAnswer.create({ data: { responseId: response.id, questionId: question.id, valueNumber: 9 } });

    for (const record of completedItems.slice(0, professionals.length)) {
      const liquidation = await firstOrCreate(tx, "payrollLiquidation", { professionalId: record.professional.professional.id, finalizedAt: { gte: at(-40), lte: at(1) } }, {
        organizationId, professionalId: record.professional.professional.id, branchId: record.professional.branch.id, professionalContractId: record.professional.contract.id,
        commissionRate: 30, completedItems: 1, collectedAmount: record.paymentAmount, payableAmount: money(record.paymentAmount * 0.3), lastCompletedAt: at(-10), finalizedById: adminId, finalizedAt: at(-5)
      });
      await tx.payrollLiquidationItem.create({ data: { liquidationId: liquidation.id, treatmentPlanItemId: record.item.id, collectedAmount: record.paymentAmount, payableAmount: money(record.paymentAmount * 0.3), commissionRate: 30 } });
    }

    console.log(`Production clinic seed completed: ${patients.length} patients, ${professionals.length} professionals, 30-day agenda and financial history.`);
    return { skipped: false, patients: patients.length, professionals: professionals.length };
  }, { timeout: 120_000, maxWait: 30_000 });
}

async function ensureAllBranchCoverage(db: Db, organizationId: string, adminId: string) {
  const branches = await db.branch.findMany({
    where: { organizationId, isActive: true, status: "ACTIVE", deletedAt: null },
    orderBy: { code: "asc" }
  });
  const generalSpecialty = await db.specialty.findFirstOrThrow({ where: { organizationId, name: "Odontología General" } });
  const specialties = await db.specialty.findMany({ where: { organizationId, isActive: true }, select: { id: true } });
  const cashMethod = await db.paymentMethod.findFirstOrThrow({ where: { organizationId, type: "CASH", isActive: true } });
  const labProvider = await db.labProvider.findFirstOrThrow({ where: { organizationId, isActive: true } });
  let appointmentsCreated = 0;
  let paymentsCreated = 0;
  let labOrdersCreated = 0;

  for (const [index, branch] of branches.entries()) {
    const professionalEmail = `seed.coverage.${branch.code.toLowerCase()}@dentalwarner.local`;
    const user = await firstOrCreate(db, "user", { email: professionalEmail }, {
      organizationId, firstName: "Equipo", lastName: branch.name, email: professionalEmail,
      passwordHash: "seed-not-for-login", isActive: true, status: "ACTIVE"
    });
    const professional = await firstOrCreate(db, "professional", { organizationId, email: professionalEmail }, {
      organizationId, userId: user.id, firstName: "Equipo", lastName: branch.name, email: professionalEmail,
      licenseNumber: `CED-COB-${String(index + 1).padStart(3, "0")}`, color: "#0F766E", isActive: true
    });
    const chair = await firstOrCreate(db, "chair", { branchId: branch.id, name: "Consultorio Operativo" }, {
      organizationId, branchId: branch.id, name: "Consultorio Operativo", isActive: true
    });
    await db.userBranch.upsert({ where: { userId_branchId: { userId: user.id, branchId: branch.id } }, update: { isPrimary: true }, create: { userId: user.id, branchId: branch.id, isPrimary: true } });
    await db.professionalBranch.upsert({ where: { professionalId_branchId: { professionalId: professional.id, branchId: branch.id } }, update: { status: "ACTIVE", isPrimary: true }, create: { professionalId: professional.id, branchId: branch.id, status: "ACTIVE", isPrimary: true, startsAt: at(-365) } });
    for (const specialty of specialties) {
      await db.professionalSpecialty.upsert({ where: { professionalId_specialtyId: { professionalId: professional.id, specialtyId: specialty.id } }, update: {}, create: { professionalId: professional.id, specialtyId: specialty.id } });
    }
    for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
      await firstOrCreate(db, "professionalSchedule", { professionalId: professional.id, branchId: branch.id, dayOfWeek }, {
        professionalId: professional.id, branchId: branch.id, chairId: chair.id, dayOfWeek,
        startTime: "10:00", endTime: "19:00", breakStartTime: "14:00", breakEndTime: "15:00", isActive: true
      });
    }

    // Every treatment, appointment, evolution and laboratory order remains inside
    // the professional's active clinical branch; access branches are not reused.
    await db.treatmentPlan.updateMany({ where: { organizationId, branchId: branch.id, patient: { source: SCENARIO } }, data: { professionalId: professional.id, specialtyId: generalSpecialty.id, specialtySnapshotName: generalSpecialty.name } });
    await db.appointment.updateMany({ where: { organizationId, branchId: branch.id, patient: { source: SCENARIO } }, data: { professionalId: professional.id, chairId: chair.id, specialtyId: generalSpecialty.id } });
    await db.clinicalEvolution.updateMany({ where: { branchId: branch.id, patient: { source: SCENARIO } }, data: { professionalId: professional.id, createdById: user.id, signedById: user.id } });
    await db.labOrder.updateMany({ where: { organizationId, treatmentPlan: { branchId: branch.id }, patient: { source: SCENARIO } }, data: { professionalId: professional.id } });

    let branchPatients = await db.patient.findMany({ where: { organizationId, branchId: branch.id, source: SCENARIO }, orderBy: { createdAt: "asc" } });
    for (let patientIndex = branchPatients.length; patientIndex < 8; patientIndex++) {
      const sequence = index * 10 + patientIndex + 500;
      const patient = await db.patient.create({ data: {
        organizationId, branchId: branch.id, firstName: "Paciente", lastName: `Cobertura ${branch.code} ${patientIndex + 1}`,
        birthDate: at(-(24 + patientIndex) * 365), documentType: "CURP", documentNumber: `COB${String(sequence).padStart(15, "0")}`,
        email: `seed.coverage.patient.${branch.code.toLowerCase()}.${patientIndex + 1}@clinic.local`, phone: `+525501${String(sequence).slice(-6)}`,
        source: SCENARIO, status: "ACTIVE", marketingConsent: "GRANTED", marketingConsentedAt: at(-90), createdAt: at(-90)
      } });
      await db.medicalHistory.create({ data: { patientId: patient.id, notes: "Historia clínica de paciente de cobertura." } });
      branchPatients.push(patient);
    }

    const branchPlan = await db.treatmentPlan.findFirst({
      where: { organizationId, branchId: branch.id, patient: { source: SCENARIO } },
      include: { items: { orderBy: { createdAt: "asc" }, take: 1 } },
      orderBy: { createdAt: "asc" }
    });
    if (!branchPlan?.items[0]) throw new Error(`Missing seeded treatment plan for branch ${branch.name}.`);

    const branchPayment = await db.payment.findFirst({
      where: { organizationId, branchId: branch.id, patient: { source: SCENARIO } },
      select: { id: true }
    });
    if (!branchPayment) {
      const paymentAmount = Math.min(500, Number(branchPlan.items[0].total));
      const register = await db.cashRegister.findFirstOrThrow({ where: { organizationId, branchId: branch.id, status: "CLOSED" } });
      const paidAt = at(-7, 16);
      const payment = await db.payment.create({ data: {
        organizationId, branchId: branch.id, patientId: branchPlan.patientId, receivedById: adminId,
        paymentNumber: 910_000 + index, amount: paymentAmount, grossAmount: paymentAmount, netAmount: paymentAmount,
        paymentMethodId: cashMethod.id, paymentMethodSnapshot: { publicCode: cashMethod.publicCode, name: cashMethod.name, type: cashMethod.type },
        status: "PARTIALLY_ALLOCATED", paidAt, notes: "Pago parcial de cobertura para todas las clínicas.",
        idempotencyKey: `seed-coverage-payment-${branch.id}`
      } });
      await db.paymentMethodSplit.create({ data: {
        paymentId: payment.id, paymentMethodId: cashMethod.id, amount: paymentAmount, grossAmount: paymentAmount, netAmount: paymentAmount,
        paymentMethodCodeSnapshot: cashMethod.publicCode, paymentMethodNameSnapshot: cashMethod.name, paymentMethodTypeSnapshot: cashMethod.type
      } });
      await db.paymentAllocation.create({ data: { paymentId: payment.id, treatmentPlanItemId: branchPlan.items[0].id, amount: paymentAmount } });
      await db.patientLedgerEntry.create({ data: {
        organizationId, branchId: branch.id, patientId: branchPlan.patientId, occurredAt: paidAt, entryType: "PAYMENT", sourceType: "PAYMENT", sourceId: payment.id,
        planId: branchPlan.id, creditAmount: paymentAmount, descriptionSnapshot: `Pago parcial de cobertura #${payment.paymentNumber}`
      } });
      await db.cashMovement.create({ data: {
        organizationId, branchId: branch.id, cashRegisterId: register.id, type: "INCOME", direction: "IN", amount: paymentAmount, paymentId: payment.id,
        paymentMethodId: cashMethod.id, paymentMethodNameSnapshot: cashMethod.name, paymentMethodTypeSnapshot: cashMethod.type,
        includeInCollectionReportsSnapshot: true, includeInPhysicalCashBalanceSnapshot: true, includeInCashFlowReportsSnapshot: true,
        includeInClosingSummarySnapshot: true, includeInGraphicalReportsSnapshot: true, description: "Ingreso de cobertura por pago parcial",
        createdById: adminId, createdAt: paidAt, idempotencyKey: `seed-coverage-cash-${branch.id}`
      } });
      paymentsCreated++;
    }

    const branchLabOrder = await db.labOrder.findFirst({ where: { organizationId, patient: { branchId: branch.id, source: SCENARIO } }, select: { id: true } });
    if (!branchLabOrder) {
      await db.labOrder.create({ data: {
        organizationId, patientId: branchPlan.patientId, treatmentPlanId: branchPlan.id, professionalId: professional.id, labProviderId: labProvider.id,
        status: "IN_PROCESS", sentAt: at(-3), expectedAt: at(5), cost: 2400, notes: "Orden de laboratorio de cobertura clínica.",
        items: { create: { description: "Corona cerámica de seguimiento", toothNumber: "16", quantity: 1, unitCost: 2400 } }
      } });
      labOrdersCreated++;
    }

    const existingFuture = await db.appointment.count({
      where: { branchId: branch.id, patient: { source: SCENARIO }, startAt: { gte: at(0, 0), lt: at(31, 0) } }
    });
    if (!existingFuture) {
      const records: any[] = [];
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const date = at(dayOffset, 10);
        if (date.getDay() === 0) continue;
        for (const [slot, hour] of [10, 11, 12, 13, 15, 16, 17, 18].entries()) {
          const patient = branchPatients[(dayOffset + slot) % branchPatients.length];
          const startAt = at(dayOffset, hour);
          records.push({ organizationId, branchId: branch.id, patientId: patient.id, professionalId: professional.id, chairId: chair.id, specialtyId: generalSpecialty.id, title: "Consulta de seguimiento", reason: "Agenda de cobertura clínica", status: "SCHEDULED", startAt, endAt: new Date(startAt.getTime() + 45 * 60_000), durationMinutes: 45, createdById: adminId, notes: "Agenda de cobertura para todas las clínicas." });
        }
      }
      await db.appointment.createMany({ data: records });
      appointmentsCreated += records.length;
    }
  }
  return { branches: branches.length, appointmentsCreated, paymentsCreated, labOrdersCreated };
}
