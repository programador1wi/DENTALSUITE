ALTER TYPE "PaymentMethodType" ADD VALUE IF NOT EXISTS 'CHECK';
ALTER TYPE "PaymentMethodType" ADD VALUE IF NOT EXISTS 'BONUS';
ALTER TYPE "PaymentMethodType" ADD VALUE IF NOT EXISTS 'INSURANCE';

CREATE TYPE "PaymentMethodSource" AS ENUM ('SYSTEM', 'CUSTOM');
CREATE TYPE "PaymentSettlementStatus" AS ENUM ('PENDING', 'RECEIVED', 'OVERDUE', 'CANCELLED', 'REVERSED');

ALTER TABLE "PaymentMethod"
  ADD COLUMN "publicCode" TEXT,
  ADD COLUMN "source" "PaymentMethodSource" NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "retentionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "allowsRefund" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acceptsMultipleSettlements" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresReference" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresFinancialInstitution" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fiscalCode" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "disabledById" TEXT,
  ADD COLUMN "disableReason" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "PaymentMethod"
SET
  "publicCode" = 'PM-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 10)),
  "allowsRefund" = true,
  "source" = CASE
    WHEN LOWER(TRIM("name")) IN (
      'efectivo', 'cheque', 'tarjeta', 'tarjeta de crédito', 'tarjeta de credito',
      'tarjeta de débito', 'tarjeta de debito', 'transferencia', 'depósito', 'deposito',
      'depósito bancario', 'deposito bancario', 'bono', 'seguro', 'crédito', 'credito'
    ) THEN 'SYSTEM'::"PaymentMethodSource"
    ELSE 'CUSTOM'::"PaymentMethodSource"
  END;

ALTER TABLE "PaymentMethod" ALTER COLUMN "publicCode" SET NOT NULL;
ALTER TABLE "PaymentMethod"
  ADD CONSTRAINT "PaymentMethod_retention_check" CHECK ("retentionPercent" >= 0 AND "retentionPercent" <= 100);
CREATE UNIQUE INDEX "PaymentMethod_organizationId_publicCode_key" ON "PaymentMethod"("organizationId", "publicCode");

ALTER TABLE "Payment"
  ADD COLUMN "grossAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "retentionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "netAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentMethodSnapshot" JSONB;

UPDATE "Payment" payment
SET
  "grossAmount" = payment."amount",
  "netAmount" = payment."amount",
  "paymentMethodSnapshot" = CASE WHEN method."id" IS NULL THEN NULL ELSE jsonb_build_object(
    'id', method."id",
    'publicCode', method."publicCode",
    'name', method."name",
    'type', method."type",
    'retentionPercent', method."retentionPercent",
    'allowsRefund', method."allowsRefund",
    'acceptsMultipleSettlements', method."acceptsMultipleSettlements",
    'requiresReference', method."requiresReference",
    'requiresFinancialInstitution', method."requiresFinancialInstitution",
    'fiscalCode', method."fiscalCode"
  ) END
FROM "PaymentMethod" method
WHERE payment."paymentMethodId" = method."id";

ALTER TABLE "PaymentMethodSplit"
  ADD COLUMN "grossAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "retentionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "netAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentMethodCodeSnapshot" TEXT,
  ADD COLUMN "paymentMethodNameSnapshot" TEXT,
  ADD COLUMN "paymentMethodTypeSnapshot" "PaymentMethodType",
  ADD COLUMN "retentionPercentSnapshot" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "allowsRefundSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acceptsMultipleSettlementsSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresReferenceSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiresFinancialInstitutionSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "includeInCollectionReportsSnapshot" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeInPhysicalCashBalanceSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "includeInCashFlowReportsSnapshot" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeInClosingSummarySnapshot" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeInGraphicalReportsSnapshot" BOOLEAN NOT NULL DEFAULT true;

UPDATE "PaymentMethodSplit" split
SET
  "grossAmount" = split."amount",
  "netAmount" = split."amount",
  "paymentMethodCodeSnapshot" = method."publicCode",
  "paymentMethodNameSnapshot" = method."name",
  "paymentMethodTypeSnapshot" = method."type",
  "retentionPercentSnapshot" = method."retentionPercent",
  "allowsRefundSnapshot" = method."allowsRefund",
  "acceptsMultipleSettlementsSnapshot" = method."acceptsMultipleSettlements",
  "requiresReferenceSnapshot" = method."requiresReference",
  "requiresFinancialInstitutionSnapshot" = method."requiresFinancialInstitution",
  "includeInCollectionReportsSnapshot" = method."includeInCollectionReports",
  "includeInPhysicalCashBalanceSnapshot" = method."includeInPhysicalCashBalance",
  "includeInCashFlowReportsSnapshot" = method."includeInCashFlowReports",
  "includeInClosingSummarySnapshot" = method."includeInClosingSummary",
  "includeInGraphicalReportsSnapshot" = method."includeInGraphicalReports"
FROM "PaymentMethod" method
WHERE split."paymentMethodId" = method."id";

ALTER TABLE "Refund"
  ADD COLUMN "financialInstitutionId" TEXT,
  ADD COLUMN "reference" TEXT;

CREATE TABLE "PaymentSettlement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "paymentMethodSplitId" TEXT NOT NULL,
  "paymentMethodId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3),
  "status" "PaymentSettlementStatus" NOT NULL DEFAULT 'PENDING',
  "reference" TEXT,
  "financialInstitutionId" TEXT,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentSettlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentSettlement_amount_check" CHECK ("amount" > 0)
);

ALTER TABLE "CashMovement" ADD COLUMN "paymentSettlementId" TEXT;
CREATE UNIQUE INDEX "CashMovement_paymentSettlementId_key" ON "CashMovement"("paymentSettlementId");
CREATE UNIQUE INDEX "PaymentSettlement_paymentMethodSplitId_sequence_key" ON "PaymentSettlement"("paymentMethodSplitId", "sequence");
CREATE INDEX "PaymentSettlement_organizationId_branchId_status_dueAt_idx" ON "PaymentSettlement"("organizationId", "branchId", "status", "dueAt");
CREATE INDEX "PaymentSettlement_paymentId_idx" ON "PaymentSettlement"("paymentId");
CREATE INDEX "PaymentSettlement_paymentMethodId_status_dueAt_idx" ON "PaymentSettlement"("paymentMethodId", "status", "dueAt");

ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_paymentMethodSplitId_fkey"
  FOREIGN KEY ("paymentMethodSplitId") REFERENCES "PaymentMethodSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlement" ADD CONSTRAINT "PaymentSettlement_financialInstitutionId_fkey"
  FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_paymentSettlementId_fkey"
  FOREIGN KEY ("paymentSettlementId") REFERENCES "PaymentSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_financialInstitutionId_fkey"
  FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" (
  "id", "key", "name", "description", "module", "isSystem", "isActive", "createdAt", "updatedAt"
)
SELECT 'perm_' || md5(permission_key), permission_key, permission_name, permission_description,
  'payment_methods', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('payment_methods.reactivate', 'Reactivate payment methods', 'Reactivate disabled payment methods'),
  ('payment_methods.configure_retention', 'Configure payment retention', 'Configure retention percentage'),
  ('payment_methods.configure_refunds', 'Configure payment refunds', 'Configure whether the method can be used for refunds'),
  ('payment_methods.configure_multiple_settlements', 'Configure multiple settlements', 'Configure scheduled receivables for a payment method'),
  ('payment_methods.configure_cash_impact', 'Configure cash impact', 'Configure cash and reporting behavior'),
  ('payment_methods.view_audit', 'View payment method audit', 'View payment method configuration history'),
  ('payment_settlements.read', 'Read payment settlements', 'View scheduled receivables'),
  ('payment_settlements.receive', 'Receive payment settlements', 'Mark a scheduled receivable as received'),
  ('payment_settlements.cancel', 'Cancel payment settlements', 'Cancel a pending scheduled receivable')
) AS permissions(permission_key, permission_name, permission_description)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name", "description" = EXCLUDED."description", "module" = EXCLUDED."module",
  "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "Role" role CROSS JOIN "Permission" permission
WHERE role."name" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  AND role."deletedAt" IS NULL
  AND permission."key" IN (
    'payment_methods.reactivate', 'payment_methods.configure_retention', 'payment_methods.configure_refunds',
    'payment_methods.configure_multiple_settlements', 'payment_methods.configure_cash_impact',
    'payment_methods.view_audit', 'payment_settlements.read', 'payment_settlements.receive',
    'payment_settlements.cancel'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
