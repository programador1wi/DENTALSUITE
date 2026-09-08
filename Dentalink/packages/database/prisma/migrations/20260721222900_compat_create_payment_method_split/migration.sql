-- Compatibility repair for clean installations.
-- This table existed in long-lived databases before it was referenced by
-- 20260721223000_payment_method_settlements, but its creating migration was
-- never committed. Keep this migration idempotent so existing databases can
-- record the repair without changing their already-correct table.
CREATE TABLE IF NOT EXISTS "PaymentMethodSplit" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "paymentMethodId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "financialInstitutionId" TEXT,
  "reference" TEXT,
  "externalTransactionId" TEXT,
  "authorizationCode" TEXT,
  "lastFour" TEXT,
  "provider" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'RECEIVED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMethodSplit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentMethodSplit_paymentId_idx"
  ON "PaymentMethodSplit"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentMethodSplit_paymentMethodId_idx"
  ON "PaymentMethodSplit"("paymentMethodId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentMethodSplit_paymentId_fkey'
      AND conrelid = '"PaymentMethodSplit"'::regclass
  ) THEN
    ALTER TABLE "PaymentMethodSplit"
      ADD CONSTRAINT "PaymentMethodSplit_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentMethodSplit_paymentMethodId_fkey'
      AND conrelid = '"PaymentMethodSplit"'::regclass
  ) THEN
    ALTER TABLE "PaymentMethodSplit"
      ADD CONSTRAINT "PaymentMethodSplit_paymentMethodId_fkey"
      FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentMethodSplit_financialInstitutionId_fkey'
      AND conrelid = '"PaymentMethodSplit"'::regclass
  ) THEN
    ALTER TABLE "PaymentMethodSplit"
      ADD CONSTRAINT "PaymentMethodSplit_financialInstitutionId_fkey"
      FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
