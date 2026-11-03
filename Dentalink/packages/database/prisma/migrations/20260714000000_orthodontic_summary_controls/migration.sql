-- CreateEnum
CREATE TYPE "ProcedureBehaviorType" AS ENUM ('GENERAL', 'ORTHODONTIC_CONTROL', 'ORTHODONTIC_MONTHLY_FEE');

-- CreateEnum
CREATE TYPE "OrthodonticControlStatus" AS ENUM ('PLANNED', 'COMPLETED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "HygieneAssessmentStatus" AS ENUM ('ACTIVE', 'ANNULLED');

-- CreateEnum
CREATE TYPE "OrthodonticMilestoneType" AS ENUM ('REEVALUATION', 'RADIOGRAPHY');

-- CreateEnum
CREATE TYPE "OrthodonticMilestoneStatus" AS ENUM ('PENDING', 'UPCOMING', 'OVERDUE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN "procedureType" "ProcedureBehaviorType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Procedure" ADD COLUMN "countsTowardOrthodonticProgress" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "startedById" TEXT;
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "finalizedById" TEXT;
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "finalizedAt" TIMESTAMP(3);
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "actualEndDate" TIMESTAMP(3);
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "finalCalendarProgress" DECIMAL(10,2);
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "finalControlsProgress" DECIMAL(10,2);
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "finalizationReason" TEXT;
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "controlFrequencyValue" INTEGER;
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "controlFrequencyUnit" TEXT;
ALTER TABLE "OrthodonticTreatmentProfile" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "OrthodonticControl" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "procedureId" TEXT,
    "evolutionId" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "clinicalDate" TIMESTAMP(3) NOT NULL,
    "status" "OrthodonticControlStatus" NOT NULL DEFAULT 'PLANNED',
    "clinicalConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "annulledById" TEXT,
    "annulledAt" TIMESTAMP(3),
    "annulmentReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrthodonticControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrthodonticHygieneScale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minValue" INTEGER NOT NULL,
    "maxValue" INTEGER NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrthodonticHygieneScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrthodonticHygieneOption" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "numericValue" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrthodonticHygieneOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrthodonticHygieneAssessment" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "controlId" TEXT,
    "evolutionId" TEXT,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clinicalDate" TIMESTAMP(3) NOT NULL,
    "scaleId" TEXT NOT NULL,
    "optionId" TEXT,
    "numericValue" DECIMAL(10,2) NOT NULL,
    "observations" TEXT,
    "recommendations" TEXT,
    "status" "HygieneAssessmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "updatedById" TEXT,
    "annulledById" TEXT,
    "annulledAt" TIMESTAMP(3),
    "annulmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrthodonticHygieneAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrthodonticMilestone" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "type" "OrthodonticMilestoneType" NOT NULL,
    "label" TEXT,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "OrthodonticMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "professionalId" TEXT,
    "evolutionId" TEXT,
    "fileAttachmentId" TEXT,
    "notes" TEXT,
    "findings" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrthodonticMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrthodonticControl_evolutionId_key" ON "OrthodonticControl"("evolutionId");
CREATE UNIQUE INDEX "OrthodonticControl_treatmentPlanId_sequenceNumber_key" ON "OrthodonticControl"("treatmentPlanId", "sequenceNumber");
CREATE INDEX "OrthodonticControl_organizationId_branchId_clinicalDate_idx" ON "OrthodonticControl"("organizationId", "branchId", "clinicalDate");
CREATE INDEX "OrthodonticControl_treatmentPlanId_status_idx" ON "OrthodonticControl"("treatmentPlanId", "status");
CREATE INDEX "OrthodonticControl_appointmentId_idx" ON "OrthodonticControl"("appointmentId");
CREATE INDEX "OrthodonticControl_procedureId_idx" ON "OrthodonticControl"("procedureId");
CREATE UNIQUE INDEX "OrthodonticHygieneScale_organizationId_name_key" ON "OrthodonticHygieneScale"("organizationId", "name");
CREATE INDEX "OrthodonticHygieneScale_organizationId_isActive_idx" ON "OrthodonticHygieneScale"("organizationId", "isActive");
CREATE UNIQUE INDEX "OrthodonticHygieneOption_scaleId_numericValue_key" ON "OrthodonticHygieneOption"("scaleId", "numericValue");
CREATE INDEX "OrthodonticHygieneOption_scaleId_sortOrder_idx" ON "OrthodonticHygieneOption"("scaleId", "sortOrder");
CREATE INDEX "OrthodonticHygieneAssessment_treatmentPlanId_clinicalDate_idx" ON "OrthodonticHygieneAssessment"("treatmentPlanId", "clinicalDate");
CREATE INDEX "OrthodonticHygieneAssessment_evolutionId_idx" ON "OrthodonticHygieneAssessment"("evolutionId");
CREATE INDEX "OrthodonticHygieneAssessment_controlId_idx" ON "OrthodonticHygieneAssessment"("controlId");
CREATE INDEX "OrthodonticHygieneAssessment_status_idx" ON "OrthodonticHygieneAssessment"("status");
CREATE INDEX "OrthodonticMilestone_treatmentPlanId_type_plannedAt_idx" ON "OrthodonticMilestone"("treatmentPlanId", "type", "plannedAt");
CREATE INDEX "OrthodonticMilestone_status_plannedAt_idx" ON "OrthodonticMilestone"("status", "plannedAt");

-- AddForeignKey
ALTER TABLE "OrthodonticControl" ADD CONSTRAINT "OrthodonticControl_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrthodonticHygieneScale" ADD CONSTRAINT "OrthodonticHygieneScale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrthodonticHygieneOption" ADD CONSTRAINT "OrthodonticHygieneOption_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "OrthodonticHygieneScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrthodonticHygieneAssessment" ADD CONSTRAINT "OrthodonticHygieneAssessment_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrthodonticHygieneAssessment" ADD CONSTRAINT "OrthodonticHygieneAssessment_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "OrthodonticHygieneScale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrthodonticHygieneAssessment" ADD CONSTRAINT "OrthodonticHygieneAssessment_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "OrthodonticHygieneOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrthodonticMilestone" ADD CONSTRAINT "OrthodonticMilestone_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
