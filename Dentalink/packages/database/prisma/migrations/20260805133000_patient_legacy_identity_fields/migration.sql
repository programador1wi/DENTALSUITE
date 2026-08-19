ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "socialName" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "sex" TEXT,
  ADD COLUMN IF NOT EXISTS "employer" TEXT,
  ADD COLUMN IF NOT EXISTS "observations" TEXT;

ALTER TABLE "PatientContact"
  ADD COLUMN IF NOT EXISTS "socialName" TEXT,
  ADD COLUMN IF NOT EXISTS "documentNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT;

CREATE INDEX IF NOT EXISTS "Patient_organizationId_internalNumber_idx"
  ON "Patient"("organizationId", "internalNumber");

WITH catalog("fieldKey", "sortOrder") AS (
  VALUES
    ('legalName', 1), ('socialName', 2), ('lastName', 3), ('curp', 4),
    ('email', 5), ('agreement', 6), ('internalNumber', 7), ('sex', 8),
    ('gender', 9), ('birthDate', 10), ('city', 11), ('delegation', 12),
    ('address', 13), ('fixedPhone', 14), ('mobilePhone', 15), ('profession', 16),
    ('employer', 17), ('observations', 18), ('guardian', 19), ('reference', 20),
    ('type', 21), ('guardianDocument', 22), ('guardianSocialName', 23), ('guardianGender', 24)
)
UPDATE "patient_field_configs" AS config
SET "sortOrder" = catalog."sortOrder", "updatedAt" = CURRENT_TIMESTAMP
FROM catalog
WHERE config."fieldKey" = catalog."fieldKey";

WITH missing_fields("fieldKey", "sortOrder") AS (
  VALUES
    ('socialName', 2),
    ('agreement', 6),
    ('internalNumber', 7),
    ('sex', 8),
    ('employer', 17),
    ('observations', 18),
    ('guardianDocument', 22),
    ('guardianSocialName', 23),
    ('guardianGender', 24)
)
INSERT INTO "patient_field_configs" (
  "id", "organizationId", "fieldKey", "sortOrder", "updatedAt"
)
SELECT
  'pfc_' || md5(organization."id" || ':' || missing_fields."fieldKey"),
  organization."id",
  missing_fields."fieldKey",
  missing_fields."sortOrder",
  CURRENT_TIMESTAMP
FROM "Organization" AS organization
CROSS JOIN missing_fields
ON CONFLICT ("organizationId", "fieldKey") DO NOTHING;
