-- Track partial and full payments applied to financing installments.
CREATE TABLE "PaymentInstallmentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentInstallmentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentInstallmentAllocation_paymentId_installmentId_key" ON "PaymentInstallmentAllocation"("paymentId", "installmentId");
CREATE INDEX "PaymentInstallmentAllocation_installmentId_idx" ON "PaymentInstallmentAllocation"("installmentId");

ALTER TABLE "PaymentInstallmentAllocation"
    ADD CONSTRAINT "PaymentInstallmentAllocation_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentInstallmentAllocation"
    ADD CONSTRAINT "PaymentInstallmentAllocation_installmentId_fkey"
    FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
