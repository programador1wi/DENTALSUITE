-- Link installment plans to the treatment plan items they finance.
CREATE TABLE "InstallmentPlanItem" (
    "id" TEXT NOT NULL,
    "installmentPlanId" TEXT NOT NULL,
    "treatmentPlanItemId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstallmentPlanItem_installmentPlanId_treatmentPlanItemId_key"
ON "InstallmentPlanItem"("installmentPlanId", "treatmentPlanItemId");

CREATE INDEX "InstallmentPlanItem_treatmentPlanItemId_idx"
ON "InstallmentPlanItem"("treatmentPlanItemId");

ALTER TABLE "InstallmentPlanItem"
ADD CONSTRAINT "InstallmentPlanItem_installmentPlanId_fkey"
FOREIGN KEY ("installmentPlanId") REFERENCES "InstallmentPlan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstallmentPlanItem"
ADD CONSTRAINT "InstallmentPlanItem_treatmentPlanItemId_fkey"
FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
