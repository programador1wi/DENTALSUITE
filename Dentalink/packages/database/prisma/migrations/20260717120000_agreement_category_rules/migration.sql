CREATE TABLE "AgreementCategoryRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agreementVersionId" TEXT NOT NULL,
  "procedureCategoryId" TEXT NOT NULL,
  "isEligible" BOOLEAN NOT NULL DEFAULT true,
  "preferredPrice" DECIMAL(10,2),
  "discountPercent" DECIMAL(5,2),
  "coveragePercent" DECIMAL(5,2),
  "copayAmount" DECIMAL(10,2),
  "coverageLimitAmount" DECIMAL(10,2),
  "coverageRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgreementCategoryRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgreementCategoryRule_agreementVersionId_procedureCategoryId_key"
  ON "AgreementCategoryRule"("agreementVersionId", "procedureCategoryId");

CREATE INDEX "AgreementCategoryRule_organizationId_procedureCategoryId_idx"
  ON "AgreementCategoryRule"("organizationId", "procedureCategoryId");

ALTER TABLE "AgreementCategoryRule"
  ADD CONSTRAINT "AgreementCategoryRule_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgreementCategoryRule"
  ADD CONSTRAINT "AgreementCategoryRule_agreementVersionId_fkey"
  FOREIGN KEY ("agreementVersionId") REFERENCES "AgreementVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgreementCategoryRule"
  ADD CONSTRAINT "AgreementCategoryRule_procedureCategoryId_fkey"
  FOREIGN KEY ("procedureCategoryId") REFERENCES "ProcedureCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
