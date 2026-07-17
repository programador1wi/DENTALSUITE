ALTER TABLE "Procedure"
  ADD COLUMN IF NOT EXISTS "requiresOdontogramSymbol" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "defaultOdontogramSymbol" TEXT;

ALTER TABLE "TreatmentPlanItem"
  ADD COLUMN IF NOT EXISTS "odontogramSymbol" TEXT;

ALTER TABLE "OdontogramRecord"
  ADD COLUMN IF NOT EXISTS "odontogramSymbol" TEXT;

ALTER TABLE "ToothProcedure"
  ADD COLUMN IF NOT EXISTS "odontogramSymbol" TEXT;

UPDATE "Procedure"
SET
  "requiresOdontogramSymbol" = true,
  "defaultOdontogramSymbol" = COALESCE("defaultOdontogramSymbol", 'other')
WHERE lower("name") LIKE '%limpieza%'
  AND lower("name") LIKE '%blanqueamiento%';
