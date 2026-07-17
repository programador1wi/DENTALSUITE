-- CreateEnum
CREATE TYPE "PriceListStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'SUPERSEDED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceListScopeType" AS ENUM ('ORGANIZATION', 'BRANCH', 'SEGMENT', 'AGREEMENT', 'CHANNEL', 'SPECIALTY');

-- CreateEnum
CREATE TYPE "PriceListItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProcedureItemType" AS ENUM ('CLINICAL_SERVICE', 'PRODUCT', 'LABORATORY_SERVICE', 'PACKAGE');

-- CreateEnum
CREATE TYPE "PriceTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'WITH_ERRORS', 'READY', 'APPLYING', 'APPLIED', 'PARTIALLY_APPLIED', 'REVERTED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "PriceList" ADD COLUMN     "basePriceListId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
ADD COLUMN     "currentVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "PriceListStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validTo" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- Backfill stable, collision-safe codes before enforcing the required constraint.
UPDATE "PriceList"
SET "code" = 'PL-' || upper(substr(md5("id"), 1, 10)),
    "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"PriceListStatus" ELSE 'INACTIVE'::"PriceListStatus" END,
    "currentVersion" = 1;

-- Make legacy precedence explicit and deterministic. This does not change any amount.
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "organizationId"
    ORDER BY "isDefault" DESC, "updatedAt" DESC, "id" ASC
  ) AS rank
  FROM "PriceList"
)
UPDATE "PriceList" pl
SET "priority" = 10000 - ranked.rank
FROM ranked
WHERE ranked."id" = pl."id";

ALTER TABLE "PriceList" ALTER COLUMN "code" SET NOT NULL;

-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "allowedProgressValues" JSONB,
ADD COLUMN     "allowsArch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowsProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowsQuantity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "consumesInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createsEvolution" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "itemType" "ProcedureItemType" NOT NULL DEFAULT 'CLINICAL_SERVICE',
ADD COLUMN     "specialtyId" TEXT,
ADD COLUMN     "taxCategory" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProcedureCategory" ADD COLUMN     "code" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TreatmentPlanItem" ADD COLUMN     "internalCostSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "laboratoryCostSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priceCurrency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
ADD COLUMN     "priceListNameSnapshot" TEXT,
ADD COLUMN     "priceListVersionId" TEXT,
ADD COLUMN     "priceListVersionItemId" TEXT,
ADD COLUMN     "priceListVersionNumber" INTEGER,
ADD COLUMN     "pricedById" TEXT,
ADD COLUMN     "pricingRuleSnapshot" JSONB,
ADD COLUMN     "procedureCategorySnapshot" TEXT,
ADD COLUMN     "procedureCodeSnapshot" TEXT,
ADD COLUMN     "procedureNameSnapshot" TEXT;

-- CreateTable
CREATE TABLE "ProcedureVariant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PriceListStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "changeSummary" TEXT,
    "previousVersionId" TEXT,
    "checksum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListScope" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListVersionId" TEXT NOT NULL,
    "scopeType" "PriceListScopeType" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListVersionItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListVersionId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "procedureVariantId" TEXT,
    "displayCategoryId" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "laboratoryCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "internalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allowDiscount" BOOLEAN NOT NULL DEFAULT false,
    "maxDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "authorizationThresholdPercent" DECIMAL(5,2),
    "quantityRule" JSONB,
    "taxCategory" TEXT,
    "status" "PriceListItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceItemId" TEXT,
    "legacyPriceListItemId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListVersionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "specialtyId" TEXT,
    "basePriceListId" TEXT,
    "branchIds" TEXT[],
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" "PriceTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTemplateSection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTemplateItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "procedureVariantId" TEXT,
    "sourceVersionItemId" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "priceListVersionId" TEXT,
    "fileName" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PriceImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "options" JSONB,
    "summary" JSONB,
    "appliedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceImportRow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "status" "PriceImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "appliedItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceImportError" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "importRowId" TEXT,
    "field" TEXT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "actorUserId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "correlationId" TEXT,
    "idempotencyKey" TEXT,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcedureVariant_organizationId_isActive_idx" ON "ProcedureVariant"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ProcedureVariant_procedureId_idx" ON "ProcedureVariant"("procedureId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureVariant_organizationId_code_key" ON "ProcedureVariant"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureVariant_procedureId_name_key" ON "ProcedureVariant"("procedureId", "name");

-- CreateIndex
CREATE INDEX "PriceListVersion_organizationId_status_validFrom_validTo_idx" ON "PriceListVersion"("organizationId", "status", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "PriceListVersion_priceListId_status_idx" ON "PriceListVersion"("priceListId", "status");

-- CreateIndex
CREATE INDEX "PriceListVersion_previousVersionId_idx" ON "PriceListVersion"("previousVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListVersion_priceListId_versionNumber_key" ON "PriceListVersion"("priceListId", "versionNumber");

-- CreateIndex
CREATE INDEX "PriceListScope_organizationId_scopeType_scopeKey_isActive_idx" ON "PriceListScope"("organizationId", "scopeType", "scopeKey", "isActive");

-- CreateIndex
CREATE INDEX "PriceListScope_priceListVersionId_priority_idx" ON "PriceListScope"("priceListVersionId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListScope_priceListVersionId_scopeType_scopeKey_key" ON "PriceListScope"("priceListVersionId", "scopeType", "scopeKey");

-- CreateIndex
CREATE INDEX "PriceListVersionItem_organizationId_procedureId_status_idx" ON "PriceListVersionItem"("organizationId", "procedureId", "status");

-- CreateIndex
CREATE INDEX "PriceListVersionItem_displayCategoryId_idx" ON "PriceListVersionItem"("displayCategoryId");

-- CreateIndex
CREATE INDEX "PriceListVersionItem_sourceItemId_idx" ON "PriceListVersionItem"("sourceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListVersionItem_priceListVersionId_procedureId_procedu_key" ON "PriceListVersionItem"("priceListVersionId", "procedureId", "procedureVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListVersionItem_legacyPriceListItemId_key" ON "PriceListVersionItem"("legacyPriceListItemId");

-- CreateIndex
CREATE INDEX "PriceTemplate_organizationId_status_idx" ON "PriceTemplate"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PriceTemplate_specialtyId_idx" ON "PriceTemplate"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTemplate_organizationId_name_version_key" ON "PriceTemplate"("organizationId", "name", "version");

-- CreateIndex
CREATE INDEX "PriceTemplateSection_organizationId_templateId_idx" ON "PriceTemplateSection"("organizationId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTemplateSection_templateId_sortOrder_name_key" ON "PriceTemplateSection"("templateId", "sortOrder", "name");

-- CreateIndex
CREATE INDEX "PriceTemplateItem_organizationId_sectionId_idx" ON "PriceTemplateItem"("organizationId", "sectionId");

-- CreateIndex
CREATE INDEX "PriceTemplateItem_sourceVersionItemId_idx" ON "PriceTemplateItem"("sourceVersionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTemplateItem_sectionId_procedureId_procedureVariantId_key" ON "PriceTemplateItem"("sectionId", "procedureId", "procedureVariantId");

-- CreateIndex
CREATE INDEX "PriceImportJob_organizationId_status_createdAt_idx" ON "PriceImportJob"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PriceImportJob_priceListId_createdAt_idx" ON "PriceImportJob"("priceListId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceImportJob_priceListVersionId_idx" ON "PriceImportJob"("priceListVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceImportJob_organizationId_idempotencyKey_key" ON "PriceImportJob"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PriceImportRow_organizationId_status_idx" ON "PriceImportRow"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceImportRow_importJobId_rowNumber_key" ON "PriceImportRow"("importJobId", "rowNumber");

-- CreateIndex
CREATE INDEX "PriceImportError_organizationId_importJobId_idx" ON "PriceImportError"("organizationId", "importJobId");

-- CreateIndex
CREATE INDEX "PriceImportError_importRowId_idx" ON "PriceImportError"("importRowId");

-- CreateIndex
CREATE INDEX "PricingAuditEvent_organizationId_entity_entityId_createdAt_idx" ON "PricingAuditEvent"("organizationId", "entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "PricingAuditEvent_correlationId_idx" ON "PricingAuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "PricingAuditEvent_branchId_createdAt_idx" ON "PricingAuditEvent"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_organizationId_aggregateType_aggregateId_idx" ON "OutboxEvent"("organizationId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_organizationId_idempotencyKey_key" ON "OutboxEvent"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PriceList_organizationId_status_validFrom_validTo_idx" ON "PriceList"("organizationId", "status", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "PriceList_basePriceListId_idx" ON "PriceList"("basePriceListId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_organizationId_code_key" ON "PriceList"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Procedure_organizationId_itemType_isActive_idx" ON "Procedure"("organizationId", "itemType", "isActive");

-- CreateIndex
CREATE INDEX "Procedure_specialtyId_idx" ON "Procedure"("specialtyId");

-- CreateIndex
CREATE INDEX "ProcedureCategory_parentId_isActive_idx" ON "ProcedureCategory"("parentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureCategory_organizationId_code_key" ON "ProcedureCategory"("organizationId", "code");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_priceListVersionId_idx" ON "TreatmentPlanItem"("priceListVersionId");

-- CreateIndex
CREATE INDEX "TreatmentPlanItem_priceListVersionItemId_idx" ON "TreatmentPlanItem"("priceListVersionItemId");

-- AddForeignKey
ALTER TABLE "ProcedureCategory" ADD CONSTRAINT "ProcedureCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProcedureCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_basePriceListId_fkey" FOREIGN KEY ("basePriceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureVariant" ADD CONSTRAINT "ProcedureVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureVariant" ADD CONSTRAINT "ProcedureVariant_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersion" ADD CONSTRAINT "PriceListVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersion" ADD CONSTRAINT "PriceListVersion_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersion" ADD CONSTRAINT "PriceListVersion_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "PriceListVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListScope" ADD CONSTRAINT "PriceListScope_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListScope" ADD CONSTRAINT "PriceListScope_priceListVersionId_fkey" FOREIGN KEY ("priceListVersionId") REFERENCES "PriceListVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_priceListVersionId_fkey" FOREIGN KEY ("priceListVersionId") REFERENCES "PriceListVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_procedureVariantId_fkey" FOREIGN KEY ("procedureVariantId") REFERENCES "ProcedureVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_displayCategoryId_fkey" FOREIGN KEY ("displayCategoryId") REFERENCES "ProcedureCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "PriceListVersionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplate" ADD CONSTRAINT "PriceTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplate" ADD CONSTRAINT "PriceTemplate_basePriceListId_fkey" FOREIGN KEY ("basePriceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplateSection" ADD CONSTRAINT "PriceTemplateSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplateSection" ADD CONSTRAINT "PriceTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PriceTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplateItem" ADD CONSTRAINT "PriceTemplateItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplateItem" ADD CONSTRAINT "PriceTemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "PriceTemplateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplateItem" ADD CONSTRAINT "PriceTemplateItem_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplateItem" ADD CONSTRAINT "PriceTemplateItem_procedureVariantId_fkey" FOREIGN KEY ("procedureVariantId") REFERENCES "ProcedureVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTemplateItem" ADD CONSTRAINT "PriceTemplateItem_sourceVersionItemId_fkey" FOREIGN KEY ("sourceVersionItemId") REFERENCES "PriceListVersionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportJob" ADD CONSTRAINT "PriceImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportJob" ADD CONSTRAINT "PriceImportJob_priceListVersionId_fkey" FOREIGN KEY ("priceListVersionId") REFERENCES "PriceListVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportRow" ADD CONSTRAINT "PriceImportRow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportRow" ADD CONSTRAINT "PriceImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "PriceImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportError" ADD CONSTRAINT "PriceImportError_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportError" ADD CONSTRAINT "PriceImportError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "PriceImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceImportError" ADD CONSTRAINT "PriceImportError_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "PriceImportRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingAuditEvent" ADD CONSTRAINT "PricingAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_priceListVersionId_fkey" FOREIGN KEY ("priceListVersionId") REFERENCES "PriceListVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_priceListVersionItemId_fkey" FOREIGN KEY ("priceListVersionItemId") REFERENCES "PriceListVersionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Safety constraints for validity windows, money and percentages.
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_validity_check"
  CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" > "validFrom");
ALTER TABLE "PriceListVersion" ADD CONSTRAINT "PriceListVersion_validity_check"
  CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" > "validFrom");
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_money_check"
  CHECK ("basePrice" >= 0 AND "laboratoryCost" >= 0 AND "internalCost" >= 0);
ALTER TABLE "PriceListVersionItem" ADD CONSTRAINT "PriceListVersionItem_discount_check"
  CHECK (
    "maxDiscountPercent" BETWEEN 0 AND 100
    AND ("authorizationThresholdPercent" IS NULL OR "authorizationThresholdPercent" BETWEEN 0 AND 100)
  );
ALTER TABLE "ProcedureCategory" ADD CONSTRAINT "ProcedureCategory_parent_check"
  CHECK ("parentId" IS NULL OR "parentId" <> "id");

-- Backfill one immutable version for every legacy list without changing legacy identifiers.
INSERT INTO "PriceListVersion" (
  "id", "organizationId", "priceListId", "versionNumber", "status", "validFrom", "validTo",
  "currency", "publishedAt", "changeSummary", "checksum", "version", "createdAt", "updatedAt"
)
SELECT
  'plv2_' || md5(pl."id" || ':1'),
  pl."organizationId",
  pl."id",
  1,
  CASE WHEN pl."isActive" THEN 'ACTIVE'::"PriceListStatus" ELSE 'INACTIVE'::"PriceListStatus" END,
  pl."validFrom",
  pl."validTo",
  pl."currency",
  CASE WHEN pl."isActive" THEN pl."updatedAt" ELSE NULL END,
  'Versión inicial creada desde el arancel legacy',
  md5(pl."id" || ':' || pl."updatedAt"::text),
  1,
  pl."createdAt",
  pl."updatedAt"
FROM "PriceList" pl
ON CONFLICT ("priceListId", "versionNumber") DO NOTHING;

-- Preserve legacy prices exactly; no historical amount is recalculated.
INSERT INTO "PriceListVersionItem" (
  "id", "organizationId", "priceListVersionId", "procedureId", "displayCategoryId",
  "basePrice", "laboratoryCost", "internalCost", "allowDiscount", "maxDiscountPercent",
  "status", "legacyPriceListItemId", "version", "createdAt", "updatedAt"
)
SELECT
  'plvi_' || md5(pli."id"),
  pl."organizationId",
  plv."id",
  pli."procedureId",
  COALESCE(plc."procedureCategoryId", p."categoryId"),
  pli."price",
  pli."labCost",
  0,
  pli."allowsDiscount",
  CASE WHEN pli."allowsDiscount" THEN 100 ELSE 0 END,
  'ACTIVE'::"PriceListItemStatus",
  pli."id",
  1,
  pli."createdAt",
  pli."updatedAt"
FROM "PriceListItem" pli
JOIN "PriceList" pl ON pl."id" = pli."priceListId"
JOIN "PriceListVersion" plv ON plv."priceListId" = pl."id" AND plv."versionNumber" = 1
JOIN "Procedure" p ON p."id" = pli."procedureId"
LEFT JOIN "PriceListCategory" plc ON plc."id" = pli."priceListCategoryId"
ON CONFLICT ("legacyPriceListItemId") DO NOTHING;

-- Convert legacy branch availability into explicit version scopes.
INSERT INTO "PriceListScope" (
  "id", "organizationId", "priceListVersionId", "scopeType", "scopeKey", "priority", "isActive", "createdAt", "updatedAt"
)
SELECT
  'plscope_' || md5(plv."id" || ':BRANCH:' || bpl."branchId"),
  bpl."organizationId",
  plv."id",
  'BRANCH'::"PriceListScopeType",
  bpl."branchId",
  (CASE WHEN bpl."isDefault" THEN 10000 ELSE 0 END) + pl."priority",
  bpl."isActive",
  bpl."createdAt",
  bpl."updatedAt"
FROM "BranchPriceList" bpl
JOIN "PriceList" pl ON pl."id" = bpl."priceListId"
JOIN "PriceListVersion" plv ON plv."priceListId" = pl."id" AND plv."versionNumber" = 1
ON CONFLICT ("priceListVersionId", "scopeType", "scopeKey") DO NOTHING;

INSERT INTO "PriceListScope" (
  "id", "organizationId", "priceListVersionId", "scopeType", "scopeKey", "priority", "isActive", "createdAt", "updatedAt"
)
SELECT
  'plscope_' || md5(plv."id" || ':ORGANIZATION:' || pl."organizationId"),
  pl."organizationId",
  plv."id",
  'ORGANIZATION'::"PriceListScopeType",
  pl."organizationId",
  pl."priority",
  pl."isActive",
  pl."createdAt",
  pl."updatedAt"
FROM "PriceList" pl
JOIN "PriceListVersion" plv ON plv."priceListId" = pl."id" AND plv."versionNumber" = 1
WHERE pl."isDefault"
ON CONFLICT ("priceListVersionId", "scopeType", "scopeKey") DO NOTHING;

-- Backfill clinical snapshots from the values that were historically stored.
UPDATE "TreatmentPlanItem" tpi
SET
  "procedureCodeSnapshot" = COALESCE(tpi."procedureCodeSnapshot", p."code"),
  "procedureNameSnapshot" = COALESCE(tpi."procedureNameSnapshot", p."name"),
  "procedureCategorySnapshot" = COALESCE(tpi."procedureCategorySnapshot", pc."name"),
  "priceSnapshotCode" = COALESCE(tpi."priceSnapshotCode", p."code"),
  "priceSnapshotCategory" = COALESCE(tpi."priceSnapshotCategory", pc."name")
FROM "Procedure" p
JOIN "ProcedureCategory" pc ON pc."id" = p."categoryId"
WHERE p."id" = tpi."procedureId";

UPDATE "TreatmentPlanItem" tpi
SET
  "priceListVersionId" = plv."id",
  "priceListVersionNumber" = plv."versionNumber",
  "priceListNameSnapshot" = COALESCE(tpi."priceListNameSnapshot", pl."name"),
  "priceSnapshotName" = COALESCE(tpi."priceSnapshotName", pl."name"),
  "priceCurrency" = plv."currency",
  "priceResolvedAt" = COALESCE(tpi."priceResolvedAt", tpi."createdAt"),
  "pricingRuleSnapshot" = COALESCE(
    tpi."pricingRuleSnapshot",
    jsonb_build_object('source', 'LEGACY_MIGRATION', 'priceListId', pl."id", 'version', plv."versionNumber")
  )
FROM "PriceListVersion" plv
JOIN "PriceList" pl ON pl."id" = plv."priceListId"
WHERE tpi."priceListId" = pl."id" AND plv."versionNumber" = 1;

UPDATE "TreatmentPlanItem" tpi
SET
  "priceListVersionItemId" = plvi."id",
  "laboratoryCostSnapshot" = plvi."laboratoryCost",
  "internalCostSnapshot" = plvi."internalCost"
FROM "PriceListVersionItem" plvi
WHERE plvi."priceListVersionId" = tpi."priceListVersionId"
  AND plvi."procedureId" = tpi."procedureId"
  AND plvi."procedureVariantId" IS NULL;

-- Fill agreement snapshots only from the already published agreement version; never recompute amounts.
UPDATE "TreatmentPlanItem" tpi
SET
  "agreementVersionId" = COALESCE(tpi."agreementVersionId", av."id"),
  "agreementVersionNumber" = COALESCE(tpi."agreementVersionNumber", av."version"),
  "agreementSnapshot" = COALESCE(
    tpi."agreementSnapshot",
    jsonb_build_object(
      'source', 'LEGACY_MIGRATION',
      'agreementId', a."id",
      'agreementName', a."name",
      'agreementVersion', av."version"
    )
  )
FROM "Agreement" a
JOIN "AgreementVersion" av ON av."agreementId" = a."id" AND av."version" = a."version"
WHERE tpi."agreementId" = a."id";

-- One auditable marker per organization for the controlled migration.
INSERT INTO "PricingAuditEvent" (
  "id", "organizationId", "entity", "entityId", "action", "newValue", "reason", "createdAt"
)
SELECT
  'pae_' || md5(o."id" || ':price-list-v2-backfill'),
  o."id",
  'PriceListMigration',
  o."id",
  'legacy_backfill',
  jsonb_build_object(
    'priceLists', (SELECT COUNT(*) FROM "PriceList" pl WHERE pl."organizationId" = o."id"),
    'versionItems', (SELECT COUNT(*) FROM "PriceListVersionItem" vi WHERE vi."organizationId" = o."id")
  ),
  'Backfill aditivo sin recálculo de importes históricos',
  CURRENT_TIMESTAMP
FROM "Organization" o;
