-- Align orthodontic treatment support with the current API contract.

ALTER TABLE "OrthodonticTreatmentProfile"
  ADD COLUMN IF NOT EXISTS "estimatedControls" INTEGER;

CREATE TABLE IF NOT EXISTS "OrthodonticMaterial" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrthodonticMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrthodonticArchSize" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrthodonticArchSize_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrthodonticMaterial"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "OrthodonticArchSize"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "OrthodonticMaterial_name_key";
DROP INDEX IF EXISTS "OrthodonticArchSize_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "OrthodonticMaterial_organizationId_name_key"
  ON "OrthodonticMaterial"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "OrthodonticMaterial_organizationId_isActive_idx"
  ON "OrthodonticMaterial"("organizationId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "OrthodonticArchSize_organizationId_name_key"
  ON "OrthodonticArchSize"("organizationId", "name");

CREATE INDEX IF NOT EXISTS "OrthodonticArchSize_organizationId_isActive_idx"
  ON "OrthodonticArchSize"("organizationId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrthodonticMaterial_organizationId_fkey'
  ) THEN
    ALTER TABLE "OrthodonticMaterial"
      ADD CONSTRAINT "OrthodonticMaterial_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrthodonticArchSize_organizationId_fkey'
  ) THEN
    ALTER TABLE "OrthodonticArchSize"
      ADD CONSTRAINT "OrthodonticArchSize_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
