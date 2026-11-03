-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "salePrice" DECIMAL(10,2);
ALTER TABLE "InventoryItem" ADD COLUMN "isSellable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN "warehouseId" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "unitCost" DECIMAL(10,2);
ALTER TABLE "InventoryMovement" ADD COLUMN "source" TEXT DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "InventoryWarehouse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "stock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryProductSale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "patientId" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "inventoryMovementId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryProductSale_pkey" PRIMARY KEY ("id")
);

-- Backfill default warehouses for existing branch inventory.
INSERT INTO "InventoryWarehouse" ("id", "organizationId", "branchId", "name", "description", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
    CONCAT('invwh_', "branchId"),
    "organizationId",
    "branchId",
    'Bodega central',
    'Bodega creada automaticamente para migrar inventario existente.',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "InventoryItem"
GROUP BY "organizationId", "branchId"
ON CONFLICT DO NOTHING;

-- Backfill normalized stock from legacy InventoryItem stock/minStock.
INSERT INTO "InventoryStock" ("id", "organizationId", "inventoryItemId", "warehouseId", "stock", "minStock", "averageCost", "createdAt", "updatedAt")
SELECT
    CONCAT('invstk_', item."id"),
    item."organizationId",
    item."id",
    warehouse."id",
    item."stock",
    item."minStock",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "InventoryItem" item
JOIN "InventoryWarehouse" warehouse
  ON warehouse."organizationId" = item."organizationId"
 AND warehouse."branchId" = item."branchId"
 AND warehouse."isDefault" = true
ON CONFLICT DO NOTHING;

-- Backfill historical movements with default warehouse and before/after when missing.
UPDATE "InventoryMovement" movement
SET "warehouseId" = warehouse."id",
    "source" = COALESCE(movement."source", 'MANUAL')
FROM "InventoryItem" item
JOIN "InventoryWarehouse" warehouse
  ON warehouse."organizationId" = item."organizationId"
 AND warehouse."branchId" = item."branchId"
 AND warehouse."isDefault" = true
WHERE movement."inventoryItemId" = item."id"
  AND movement."warehouseId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryWarehouse_organizationId_branchId_name_key" ON "InventoryWarehouse"("organizationId", "branchId", "name");
CREATE INDEX "InventoryWarehouse_organizationId_branchId_isActive_idx" ON "InventoryWarehouse"("organizationId", "branchId", "isActive");
CREATE INDEX "InventoryWarehouse_organizationId_branchId_isDefault_idx" ON "InventoryWarehouse"("organizationId", "branchId", "isDefault");
CREATE UNIQUE INDEX "InventoryStock_inventoryItemId_warehouseId_key" ON "InventoryStock"("inventoryItemId", "warehouseId");
CREATE INDEX "InventoryStock_organizationId_warehouseId_idx" ON "InventoryStock"("organizationId", "warehouseId");
CREATE INDEX "InventoryStock_organizationId_inventoryItemId_idx" ON "InventoryStock"("organizationId", "inventoryItemId");
CREATE INDEX "InventoryMovement_warehouseId_createdAt_idx" ON "InventoryMovement"("warehouseId", "createdAt");
CREATE UNIQUE INDEX "InventoryProductSale_inventoryMovementId_key" ON "InventoryProductSale"("inventoryMovementId");
CREATE INDEX "InventoryProductSale_organizationId_branchId_createdAt_idx" ON "InventoryProductSale"("organizationId", "branchId", "createdAt");
CREATE INDEX "InventoryProductSale_inventoryItemId_createdAt_idx" ON "InventoryProductSale"("inventoryItemId", "createdAt");
CREATE INDEX "InventoryProductSale_patientId_createdAt_idx" ON "InventoryProductSale"("patientId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryWarehouse" ADD CONSTRAINT "InventoryWarehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryWarehouse" ADD CONSTRAINT "InventoryWarehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryProductSale" ADD CONSTRAINT "InventoryProductSale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryProductSale" ADD CONSTRAINT "InventoryProductSale_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryProductSale" ADD CONSTRAINT "InventoryProductSale_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryProductSale" ADD CONSTRAINT "InventoryProductSale_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryProductSale" ADD CONSTRAINT "InventoryProductSale_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryProductSale" ADD CONSTRAINT "InventoryProductSale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
