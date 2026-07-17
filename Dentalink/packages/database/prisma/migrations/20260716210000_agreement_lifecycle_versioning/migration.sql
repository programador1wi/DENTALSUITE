-- Expand the legacy Agreement row without removing its identifiers or relations.
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'INACTIVE', 'CANCELLED');
CREATE TYPE "AgreementType" AS ENUM ('CORPORATE', 'INSURANCE', 'MEMBERSHIP', 'PAYROLL', 'OTHER');

ALTER TABLE "Agreement"
  ADD COLUMN "entityName" TEXT,
  ADD COLUMN "entityTaxId" TEXT,
  ADD COLUMN "type" "AgreementType" NOT NULL DEFAULT 'CORPORATE',
  ADD COLUMN "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "coveragePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "copayAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "coverageLimitAmount" DECIMAL(10,2),
  ADD COLUMN "coverageRules" JSONB,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Keep the legacy boolean compatible with the richer lifecycle.
UPDATE "Agreement"
SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"AgreementStatus" ELSE 'INACTIVE'::"AgreementStatus" END,
    "publishedAt" = CASE WHEN "isActive" THEN "updatedAt" ELSE NULL END;

CREATE TABLE "AgreementVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "entityName" TEXT,
  "entityTaxId" TEXT,
  "type" "AgreementType" NOT NULL,
  "description" TEXT,
  "priceListId" TEXT,
  "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "coveragePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "copayAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "coverageLimitAmount" DECIMAL(10,2),
  "coverageRules" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgreementVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgreementVersion_agreementId_version_key" ON "AgreementVersion"("agreementId", "version");
CREATE INDEX "AgreementVersion_organizationId_agreementId_version_idx" ON "AgreementVersion"("organizationId", "agreementId", "version");
CREATE INDEX "AgreementVersion_priceListId_idx" ON "AgreementVersion"("priceListId");

CREATE TABLE "AgreementBranch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agreementVersionId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgreementBranch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgreementBranch_agreementVersionId_branchId_key" ON "AgreementBranch"("agreementVersionId", "branchId");
CREATE INDEX "AgreementBranch_organizationId_branchId_idx" ON "AgreementBranch"("organizationId", "branchId");

CREATE TABLE "AgreementProcedureRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agreementVersionId" TEXT NOT NULL,
  "procedureId" TEXT NOT NULL,
  "isEligible" BOOLEAN NOT NULL DEFAULT true,
  "preferredPrice" DECIMAL(10,2),
  "discountPercent" DECIMAL(5,2),
  "coveragePercent" DECIMAL(5,2),
  "copayAmount" DECIMAL(10,2),
  "coverageLimitAmount" DECIMAL(10,2),
  "coverageRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgreementProcedureRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgreementProcedureRule_agreementVersionId_procedureId_key" ON "AgreementProcedureRule"("agreementVersionId", "procedureId");
CREATE INDEX "AgreementProcedureRule_organizationId_procedureId_idx" ON "AgreementProcedureRule"("organizationId", "procedureId");

CREATE TABLE "AgreementPatientAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "notes" TEXT,
  CONSTRAINT "AgreementPatientAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgreementPatientAssignment_organizationId_patientId_revokedAt_idx" ON "AgreementPatientAssignment"("organizationId", "patientId", "revokedAt");
CREATE INDEX "AgreementPatientAssignment_agreementId_version_idx" ON "AgreementPatientAssignment"("agreementId", "version");

ALTER TABLE "TreatmentPlan"
  ADD COLUMN "agreementId" TEXT,
  ADD COLUMN "agreementVersionNumber" INTEGER,
  ADD COLUMN "agreementSnapshot" JSONB;
ALTER TABLE "TreatmentPlanItem"
  ADD COLUMN "agreementVersionId" TEXT,
  ADD COLUMN "agreementVersionNumber" INTEGER,
  ADD COLUMN "agreementSnapshot" JSONB,
  ADD COLUMN "agreementNormalPrice" DECIMAL(10,2),
  ADD COLUMN "agreementAppliedPrice" DECIMAL(10,2),
  ADD COLUMN "agreementDiscountAmount" DECIMAL(10,2);

CREATE INDEX "Agreement_organizationId_status_startsAt_endsAt_idx" ON "Agreement"("organizationId", "status", "startsAt", "endsAt");
CREATE INDEX "TreatmentPlan_agreementId_agreementVersionNumber_idx" ON "TreatmentPlan"("agreementId", "agreementVersionNumber");
CREATE INDEX "TreatmentPlanItem_agreementId_agreementVersionNumber_idx" ON "TreatmentPlanItem"("agreementId", "agreementVersionNumber");

ALTER TABLE "AgreementVersion" ADD CONSTRAINT "AgreementVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementVersion" ADD CONSTRAINT "AgreementVersion_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementVersion" ADD CONSTRAINT "AgreementVersion_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgreementBranch" ADD CONSTRAINT "AgreementBranch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementBranch" ADD CONSTRAINT "AgreementBranch_agreementVersionId_fkey" FOREIGN KEY ("agreementVersionId") REFERENCES "AgreementVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementBranch" ADD CONSTRAINT "AgreementBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementProcedureRule" ADD CONSTRAINT "AgreementProcedureRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementProcedureRule" ADD CONSTRAINT "AgreementProcedureRule_agreementVersionId_fkey" FOREIGN KEY ("agreementVersionId") REFERENCES "AgreementVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementProcedureRule" ADD CONSTRAINT "AgreementProcedureRule_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementPatientAssignment" ADD CONSTRAINT "AgreementPatientAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementPatientAssignment" ADD CONSTRAINT "AgreementPatientAssignment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementPatientAssignment" ADD CONSTRAINT "AgreementPatientAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
