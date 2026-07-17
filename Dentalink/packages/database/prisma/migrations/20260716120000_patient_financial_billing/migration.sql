DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerEntryType') THEN
    CREATE TYPE "LedgerEntryType" AS ENUM ('CHARGE', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'VOID');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerSourceType') THEN
    CREATE TYPE "LedgerSourceType" AS ENUM ('TREATMENT', 'PAYMENT', 'REFUND', 'INSTALLMENT', 'MANUAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerEntryStatus') THEN
    CREATE TYPE "LedgerEntryStatus" AS ENUM ('APPLIED', 'REVERTED', 'PENDING');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinancialDocumentType') THEN
    CREATE TYPE "FinancialDocumentType" AS ENUM (
      'PAYMENT_RECEIPT',
      'INVOICE',
      'SALES_RECEIPT',
      'CREDIT_NOTE',
      'DEBIT_NOTE',
      'PAYMENT_COMPLEMENT',
      'REFUND_RECEIPT',
      'BUDGET_DOCUMENT',
      'ACCOUNT_STATEMENT',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinancialDocumentStatus') THEN
    CREATE TYPE "FinancialDocumentStatus" AS ENUM (
      'DRAFT',
      'ISSUING',
      'ISSUED',
      'ACCEPTED',
      'REJECTED',
      'CANCEL_REQUESTED',
      'CANCELLED',
      'REPLACED',
      'FAILED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CoverageStatus') THEN
    CREATE TYPE "CoverageStatus" AS ENUM (
      'NOT_VALIDATED',
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'AUTHORIZED',
      'PARTIALLY_AUTHORIZED',
      'REJECTED',
      'EXPIRED',
      'CANCELLED',
      'SETTLED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthorizationStatus') THEN
    CREATE TYPE "AuthorizationStatus" AS ENUM (
      'SUBMITTED',
      'UNDER_REVIEW',
      'AUTHORIZED',
      'PARTIALLY_AUTHORIZED',
      'REJECTED',
      'EXPIRED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PatientLedgerEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entryType" "LedgerEntryType" NOT NULL,
  "sourceType" "LedgerSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "planId" TEXT,
  "debitAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "creditAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
  "descriptionSnapshot" TEXT,
  "status" "LedgerEntryStatus" NOT NULL DEFAULT 'APPLIED',
  "reversalEntryId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PatientLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinancialDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "type" "FinancialDocumentType" NOT NULL,
  "folio" TEXT,
  "status" "FinancialDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "taxes" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "issuedAt" TIMESTAMP(3),
  "paymentId" TEXT,
  "refundId" TEXT,
  "treatmentPlanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinancialDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinancialDocumentFile" (
  "id" TEXT NOT NULL,
  "financialDocumentId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FinancialDocumentFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoverageCase" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "agreementId" TEXT,
  "policyNumber" TEXT,
  "status" "CoverageStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoverageCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoverageAuthorization" (
  "id" TEXT NOT NULL,
  "coverageCaseId" TEXT NOT NULL,
  "treatmentPlanId" TEXT,
  "authorizationCode" TEXT,
  "requestedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "authorizedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "consumedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" "AuthorizationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoverageAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PatientLedgerEntry_organizationId_branchId_occurredAt_idx"
ON "PatientLedgerEntry"("organizationId", "branchId", "occurredAt");

CREATE INDEX IF NOT EXISTS "PatientLedgerEntry_patientId_occurredAt_idx"
ON "PatientLedgerEntry"("patientId", "occurredAt");

CREATE INDEX IF NOT EXISTS "FinancialDocument_organizationId_branchId_type_idx"
ON "FinancialDocument"("organizationId", "branchId", "type");

CREATE INDEX IF NOT EXISTS "FinancialDocument_patientId_idx"
ON "FinancialDocument"("patientId");

CREATE INDEX IF NOT EXISTS "CoverageCase_organizationId_patientId_idx"
ON "CoverageCase"("organizationId", "patientId");

CREATE INDEX IF NOT EXISTS "CoverageAuthorization_coverageCaseId_idx"
ON "CoverageAuthorization"("coverageCaseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientLedgerEntry_organizationId_fkey') THEN
    ALTER TABLE "PatientLedgerEntry"
    ADD CONSTRAINT "PatientLedgerEntry_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientLedgerEntry_branchId_fkey') THEN
    ALTER TABLE "PatientLedgerEntry"
    ADD CONSTRAINT "PatientLedgerEntry_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientLedgerEntry_patientId_fkey') THEN
    ALTER TABLE "PatientLedgerEntry"
    ADD CONSTRAINT "PatientLedgerEntry_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientLedgerEntry_planId_fkey') THEN
    ALTER TABLE "PatientLedgerEntry"
    ADD CONSTRAINT "PatientLedgerEntry_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialDocument_organizationId_fkey') THEN
    ALTER TABLE "FinancialDocument"
    ADD CONSTRAINT "FinancialDocument_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialDocument_branchId_fkey') THEN
    ALTER TABLE "FinancialDocument"
    ADD CONSTRAINT "FinancialDocument_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialDocument_patientId_fkey') THEN
    ALTER TABLE "FinancialDocument"
    ADD CONSTRAINT "FinancialDocument_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialDocument_paymentId_fkey') THEN
    ALTER TABLE "FinancialDocument"
    ADD CONSTRAINT "FinancialDocument_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialDocument_refundId_fkey') THEN
    ALTER TABLE "FinancialDocument"
    ADD CONSTRAINT "FinancialDocument_refundId_fkey"
    FOREIGN KEY ("refundId") REFERENCES "Refund"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialDocument_treatmentPlanId_fkey') THEN
    ALTER TABLE "FinancialDocument"
    ADD CONSTRAINT "FinancialDocument_treatmentPlanId_fkey"
    FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialDocumentFile_financialDocumentId_fkey') THEN
    ALTER TABLE "FinancialDocumentFile"
    ADD CONSTRAINT "FinancialDocumentFile_financialDocumentId_fkey"
    FOREIGN KEY ("financialDocumentId") REFERENCES "FinancialDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoverageCase_organizationId_fkey') THEN
    ALTER TABLE "CoverageCase"
    ADD CONSTRAINT "CoverageCase_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoverageCase_branchId_fkey') THEN
    ALTER TABLE "CoverageCase"
    ADD CONSTRAINT "CoverageCase_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoverageCase_patientId_fkey') THEN
    ALTER TABLE "CoverageCase"
    ADD CONSTRAINT "CoverageCase_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoverageCase_agreementId_fkey') THEN
    ALTER TABLE "CoverageCase"
    ADD CONSTRAINT "CoverageCase_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoverageAuthorization_coverageCaseId_fkey') THEN
    ALTER TABLE "CoverageAuthorization"
    ADD CONSTRAINT "CoverageAuthorization_coverageCaseId_fkey"
    FOREIGN KEY ("coverageCaseId") REFERENCES "CoverageCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoverageAuthorization_treatmentPlanId_fkey') THEN
    ALTER TABLE "CoverageAuthorization"
    ADD CONSTRAINT "CoverageAuthorization_treatmentPlanId_fkey"
    FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
