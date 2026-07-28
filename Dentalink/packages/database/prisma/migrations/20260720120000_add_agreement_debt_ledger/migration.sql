CREATE TYPE "AgreementChargeStatus" AS ENUM (
  'SCHEDULED', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REVERSED'
);

CREATE TYPE "CompanyPaymentStatus" AS ENUM (
  'DRAFT', 'CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED', 'VOIDED', 'REFUNDED'
);

CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "taxId" TEXT,
  "billingEmail" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_organizationId_legalName_key" ON "Company"("organizationId", "legalName");
CREATE INDEX "Company_organizationId_taxId_idx" ON "Company"("organizationId", "taxId");
CREATE INDEX "Company_organizationId_status_idx" ON "Company"("organizationId", "status");

ALTER TABLE "Agreement" ADD COLUMN "companyId" TEXT;

INSERT INTO "Company" ("id", "organizationId", "legalName", "taxId", "status", "createdAt", "updatedAt")
SELECT
  'cmp_' || substr(md5(source."organizationId" || ':' || lower(source."legalName")), 1, 20),
  source."organizationId",
  source."legalName",
  source."entityTaxId",
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("organizationId", COALESCE(NULLIF(trim("entityName"), ''), "name"))
    "organizationId",
    COALESCE(NULLIF(trim("entityName"), ''), "name") AS "legalName",
    NULLIF(trim("entityTaxId"), '') AS "entityTaxId",
    "createdAt"
  FROM "Agreement"
  ORDER BY "organizationId", COALESCE(NULLIF(trim("entityName"), ''), "name"), "createdAt"
) AS source;

UPDATE "Agreement" AS agreement
SET "companyId" = company."id"
FROM "Company" AS company
WHERE company."organizationId" = agreement."organizationId"
  AND company."legalName" = COALESCE(NULLIF(trim(agreement."entityName"), ''), agreement."name");

ALTER TABLE "Agreement" ALTER COLUMN "companyId" SET NOT NULL;
CREATE INDEX "Agreement_organizationId_companyId_idx" ON "Agreement"("organizationId", "companyId");

CREATE TABLE "PayrollDiscountPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "installmentCount" INTEGER NOT NULL,
  "firstDueDate" TIMESTAMP(3) NOT NULL,
  "periodicity" "InstallmentFrequency" NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "agreementSnapshot" JSONB NOT NULL,
  "status" "InstallmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollDiscountPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollDiscountPlan_organizationId_agreementId_status_idx" ON "PayrollDiscountPlan"("organizationId", "agreementId", "status");
CREATE INDEX "PayrollDiscountPlan_patientId_treatmentPlanId_idx" ON "PayrollDiscountPlan"("patientId", "treatmentPlanId");
CREATE INDEX "PayrollDiscountPlan_branchId_firstDueDate_idx" ON "PayrollDiscountPlan"("branchId", "firstDueDate");

CREATE TABLE "AgreementCharge" (
  "id" TEXT NOT NULL,
  "folio" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "payrollDiscountPlanId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "treatmentPlanItemId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "installmentNumber" INTEGER NOT NULL,
  "originalAmount" DECIMAL(12,2) NOT NULL,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "outstandingAmount" DECIMAL(12,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "status" "AgreementChargeStatus" NOT NULL,
  "agreementSnapshot" JSONB NOT NULL,
  "priceSnapshot" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgreementCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgreementCharge_organizationId_folio_key" ON "AgreementCharge"("organizationId", "folio");
CREATE INDEX "AgreementCharge_organizationId_agreementId_currency_dueDate_status_idx" ON "AgreementCharge"("organizationId", "agreementId", "currency", "dueDate", "status");
CREATE INDEX "AgreementCharge_organizationId_branchId_currency_dueDate_status_idx" ON "AgreementCharge"("organizationId", "branchId", "currency", "dueDate", "status");
CREATE INDEX "AgreementCharge_patientId_treatmentPlanId_idx" ON "AgreementCharge"("patientId", "treatmentPlanId");
CREATE INDEX "AgreementCharge_treatmentPlanItemId_idx" ON "AgreementCharge"("treatmentPlanItemId");

CREATE TABLE "CompanyPayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "branchId" TEXT,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "unappliedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" "CurrencyCode" NOT NULL,
  "paymentMethodId" TEXT,
  "financialInstitutionId" TEXT,
  "reference" TEXT,
  "proofUrl" TEXT,
  "cashRegisterId" TEXT,
  "notes" TEXT,
  "status" "CompanyPaymentStatus" NOT NULL DEFAULT 'DRAFT',
  "receivedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "voidedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyPayment_organizationId_idempotencyKey_key" ON "CompanyPayment"("organizationId", "idempotencyKey");
CREATE INDEX "CompanyPayment_organizationId_agreementId_currency_paymentDate_status_idx" ON "CompanyPayment"("organizationId", "agreementId", "currency", "paymentDate", "status");
CREATE INDEX "CompanyPayment_organizationId_branchId_paymentDate_idx" ON "CompanyPayment"("organizationId", "branchId", "paymentDate");
CREATE INDEX "CompanyPayment_companyId_status_idx" ON "CompanyPayment"("companyId", "status");

CREATE TABLE "CompanyPaymentAllocation" (
  "id" TEXT NOT NULL,
  "companyPaymentId" TEXT NOT NULL,
  "agreementChargeId" TEXT NOT NULL,
  "allocatedAmount" DECIMAL(12,2) NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyPaymentAllocation_companyPaymentId_agreementChargeId_key" ON "CompanyPaymentAllocation"("companyPaymentId", "agreementChargeId");
CREATE INDEX "CompanyPaymentAllocation_agreementChargeId_reversedAt_idx" ON "CompanyPaymentAllocation"("agreementChargeId", "reversedAt");

ALTER TABLE "CashMovement" ADD COLUMN "companyPaymentId" TEXT;
CREATE INDEX "CashMovement_companyPaymentId_idx" ON "CashMovement"("companyPaymentId");
ALTER TABLE "AuditLog" ADD COLUMN "correlationId" TEXT;

ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollDiscountPlan" ADD CONSTRAINT "PayrollDiscountPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDiscountPlan" ADD CONSTRAINT "PayrollDiscountPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollDiscountPlan" ADD CONSTRAINT "PayrollDiscountPlan_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollDiscountPlan" ADD CONSTRAINT "PayrollDiscountPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollDiscountPlan" ADD CONSTRAINT "PayrollDiscountPlan_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollDiscountPlan" ADD CONSTRAINT "PayrollDiscountPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_payrollDiscountPlanId_fkey" FOREIGN KEY ("payrollDiscountPlanId") REFERENCES "PayrollDiscountPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_treatmentPlanItemId_fkey" FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgreementCharge" ADD CONSTRAINT "AgreementCharge_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_financialInstitutionId_fkey" FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyPayment" ADD CONSTRAINT "CompanyPayment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyPaymentAllocation" ADD CONSTRAINT "CompanyPaymentAllocation_companyPaymentId_fkey" FOREIGN KEY ("companyPaymentId") REFERENCES "CompanyPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyPaymentAllocation" ADD CONSTRAINT "CompanyPaymentAllocation_agreementChargeId_fkey" FOREIGN KEY ("agreementChargeId") REFERENCES "AgreementCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyPaymentAllocation" ADD CONSTRAINT "CompanyPaymentAllocation_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_companyPaymentId_fkey" FOREIGN KEY ("companyPaymentId") REFERENCES "CompanyPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH permission_seed("key", "name", "description", "module") AS (
  VALUES
    ('agreements.debt_report.read', 'Read agreement debt report', 'View company debt balances and charge details', 'agreements'),
    ('agreements.debt_report.all_branches', 'Read agreement debt across branches', 'View company debts outside assigned branches', 'agreements'),
    ('agreements.payments.create', 'Create company payments', 'Register company remittances and drafts', 'agreements'),
    ('agreements.payments.approve', 'Approve company payments', 'Confirm and allocate company remittances', 'agreements'),
    ('agreements.payments.void', 'Void company payments', 'Reverse company remittances and allocations', 'agreements'),
    ('agreements.reports.export', 'Export agreement reports', 'Export company debt reports', 'agreements')
)
INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "code", "action", "resource",
  "isSystem", "isActive", "createdAt", "updatedAt"
)
SELECT
  'perm_agrdebt_' || substr(md5(permission_seed."key"), 1, 16),
  permission_seed."key", permission_seed."name", permission_seed."description", permission_seed."module",
  permission_seed."key", split_part(permission_seed."key", '.', 3), 'agreement_debt',
  true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM permission_seed
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "module" = EXCLUDED."module",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
CROSS JOIN "Permission" AS permission
WHERE (role."code" IN ('super_admin', 'admin') OR role."name" IN ('SUPER_ADMIN', 'ADMIN'))
  AND permission."key" IN (
    'agreements.debt_report.read', 'agreements.debt_report.all_branches',
    'agreements.payments.create', 'agreements.payments.approve',
    'agreements.payments.void', 'agreements.reports.export'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" AS role
CROSS JOIN "Permission" AS permission
WHERE (role."code" IN ('receptionist', 'cashier') OR role."name" IN ('RECEPTIONIST', 'CASHIER'))
  AND permission."key" IN ('agreements.debt_report.read', 'agreements.payments.create')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
