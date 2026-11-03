CREATE TYPE "RadiographyAnalysisProvider" AS ENUM ('MANUAL', 'AI');

CREATE TYPE "RadiographyAnalysisStatus" AS ENUM ('DRAFT', 'CONFIRMED');

CREATE TABLE "RadiographyAnalysis" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "fileAttachmentId" TEXT NOT NULL,
  "provider" "RadiographyAnalysisProvider" NOT NULL DEFAULT 'MANUAL',
  "status" "RadiographyAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
  "findings" JSONB NOT NULL DEFAULT '[]',
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RadiographyAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RadiographyAnalysis_fileAttachmentId_key" ON "RadiographyAnalysis"("fileAttachmentId");
CREATE INDEX "RadiographyAnalysis_organizationId_createdAt_idx" ON "RadiographyAnalysis"("organizationId", "createdAt");
CREATE INDEX "RadiographyAnalysis_patientId_createdAt_idx" ON "RadiographyAnalysis"("patientId", "createdAt");
CREATE INDEX "RadiographyAnalysis_createdById_idx" ON "RadiographyAnalysis"("createdById");
CREATE INDEX "RadiographyAnalysis_updatedById_idx" ON "RadiographyAnalysis"("updatedById");

ALTER TABLE "RadiographyAnalysis"
  ADD CONSTRAINT "RadiographyAnalysis_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RadiographyAnalysis"
  ADD CONSTRAINT "RadiographyAnalysis_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RadiographyAnalysis"
  ADD CONSTRAINT "RadiographyAnalysis_fileAttachmentId_fkey"
  FOREIGN KEY ("fileAttachmentId") REFERENCES "FileAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RadiographyAnalysis"
  ADD CONSTRAINT "RadiographyAnalysis_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RadiographyAnalysis"
  ADD CONSTRAINT "RadiographyAnalysis_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
