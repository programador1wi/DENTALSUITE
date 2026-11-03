-- Create arancel-specific categories without removing the global procedure catalog.
CREATE TABLE "PriceListCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "procedureCategoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PriceListItem"
  ADD COLUMN "priceListCategoryId" TEXT;

CREATE UNIQUE INDEX "PriceListCategory_priceListId_name_key" ON "PriceListCategory"("priceListId", "name");
CREATE INDEX "PriceListCategory_organizationId_isActive_idx" ON "PriceListCategory"("organizationId", "isActive");
CREATE INDEX "PriceListCategory_priceListId_isActive_sortOrder_idx" ON "PriceListCategory"("priceListId", "isActive", "sortOrder");
CREATE INDEX "PriceListCategory_procedureCategoryId_idx" ON "PriceListCategory"("procedureCategoryId");
CREATE INDEX "PriceListItem_priceListCategoryId_idx" ON "PriceListItem"("priceListCategoryId");

-- Backfill one arancel category per existing procedure category already priced in each arancel.
INSERT INTO "PriceListCategory" (
    "id",
    "organizationId",
    "priceListId",
    "procedureCategoryId",
    "name",
    "description",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    concat('plcat_', md5(pli."priceListId" || ':' || pc."id")),
    pl."organizationId",
    pli."priceListId",
    pc."id",
    pc."name",
    pc."description",
    pc."sortOrder",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "PriceListItem" pli
INNER JOIN "PriceList" pl ON pl."id" = pli."priceListId"
INNER JOIN "Procedure" p ON p."id" = pli."procedureId"
INNER JOIN "ProcedureCategory" pc ON pc."id" = p."categoryId"
GROUP BY pl."organizationId", pli."priceListId", pc."id", pc."name", pc."description", pc."sortOrder"
ON CONFLICT ("priceListId", "name") DO NOTHING;

UPDATE "PriceListItem" pli
SET "priceListCategoryId" = plc."id"
FROM "Procedure" p
INNER JOIN "PriceListCategory" plc ON plc."procedureCategoryId" = p."categoryId"
WHERE pli."procedureId" = p."id"
  AND pli."priceListId" = plc."priceListId"
  AND pli."priceListCategoryId" IS NULL;

ALTER TABLE "PriceListCategory"
  ADD CONSTRAINT "PriceListCategory_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceListCategory"
  ADD CONSTRAINT "PriceListCategory_priceListId_fkey"
  FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceListCategory"
  ADD CONSTRAINT "PriceListCategory_procedureCategoryId_fkey"
  FOREIGN KEY ("procedureCategoryId") REFERENCES "ProcedureCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceListItem"
  ADD CONSTRAINT "PriceListItem_priceListCategoryId_fkey"
  FOREIGN KEY ("priceListCategoryId") REFERENCES "PriceListCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
