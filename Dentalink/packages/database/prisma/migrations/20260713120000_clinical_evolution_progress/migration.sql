ALTER TABLE "TreatmentPlanItem"
ADD COLUMN "completionPercentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "performedAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "TreatmentPlanItem"
SET
  "completionPercentage" = CASE
    WHEN "status" = 'COMPLETED' THEN 100
    WHEN "status" = 'IN_PROGRESS' THEN 25
    ELSE 0
  END,
  "performedAmount" = CASE
    WHEN "status" = 'COMPLETED' THEN "total"
    WHEN "status" = 'IN_PROGRESS' THEN ROUND(("total" * 0.25)::numeric, 2)
    ELSE 0
  END;

ALTER TABLE "ClinicalEvolution"
ADD COLUMN "completionPercentage" INTEGER,
ADD COLUMN "performedAmountSnapshot" DECIMAL(10, 2);
