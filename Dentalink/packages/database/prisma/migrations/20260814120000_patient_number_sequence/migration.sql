-- Create sequence for patientNumber
CREATE SEQUENCE IF NOT EXISTS "Patient_patientNumber_seq";

-- Add column patientNumber
ALTER TABLE "Patient"
ADD COLUMN IF NOT EXISTS "patientNumber" INTEGER DEFAULT nextval('"Patient_patientNumber_seq"');

-- Backfill existing rows with sequential numbers based on creation order
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS row_number
  FROM "Patient"
  WHERE "patientNumber" IS NULL
)
UPDATE "Patient" p
SET "patientNumber" = ordered.row_number
FROM ordered
WHERE p."id" = ordered."id";

-- Update sequence current value to max patientNumber
SELECT setval('"Patient_patientNumber_seq"', COALESCE((SELECT MAX("patientNumber") FROM "Patient"), 1));

-- Set patientNumber to NOT NULL
ALTER TABLE "Patient" ALTER COLUMN "patientNumber" SET NOT NULL;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_patientNumber_key" ON "Patient"("patientNumber");
