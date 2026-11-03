CREATE TYPE "CashDiscountStatus" AS ENUM ('DRAFT', 'ENABLED', 'DISABLED');
CREATE TYPE "CashDiscountApplicationStatus" AS ENUM ('APPLIED', 'VOIDED', 'PARTIALLY_REFUNDED', 'REFUNDED');

ALTER TABLE "PaymentAllocation"
  ADD COLUMN "settlementDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "CashDiscountRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "campaign" TEXT,
  "discountPercent" DECIMAL(5,2) NOT NULL,
  "appliesToClinicalActions" BOOLEAN NOT NULL DEFAULT true,
  "appliesToLaboratoryActions" BOOLEAN NOT NULL DEFAULT false,
  "availableToAllUsers" BOOLEAN NOT NULL DEFAULT true,
  "availableToAllBranches" BOOLEAN NOT NULL DEFAULT true,
  "stackableWithAgreements" BOOLEAN NOT NULL DEFAULT false,
  "stackableWithOtherDiscounts" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "status" "CashDiscountStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "disabledById" TEXT,
  "disableReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashDiscountRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashDiscountRule_percent_check" CHECK ("discountPercent" > 0 AND "discountPercent" <= 100),
  CONSTRAINT "CashDiscountRule_scope_check" CHECK ("appliesToClinicalActions" OR "appliesToLaboratoryActions"),
  CONSTRAINT "CashDiscountRule_dates_check" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE TABLE "CashDiscountRuleUser" (
  "cashDiscountRuleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashDiscountRuleUser_pkey" PRIMARY KEY ("cashDiscountRuleId", "userId")
);

CREATE TABLE "CashDiscountRuleBranch" (
  "cashDiscountRuleId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashDiscountRuleBranch_pkey" PRIMARY KEY ("cashDiscountRuleId", "branchId")
);

CREATE TABLE "CashDiscountApplication" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "cashDiscountRuleId" TEXT NOT NULL,
  "cashDiscountRuleVersion" INTEGER NOT NULL,
  "paymentId" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "appliedById" TEXT NOT NULL,
  "ruleCodeSnapshot" TEXT NOT NULL,
  "ruleNameSnapshot" TEXT NOT NULL,
  "campaignSnapshot" TEXT,
  "discountPercentSnapshot" DECIMAL(5,2) NOT NULL,
  "appliesToClinicalSnapshot" BOOLEAN NOT NULL,
  "appliesToLaboratorySnapshot" BOOLEAN NOT NULL,
  "originalAmount" DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL,
  "finalAmount" DECIMAL(12,2) NOT NULL,
  "status" "CashDiscountApplicationStatus" NOT NULL DEFAULT 'APPLIED',
  "voidedAt" TIMESTAMP(3),
  "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashDiscountApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashDiscountApplication_amounts_check" CHECK (
    "originalAmount" > 0 AND "discountAmount" > 0 AND "finalAmount" > 0
    AND "originalAmount" = "discountAmount" + "finalAmount"
  )
);

CREATE TABLE "CashDiscountApplicationItem" (
  "id" TEXT NOT NULL,
  "cashDiscountApplicationId" TEXT NOT NULL,
  "treatmentPlanItemId" TEXT NOT NULL,
  "paymentAllocationId" TEXT,
  "procedureCodeSnapshot" TEXT NOT NULL,
  "procedureNameSnapshot" TEXT NOT NULL,
  "itemTypeSnapshot" TEXT NOT NULL,
  "originalBalance" DECIMAL(12,2) NOT NULL,
  "discountPercent" DECIMAL(5,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL,
  "finalAmount" DECIMAL(12,2) NOT NULL,
  "userMaximumSnapshot" DECIMAL(5,2) NOT NULL,
  "procedureMaximumSnapshot" DECIMAL(5,2) NOT NULL,
  "effectiveMaximumSnapshot" DECIMAL(5,2) NOT NULL,
  "eligibilityResult" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashDiscountApplicationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashDiscountApplicationItem_amounts_check" CHECK (
    "originalBalance" > 0 AND "discountAmount" > 0 AND "finalAmount" > 0
    AND "originalBalance" = "discountAmount" + "finalAmount"
  )
);

CREATE UNIQUE INDEX "CashDiscountRule_organizationId_publicCode_key" ON "CashDiscountRule"("organizationId", "publicCode");
CREATE INDEX "CashDiscountRule_organizationId_status_startsAt_endsAt_idx" ON "CashDiscountRule"("organizationId", "status", "startsAt", "endsAt");
CREATE INDEX "CashDiscountRule_organizationId_name_idx" ON "CashDiscountRule"("organizationId", "name");
CREATE INDEX "CashDiscountRuleUser_userId_idx" ON "CashDiscountRuleUser"("userId");
CREATE INDEX "CashDiscountRuleBranch_branchId_idx" ON "CashDiscountRuleBranch"("branchId");
CREATE UNIQUE INDEX "CashDiscountApplication_paymentId_key" ON "CashDiscountApplication"("paymentId");
CREATE INDEX "CashDiscountApplication_organizationId_branchId_createdAt_idx" ON "CashDiscountApplication"("organizationId", "branchId", "createdAt");
CREATE INDEX "CashDiscountApplication_cashDiscountRuleId_createdAt_idx" ON "CashDiscountApplication"("cashDiscountRuleId", "createdAt");
CREATE INDEX "CashDiscountApplication_appliedById_createdAt_idx" ON "CashDiscountApplication"("appliedById", "createdAt");
CREATE INDEX "CashDiscountApplication_treatmentPlanId_idx" ON "CashDiscountApplication"("treatmentPlanId");
CREATE UNIQUE INDEX "CashDiscountApplicationItem_paymentAllocationId_key" ON "CashDiscountApplicationItem"("paymentAllocationId");
CREATE UNIQUE INDEX "CashDiscountApplicationItem_application_item_key" ON "CashDiscountApplicationItem"("cashDiscountApplicationId", "treatmentPlanItemId");
CREATE INDEX "CashDiscountApplicationItem_treatmentPlanItemId_idx" ON "CashDiscountApplicationItem"("treatmentPlanItemId");

ALTER TABLE "CashDiscountRule" ADD CONSTRAINT "CashDiscountRule_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashDiscountRuleUser" ADD CONSTRAINT "CashDiscountRuleUser_cashDiscountRuleId_fkey"
  FOREIGN KEY ("cashDiscountRuleId") REFERENCES "CashDiscountRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashDiscountRuleUser" ADD CONSTRAINT "CashDiscountRuleUser_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDiscountRuleBranch" ADD CONSTRAINT "CashDiscountRuleBranch_cashDiscountRuleId_fkey"
  FOREIGN KEY ("cashDiscountRuleId") REFERENCES "CashDiscountRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashDiscountRuleBranch" ADD CONSTRAINT "CashDiscountRuleBranch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplication" ADD CONSTRAINT "CashDiscountApplication_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplication" ADD CONSTRAINT "CashDiscountApplication_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplication" ADD CONSTRAINT "CashDiscountApplication_cashDiscountRuleId_fkey"
  FOREIGN KEY ("cashDiscountRuleId") REFERENCES "CashDiscountRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplication" ADD CONSTRAINT "CashDiscountApplication_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplication" ADD CONSTRAINT "CashDiscountApplication_treatmentPlanId_fkey"
  FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplicationItem" ADD CONSTRAINT "CashDiscountApplicationItem_cashDiscountApplicationId_fkey"
  FOREIGN KEY ("cashDiscountApplicationId") REFERENCES "CashDiscountApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplicationItem" ADD CONSTRAINT "CashDiscountApplicationItem_treatmentPlanItemId_fkey"
  FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashDiscountApplicationItem" ADD CONSTRAINT "CashDiscountApplicationItem_paymentAllocationId_fkey"
  FOREIGN KEY ("paymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "isSystem", "isActive", "createdAt", "updatedAt"
)
SELECT
  'perm_' || md5(permission_key), permission_key, permission_name, permission_description,
  'payments', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('payment_options.cash_discounts.view', 'View cash discounts', 'View cash discount configuration'),
  ('payment_options.cash_discounts.create', 'Create cash discounts', 'Create cash discount rules'),
  ('payment_options.cash_discounts.update', 'Update cash discounts', 'Edit cash discount rules'),
  ('payment_options.cash_discounts.disable', 'Disable cash discounts', 'Disable cash discount rules without deleting history'),
  ('payment_options.cash_discounts.reactivate', 'Reactivate cash discounts', 'Reactivate valid cash discount rules'),
  ('payments.cash_discounts.apply', 'Apply cash discounts', 'Apply authorized cash discounts during full settlement'),
  ('payments.cash_discounts.override', 'Override cash discounts', 'Reserved override permission; disabled by default'),
  ('payments.cash_discounts.view_audit', 'View cash discount audit', 'View cash discount audit and historical applications')
) AS permissions(permission_key, permission_name, permission_description)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  AND role."deletedAt" IS NULL
  AND permission."key" IN (
    'payment_options.cash_discounts.view',
    'payment_options.cash_discounts.create',
    'payment_options.cash_discounts.update',
    'payment_options.cash_discounts.disable',
    'payment_options.cash_discounts.reactivate',
    'payments.cash_discounts.view_audit'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT existing."roleId", cash_permission."id", CURRENT_TIMESTAMP
FROM "RolePermission" existing
JOIN "Permission" treatment_permission
  ON treatment_permission."id" = existing."permissionId"
 AND treatment_permission."key" = 'treatment_discount.apply'
CROSS JOIN "Permission" cash_permission
WHERE cash_permission."key" = 'payments.cash_discounts.apply'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
