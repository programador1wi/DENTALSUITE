-- Additive orthodontic treatment plan configuration.
ALTER TABLE "OrthodonticTreatmentProfile"
  ADD COLUMN "technicalDescription" TEXT,
  ADD COLUMN "totalAligners" INTEGER,
  ADD COLUMN "indicatedExtractions" TEXT,
  ADD COLUMN "performedExtractions" TEXT,
  ADD COLUMN "reevaluationDate" TIMESTAMP(3),
  ADD COLUMN "interconsultations" TEXT;

CREATE TABLE "OrthodonticOptionField" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "inputType" TEXT NOT NULL,
  "allowsMultiple" BOOLEAN NOT NULL DEFAULT false,
  "isConfigurable" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrthodonticOptionField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticFieldOption" (
  "id" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "normalizedLabel" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deactivatedById" TEXT,
  "deactivatedAt" TIMESTAMP(3),
  "deactivationReason" TEXT,
  "reactivatedById" TEXT,
  "reactivatedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OrthodonticFieldOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticPlanFieldValue" (
  "id" TEXT NOT NULL,
  "orthodonticProfileId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "optionId" TEXT,
  "optionLabelSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrthodonticPlanFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticPlanOptionValue" (
  "id" TEXT NOT NULL,
  "orthodonticProfileId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "optionId" TEXT,
  "optionLabelSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrthodonticPlanOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrthodonticOptionField_organizationId_code_key" ON "OrthodonticOptionField"("organizationId", "code");
CREATE INDEX "OrthodonticOptionField_organizationId_isActive_idx" ON "OrthodonticOptionField"("organizationId", "isActive");

CREATE UNIQUE INDEX "OrthodonticFieldOption_fieldId_normalizedLabel_key" ON "OrthodonticFieldOption"("fieldId", "normalizedLabel");
CREATE INDEX "OrthodonticFieldOption_fieldId_isActive_sortOrder_idx" ON "OrthodonticFieldOption"("fieldId", "isActive", "sortOrder");

CREATE UNIQUE INDEX "OrthodonticPlanFieldValue_orthodonticProfileId_fieldId_key" ON "OrthodonticPlanFieldValue"("orthodonticProfileId", "fieldId");
CREATE INDEX "OrthodonticPlanFieldValue_fieldId_idx" ON "OrthodonticPlanFieldValue"("fieldId");
CREATE INDEX "OrthodonticPlanFieldValue_optionId_idx" ON "OrthodonticPlanFieldValue"("optionId");

CREATE UNIQUE INDEX "OrthodonticPlanOptionValue_orthodonticProfileId_fieldId_optionId_key" ON "OrthodonticPlanOptionValue"("orthodonticProfileId", "fieldId", "optionId");
CREATE INDEX "OrthodonticPlanOptionValue_fieldId_idx" ON "OrthodonticPlanOptionValue"("fieldId");
CREATE INDEX "OrthodonticPlanOptionValue_optionId_idx" ON "OrthodonticPlanOptionValue"("optionId");

ALTER TABLE "OrthodonticFieldOption"
  ADD CONSTRAINT "OrthodonticFieldOption_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "OrthodonticOptionField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticPlanFieldValue"
  ADD CONSTRAINT "OrthodonticPlanFieldValue_orthodonticProfileId_fkey"
  FOREIGN KEY ("orthodonticProfileId") REFERENCES "OrthodonticTreatmentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticPlanFieldValue"
  ADD CONSTRAINT "OrthodonticPlanFieldValue_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "OrthodonticOptionField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrthodonticPlanFieldValue"
  ADD CONSTRAINT "OrthodonticPlanFieldValue_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "OrthodonticFieldOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrthodonticPlanOptionValue"
  ADD CONSTRAINT "OrthodonticPlanOptionValue_orthodonticProfileId_fkey"
  FOREIGN KEY ("orthodonticProfileId") REFERENCES "OrthodonticTreatmentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticPlanOptionValue"
  ADD CONSTRAINT "OrthodonticPlanOptionValue_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "OrthodonticOptionField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrthodonticPlanOptionValue"
  ADD CONSTRAINT "OrthodonticPlanOptionValue_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "OrthodonticFieldOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
