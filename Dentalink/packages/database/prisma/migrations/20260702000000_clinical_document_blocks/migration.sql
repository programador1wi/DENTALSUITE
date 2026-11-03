-- Create clinical document template and patient document storage with structured JSON content.
CREATE TABLE IF NOT EXISTS "ClinicalDocumentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClinicalDocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClinicalDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,
    CONSTRAINT "ClinicalDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClinicalDocument"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT,
  ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ClinicalDocumentTemplate' AND column_name = 'content' AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE "ClinicalDocumentTemplate"
    ALTER COLUMN "content" TYPE JSONB USING jsonb_build_object(
      'version', 'clinical-doc-blocks/v1',
      'blocks', CASE
        WHEN "content" IS NULL OR btrim("content"::text) = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(jsonb_build_object('id', 'legacy-text', 'type', 'text', 'text', "content"::text))
      END
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ClinicalDocument' AND column_name = 'content' AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE "ClinicalDocument"
    ALTER COLUMN "content" TYPE JSONB USING jsonb_build_object(
      'version', 'clinical-doc-blocks/v1',
      'blocks', CASE
        WHEN "content" IS NULL OR btrim("content"::text) = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(jsonb_build_object('id', 'legacy-text', 'type', 'text', 'text', "content"::text))
      END
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicalDocumentTemplate_organizationId_name_key" ON "ClinicalDocumentTemplate"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "ClinicalDocumentTemplate_organizationId_isActive_idx" ON "ClinicalDocumentTemplate"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "ClinicalDocument_patientId_createdAt_idx" ON "ClinicalDocument"("patientId", "createdAt");
CREATE INDEX IF NOT EXISTS "ClinicalDocument_templateId_idx" ON "ClinicalDocument"("templateId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalDocumentTemplate_organizationId_fkey') THEN
    ALTER TABLE "ClinicalDocumentTemplate" ADD CONSTRAINT "ClinicalDocumentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalDocument_patientId_fkey') THEN
    ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalDocument_templateId_fkey') THEN
    ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClinicalDocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalDocument_createdById_fkey') THEN
    ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalDocument_deletedById_fkey') THEN
    ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
