import { BadRequestException } from "@nestjs/common";
import { InventoryMovementType, Prisma } from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import { LabsInventoryService } from "./labs-inventory.service";

describe("LabsInventoryService inventory movements", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    branchIds: ["branch-1"],
    permissions: []
  };

  const item = {
    id: "item-1",
    organizationId: "org-1",
    name: "Acido",
    sku: "AC-1",
    category: "Operatoria",
    unit: "pieza",
    stock: new Prisma.Decimal(3),
    minStock: new Prisma.Decimal(1),
    salePrice: null,
    isSellable: false,
    tracksLots: false,
    tracksExpiration: false,
    allowFractionalQuantity: false,
    branchId: "branch-1",
    supplierId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  function buildService(stock = 3) {
    const tx = {
      $queryRaw: jest.fn(),
      inventoryStock: {
        findUnique: jest.fn().mockResolvedValue({
          id: "stock-1",
          inventoryItemId: "item-1",
          warehouseId: "warehouse-1",
          stock: new Prisma.Decimal(stock),
          minStock: new Prisma.Decimal(1),
          averageCost: new Prisma.Decimal(0)
        }),
        update: jest.fn()
      },
      inventoryItem: {
        update: jest.fn()
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: "movement-1" })
      },
      auditLog: {
        create: jest.fn()
      }
    };
    const prisma = {
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue(item),
        findMany: jest.fn().mockResolvedValue([item])
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: "branch-1", organizationId: "org-1" })
      },
      inventoryWarehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: "warehouse-1",
          organizationId: "org-1",
          branchId: "branch-1",
          name: "Bodega central",
          isDefault: true,
          isActive: true
        })
      },
      inventoryMovement: {
        findUnique: jest.fn().mockResolvedValue({ id: "movement-1" })
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    return { service: new LabsInventoryService(prisma as never), tx };
  }

  it("blocks OUT movements that would leave negative stock", async () => {
    const { service, tx } = buildService(3);

    await expect(
      service.createInventoryMovement(actor, {
        inventoryItemId: "item-1",
        branchId: "branch-1",
        warehouseId: "warehouse-1",
        type: InventoryMovementType.OUT,
        quantity: 4
      })
    ).rejects.toThrow(BadRequestException);

    expect(tx.inventoryStock.update).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("requires a reason for stock adjustments", async () => {
    const { service } = buildService(3);

    await expect(
      service.createInventoryMovement(actor, {
        inventoryItemId: "item-1",
        branchId: "branch-1",
        warehouseId: "warehouse-1",
        type: InventoryMovementType.ADJUSTMENT,
        quantity: 1,
        reason: "   "
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects transfers to the same warehouse before changing stock", async () => {
    const { service, tx } = buildService(3);

    await expect(
      service.postInventoryMovement(
        actor,
        InventoryMovementType.TRANSFER,
        {
          branchId: "branch-1",
          sourceWarehouseId: "warehouse-1",
          destinationWarehouseId: "warehouse-1",
          reason: "Reubicacion",
          lines: [{ inventoryItemId: "item-1", quantity: 1 }]
        },
        { idempotencyKey: "transfer-1" }
      )
    ).rejects.toThrow(BadRequestException);

    expect(tx.inventoryStock.update).not.toHaveBeenCalled();
  });

  it("rejects fractional quantities for products configured as indivisible", async () => {
    const { service, tx } = buildService(3);

    await expect(
      service.postInventoryMovement(
        actor,
        InventoryMovementType.EXIT,
        {
          branchId: "branch-1",
          sourceWarehouseId: "warehouse-1",
          reason: "Consumo clinico",
          lines: [{ inventoryItemId: "item-1", quantity: 0.5 }]
        },
        { idempotencyKey: "exit-1" }
      )
    ).rejects.toThrow(BadRequestException);

    expect(tx.inventoryStock.update).not.toHaveBeenCalled();
  });
});
