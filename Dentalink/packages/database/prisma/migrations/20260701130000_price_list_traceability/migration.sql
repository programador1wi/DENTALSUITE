-- CreateEnum
CREATE TYPE "ProcedureType" AS ENUM ('CLINICAL', 'LAB', 'MIXED');

-- CreateEnum
CREATE TYPE "TreatmentPriceSource" AS ENUM ('PRICE_LIST', 'MANUAL', 'UNPRICED');

-- AlterTable
ALTER TABLE "ProcedureCategory"
ADD COLUMN "type" "ProcedureType" NOT NULL DEFAULT 'CLINICAL';

-- AlterTable
ALTER TABLE "Procedure"
ADD COLUMN "type" "ProcedureType" NOT NULL DEFAULT 'CLINICAL';

-- Preserve the previous laboratory signal without turning existing records into pure lab procedures.
UPDATE "Procedure"
SET "type" = 'MIXED'
WHERE "requiresLab" = true;

UPDATE "ProcedureCategory" category
SET "type" = 'MIXED'
WHERE EXISTS (
  SELECT 1
  FROM "Procedure" procedure
  WHERE procedure."categoryId" = category."id"
    AND procedure."type" = 'MIXED'
);

-- AlterTable
ALTER TABLE "TreatmentPlanItem"
ADD COLUMN "priceListId" TEXT,
ADD COLUMN "priceListItemId" TEXT,
ADD COLUMN "priceSource" "TreatmentPriceSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "priceSnapshotName" TEXT,
ADD COLUMN "priceSnapshotCode" TEXT,
ADD COLUMN "priceSnapshotCategory" TEXT,
ADD COLUMN "priceResolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_priceListId_idx" ON "TreatmentPlanItem"("priceListId");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_priceListItemId_idx" ON "TreatmentPlanItem"("priceListItemId");

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_priceListItemId_fkey" FOREIGN KEY ("priceListItemId") REFERENCES "PriceListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
