-- Add treatment-plan specialization for general dentistry and orthodontics.
CREATE TYPE "TreatmentPlanKind" AS ENUM ('GENERAL', 'ORTHODONTICS');

ALTER TABLE "TreatmentPlan"
  ADD COLUMN "kind" "TreatmentPlanKind" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "specialtyId" TEXT,
  ADD COLUMN "specialtySnapshotName" TEXT;

CREATE TABLE "OrthodonticTreatmentProfile" (
  "id" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3),
  "estimatedMonths" INTEGER,
  "lastUpperArch" TEXT,
  "lastLowerArch" TEXT,
  "nextControlAt" TIMESTAMP(3),
  "nextRadiographyAt" TIMESTAMP(3),
  "hygieneStatus" TEXT,
  "alert" TEXT,
  "indications" TEXT,
  "elastics" TEXT,
  "diagnosis" JSONB NOT NULL DEFAULT '{}',
  "planNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrthodonticTreatmentProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FileAttachment"
  ADD COLUMN "treatmentPlanId" TEXT;

CREATE UNIQUE INDEX "OrthodonticTreatmentProfile_treatmentPlanId_key" ON "OrthodonticTreatmentProfile"("treatmentPlanId");
CREATE INDEX "OrthodonticTreatmentProfile_treatmentPlanId_idx" ON "OrthodonticTreatmentProfile"("treatmentPlanId");
CREATE INDEX "TreatmentPlan_kind_status_idx" ON "TreatmentPlan"("kind", "status");
CREATE INDEX "TreatmentPlan_specialtyId_idx" ON "TreatmentPlan"("specialtyId");
CREATE INDEX "FileAttachment_treatmentPlanId_createdAt_idx" ON "FileAttachment"("treatmentPlanId", "createdAt");
CREATE INDEX "ClinicalEvolution_treatmentPlanId_createdAt_idx" ON "ClinicalEvolution"("treatmentPlanId", "createdAt");

ALTER TABLE "TreatmentPlan"
  ADD CONSTRAINT "TreatmentPlan_specialtyId_fkey"
  FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrthodonticTreatmentProfile"
  ADD CONSTRAINT "OrthodonticTreatmentProfile_treatmentPlanId_fkey"
  FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileAttachment"
  ADD CONSTRAINT "FileAttachment_treatmentPlanId_fkey"
  FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClinicalEvolution"
  ADD CONSTRAINT "ClinicalEvolution_treatmentPlanId_fkey"
  FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
