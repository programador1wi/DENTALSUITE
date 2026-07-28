ALTER TYPE "FamilyPolicyStatus" ADD VALUE IF NOT EXISTS 'PAID_PENDING_ACTIVATION';
ALTER TYPE "FamilyPolicyStatus" ADD VALUE IF NOT EXISTS 'WAITING_PERIOD';
ALTER TYPE "FamilyPolicyStatus" ADD VALUE IF NOT EXISTS 'REPLACED';

CREATE TYPE "PolicyCoverageType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FULL');
CREATE TYPE "FamilyPolicyUsageStatus" AS ENUM ('PENDING_AUTHORIZATION', 'APPLIED', 'REVERSED', 'CANCELLED');
CREATE TYPE "FamilyPolicyDocumentType" AS ENUM ('CONTRACT', 'CERTIFICATE', 'TERMS', 'CARD', 'PAYMENT_PROOF', 'AUTHORIZATION', 'CANCELLATION', 'OTHER');

ALTER TABLE "PolicyProduct"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "brandId" TEXT,
  ADD COLUMN "waitingPeriodDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "renewable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "terms" TEXT;

ALTER TABLE "PolicyProduct"
  ADD CONSTRAINT "PolicyProduct_waiting_period_check" CHECK ("waitingPeriodDays" >= 0);

ALTER TABLE "FamilyPolicy"
  ADD COLUMN "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "coverageAvailableAt" TIMESTAMP(3),
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT;

ALTER TABLE "FamilyPolicy" ADD COLUMN "brandId" TEXT;

UPDATE "FamilyPolicy" AS policy
SET "brandId" = branch."brandId"
FROM "Branch" AS branch
WHERE branch."id" = policy."branchId";

ALTER TABLE "TreatmentPlanItem"
  ADD COLUMN "policyCoverageAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "policyCopayAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "policyCoverageAppliedAt" TIMESTAMP(3);

CREATE TABLE "PolicyProductCoverage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "policyProductId" TEXT NOT NULL,
  "procedureId" TEXT,
  "procedureCategoryId" TEXT,
  "name" TEXT NOT NULL,
  "coverageType" "PolicyCoverageType" NOT NULL,
  "coverageValue" DECIMAL(10,2) NOT NULL,
  "copayAmount" DECIMAL(10,2),
  "annualAmountLimit" DECIMAL(12,2),
  "annualUseLimit" INTEGER,
  "waitingPeriodDays" INTEGER NOT NULL DEFAULT 0,
  "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false,
  "exclusions" TEXT,
  "conditions" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicyProductCoverage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolicyProductCoverage_target_check" CHECK ("procedureId" IS NOT NULL OR "procedureCategoryId" IS NOT NULL),
  CONSTRAINT "PolicyProductCoverage_values_check" CHECK (
    "coverageValue" >= 0 AND "waitingPeriodDays" >= 0 AND
    ("annualAmountLimit" IS NULL OR "annualAmountLimit" >= 0) AND
    ("annualUseLimit" IS NULL OR "annualUseLimit" >= 0)
  )
);

CREATE TABLE "FamilyPolicyCoverage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "sourceProductCoverageId" TEXT,
  "procedureId" TEXT,
  "procedureCategoryId" TEXT,
  "name" TEXT NOT NULL,
  "coverageType" "PolicyCoverageType" NOT NULL,
  "coverageValue" DECIMAL(10,2) NOT NULL,
  "copayAmount" DECIMAL(10,2),
  "annualAmountLimit" DECIMAL(12,2),
  "annualUseLimit" INTEGER,
  "waitingPeriodDays" INTEGER NOT NULL DEFAULT 0,
  "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false,
  "exclusions" TEXT,
  "conditions" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyPolicyCoverage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FamilyPolicyCoverage_target_check" CHECK ("procedureId" IS NOT NULL OR "procedureCategoryId" IS NOT NULL),
  CONSTRAINT "FamilyPolicyCoverage_values_check" CHECK (
    "coverageValue" >= 0 AND "waitingPeriodDays" >= 0 AND
    ("annualAmountLimit" IS NULL OR "annualAmountLimit" >= 0) AND
    ("annualUseLimit" IS NULL OR "annualUseLimit" >= 0)
  )
);

CREATE TABLE "FamilyPolicyUsage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "coverageId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "treatmentPlanId" TEXT,
  "treatmentPlanItemId" TEXT,
  "procedureId" TEXT NOT NULL,
  "normalAmount" DECIMAL(12,2) NOT NULL,
  "coveredAmount" DECIMAL(12,2) NOT NULL,
  "copayAmount" DECIMAL(12,2) NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "status" "FamilyPolicyUsageStatus" NOT NULL DEFAULT 'APPLIED',
  "authorizationCode" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "appliedById" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyPolicyUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FamilyPolicyUsage_amounts_check" CHECK (
    "normalAmount" >= 0 AND "coveredAmount" >= 0 AND "copayAmount" >= 0 AND "quantity" > 0 AND
    "coveredAmount" + "copayAmount" <= "normalAmount"
  )
);

CREATE TABLE "FamilyPolicyDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "fileAttachmentId" TEXT NOT NULL,
  "type" "FamilyPolicyDocumentType" NOT NULL,
  "notes" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FamilyPolicyDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PolicyProductCoverage_organizationId_policyProductId_isActive_idx" ON "PolicyProductCoverage"("organizationId", "policyProductId", "isActive");
CREATE INDEX "PolicyProduct_brandId_idx" ON "PolicyProduct"("brandId");
CREATE INDEX "FamilyPolicy_brandId_createdAt_idx" ON "FamilyPolicy"("brandId", "createdAt");
CREATE INDEX "PolicyProductCoverage_procedureId_idx" ON "PolicyProductCoverage"("procedureId");
CREATE INDEX "PolicyProductCoverage_procedureCategoryId_idx" ON "PolicyProductCoverage"("procedureCategoryId");
CREATE INDEX "FamilyPolicyCoverage_organizationId_policyId_isActive_idx" ON "FamilyPolicyCoverage"("organizationId", "policyId", "isActive");
CREATE INDEX "FamilyPolicyCoverage_procedureId_idx" ON "FamilyPolicyCoverage"("procedureId");
CREATE INDEX "FamilyPolicyCoverage_procedureCategoryId_idx" ON "FamilyPolicyCoverage"("procedureCategoryId");
CREATE UNIQUE INDEX "FamilyPolicyUsage_organizationId_idempotencyKey_key" ON "FamilyPolicyUsage"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "FamilyPolicyUsage_policyId_treatmentPlanItemId_key" ON "FamilyPolicyUsage"("policyId", "treatmentPlanItemId");
CREATE INDEX "FamilyPolicyUsage_policyId_patientId_appliedAt_idx" ON "FamilyPolicyUsage"("policyId", "patientId", "appliedAt");
CREATE INDEX "FamilyPolicyUsage_coverageId_status_appliedAt_idx" ON "FamilyPolicyUsage"("coverageId", "status", "appliedAt");
CREATE INDEX "FamilyPolicyUsage_treatmentPlanId_idx" ON "FamilyPolicyUsage"("treatmentPlanId");
CREATE UNIQUE INDEX "FamilyPolicyDocument_policyId_fileAttachmentId_key" ON "FamilyPolicyDocument"("policyId", "fileAttachmentId");
CREATE INDEX "FamilyPolicyDocument_organizationId_policyId_type_idx" ON "FamilyPolicyDocument"("organizationId", "policyId", "type");
CREATE UNIQUE INDEX "FamilyPolicyMember_one_active_holder_per_policy_key"
  ON "FamilyPolicyMember"("policyId")
  WHERE "memberRole" = 'HOLDER' AND "removedAt" IS NULL;

ALTER TABLE "PolicyProductCoverage"
  ADD CONSTRAINT "PolicyProductCoverage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PolicyProductCoverage_policyProductId_fkey" FOREIGN KEY ("policyProductId") REFERENCES "PolicyProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PolicyProductCoverage_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PolicyProductCoverage_procedureCategoryId_fkey" FOREIGN KEY ("procedureCategoryId") REFERENCES "ProcedureCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PolicyProduct"
  ADD CONSTRAINT "PolicyProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BranchBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FamilyPolicy"
  ADD CONSTRAINT "FamilyPolicy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BranchBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FamilyPolicyCoverage"
  ADD CONSTRAINT "FamilyPolicyCoverage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyCoverage_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "FamilyPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyCoverage_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyCoverage_procedureCategoryId_fkey" FOREIGN KEY ("procedureCategoryId") REFERENCES "ProcedureCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyPolicyUsage"
  ADD CONSTRAINT "FamilyPolicyUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "FamilyPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "FamilyPolicyCoverage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyPolicyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_treatmentPlanItemId_fkey" FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyUsage_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyPolicyDocument"
  ADD CONSTRAINT "FamilyPolicyDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyDocument_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "FamilyPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyDocument_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "FileAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FamilyPolicyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource", "isSystem", "isActive", "createdAt", "updatedAt"
)
VALUES
  ('perm-family-policies-coverage-read', 'family_policies.coverage.read', 'Read policy coverage', 'View policy coverage rules and availability', 'patients', 'family_policies.coverage.read', 'read', 'family_policy_coverage', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-family-policies-coverage-apply', 'family_policies.coverage.apply', 'Apply policy coverage', 'Apply policy coverage to treatment items', 'patients', 'family_policies.coverage.apply', 'apply', 'family_policy_coverage', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm-family-policies-usage-read', 'family_policies.usage.read', 'Read policy usage', 'View policy coverage usage history', 'patients', 'family_policies.usage.read', 'read', 'family_policy_usage', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
CROSS JOIN "Permission" AS permission
WHERE (
    ((role."code" IN ('super_admin', 'admin', 'receptionist') OR role."name" IN ('SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'))
      AND permission."key" IN ('family_policies.coverage.read', 'family_policies.usage.read'))
    OR
    ((role."code" IN ('super_admin', 'admin') OR role."name" IN ('SUPER_ADMIN', 'ADMIN'))
      AND permission."key" = 'family_policies.coverage.apply')
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
