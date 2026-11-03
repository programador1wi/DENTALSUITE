ALTER TABLE "Branch" ALTER COLUMN "agendaStartHour" SET DEFAULT 10;

UPDATE "Branch"
SET "agendaStartHour" = 10,
    "agendaEndHour" = 19
WHERE "deletedAt" IS NULL
  AND "agendaStartHour" = 8
  AND "agendaEndHour" = 19;

WITH ranked_assignments AS (
  SELECT
    "professionalId",
    "branchId",
    ROW_NUMBER() OVER (
      PARTITION BY "professionalId"
      ORDER BY "isPrimary" DESC, "startsAt" ASC, "createdAt" ASC, "branchId" ASC
    ) AS assignment_rank
  FROM "ProfessionalBranch"
  WHERE "status" = 'ACTIVE'
    AND ("endsAt" IS NULL OR "endsAt" > NOW())
)
UPDATE "ProfessionalBranch" pb
SET "status" = 'ENDED',
    "isPrimary" = false,
    "endsAt" = NOW(),
    "endedReason" = 'Cerrado por politica: un profesional solo puede estar activo en una sucursal'
FROM ranked_assignments ranked
WHERE pb."professionalId" = ranked."professionalId"
  AND pb."branchId" = ranked."branchId"
  AND ranked.assignment_rank > 1;

WITH kept_assignments AS (
  SELECT
    "professionalId",
    "branchId",
    ROW_NUMBER() OVER (
      PARTITION BY "professionalId"
      ORDER BY "isPrimary" DESC, "startsAt" ASC, "createdAt" ASC, "branchId" ASC
    ) AS assignment_rank
  FROM "ProfessionalBranch"
  WHERE "status" = 'ACTIVE'
    AND ("endsAt" IS NULL OR "endsAt" > NOW())
)
UPDATE "ProfessionalBranch" pb
SET "isPrimary" = true
FROM kept_assignments kept
WHERE pb."professionalId" = kept."professionalId"
  AND pb."branchId" = kept."branchId"
  AND kept.assignment_rank = 1;

INSERT INTO "Specialty" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
SELECT 'auto_specialty_general_' || org."id",
       org."id",
       'Odontología General (Integral)',
       true,
       NOW(),
       NOW()
FROM "Organization" org
ON CONFLICT ("organizationId", "name")
DO UPDATE SET "isActive" = true, "updatedAt" = NOW();

INSERT INTO "Specialty" ("id", "organizationId", "name", "isActive", "createdAt", "updatedAt")
SELECT 'auto_specialty_ortho_' || org."id",
       org."id",
       'Ortodoncia',
       true,
       NOW(),
       NOW()
FROM "Organization" org
ON CONFLICT ("organizationId", "name")
DO UPDATE SET "isActive" = true, "updatedAt" = NOW();

WITH needed_general AS (
  SELECT b."id" AS "branchId",
         b."organizationId",
         b."name" AS "branchName",
         COALESCE(b."code", b."id") AS "branchCode",
         series.idx
  FROM "Branch" b
  CROSS JOIN generate_series(1, 2) AS series(idx)
  WHERE b."deletedAt" IS NULL
    AND b."status" = 'ACTIVE'
    AND b."isActive" = true
    AND (
      SELECT COUNT(DISTINCT p."id")
      FROM "ProfessionalBranch" pb
      JOIN "Professional" p ON p."id" = pb."professionalId" AND p."isActive" = true
      JOIN "ProfessionalSpecialty" ps ON ps."professionalId" = p."id"
      JOIN "Specialty" s ON s."id" = ps."specialtyId"
      WHERE pb."branchId" = b."id"
        AND pb."status" = 'ACTIVE'
        AND (pb."endsAt" IS NULL OR pb."endsAt" > NOW())
        AND s."name" IN ('Odontología General (Integral)', 'OdontologÃ­a General (Integral)', 'Odontología General', 'OdontologÃ­a General', 'General')
    ) < series.idx
),
general_specialties AS (
  SELECT "organizationId", "id" AS "specialtyId"
  FROM "Specialty"
  WHERE "name" = 'Odontología General (Integral)'
)
INSERT INTO "Professional" ("id", "organizationId", "firstName", "lastName", "email", "color", "isActive", "createdAt", "updatedAt")
SELECT 'auto_prof_general_' || ng."branchId" || '_' || ng.idx,
       ng."organizationId",
       'Dr. General',
       ng."branchName" || ' ' || ng.idx,
       'auto.general.' || ng.idx || '.' || lower(regexp_replace(ng."branchCode", '[^a-zA-Z0-9]+', '.', 'g')) || '@dentalwarner.local',
       '#0f766e',
       true,
       NOW(),
       NOW()
FROM needed_general ng
JOIN general_specialties gs ON gs."organizationId" = ng."organizationId"
ON CONFLICT ("organizationId", "email")
DO UPDATE SET "isActive" = true, "updatedAt" = NOW();

WITH needed_general AS (
  SELECT b."id" AS "branchId",
         b."organizationId",
         COALESCE(b."code", b."id") AS "branchCode",
         series.idx
  FROM "Branch" b
  CROSS JOIN generate_series(1, 2) AS series(idx)
  WHERE b."deletedAt" IS NULL
    AND b."status" = 'ACTIVE'
    AND b."isActive" = true
    AND (
      SELECT COUNT(DISTINCT p."id")
      FROM "ProfessionalBranch" pb
      JOIN "Professional" p ON p."id" = pb."professionalId" AND p."isActive" = true
      JOIN "ProfessionalSpecialty" ps ON ps."professionalId" = p."id"
      JOIN "Specialty" s ON s."id" = ps."specialtyId"
      WHERE pb."branchId" = b."id"
        AND pb."status" = 'ACTIVE'
        AND (pb."endsAt" IS NULL OR pb."endsAt" > NOW())
        AND s."name" IN ('Odontología General (Integral)', 'OdontologÃ­a General (Integral)', 'Odontología General', 'OdontologÃ­a General', 'General')
    ) < series.idx
),
general_specialties AS (
  SELECT "organizationId", "id" AS "specialtyId"
  FROM "Specialty"
  WHERE "name" = 'Odontología General (Integral)'
),
created_general AS (
  SELECT p."id" AS "professionalId",
         ng."branchId",
         gs."specialtyId"
  FROM needed_general ng
  JOIN "Professional" p
    ON p."organizationId" = ng."organizationId"
    AND p."email" = 'auto.general.' || ng.idx || '.' || lower(regexp_replace(ng."branchCode", '[^a-zA-Z0-9]+', '.', 'g')) || '@dentalwarner.local'
  JOIN general_specialties gs ON gs."organizationId" = ng."organizationId"
)
INSERT INTO "ProfessionalSpecialty" ("professionalId", "specialtyId", "createdAt")
SELECT "professionalId", "specialtyId", NOW()
FROM created_general
ON CONFLICT ("professionalId", "specialtyId") DO NOTHING;

WITH needed_general AS (
  SELECT b."id" AS "branchId",
         b."organizationId",
         COALESCE(b."code", b."id") AS "branchCode",
         series.idx
  FROM "Branch" b
  CROSS JOIN generate_series(1, 2) AS series(idx)
  WHERE b."deletedAt" IS NULL
    AND b."status" = 'ACTIVE'
    AND b."isActive" = true
    AND (
      SELECT COUNT(DISTINCT p."id")
      FROM "ProfessionalBranch" pb
      JOIN "Professional" p ON p."id" = pb."professionalId" AND p."isActive" = true
      JOIN "ProfessionalSpecialty" ps ON ps."professionalId" = p."id"
      JOIN "Specialty" s ON s."id" = ps."specialtyId"
      WHERE pb."branchId" = b."id"
        AND pb."status" = 'ACTIVE'
        AND (pb."endsAt" IS NULL OR pb."endsAt" > NOW())
        AND s."name" IN ('Odontología General (Integral)', 'OdontologÃ­a General (Integral)', 'Odontología General', 'OdontologÃ­a General', 'General')
    ) < series.idx
),
created_general AS (
  SELECT p."id" AS "professionalId", ng."branchId"
  FROM needed_general ng
  JOIN "Professional" p
    ON p."organizationId" = ng."organizationId"
    AND p."email" = 'auto.general.' || ng.idx || '.' || lower(regexp_replace(ng."branchCode", '[^a-zA-Z0-9]+', '.', 'g')) || '@dentalwarner.local'
)
INSERT INTO "ProfessionalBranch" ("professionalId", "branchId", "isPrimary", "status", "startsAt", "createdAt")
SELECT "professionalId", "branchId", true, 'ACTIVE', NOW(), NOW()
FROM created_general
ON CONFLICT ("professionalId", "branchId")
DO UPDATE SET "status" = 'ACTIVE', "isPrimary" = true, "endsAt" = NULL, "endedReason" = NULL;

WITH needed_ortho AS (
  SELECT b."id" AS "branchId",
         b."organizationId",
         b."name" AS "branchName",
         COALESCE(b."code", b."id") AS "branchCode"
  FROM "Branch" b
  WHERE b."deletedAt" IS NULL
    AND b."status" = 'ACTIVE'
    AND b."isActive" = true
    AND (
      SELECT COUNT(DISTINCT p."id")
      FROM "ProfessionalBranch" pb
      JOIN "Professional" p ON p."id" = pb."professionalId" AND p."isActive" = true
      JOIN "ProfessionalSpecialty" ps ON ps."professionalId" = p."id"
      JOIN "Specialty" s ON s."id" = ps."specialtyId"
      WHERE pb."branchId" = b."id"
        AND pb."status" = 'ACTIVE'
        AND (pb."endsAt" IS NULL OR pb."endsAt" > NOW())
        AND s."name" = 'Ortodoncia'
    ) < 1
),
ortho_specialties AS (
  SELECT "organizationId", "id" AS "specialtyId"
  FROM "Specialty"
  WHERE "name" = 'Ortodoncia'
)
INSERT INTO "Professional" ("id", "organizationId", "firstName", "lastName", "email", "color", "isActive", "createdAt", "updatedAt")
SELECT 'auto_prof_ortho_' || no."branchId" || '_1',
       no."organizationId",
       'Dr. Ortodoncia',
       no."branchName" || ' 1',
       'auto.ortodoncia.1.' || lower(regexp_replace(no."branchCode", '[^a-zA-Z0-9]+', '.', 'g')) || '@dentalwarner.local',
       '#7c3aed',
       true,
       NOW(),
       NOW()
FROM needed_ortho no
JOIN ortho_specialties os ON os."organizationId" = no."organizationId"
ON CONFLICT ("organizationId", "email")
DO UPDATE SET "isActive" = true, "updatedAt" = NOW();

WITH needed_ortho AS (
  SELECT b."id" AS "branchId",
         b."organizationId",
         COALESCE(b."code", b."id") AS "branchCode"
  FROM "Branch" b
  WHERE b."deletedAt" IS NULL
    AND b."status" = 'ACTIVE'
    AND b."isActive" = true
    AND (
      SELECT COUNT(DISTINCT p."id")
      FROM "ProfessionalBranch" pb
      JOIN "Professional" p ON p."id" = pb."professionalId" AND p."isActive" = true
      JOIN "ProfessionalSpecialty" ps ON ps."professionalId" = p."id"
      JOIN "Specialty" s ON s."id" = ps."specialtyId"
      WHERE pb."branchId" = b."id"
        AND pb."status" = 'ACTIVE'
        AND (pb."endsAt" IS NULL OR pb."endsAt" > NOW())
        AND s."name" = 'Ortodoncia'
    ) < 1
),
ortho_specialties AS (
  SELECT "organizationId", "id" AS "specialtyId"
  FROM "Specialty"
  WHERE "name" = 'Ortodoncia'
),
created_ortho AS (
  SELECT p."id" AS "professionalId",
         no."branchId",
         os."specialtyId"
  FROM needed_ortho no
  JOIN "Professional" p
    ON p."organizationId" = no."organizationId"
    AND p."email" = 'auto.ortodoncia.1.' || lower(regexp_replace(no."branchCode", '[^a-zA-Z0-9]+', '.', 'g')) || '@dentalwarner.local'
  JOIN ortho_specialties os ON os."organizationId" = no."organizationId"
)
INSERT INTO "ProfessionalSpecialty" ("professionalId", "specialtyId", "createdAt")
SELECT "professionalId", "specialtyId", NOW()
FROM created_ortho
ON CONFLICT ("professionalId", "specialtyId") DO NOTHING;

WITH needed_ortho AS (
  SELECT b."id" AS "branchId",
         b."organizationId",
         COALESCE(b."code", b."id") AS "branchCode"
  FROM "Branch" b
  WHERE b."deletedAt" IS NULL
    AND b."status" = 'ACTIVE'
    AND b."isActive" = true
    AND (
      SELECT COUNT(DISTINCT p."id")
      FROM "ProfessionalBranch" pb
      JOIN "Professional" p ON p."id" = pb."professionalId" AND p."isActive" = true
      JOIN "ProfessionalSpecialty" ps ON ps."professionalId" = p."id"
      JOIN "Specialty" s ON s."id" = ps."specialtyId"
      WHERE pb."branchId" = b."id"
        AND pb."status" = 'ACTIVE'
        AND (pb."endsAt" IS NULL OR pb."endsAt" > NOW())
        AND s."name" = 'Ortodoncia'
    ) < 1
),
created_ortho AS (
  SELECT p."id" AS "professionalId", no."branchId"
  FROM needed_ortho no
  JOIN "Professional" p
    ON p."organizationId" = no."organizationId"
    AND p."email" = 'auto.ortodoncia.1.' || lower(regexp_replace(no."branchCode", '[^a-zA-Z0-9]+', '.', 'g')) || '@dentalwarner.local'
)
INSERT INTO "ProfessionalBranch" ("professionalId", "branchId", "isPrimary", "status", "startsAt", "createdAt")
SELECT "professionalId", "branchId", true, 'ACTIVE', NOW(), NOW()
FROM created_ortho
ON CONFLICT ("professionalId", "branchId")
DO UPDATE SET "status" = 'ACTIVE', "isPrimary" = true, "endsAt" = NULL, "endedReason" = NULL;
