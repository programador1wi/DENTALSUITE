import {
  PrismaClient,
  ProcedureType,
  PaymentMethodType,
  PaymentMethodSource,
  BranchPriceListType
} from "@prisma/client";

export async function seedTier2Catalogs(prisma: PrismaClient, orgId: string, branchIds: string[]) {
  console.log("🌱 [Tier 2] Seeding Catalogs...");

  // 1. Payment Methods & Financial Institutions
  const paymentMethods = [
    { publicCode: "SYS-CASH", name: "Efectivo", type: PaymentMethodType.CASH },
    { publicCode: "SYS-CREDIT-CARD", name: "Tarjeta de Crédito", type: PaymentMethodType.CARD },
    { publicCode: "SYS-DEBIT-CARD", name: "Tarjeta de Débito", type: PaymentMethodType.CARD },
    { publicCode: "SYS-TRANSFER", name: "Transferencia", type: PaymentMethodType.TRANSFER }
  ];
  const createdMethods = [];
  for (const pm of paymentMethods) {
    const created =
      (await prisma.paymentMethod.findFirst({ where: { organizationId: orgId, name: pm.name } })) ??
      (await prisma.paymentMethod.create({
        data: {
          organizationId: orgId,
          ...pm,
          source: PaymentMethodSource.SYSTEM,
          allowsRefund: true,
          isActive: true
        }
      }));
    createdMethods.push(created);
  }

  (await prisma.financialInstitution.findFirst({ where: { organizationId: orgId, name: "BBVA" } })) ??
    (await prisma.financialInstitution.create({
      data: { organizationId: orgId, name: "BBVA", isActive: true }
    }));
  (await prisma.financialInstitution.findFirst({ where: { organizationId: orgId, name: "Santander" } })) ??
    (await prisma.financialInstitution.create({
      data: { organizationId: orgId, name: "Santander", isActive: true }
    }));

  // 2. Specialties
  const specialties = [
    "Odontología General",
    "Ortodoncia",
    "Endodoncia",
    "Odontopediatría",
    "Rehabilitación Oral"
  ];
  const createdSpecialties = [];
  for (const spec of specialties) {
    const created =
      (await prisma.specialty.findFirst({ where: { organizationId: orgId, name: spec } })) ??
      (await prisma.specialty.create({ data: { organizationId: orgId, name: spec, isActive: true } }));
    createdSpecialties.push(created);
  }

  // 3. Procedure Categories
  const categories = [
    { name: "Diagnóstico", type: ProcedureType.CLINICAL, sortOrder: 1 },
    { name: "Preventiva", type: ProcedureType.CLINICAL, sortOrder: 2 },
    { name: "Operatoria", type: ProcedureType.CLINICAL, sortOrder: 3 },
    { name: "Endodoncia", type: ProcedureType.CLINICAL, sortOrder: 4 },
    { name: "Rehabilitación", type: ProcedureType.MIXED, sortOrder: 5 }, // Requiere laboratorio
    { name: "Ortodoncia", type: ProcedureType.CLINICAL, sortOrder: 6 },
    { name: "Insumos", type: ProcedureType.CLINICAL, sortOrder: 99 }
  ];

  const createdCategories = [];
  for (const cat of categories) {
    const created =
      (await prisma.procedureCategory.findFirst({ where: { organizationId: orgId, name: cat.name } })) ??
      (await prisma.procedureCategory.create({ data: { organizationId: orgId, ...cat, isActive: true } }));
    createdCategories.push(created);
  }

  // 4. Procedures
  const proceduresData = [
    // Diagnóstico
    {
      cat: "Diagnóstico",
      code: "D0120",
      name: "Evaluación oral periódica",
      reqTooth: false,
      reqLab: false,
      dur: 30,
      basePrice: 500
    },
    {
      cat: "Diagnóstico",
      code: "D0150",
      name: "Evaluación oral comprensiva",
      reqTooth: false,
      reqLab: false,
      dur: 45,
      basePrice: 800
    },
    {
      cat: "Diagnóstico",
      code: "D0220",
      name: "Radiografía periapical",
      reqTooth: true,
      reqLab: false,
      dur: 15,
      basePrice: 200
    },

    // Preventiva
    {
      cat: "Preventiva",
      code: "D1110",
      name: "Profilaxis adulto",
      reqTooth: false,
      reqLab: false,
      dur: 45,
      basePrice: 600
    },
    {
      cat: "Preventiva",
      code: "D1206",
      name: "Aplicación de flúor",
      reqTooth: false,
      reqLab: false,
      dur: 15,
      basePrice: 400
    },

    // Operatoria
    {
      cat: "Operatoria",
      code: "D2391",
      name: "Resina compuesta - 1 superficie",
      reqTooth: true,
      reqLab: false,
      dur: 45,
      basePrice: 900
    },
    {
      cat: "Operatoria",
      code: "D2392",
      name: "Resina compuesta - 2 superficies",
      reqTooth: true,
      reqLab: false,
      dur: 60,
      basePrice: 1200
    },

    // Endodoncia
    {
      cat: "Endodoncia",
      code: "D3310",
      name: "Terapia endodóntica diente anterior",
      reqTooth: true,
      reqLab: false,
      dur: 90,
      basePrice: 3500
    },
    {
      cat: "Endodoncia",
      code: "D3330",
      name: "Terapia endodóntica premolar",
      reqTooth: true,
      reqLab: false,
      dur: 90,
      basePrice: 4500
    },

    // Rehabilitación (con laboratorio)
    {
      cat: "Rehabilitación",
      code: "D2740",
      name: "Corona de porcelana/cerámica",
      reqTooth: true,
      reqLab: true,
      dur: 120,
      basePrice: 6500,
      labCost: 2000
    },
    {
      cat: "Rehabilitación",
      code: "D2950",
      name: "Reconstrucción de muñón",
      reqTooth: true,
      reqLab: false,
      dur: 60,
      basePrice: 1500
    },

    // Ortodoncia
    {
      cat: "Ortodoncia",
      code: "D8090",
      name: "Tratamiento ortodóntico integral adulto (Brackets)",
      reqTooth: false,
      reqLab: false,
      dur: 120,
      basePrice: 15000
    },
    {
      cat: "Ortodoncia",
      code: "D8670",
      name: "Control mensual ortodoncia",
      reqTooth: false,
      reqLab: false,
      dur: 30,
      basePrice: 800
    },

    // Insumos
    {
      cat: "Insumos",
      code: "I0001",
      name: "Kit de bioseguridad paciente",
      reqTooth: false,
      reqLab: false,
      dur: 0,
      basePrice: 150
    }
  ];

  const createdProcedures = [];
  let displayId = 1;
  for (const p of proceduresData) {
    const category = createdCategories.find((c) => c.name === p.cat);
    if (!category) continue;

    const created =
      (await prisma.procedure.findFirst({ where: { organizationId: orgId, code: p.code } })) ??
      (await prisma.procedure.create({
        data: {
          organizationId: orgId,
          categoryId: category.id,
          displayId: displayId++,
          code: p.code,
          name: p.name,
          type: category.type,
          defaultDuration: p.dur,
          requiresTooth: p.reqTooth,
          requiresSurface: p.reqTooth, // simplify
          requiresLab: p.reqLab,
          isActive: true
        }
      }));
    createdProcedures.push({
      ...created,
      basePrice: p.basePrice,
      labCost: p.labCost || 0,
      categoryName: p.cat
    });
  }

  // 5. Price Lists
  const priceListBase =
    (await prisma.priceList.findFirst({ where: { organizationId: orgId, name: "Tarifario Base" } })) ??
    (await prisma.priceList.create({
      data: {
        organizationId: orgId,
        name: "Tarifario Base",
        description: "Precios estándar al público",
        isDefault: true,
        isActive: true
      }
    }));

  const priceListPoliza =
    (await prisma.priceList.findFirst({ where: { organizationId: orgId, name: "Tarifario Póliza" } })) ??
    (await prisma.priceList.create({
      data: {
        organizationId: orgId,
        name: "Tarifario Póliza",
        description: "Precios con 15% de descuento",
        isDefault: false,
        isActive: true
      }
    }));

  // Assign Price Lists to Branches
  for (const branchId of branchIds) {
    (await prisma.branchPriceList.findFirst({
      where: { organizationId: orgId, branchId, priceListId: priceListBase.id }
    })) ??
      (await prisma.branchPriceList.create({
        data: {
          organizationId: orgId,
          branchId,
          priceListId: priceListBase.id,
          type: BranchPriceListType.BASE,
          isDefault: true,
          isActive: true
        }
      }));

    (await prisma.branchPriceList.findFirst({
      where: { organizationId: orgId, branchId, priceListId: priceListPoliza.id }
    })) ??
      (await prisma.branchPriceList.create({
        data: {
          organizationId: orgId,
          branchId,
          priceListId: priceListPoliza.id,
          type: BranchPriceListType.POLIZA,
          isDefault: false,
          isActive: true
        }
      }));
  }

  // Generate Price List Items and Categories
  for (const cat of createdCategories) {
    // BASE PriceListCategory
    let plCatBase =
      (await prisma.priceListCategory.findFirst({
        where: { organizationId: orgId, priceListId: priceListBase.id, procedureCategoryId: cat.id }
      })) ??
      (await prisma.priceListCategory.create({
        data: {
          organizationId: orgId,
          priceListId: priceListBase.id,
          procedureCategoryId: cat.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          isActive: true
        }
      }));

    // POLIZA PriceListCategory
    let plCatPoliza =
      (await prisma.priceListCategory.findFirst({
        where: { organizationId: orgId, priceListId: priceListPoliza.id, procedureCategoryId: cat.id }
      })) ??
      (await prisma.priceListCategory.create({
        data: {
          organizationId: orgId,
          priceListId: priceListPoliza.id,
          procedureCategoryId: cat.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          isActive: true
        }
      }));

    // Create Items
    const procsInCat = createdProcedures.filter((p) => p.categoryName === cat.name);
    for (const proc of procsInCat) {
      // BASE Item
      (await prisma.priceListItem.findFirst({
        where: { priceListId: priceListBase.id, procedureId: proc.id }
      })) ??
        (await prisma.priceListItem.create({
          data: {
            priceListId: priceListBase.id,
            priceListCategoryId: plCatBase.id,
            procedureId: proc.id,
            price: proc.basePrice,
            labCost: proc.labCost,
            currency: "MXN",
            allowsDiscount: true
          }
        }));

      // POLIZA Item (-15%)
      (await prisma.priceListItem.findFirst({
        where: { priceListId: priceListPoliza.id, procedureId: proc.id }
      })) ??
        (await prisma.priceListItem.create({
          data: {
            priceListId: priceListPoliza.id,
            priceListCategoryId: plCatPoliza.id,
            procedureId: proc.id,
            price: proc.basePrice * 0.85,
            labCost: proc.labCost,
            currency: "MXN",
            allowsDiscount: false
          }
        }));
    }
  }

  // 6. Agreement
  const agreementCompany =
    (await prisma.company.findFirst({
      where: { organizationId: orgId, legalName: "MetLife" }
    })) ??
    (await prisma.company.create({
      data: { organizationId: orgId, legalName: "MetLife" }
    }));
  const agreement =
    (await prisma.agreement.findFirst({ where: { organizationId: orgId, name: "Convenio MetLife" } })) ??
    (await prisma.agreement.create({
      data: {
        organizationId: orgId,
        companyId: agreementCompany.id,
        name: "Convenio MetLife",
        discountPercent: 10,
        priceListId: priceListPoliza.id, // Usa el tarifario poliza como base
        appliesToLabs: false,
        isActive: true
      }
    }));

  return {
    specialties: createdSpecialties,
    procedures: createdProcedures,
    priceLists: [priceListBase, priceListPoliza],
    paymentMethods: createdMethods,
    agreement
  };
}
