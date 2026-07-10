import { 
  PrismaClient, Patient, Professional, Branch, PatientTaskStatus, 
  LabOrderStatus, InventoryMovementType 
} from "@prisma/client";

export async function seedTier6Operations(
  prisma: PrismaClient,
  orgId: string,
  branches: Branch[],
  patients: Patient[],
  professionals: Professional[]
) {
  console.log("🌱 [Tier 6] Seeding Operations (Tasks, Inventory, Labs)...");

  // 1. Patient Tasks
  for (let i = 0; i < 5; i++) {
    await prisma.patientTask.create({
      data: {
        organizationId: orgId,
        patientId: patients[i].id,
        type: "LLAMADA_SEGUIMIENTO",
        detail: "Llamar para ver cómo sigue después de la endodoncia",
        status: PatientTaskStatus.PENDING,
        dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
        assignedToId: professionals[0].userId!, // Assign to first professional or receptionist
        createdById: professionals[0].userId!,
      }
    });
  }

  // 2. Inventory (Suppliers, Items, Warehouses)
  const supplier = await prisma.supplier.findFirst({ where: { organizationId: orgId, name: "Depósito Dental Central" }})
    ?? await prisma.supplier.create({ data: { organizationId: orgId, name: "Depósito Dental Central", phone: "5512341234", isActive: true }});

  const inventoryItems = [
    { name: "Guantes de Nitrilo (Caja 100)", sku: "GUA-001", category: "Bioseguridad", unit: "Caja" },
    { name: "Resina Compuesta A2", sku: "RES-A2", category: "Operatoria", unit: "Jeringa" },
    { name: "Anestesia Lidocaína 2%", sku: "ANE-02", category: "Anestésicos", unit: "Cartucho" },
    { name: "Kit Cepillos Ortodoncia", sku: "KIT-ORT", category: "Venta", unit: "Kit", isSellable: true, salePrice: 150 },
  ];

  const items = [];
  for (const item of inventoryItems) {
    let ii = await prisma.inventoryItem.findFirst({ where: { organizationId: orgId, sku: item.sku }});
    if (!ii) {
      ii = await prisma.inventoryItem.create({
        data: {
          organizationId: orgId,
          branchId: branches[0].id,
          supplierId: supplier.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          unit: item.unit,
          isSellable: item.isSellable || false,
          salePrice: item.salePrice || null,
          stock: 100,
          minStock: 20,
          isActive: true,
        }
      });
    }
    items.push(ii);
  }

  // Warehouses & Stock
  for (const branch of branches) {
    let warehouse = await prisma.inventoryWarehouse.findFirst({ where: { organizationId: orgId, branchId: branch.id }});
    if (!warehouse) {
      warehouse = await prisma.inventoryWarehouse.create({
        data: {
          organizationId: orgId,
          branchId: branch.id,
          name: `Almacén Principal ${branch.name}`,
          isDefault: true,
          isActive: true,
        }
      });

      for (const item of items) {
        await prisma.inventoryStock.create({
          data: {
            organizationId: orgId,
            warehouseId: warehouse.id,
            inventoryItemId: item.id,
            stock: 50,
            minStock: 10,
            averageCost: 50,
          }
        });

        // Add initial movement
        await prisma.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            branchId: branch.id,
            warehouseId: warehouse.id,
            type: InventoryMovementType.IN,
            quantity: 50,
            source: "MANUAL",
            reason: "Inventario inicial",
            createdById: professionals[0].userId!,
            stockBefore: 0,
            stockAfter: 50,
          }
        });
      }
    }
  }

  // 3. Lab Providers & Orders
  const lab = await prisma.labProvider.findFirst({ where: { organizationId: orgId, name: "Laboratorio ProDental" }})
    ?? await prisma.labProvider.create({
      data: {
        organizationId: orgId,
        name: "Laboratorio ProDental",
        phone: "5588776655",
        isActive: true,
      }
    });

  // Find a patient with an IN_PROGRESS plan to attach a lab order
  const plan = await prisma.treatmentPlan.findFirst({ where: { organizationId: orgId, status: "IN_PROGRESS" } });
  if (plan) {
    if (!await prisma.labOrder.findFirst({ where: { patientId: plan.patientId, labProviderId: lab.id }})) {
      await prisma.labOrder.create({
        data: {
          organizationId: orgId,
          patientId: plan.patientId,
          treatmentPlanId: plan.id,
          professionalId: plan.professionalId,
          labProviderId: lab.id,
          status: LabOrderStatus.SENT,
          sentAt: new Date(),
          expectedAt: new Date(Date.now() + 86400000 * 5), // 5 days from now
          notes: "Corona metal porcelana en color A2",
          items: {
            create: [
              { description: "Corona de porcelana/cerámica", toothNumber: "11", quantity: 1, unitCost: 1500 }
            ]
          }
        }
      });
    }
  }
}
