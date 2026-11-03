CREATE TYPE "OrthodonticDiagnosisStatus" AS ENUM ('DRAFT', 'ACTIVE', 'AMENDED', 'VOIDED');

CREATE TABLE "OrthodonticDiagnosis" (
  "id" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "status" "OrthodonticDiagnosisStatus" NOT NULL DEFAULT 'DRAFT',
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "previousVersionId" TEXT,
  "clinicalDate" TIMESTAMP(3),
  "changeReason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedById" TEXT,
  "activatedAt" TIMESTAMP(3),
  "voidedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OrthodonticDiagnosis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticDiagnosisSection" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrthodonticDiagnosisSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticDiagnosisField" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "inputType" TEXT NOT NULL,
  "allowsMultiple" BOOLEAN NOT NULL DEFAULT false,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "includeInSummary" BOOLEAN NOT NULL DEFAULT false,
  "unitType" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isConfigurable" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "validationJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrthodonticDiagnosisField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticDiagnosisFieldOption" (
  "id" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "normalizedLabel" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
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
  CONSTRAINT "OrthodonticDiagnosisFieldOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticDiagnosisFieldValue" (
  "id" TEXT NOT NULL,
  "diagnosisId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "valueText" TEXT,
  "valueNumber" DECIMAL(12,4),
  "valueDate" TIMESTAMP(3),
  "valueBoolean" BOOLEAN,
  "unitId" TEXT,
  "optionId" TEXT,
  "optionLabelSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrthodonticDiagnosisFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrthodonticDiagnosisMultiOptionValue" (
  "id" TEXT NOT NULL,
  "diagnosisId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "optionId" TEXT,
  "optionLabelSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrthodonticDiagnosisMultiOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrthodonticDiagnosis_treatmentPlanId_status_idx" ON "OrthodonticDiagnosis"("treatmentPlanId", "status");
CREATE INDEX "OrthodonticDiagnosis_patientId_status_idx" ON "OrthodonticDiagnosis"("patientId", "status");
CREATE INDEX "OrthodonticDiagnosis_previousVersionId_idx" ON "OrthodonticDiagnosis"("previousVersionId");

CREATE UNIQUE INDEX "OrthodonticDiagnosisSection_code_key" ON "OrthodonticDiagnosisSection"("code");
CREATE INDEX "OrthodonticDiagnosisSection_isActive_sortOrder_idx" ON "OrthodonticDiagnosisSection"("isActive", "sortOrder");

CREATE UNIQUE INDEX "OrthodonticDiagnosisField_sectionId_code_key" ON "OrthodonticDiagnosisField"("sectionId", "code");
CREATE INDEX "OrthodonticDiagnosisField_sectionId_isActive_sortOrder_idx" ON "OrthodonticDiagnosisField"("sectionId", "isActive", "sortOrder");

CREATE UNIQUE INDEX "OrthodonticDiagnosisFieldOption_fieldId_normalizedLabel_key" ON "OrthodonticDiagnosisFieldOption"("fieldId", "normalizedLabel");
CREATE INDEX "OrthodonticDiagnosisFieldOption_fieldId_isActive_sortOrder_idx" ON "OrthodonticDiagnosisFieldOption"("fieldId", "isActive", "sortOrder");

CREATE UNIQUE INDEX "OrthodonticDiagnosisFieldValue_diagnosisId_fieldId_key" ON "OrthodonticDiagnosisFieldValue"("diagnosisId", "fieldId");
CREATE INDEX "OrthodonticDiagnosisFieldValue_fieldId_idx" ON "OrthodonticDiagnosisFieldValue"("fieldId");
CREATE INDEX "OrthodonticDiagnosisFieldValue_optionId_idx" ON "OrthodonticDiagnosisFieldValue"("optionId");

CREATE UNIQUE INDEX "OrthodonticDiagnosisMultiOptionValue_diagnosisId_fieldId_optionId_key" ON "OrthodonticDiagnosisMultiOptionValue"("diagnosisId", "fieldId", "optionId");
CREATE INDEX "OrthodonticDiagnosisMultiOptionValue_fieldId_idx" ON "OrthodonticDiagnosisMultiOptionValue"("fieldId");
CREATE INDEX "OrthodonticDiagnosisMultiOptionValue_optionId_idx" ON "OrthodonticDiagnosisMultiOptionValue"("optionId");

ALTER TABLE "OrthodonticDiagnosis"
  ADD CONSTRAINT "OrthodonticDiagnosis_treatmentPlanId_fkey"
  FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisField"
  ADD CONSTRAINT "OrthodonticDiagnosisField_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "OrthodonticDiagnosisSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisFieldOption"
  ADD CONSTRAINT "OrthodonticDiagnosisFieldOption_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "OrthodonticDiagnosisField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisFieldValue"
  ADD CONSTRAINT "OrthodonticDiagnosisFieldValue_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "OrthodonticDiagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisFieldValue"
  ADD CONSTRAINT "OrthodonticDiagnosisFieldValue_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "OrthodonticDiagnosisField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisFieldValue"
  ADD CONSTRAINT "OrthodonticDiagnosisFieldValue_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "OrthodonticDiagnosisFieldOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisMultiOptionValue"
  ADD CONSTRAINT "OrthodonticDiagnosisMultiOptionValue_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "OrthodonticDiagnosis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisMultiOptionValue"
  ADD CONSTRAINT "OrthodonticDiagnosisMultiOptionValue_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "OrthodonticDiagnosisField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrthodonticDiagnosisMultiOptionValue"
  ADD CONSTRAINT "OrthodonticDiagnosisMultiOptionValue_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "OrthodonticDiagnosisFieldOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
