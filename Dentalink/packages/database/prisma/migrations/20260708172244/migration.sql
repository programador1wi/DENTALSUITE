-- DropForeignKey
ALTER TABLE "PaymentInstallmentAllocation" DROP CONSTRAINT "PaymentInstallmentAllocation_installmentId_fkey";

-- DropIndex
DROP INDEX "ClinicalEvolution_treatmentPlanId_createdAt_idx";

-- DropIndex
DROP INDEX "FileAttachment_treatmentPlanId_createdAt_idx";

-- DropIndex
DROP INDEX "OrthodonticTreatmentProfile_treatmentPlanId_idx";

-- DropIndex
DROP INDEX "TreatmentPlan_kind_status_idx";

-- DropIndex
DROP INDEX "TreatmentPlan_specialtyId_idx";

-- AlterTable
ALTER TABLE "ClinicalDocument" ADD COLUMN     "treatmentPlanId" TEXT;

-- AlterTable
ALTER TABLE "OrthodonticArchSize" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrthodonticMaterial" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrthodonticTreatmentProfile" ALTER COLUMN "diagnosis" DROP NOT NULL,
ALTER COLUMN "diagnosis" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentInstallmentAllocation" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "PaymentInstallmentAllocation" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "PaymentInstallmentAllocation" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "TreatmentPlanPause" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlanPause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreatmentPlanPause_treatmentPlanId_idx" ON "TreatmentPlanPause"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "PaymentInstallmentAllocation_paymentId_idx" ON "PaymentInstallmentAllocation"("paymentId");

-- AddForeignKey
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstallmentAllocation" ADD CONSTRAINT "PaymentInstallmentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanPause" ADD CONSTRAINT "TreatmentPlanPause_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
