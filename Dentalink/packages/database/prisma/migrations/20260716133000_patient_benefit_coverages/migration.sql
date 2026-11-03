DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientBenefitCoverageType') THEN
    CREATE TYPE "PatientBenefitCoverageType" AS ENUM (
      'INSURANCE',
      'AGREEMENT',
      'PAYROLL_BENEFIT',
      'CORPORATE_BENEFIT',
      'MEMBERSHIP',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientBenefitCoverageStatus') THEN
    CREATE TYPE "PatientBenefitCoverageStatus" AS ENUM (
      'DRAFT',
      'PENDING_VALIDATION',
      'VALIDATING',
      'ACTIVE',
      'INACTIVE',
      'SUSPENDED',
      'EXPIRED',
      'REJECTED',
      'REQUIRES_DOCUMENTS',
      'INTEGRATION_ERROR',
      'CANCELLED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CoverageValidationMode') THEN
    CREATE TYPE "CoverageValidationMode" AS ENUM ('AUTOMATIC', 'MANUAL', 'DOCUMENTAL', 'MIXED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PatientBenefitCoverage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "type" "PatientBenefitCoverageType" NOT NULL,
  "status" "PatientBenefitCoverageStatus" NOT NULL DEFAULT 'DRAFT',
  "providerName" TEXT NOT NULL,
  "agreementId" TEXT,
  "planName" TEXT,
  "policyNumber" TEXT,
  "affiliateNumber" TEXT,
  "certificateNumber" TEXT,
  "employeeNumber" TEXT,
  "holderName" TEXT,
  "holderDocument" TEXT,
  "relationshipToPatient" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "coveragePercent" DECIMAL(5,2),
  "copayAmount" DECIMAL(10,2),
  "deductibleAmount" DECIMAL(10,2),
  "annualLimitAmount" DECIMAL(10,2),
  "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "externalReference" TEXT,
  "lastValidatedAt" TIMESTAMP(3),
  "lastValidationStatus" "PatientBenefitCoverageStatus",
  "lastValidationSummary" TEXT,
  "metadata" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PatientBenefitCoverage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PatientBenefitCoverageValidation" (
  "id" TEXT NOT NULL,
  "coverageId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "mode" "CoverageValidationMode" NOT NULL DEFAULT 'MANUAL',
  "status" "PatientBenefitCoverageStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
  "providerName" TEXT,
  "externalIdentifier" TEXT,
  "requestSnapshot" JSONB,
  "responseSnapshot" JSONB,
  "normalizedResult" JSONB,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "validatedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientBenefitCoverageValidation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PatientBenefitCoverageDocument" (
  "id" TEXT NOT NULL,
  "coverageId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "fileAttachmentId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "notes" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientBenefitCoverageDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PatientBenefitCoverageAudit" (
  "id" TEXT NOT NULL,
  "coverageId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "correlationId" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientBenefitCoverageAudit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CoverageCase" ADD COLUMN IF NOT EXISTS "patientCoverageId" TEXT;

CREATE INDEX IF NOT EXISTS "PatientBenefitCoverage_organizationId_patientId_status_idx"
  ON "PatientBenefitCoverage"("organizationId", "patientId", "status");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverage_branchId_status_idx"
  ON "PatientBenefitCoverage"("branchId", "status");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverage_agreementId_idx"
  ON "PatientBenefitCoverage"("agreementId");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverage_policyNumber_idx"
  ON "PatientBenefitCoverage"("policyNumber");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverage_affiliateNumber_idx"
  ON "PatientBenefitCoverage"("affiliateNumber");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverage_endsAt_idx"
  ON "PatientBenefitCoverage"("endsAt");

CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageValidation_coverageId_createdAt_idx"
  ON "PatientBenefitCoverageValidation"("coverageId", "createdAt");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageValidation_organizationId_patientId_createdAt_idx"
  ON "PatientBenefitCoverageValidation"("organizationId", "patientId", "createdAt");

CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageDocument_coverageId_createdAt_idx"
  ON "PatientBenefitCoverageDocument"("coverageId", "createdAt");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageDocument_fileAttachmentId_idx"
  ON "PatientBenefitCoverageDocument"("fileAttachmentId");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageDocument_organizationId_patientId_idx"
  ON "PatientBenefitCoverageDocument"("organizationId", "patientId");

CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageAudit_coverageId_createdAt_idx"
  ON "PatientBenefitCoverageAudit"("coverageId", "createdAt");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageAudit_organizationId_patientId_createdAt_idx"
  ON "PatientBenefitCoverageAudit"("organizationId", "patientId", "createdAt");
CREATE INDEX IF NOT EXISTS "PatientBenefitCoverageAudit_actorUserId_idx"
  ON "PatientBenefitCoverageAudit"("actorUserId");
CREATE INDEX IF NOT EXISTS "CoverageCase_patientCoverageId_idx"
  ON "CoverageCase"("patientCoverageId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverage_organizationId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverage" ADD CONSTRAINT "PatientBenefitCoverage_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverage_branchId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverage" ADD CONSTRAINT "PatientBenefitCoverage_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverage_patientId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverage" ADD CONSTRAINT "PatientBenefitCoverage_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverage_agreementId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverage" ADD CONSTRAINT "PatientBenefitCoverage_agreementId_fkey"
      FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageValidation_coverageId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageValidation" ADD CONSTRAINT "PatientBenefitCoverageValidation_coverageId_fkey"
      FOREIGN KEY ("coverageId") REFERENCES "PatientBenefitCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageValidation_organizationId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageValidation" ADD CONSTRAINT "PatientBenefitCoverageValidation_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageValidation_branchId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageValidation" ADD CONSTRAINT "PatientBenefitCoverageValidation_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageValidation_patientId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageValidation" ADD CONSTRAINT "PatientBenefitCoverageValidation_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageDocument_coverageId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageDocument" ADD CONSTRAINT "PatientBenefitCoverageDocument_coverageId_fkey"
      FOREIGN KEY ("coverageId") REFERENCES "PatientBenefitCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageDocument_organizationId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageDocument" ADD CONSTRAINT "PatientBenefitCoverageDocument_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageDocument_branchId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageDocument" ADD CONSTRAINT "PatientBenefitCoverageDocument_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageDocument_patientId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageDocument" ADD CONSTRAINT "PatientBenefitCoverageDocument_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageDocument_fileAttachmentId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageDocument" ADD CONSTRAINT "PatientBenefitCoverageDocument_fileAttachmentId_fkey"
      FOREIGN KEY ("fileAttachmentId") REFERENCES "FileAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageAudit_coverageId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageAudit" ADD CONSTRAINT "PatientBenefitCoverageAudit_coverageId_fkey"
      FOREIGN KEY ("coverageId") REFERENCES "PatientBenefitCoverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageAudit_organizationId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageAudit" ADD CONSTRAINT "PatientBenefitCoverageAudit_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageAudit_branchId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageAudit" ADD CONSTRAINT "PatientBenefitCoverageAudit_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientBenefitCoverageAudit_patientId_fkey') THEN
    ALTER TABLE "PatientBenefitCoverageAudit" ADD CONSTRAINT "PatientBenefitCoverageAudit_patientId_fkey"
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoverageCase_patientCoverageId_fkey') THEN
    ALTER TABLE "CoverageCase" ADD CONSTRAINT "CoverageCase_patientCoverageId_fkey"
      FOREIGN KEY ("patientCoverageId") REFERENCES "PatientBenefitCoverage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
