-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "financialInstitutionId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_financialInstitutionId_idx" ON "Payment"("financialInstitutionId");

-- AddForeignKey
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_financialInstitutionId_fkey"
FOREIGN KEY ("financialInstitutionId") REFERENCES "FinancialInstitution"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
