CREATE TYPE "BranchBrandStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "Branch"
ADD COLUMN "description" TEXT,
ADD COLUMN "countryCode" TEXT DEFAULT '+52',
ADD COLUMN "secondaryPhone" TEXT,
ADD COLUMN "replyToEmail" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "exteriorNumber" TEXT,
ADD COLUMN "interiorNumber" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "municipality" TEXT,
ADD COLUMN "references" TEXT,
ADD COLUMN "showInEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showInDocuments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showInOnlineScheduling" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowOnlineAppointments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowNotifications" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "BranchBrand"
ADD COLUMN "slug" TEXT,
ADD COLUMN "legalName" TEXT,
ADD COLUMN "shortName" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "logoStorageKey" TEXT,
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#0f172a',
ADD COLUMN "accentColor" TEXT,
ADD COLUMN "domain" TEXT,
ADD COLUMN "publicDomain" TEXT,
ADD COLUMN "senderName" TEXT,
ADD COLUMN "senderEmail" TEXT,
ADD COLUMN "replyToEmail" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "privacyNoticeUrl" TEXT,
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "status" "BranchBrandStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

UPDATE "BranchBrand"
SET
  "slug" = trim(both '-' from lower(regexp_replace("code", '[^a-zA-Z0-9]+', '-', 'g'))),
  "shortName" = COALESCE("shortName", "name"),
  "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"BranchBrandStatus" ELSE 'ARCHIVED'::"BranchBrandStatus" END,
  "archivedAt" = CASE WHEN "isActive" THEN NULL ELSE COALESCE("archivedAt", now()) END
WHERE "slug" IS NULL;

INSERT INTO "BranchBrand" (
  "id",
  "organizationId",
  "name",
  "code",
  "slug",
  "shortName",
  "legalName",
  "logoUrl",
  "phone",
  "senderEmail",
  "replyToEmail",
  "isDefault",
  "status",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'brand_default_' || substr(md5(o."id"), 1, 20),
  o."id",
  COALESCE(NULLIF(o."name", ''), 'Marca principal'),
  'DEFAULT',
  'default',
  COALESCE(NULLIF(o."name", ''), 'Principal'),
  o."legalName",
  o."logoUrl",
  o."phone",
  o."email",
  o."email",
  true,
  'ACTIVE'::"BranchBrandStatus",
  true,
  now(),
  now()
FROM "Organization" o
WHERE o."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "BranchBrand" bb
    WHERE bb."organizationId" = o."id"
  );

WITH ranked_brands AS (
  SELECT
    bb."id",
    row_number() OVER (
      PARTITION BY bb."organizationId"
      ORDER BY
        CASE WHEN bb."code" = 'DENTAL_PLUS' THEN 0 ELSE 1 END,
        bb."createdAt" ASC,
        bb."id" ASC
    ) AS rn
  FROM "BranchBrand" bb
  WHERE bb."status" = 'ACTIVE'::"BranchBrandStatus"
)
UPDATE "BranchBrand" bb
SET "isDefault" = ranked_brands.rn = 1
FROM ranked_brands
WHERE bb."id" = ranked_brands."id";

WITH default_brands AS (
  SELECT "id", "organizationId"
  FROM "BranchBrand"
  WHERE "isDefault" = true
)
UPDATE "Branch" b
SET
  "brandId" = default_brands."id",
  "updatedAt" = now()
FROM default_brands
WHERE b."organizationId" = default_brands."organizationId"
  AND b."brandId" IS NULL
  AND b."deletedAt" IS NULL;

ALTER TABLE "BranchBrand" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "BranchBrand_organizationId_slug_key" ON "BranchBrand"("organizationId", "slug");
CREATE UNIQUE INDEX "BranchBrand_one_default_per_organization_key"
ON "BranchBrand"("organizationId")
WHERE "isDefault" = true AND "archivedAt" IS NULL;
CREATE INDEX "BranchBrand_organizationId_status_idx" ON "BranchBrand"("organizationId", "status");
CREATE INDEX "BranchBrand_organizationId_isDefault_idx" ON "BranchBrand"("organizationId", "isDefault");
