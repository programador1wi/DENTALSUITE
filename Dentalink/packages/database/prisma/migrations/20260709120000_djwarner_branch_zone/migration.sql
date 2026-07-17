-- Ensure Dental J.Warner is a real operational branch zone.
INSERT INTO "BranchZone" ("id", "organizationId", "code", "name", "isActive", "createdAt", "updatedAt")
SELECT
  concat('zone_djwarner_', o."id"),
  o."id",
  'DJWARNER',
  'DJWarner',
  true,
  now(),
  now()
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "BranchZone" z
  WHERE z."organizationId" = o."id"
    AND z."code" = 'DJWARNER'
);

UPDATE "Branch" b
SET "zoneId" = z."id",
    "updatedAt" = now()
FROM "BranchBrand" brand,
     "BranchZone" z
WHERE b."brandId" = brand."id"
  AND z."organizationId" = b."organizationId"
  AND z."code" = 'DJWARNER'
  AND brand."organizationId" = b."organizationId"
  AND brand."code" = 'DENTAL_JWARNER';
