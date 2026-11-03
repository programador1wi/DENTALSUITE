CREATE TYPE "ExpenseReportGroup" AS ENUM ('PROFESSIONALS', 'LABORATORIES', 'COMMISSIONS', 'GENERAL');

ALTER TABLE "ExpenseCategory"
ADD COLUMN "reportGroup" "ExpenseReportGroup" NOT NULL DEFAULT 'GENERAL';

ALTER TABLE "Expense"
ADD COLUMN "accountingDate" TIMESTAMP(3);

ALTER TABLE "TreatmentPlanReferral"
ADD COLUMN "destinationTreatmentPlanId" TEXT;

ALTER TABLE "TreatmentPlanReferral"
ADD CONSTRAINT "TreatmentPlanReferral_destinationTreatmentPlanId_fkey"
FOREIGN KEY ("destinationTreatmentPlanId") REFERENCES "TreatmentPlan"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Expense_organizationId_branchId_accountingDate_idx"
ON "Expense"("organizationId", "branchId", "accountingDate");

CREATE INDEX "TreatmentPlanReferral_destinationTreatmentPlanId_idx"
ON "TreatmentPlanReferral"("destinationTreatmentPlanId");

CREATE INDEX "TreatmentPlanReferral_organizationId_createdAt_idx"
ON "TreatmentPlanReferral"("organizationId", "createdAt");
