ALTER TABLE "ToothProcedure"
  ADD COLUMN "treatmentPlanItemId" TEXT;

CREATE UNIQUE INDEX "ToothProcedure_treatmentPlanItemId_key" ON "ToothProcedure"("treatmentPlanItemId");

ALTER TABLE "ToothProcedure"
  ADD CONSTRAINT "ToothProcedure_treatmentPlanItemId_fkey"
  FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
