/*
  Warnings:

  - You are about to drop the column `agendaSlotMinutes` on the `ProfessionalBranch` table. All the data in the column will be lost.
  - You are about to drop the column `defaultAppointmentDurationMinutes` on the `ProfessionalBranch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProfessionalBranch" DROP COLUMN "agendaSlotMinutes",
DROP COLUMN "defaultAppointmentDurationMinutes";

-- AlterTable
ALTER TABLE "TreatmentPlanItem" ADD COLUMN     "agreementCoverage" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "agreementId" TEXT,
ADD COLUMN     "agreementPaidAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "TreatmentPlanItem" ADD CONSTRAINT "TreatmentPlanItem_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
