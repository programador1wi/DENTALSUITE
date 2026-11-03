-- Cash sessions remain stored in CashRegister for backwards compatibility.
-- This migration adds reconciliation, traceability and expense lifecycle data without deleting historical rows.

ALTER TYPE "CashRegisterStatus" ADD VALUE IF NOT EXISTS 'CLOSING';
ALTER TYPE "CashRegisterStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'PAYMENT_VOID';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'MANUAL_INCOME';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'MANUAL_EXPENSE';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CLOSING_CARRYOVER';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'INITIAL_DEPOSIT';

CREATE TYPE "CashMovementDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "ExpenseStatus" AS ENUM ('REGISTERED', 'PAID', 'VOIDED');

ALTER TABLE "PaymentMethod"
  ADD COLUMN "includeInCollectionReports" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeInPhysicalCashBalance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "includeInCashFlowReports" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeInClosingSummary" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "includeInGraphicalReports" BOOLEAN NOT NULL DEFAULT true;

UPDATE "PaymentMethod"
SET "includeInPhysicalCashBalance" = true
WHERE "type" = 'CASH';

ALTER TABLE "CashRegister"
  ADD COLUMN "publicNumber" INTEGER,
  ADD COLUMN "responsibleUserId" TEXT,
  ADD COLUMN "previousClosingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "initialDeposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "expectedCashBalance" DECIMAL(10,2),
  ADD COLUMN "declaredCashBalance" DECIMAL(10,2),
  ADD COLUMN "closingCarryover" DECIMAL(10,2),
  ADD COLUMN "withdrawnAmount" DECIMAL(10,2),
  ADD COLUMN "differenceAmount" DECIMAL(10,2),
  ADD COLUMN "openingNotes" TEXT,
  ADD COLUMN "closingNotes" TEXT,
  ADD COLUMN "reconciliationSnapshot" JSONB,
  ADD COLUMN "currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

WITH numbered AS (
  SELECT "id", 100000 + ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "openedAt", "id") AS number
  FROM "CashRegister"
)
UPDATE "CashRegister" AS register
SET
  "publicNumber" = numbered.number,
  "responsibleUserId" = register."openedById",
  "initialDeposit" = register."openingAmount"
FROM numbered
WHERE numbered."id" = register."id";

ALTER TABLE "CashRegister"
  ALTER COLUMN "publicNumber" SET NOT NULL,
  ALTER COLUMN "responsibleUserId" SET NOT NULL;

CREATE UNIQUE INDEX "CashRegister_organizationId_publicNumber_key"
  ON "CashRegister"("organizationId", "publicNumber");
CREATE UNIQUE INDEX "CashRegister_one_active_session_per_responsible_key"
  ON "CashRegister"("organizationId", "branchId", "responsibleUserId")
  WHERE "status" IN ('OPEN', 'CLOSING');
ALTER TABLE "CashRegister"
  ADD CONSTRAINT "CashRegister_responsibleUserId_fkey"
  FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD COLUMN "publicNumber" INTEGER,
  ADD COLUMN "supplierName" TEXT,
  ADD COLUMN "paymentMethodId" TEXT,
  ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'PAID',
  ADD COLUMN "documentUrl" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

WITH numbered AS (
  SELECT "id", 100000 + ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "createdAt", "id") AS number
  FROM "Expense"
)
UPDATE "Expense" AS expense
SET "publicNumber" = numbered.number
FROM numbered
WHERE numbered."id" = expense."id";

ALTER TABLE "Expense" ALTER COLUMN "publicNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Expense_organizationId_publicNumber_key"
  ON "Expense"("organizationId", "publicNumber");
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Expense_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Expense_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Refund"
  ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashMovement"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "direction" "CashMovementDirection" NOT NULL DEFAULT 'IN',
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "paymentMethodId" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidReason" TEXT;

UPDATE "CashMovement" AS movement
SET
  "organizationId" = register."organizationId",
  "branchId" = register."branchId",
  "direction" = CASE
    WHEN movement."type" IN ('EXPENSE', 'REFUND') THEN 'OUT'::"CashMovementDirection"
    ELSE 'IN'::"CashMovementDirection"
  END
FROM "CashRegister" AS register
WHERE register."id" = movement."cashRegisterId";

UPDATE "CashMovement" AS movement
SET "paymentMethodId" = payment."paymentMethodId"
FROM "Payment" AS payment
WHERE payment."id" = movement."paymentId";

ALTER TABLE "CashMovement"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL;

CREATE INDEX "CashMovement_refundId_idx" ON "CashMovement"("refundId");
CREATE INDEX "CashMovement_organizationId_branchId_createdAt_idx"
  ON "CashMovement"("organizationId", "branchId", "createdAt");
CREATE UNIQUE INDEX "CashMovement_cashRegisterId_idempotencyKey_key"
  ON "CashMovement"("cashRegisterId", "idempotencyKey");

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CashMovement_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CashMovement_refundId_fkey"
  FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CashMovement_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CashMovement_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
