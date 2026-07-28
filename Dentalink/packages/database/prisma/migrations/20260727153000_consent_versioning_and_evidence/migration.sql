-- Consent templates become versioned clinical artifacts. Existing rows are
-- migrated as immutable version 1 publications to preserve live workflows.
ALTER TYPE "ConsentStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_SIGNATURE';
ALTER TYPE "ConsentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_SIGNED';
ALTER TYPE "ConsentStatus" ADD VALUE IF NOT EXISTS 'VOIDED';
ALTER TYPE "ConsentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "ConsentTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ConsentTemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ConsentScopeType" AS ENUM ('ORGANIZATION', 'BRANCHES', 'SPECIALTY', 'TREATMENTS');

ALTER TABLE "ConsentTemplate"
  ADD COLUMN "internalDescription" TEXT,
  ADD COLUMN "scopeType" "ConsentScopeType" NOT NULL DEFAULT 'ORGANIZATION',
  ADD COLUMN "specialtyId" TEXT,
  ADD COLUMN "treatmentTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "status" "ConsentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "currentPublishedVersionId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ConsentTemplateVersion" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "ConsentTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "editorSchemaJson" JSONB NOT NULL,
  "sanitizedHtmlSnapshot" TEXT NOT NULL,
  "requiredSignersJson" JSONB NOT NULL,
  "variablesManifestJson" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdById" TEXT,
  "publishedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "ConsentTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentTemplateBranch" (
  "templateId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentTemplateBranch_pkey" PRIMARY KEY ("templateId", "branchId")
);

INSERT INTO "ConsentTemplateVersion" (
  "id",
  "templateId",
  "versionNumber",
  "status",
  "editorSchemaJson",
  "sanitizedHtmlSnapshot",
  "requiredSignersJson",
  "variablesManifestJson",
  "contentHash",
  "createdAt",
  "publishedAt"
)
SELECT
  "id" || '_v1',
  "id",
  1,
  'PUBLISHED'::"ConsentTemplateVersionStatus",
  jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', "content"))
      )
    )
  ),
  "content",
  '{"patient":{"enabled":true,"required":true},"professional":{"enabled":false,"required":false,"mode":"ANY_AUTHORIZED"},"representative":{"enabled":false,"required":false,"replacesPatient":false}}'::jsonb,
  '[]'::jsonb,
  md5("content"),
  "createdAt",
  "createdAt"
FROM "ConsentTemplate";

UPDATE "ConsentTemplate"
SET
  "currentPublishedVersionId" = "id" || '_v1',
  "status" = CASE
    WHEN "isActive" THEN 'PUBLISHED'::"ConsentTemplateStatus"
    ELSE 'INACTIVE'::"ConsentTemplateStatus"
  END;

ALTER TABLE "ConsentTemplate" ALTER COLUMN "isActive" SET DEFAULT false;

ALTER TABLE "Consent"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "templateVersionId" TEXT,
  ADD COLUMN "professionalId" TEXT,
  ADD COLUMN "representativeId" TEXT,
  ADD COLUMN "mergedValuesJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "renderedHtmlSnapshot" TEXT,
  ADD COLUMN "documentHash" TEXT,
  ADD COLUMN "pdfStorageKey" TEXT,
  ADD COLUMN "pdfMimeType" TEXT,
  ADD COLUMN "pdfSize" INTEGER,
  ADD COLUMN "pdfChecksum" TEXT,
  ADD COLUMN "readyAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" TEXT,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "supersedesConsentId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "createdById" TEXT;

UPDATE "Consent" AS consent
SET
  "organizationId" = patient."organizationId",
  "branchId" = patient."branchId",
  "templateVersionId" = consent."templateId" || '_v1',
  "renderedHtmlSnapshot" = consent."contentSnapshot",
  "documentHash" = md5(consent."contentSnapshot"),
  "completedAt" = CASE WHEN consent."signedAt" IS NOT NULL THEN consent."signedAt" ELSE NULL END
FROM "Patient" AS patient
WHERE patient."id" = consent."patientId";

ALTER TABLE "Consent"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "templateVersionId" SET NOT NULL,
  ALTER COLUMN "renderedHtmlSnapshot" SET NOT NULL,
  ALTER COLUMN "documentHash" SET NOT NULL;

ALTER TABLE "DocumentSignature"
  ADD COLUMN "signerReferenceId" TEXT,
  ADD COLUMN "signatureMethod" TEXT NOT NULL DEFAULT 'DRAWN',
  ADD COLUMN "signatureStorageKey" TEXT,
  ADD COLUMN "signatureMimeType" TEXT,
  ADD COLUMN "signatureSize" INTEGER,
  ADD COLUMN "signatureChecksum" TEXT,
  ADD COLUMN "documentHash" TEXT,
  ADD COLUMN "acceptanceText" TEXT,
  ADD COLUMN "acceptanceTextVersion" TEXT,
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "facilitatedById" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "DocumentSignature" AS signature
SET
  "signatureStorageKey" = 'legacy-inline:' || signature."id",
  "signatureMimeType" = 'image/png',
  "signatureSize" = length(signature."signatureData"),
  "signatureChecksum" = md5(signature."signatureData"),
  "documentHash" = consent."documentHash",
  "acceptanceText" = 'Aceptación registrada en versión anterior del sistema',
  "acceptanceTextVersion" = 'legacy-v1',
  "branchId" = consent."branchId"
FROM "Consent" AS consent
WHERE consent."id" = signature."consentId";

ALTER TABLE "DocumentSignature"
  ALTER COLUMN "signatureStorageKey" SET NOT NULL,
  ALTER COLUMN "signatureMimeType" SET NOT NULL,
  ALTER COLUMN "signatureSize" SET NOT NULL,
  ALTER COLUMN "signatureChecksum" SET NOT NULL,
  ALTER COLUMN "documentHash" SET NOT NULL,
  ALTER COLUMN "acceptanceText" SET NOT NULL,
  ALTER COLUMN "acceptanceTextVersion" SET NOT NULL;

CREATE UNIQUE INDEX "ConsentTemplate_currentPublishedVersionId_key"
  ON "ConsentTemplate"("currentPublishedVersionId");
CREATE INDEX "ConsentTemplate_organizationId_status_updatedAt_idx"
  ON "ConsentTemplate"("organizationId", "status", "updatedAt");
CREATE INDEX "ConsentTemplate_createdById_idx" ON "ConsentTemplate"("createdById");
CREATE INDEX "ConsentTemplate_updatedById_idx" ON "ConsentTemplate"("updatedById");

CREATE UNIQUE INDEX "ConsentTemplateVersion_templateId_versionNumber_key"
  ON "ConsentTemplateVersion"("templateId", "versionNumber");
CREATE INDEX "ConsentTemplateVersion_templateId_status_createdAt_idx"
  ON "ConsentTemplateVersion"("templateId", "status", "createdAt");
CREATE INDEX "ConsentTemplateVersion_contentHash_idx"
  ON "ConsentTemplateVersion"("contentHash");
CREATE INDEX "ConsentTemplateBranch_branchId_templateId_idx"
  ON "ConsentTemplateBranch"("branchId", "templateId");

CREATE INDEX "Consent_organizationId_branchId_status_createdAt_idx"
  ON "Consent"("organizationId", "branchId", "status", "createdAt");
CREATE INDEX "Consent_templateVersionId_createdAt_idx"
  ON "Consent"("templateVersionId", "createdAt");
CREATE INDEX "Consent_documentHash_idx" ON "Consent"("documentHash");
CREATE UNIQUE INDEX "Consent_organizationId_idempotencyKey_key"
  ON "Consent"("organizationId", "idempotencyKey");

CREATE INDEX "DocumentSignature_documentHash_idx"
  ON "DocumentSignature"("documentHash");

-- Earlier releases allowed repeated signer labels. Keep every legacy record
-- while assigning a unique historical slot before enforcing concurrency safety.
WITH ranked_signatures AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "consentId", "signerType"
      ORDER BY "signedAt", "id"
    ) AS duplicate_number
  FROM "DocumentSignature"
)
UPDATE "DocumentSignature" AS signature
SET "signerType" = signature."signerType" || '_LEGACY_' || ranked.duplicate_number::TEXT
FROM ranked_signatures AS ranked
WHERE signature."id" = ranked."id"
  AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX "DocumentSignature_consentId_signerType_key"
  ON "DocumentSignature"("consentId", "signerType");

ALTER TABLE "ConsentTemplateVersion"
  ADD CONSTRAINT "ConsentTemplateVersion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ConsentTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentTemplate"
  ADD CONSTRAINT "ConsentTemplate_currentPublishedVersionId_fkey"
  FOREIGN KEY ("currentPublishedVersionId") REFERENCES "ConsentTemplateVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentTemplateBranch"
  ADD CONSTRAINT "ConsentTemplateBranch_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ConsentTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentTemplateBranch"
  ADD CONSTRAINT "ConsentTemplateBranch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Consent"
  ADD CONSTRAINT "Consent_templateVersionId_fkey"
  FOREIGN KEY ("templateVersionId") REFERENCES "ConsentTemplateVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consent"
  ADD CONSTRAINT "Consent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consent"
  ADD CONSTRAINT "Consent_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consent"
  ADD CONSTRAINT "Consent_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Consent"
  ADD CONSTRAINT "Consent_supersedesConsentId_fkey"
  FOREIGN KEY ("supersedesConsentId") REFERENCES "Consent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentSignature"
  DROP CONSTRAINT "DocumentSignature_consentId_fkey";
ALTER TABLE "DocumentSignature"
  ADD CONSTRAINT "DocumentSignature_consentId_fkey"
  FOREIGN KEY ("consentId") REFERENCES "Consent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
