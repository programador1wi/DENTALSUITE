ALTER TABLE "Procedure"
  ADD COLUMN "displayId" INTEGER;

WITH numbered AS (
  SELECT
    "id",
    25000 + ROW_NUMBER() OVER (
      PARTITION BY "organizationId"
      ORDER BY "createdAt", "id"
    ) AS "nextDisplayId"
  FROM "Procedure"
)
UPDATE "Procedure" p
SET "displayId" = numbered."nextDisplayId"
FROM numbered
WHERE p."id" = numbered."id";

ALTER TABLE "Procedure"
  ALTER COLUMN "displayId" SET NOT NULL;

CREATE UNIQUE INDEX "Procedure_organizationId_displayId_key" ON "Procedure"("organizationId", "displayId");
