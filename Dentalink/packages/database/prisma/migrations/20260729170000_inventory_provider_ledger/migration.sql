-- Inventory remains locally authoritative in this phase.
-- Existing InventoryItem.stock/minStock and IN/OUT/ADJUSTMENT contracts are preserved.

CREATE TYPE "InventoryMovementStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED', 'FAILED');
CREATE TYPE "InventoryLotStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED', 'BLOCKED');
CREATE TYPE "InventoryStockCountStatus" AS ENUM ('DRAFT', 'COUNTED', 'RECONCILED', 'CANCELLED');

ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'ENTRY';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'EXIT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'POSITIVE_ADJUSTMENT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'NEGATIVE_ADJUSTMENT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'WASTE';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'SUPPLIER_RETURN';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'RETURN_IN';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'INITIAL_BALANCE';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'PHYSICAL_COUNT_ADJUSTMENT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'COMPENSATION';

CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryUnit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "decimalAllowed" BOOLEAN NOT NULL DEFAULT false,
    "precision" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryUnit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryItem"
    ADD COLUMN "allowFractionalQuantity" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "barcode" TEXT,
    ADD COLUMN "brand" TEXT,
    ADD COLUMN "categoryId" TEXT,
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'MXN',
    ADD COLUMN "deactivatedAt" TIMESTAMP(3),
    ADD COLUMN "deactivatedById" TEXT,
    ADD COLUMN "description" TEXT,
    ADD COLUMN "manufacturer" TEXT,
    ADD COLUMN "presentation" TEXT,
    ADD COLUMN "tracksExpiration" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "tracksLots" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "unitId" TEXT,
    ADD COLUMN "updatedById" TEXT,
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

INSERT INTO "InventoryCategory" ("id", "organizationId", "name", "createdAt", "updatedAt")
SELECT 'invcat_' || SUBSTRING(md5("organizationId" || ':' || "category"), 1, 20),
       "organizationId", "category", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "InventoryItem"
GROUP BY "organizationId", "category"
ON CONFLICT DO NOTHING;

INSERT INTO "InventoryUnit" ("id", "organizationId", "code", "name", "abbreviation", "decimalAllowed", "precision", "createdAt", "updatedAt")
SELECT 'invunit_' || SUBSTRING(md5("organizationId" || ':' || "unit"), 1, 20),
       "organizationId",
       UPPER(SUBSTRING(REGEXP_REPLACE("unit", '[^A-Za-z0-9]+', '', 'g'), 1, 12)) || '-' || SUBSTRING(md5("unit"), 1, 4),
       "unit",
       SUBSTRING("unit", 1, 8),
       true,
       2,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "InventoryItem"
GROUP BY "organizationId", "unit"
ON CONFLICT DO NOTHING;

UPDATE "InventoryItem" item
SET "categoryId" = category."id"
FROM "InventoryCategory" category
WHERE category."organizationId" = item."organizationId"
  AND category."name" = item."category";

UPDATE "InventoryItem" item
SET "unitId" = unit."id"
FROM "InventoryUnit" unit
WHERE unit."organizationId" = item."organizationId"
  AND unit."name" = item."unit";

ALTER TABLE "InventoryWarehouse"
    ADD COLUMN "code" TEXT,
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "updatedById" TEXT,
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "InventoryWarehouse"
SET "code" = 'WH-' || UPPER(SUBSTRING(md5("id"), 1, 8))
WHERE "code" IS NULL;

ALTER TABLE "InventoryWarehouse" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "InventoryStock"
    ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'MXN',
    ADD COLUMN "lastMovementAt" TIMESTAMP(3),
    ADD COLUMN "reservedStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "InventoryMovement"
    ADD COLUMN "correlationId" TEXT,
    ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'MXN',
    ADD COLUMN "destinationWarehouseId" TEXT,
    ADD COLUMN "documentDate" TIMESTAMP(3),
    ADD COLUMN "documentNumber" TEXT,
    ADD COLUMN "documentType" TEXT,
    ADD COLUMN "externalReference" TEXT,
    ADD COLUMN "idempotencyKey" TEXT,
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "occurredAt" TIMESTAMP(3),
    ADD COLUMN "organizationId" TEXT,
    ADD COLUMN "postedAt" TIMESTAMP(3),
    ADD COLUMN "reasonCode" TEXT,
    ADD COLUMN "reference" TEXT,
    ADD COLUMN "sourceWarehouseId" TEXT,
    ADD COLUMN "status" "InventoryMovementStatus" NOT NULL DEFAULT 'POSTED',
    ADD COLUMN "supplierId" TEXT,
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "voidedAt" TIMESTAMP(3);

UPDATE "InventoryMovement" movement
SET "organizationId" = item."organizationId",
    "occurredAt" = movement."createdAt",
    "postedAt" = movement."createdAt",
    "sourceWarehouseId" = CASE WHEN movement."type" = 'OUT' THEN movement."warehouseId" ELSE NULL END,
    "destinationWarehouseId" = CASE WHEN movement."type" IN ('IN', 'ADJUSTMENT') THEN movement."warehouseId" ELSE NULL END
FROM "InventoryItem" item
WHERE item."id" = movement."inventoryItemId";

ALTER TABLE "InventoryMovement" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "InventoryMovement" ALTER COLUMN "occurredAt" SET NOT NULL;
ALTER TABLE "InventoryMovement" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "InventoryLotStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovementLine" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "sourceLotId" TEXT,
    "destinationLotId" TEXT,
    "lotNumberSnapshot" TEXT,
    "expirationSnapshot" TIMESTAMP(3),
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salePriceSnapshot" DECIMAL(10,2),
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stockBefore" DECIMAL(12,2) NOT NULL,
    "stockAfter" DECIMAL(12,2) NOT NULL,
    "averageCostBefore" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "averageCostAfter" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovementLine_pkey" PRIMARY KEY ("id")
);

INSERT INTO "InventoryMovementLine" (
    "id", "movementId", "inventoryItemId", "quantity", "unitCost", "totalCost",
    "stockBefore", "stockAfter", "averageCostBefore", "averageCostAfter", "notes", "createdAt"
)
SELECT 'invline_' || SUBSTRING(md5(movement."id"), 1, 20),
       movement."id",
       movement."inventoryItemId",
       movement."quantity",
       COALESCE(movement."unitCost", 0),
       movement."quantity" * COALESCE(movement."unitCost", 0),
       COALESCE(movement."stockBefore", 0),
       COALESCE(movement."stockAfter", 0),
       0,
       0,
       movement."reason",
       movement."createdAt"
FROM "InventoryMovement" movement
ON CONFLICT DO NOTHING;

CREATE TABLE "InventoryStockCount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "InventoryStockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "countedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "InventoryStockCount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryStockCountLine" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(12,2) NOT NULL,
    "countedQuantity" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "resultingMovementId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryStockCountLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryExternalEntityMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "localEntityId" TEXT NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "inventoryItemId" TEXT,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryExternalEntityMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryCategory_organizationId_name_key" ON "InventoryCategory"("organizationId", "name");
CREATE INDEX "InventoryCategory_organizationId_isActive_idx" ON "InventoryCategory"("organizationId", "isActive");
CREATE UNIQUE INDEX "InventoryUnit_organizationId_code_key" ON "InventoryUnit"("organizationId", "code");
CREATE UNIQUE INDEX "InventoryUnit_organizationId_name_key" ON "InventoryUnit"("organizationId", "name");
CREATE INDEX "InventoryUnit_organizationId_isActive_idx" ON "InventoryUnit"("organizationId", "isActive");
CREATE UNIQUE INDEX "InventoryItem_organizationId_barcode_key" ON "InventoryItem"("organizationId", "barcode");
CREATE INDEX "InventoryItem_organizationId_categoryId_idx" ON "InventoryItem"("organizationId", "categoryId");
CREATE UNIQUE INDEX "InventoryWarehouse_organizationId_branchId_code_key" ON "InventoryWarehouse"("organizationId", "branchId", "code");
CREATE UNIQUE INDEX "InventoryMovement_organizationId_idempotencyKey_key" ON "InventoryMovement"("organizationId", "idempotencyKey");
CREATE INDEX "InventoryMovement_organizationId_occurredAt_idx" ON "InventoryMovement"("organizationId", "occurredAt");
CREATE INDEX "InventoryMovement_sourceWarehouseId_occurredAt_idx" ON "InventoryMovement"("sourceWarehouseId", "occurredAt");
CREATE INDEX "InventoryMovement_destinationWarehouseId_occurredAt_idx" ON "InventoryMovement"("destinationWarehouseId", "occurredAt");
CREATE UNIQUE INDEX "InventoryLot_warehouseId_inventoryItemId_lotNumber_key" ON "InventoryLot"("warehouseId", "inventoryItemId", "lotNumber");
CREATE INDEX "InventoryLot_organizationId_warehouseId_inventoryItemId_idx" ON "InventoryLot"("organizationId", "warehouseId", "inventoryItemId");
CREATE INDEX "InventoryLot_expirationDate_status_idx" ON "InventoryLot"("expirationDate", "status");
CREATE INDEX "InventoryMovementLine_movementId_idx" ON "InventoryMovementLine"("movementId");
CREATE INDEX "InventoryMovementLine_inventoryItemId_createdAt_idx" ON "InventoryMovementLine"("inventoryItemId", "createdAt");
CREATE INDEX "InventoryMovementLine_sourceLotId_idx" ON "InventoryMovementLine"("sourceLotId");
CREATE INDEX "InventoryMovementLine_destinationLotId_idx" ON "InventoryMovementLine"("destinationLotId");
CREATE INDEX "InventoryStockCount_organizationId_branchId_warehouseId_sta_idx" ON "InventoryStockCount"("organizationId", "branchId", "warehouseId", "status");
CREATE INDEX "InventoryStockCount_createdAt_idx" ON "InventoryStockCount"("createdAt");
CREATE UNIQUE INDEX "InventoryStockCountLine_stockCountId_inventoryItemId_key" ON "InventoryStockCountLine"("stockCountId", "inventoryItemId");
CREATE INDEX "InventoryStockCountLine_inventoryItemId_idx" ON "InventoryStockCountLine"("inventoryItemId");
CREATE UNIQUE INDEX "InventoryExternalEntityMapping_organizationId_entityType_lo_key" ON "InventoryExternalEntityMapping"("organizationId", "entityType", "localEntityId", "externalSystem");
CREATE UNIQUE INDEX "InventoryExternalEntityMapping_organizationId_entityType_ex_key" ON "InventoryExternalEntityMapping"("organizationId", "entityType", "externalSystem", "externalId");
CREATE INDEX "InventoryExternalEntityMapping_organizationId_externalSyste_idx" ON "InventoryExternalEntityMapping"("organizationId", "externalSystem");

ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryUnit" ADD CONSTRAINT "InventoryUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "InventoryUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementLine" ADD CONSTRAINT "InventoryMovementLine_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementLine" ADD CONSTRAINT "InventoryMovementLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementLine" ADD CONSTRAINT "InventoryMovementLine_sourceLotId_fkey" FOREIGN KEY ("sourceLotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovementLine" ADD CONSTRAINT "InventoryMovementLine_destinationLotId_fkey" FOREIGN KEY ("destinationLotId") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCount" ADD CONSTRAINT "InventoryStockCount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCount" ADD CONSTRAINT "InventoryStockCount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCount" ADD CONSTRAINT "InventoryStockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCountLine" ADD CONSTRAINT "InventoryStockCountLine_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "InventoryStockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockCountLine" ADD CONSTRAINT "InventoryStockCountLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryExternalEntityMapping" ADD CONSTRAINT "InventoryExternalEntityMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryExternalEntityMapping" ADD CONSTRAINT "InventoryExternalEntityMapping_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "InventoryWarehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryExternalEntityMapping" ADD CONSTRAINT "InventoryExternalEntityMapping_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

