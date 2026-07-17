-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'CONFIRMED_BY_WHATSAPP';
ALTER TYPE "AppointmentStatus" ADD VALUE 'CONFIRMED_BY_PHONE';
ALTER TYPE "AppointmentStatus" ADD VALUE 'CONFIRMED_BY_EMAIL';
ALTER TYPE "AppointmentStatus" ADD VALUE 'NOTIFIED_BY_WHATSAPP';
ALTER TYPE "AppointmentStatus" ADD VALUE 'NOTIFIED_BY_EMAIL';
ALTER TYPE "AppointmentStatus" ADD VALUE 'CANCELLED_CONFLICT';
ALTER TYPE "AppointmentStatus" ADD VALUE 'CANCELLED_RESCHEDULED';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "ClinicalDocument"
  ADD COLUMN IF NOT EXISTS "deleteReason" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

-- AlterTable
ALTER TABLE "ClinicalEvolution" ADD COLUMN     "actionNameSnapshot" TEXT,
ADD COLUMN     "annulReason" TEXT,
ADD COLUMN     "annulledAt" TIMESTAMP(3),
ADD COLUMN     "annulledById" TEXT,
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "treatmentPlanItemId" TEXT,
ADD COLUMN     "workAreaSnapshot" TEXT;

-- AlterTable
ALTER TABLE "FileAttachment" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "clinicalEvolutionId" TEXT,
ADD COLUMN     "patientId" TEXT,
ADD COLUMN     "procedureId" TEXT,
ADD COLUMN     "reversalOfMovementId" TEXT,
ADD COLUMN     "stockAfter" DECIMAL(12,2),
ADD COLUMN     "stockBefore" DECIMAL(12,2),
ADD COLUMN     "treatmentPlanId" TEXT,
ADD COLUMN     "treatmentPlanItemId" TEXT;

-- AlterTable
ALTER TABLE "InventoryStock" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InventoryWarehouse" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "treatmentPlanId" TEXT;

-- AlterTable
ALTER TABLE "SpecialtyClinicalTemplate" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "TreatmentPlanItem" ADD COLUMN     "completedByEvolutionId" TEXT;

-- CreateTable
CREATE TABLE "ProfessionalSpecialSchedule" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "chairId" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakStartTime" TEXT,
    "breakEndTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalSpecialSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineSchedulingConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "slug" TEXT NOT NULL,
    "allowedBranches" TEXT[],
    "allowedProfessionals" TEXT[],
    "allowedSpecialties" TEXT[],
    "allowedMotives" TEXT[],
    "identificationMethod" TEXT NOT NULL DEFAULT 'EMAIL',
    "requiredPatientFields" TEXT[],
    "securityMarginHours" INTEGER NOT NULL DEFAULT 2,
    "blocksPerAppointment" INTEGER NOT NULL DEFAULT 1,
    "maxDaysInAdvance" INTEGER NOT NULL DEFAULT 30,
    "maxUnvalidatedAppointmentsPerPatient" INTEGER NOT NULL DEFAULT 2,
    "brandColor" TEXT,
    "logoUrl" TEXT,
    "footerText" TEXT,
    "googleAnalyticsId" TEXT,
    "redirectUrl" TEXT,
    "confirmationMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineSchedulingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineSchedulingCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "professionalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineSchedulingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineSchedulingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "campaignCode" TEXT,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineSchedulingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlanReferral" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "fromProfessionalId" TEXT,
    "toProfessionalId" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    "professionalId" TEXT,

    CONSTRAINT "TreatmentPlanReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDiscount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "treatmentPlanId" TEXT,
    "employerName" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEvolutionField" (
    "id" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClinicalEvolutionField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEvolutionMaterial" (
    "id" TEXT NOT NULL,
    "evolutionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "inventoryMovementId" TEXT,
    "reversedMovementId" TEXT,

    CONSTRAINT "ClinicalEvolutionMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureEvolutionFieldTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "procedureId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProcedureEvolutionFieldTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureInventoryTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "procedureId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "suggestedQty" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProcedureInventoryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalSpecialSchedule_professionalId_branchId_date_is_idx" ON "ProfessionalSpecialSchedule"("professionalId", "branchId", "date", "isActive");

-- CreateIndex
CREATE INDEX "ProfessionalSpecialSchedule_chairId_date_isActive_idx" ON "ProfessionalSpecialSchedule"("chairId", "date", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineSchedulingConfig_slug_key" ON "OnlineSchedulingConfig"("slug");

-- CreateIndex
CREATE INDEX "OnlineSchedulingConfig_slug_isEnabled_idx" ON "OnlineSchedulingConfig"("slug", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineSchedulingConfig_organizationId_mode_key" ON "OnlineSchedulingConfig"("organizationId", "mode");

-- CreateIndex
CREATE INDEX "OnlineSchedulingCampaign_organizationId_idx" ON "OnlineSchedulingCampaign"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineSchedulingCampaign_organizationId_code_key" ON "OnlineSchedulingCampaign"("organizationId", "code");

-- CreateIndex
CREATE INDEX "OnlineSchedulingEvent_organizationId_eventType_createdAt_idx" ON "OnlineSchedulingEvent"("organizationId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "OnlineSchedulingEvent_campaignCode_idx" ON "OnlineSchedulingEvent"("campaignCode");

-- CreateIndex
CREATE INDEX "TreatmentPlanReferral_treatmentPlanId_createdAt_idx" ON "TreatmentPlanReferral"("treatmentPlanId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollDiscount_patientId_status_idx" ON "PayrollDiscount"("patientId", "status");

-- CreateIndex
CREATE INDEX "PayrollDiscount_organizationId_status_idx" ON "PayrollDiscount"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ClinicalEvolutionField_evolutionId_sortOrder_idx" ON "ClinicalEvolutionField"("evolutionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ClinicalEvolutionMaterial_evolutionId_idx" ON "ClinicalEvolutionMaterial"("evolutionId");

-- CreateIndex
CREATE INDEX "ProcedureEvolutionFieldTemplate_procedureId_sortOrder_idx" ON "ProcedureEvolutionFieldTemplate"("procedureId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureInventoryTemplate_procedureId_inventoryItemId_key" ON "ProcedureInventoryTemplate"("procedureId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "Prescription_treatmentPlanId_idx" ON "Prescription"("treatmentPlanId");

-- AddForeignKey
ALTER TABLE "SpecialtyClinicalTemplate" ADD CONSTRAINT "SpecialtyClinicalTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSpecialSchedule" ADD CONSTRAINT "ProfessionalSpecialSchedule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSpecialSchedule" ADD CONSTRAINT "ProfessionalSpecialSchedule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSpecialSchedule" ADD CONSTRAINT "ProfessionalSpecialSchedule_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolution" ADD CONSTRAINT "ClinicalEvolution_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolution" ADD CONSTRAINT "ClinicalEvolution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolution" ADD CONSTRAINT "ClinicalEvolution_treatmentPlanItemId_fkey" FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolution" ADD CONSTRAINT "ClinicalEvolution_annulledById_fkey" FOREIGN KEY ("annulledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalDocument_deletedById_fkey') THEN
    ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_treatmentPlanItemId_fkey" FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_clinicalEvolutionId_fkey" FOREIGN KEY ("clinicalEvolutionId") REFERENCES "ClinicalEvolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reversalOfMovementId_fkey" FOREIGN KEY ("reversalOfMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineSchedulingConfig" ADD CONSTRAINT "OnlineSchedulingConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineSchedulingCampaign" ADD CONSTRAINT "OnlineSchedulingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineSchedulingCampaign" ADD CONSTRAINT "OnlineSchedulingCampaign_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineSchedulingEvent" ADD CONSTRAINT "OnlineSchedulingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanReferral" ADD CONSTRAINT "TreatmentPlanReferral_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanReferral" ADD CONSTRAINT "TreatmentPlanReferral_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanReferral" ADD CONSTRAINT "TreatmentPlanReferral_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanReferral" ADD CONSTRAINT "TreatmentPlanReferral_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanReferral" ADD CONSTRAINT "TreatmentPlanReferral_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanReferral" ADD CONSTRAINT "TreatmentPlanReferral_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDiscount" ADD CONSTRAINT "PayrollDiscount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDiscount" ADD CONSTRAINT "PayrollDiscount_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDiscount" ADD CONSTRAINT "PayrollDiscount_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionField" ADD CONSTRAINT "ClinicalEvolutionField_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ClinicalEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionMaterial" ADD CONSTRAINT "ClinicalEvolutionMaterial_evolutionId_fkey" FOREIGN KEY ("evolutionId") REFERENCES "ClinicalEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionMaterial" ADD CONSTRAINT "ClinicalEvolutionMaterial_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionMaterial" ADD CONSTRAINT "ClinicalEvolutionMaterial_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureEvolutionFieldTemplate" ADD CONSTRAINT "ProcedureEvolutionFieldTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureEvolutionFieldTemplate" ADD CONSTRAINT "ProcedureEvolutionFieldTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureEvolutionFieldTemplate" ADD CONSTRAINT "ProcedureEvolutionFieldTemplate_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureInventoryTemplate" ADD CONSTRAINT "ProcedureInventoryTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureInventoryTemplate" ADD CONSTRAINT "ProcedureInventoryTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureInventoryTemplate" ADD CONSTRAINT "ProcedureInventoryTemplate_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureInventoryTemplate" ADD CONSTRAINT "ProcedureInventoryTemplate_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ProfessionalContractCategoryRate_contractId_procedureCategoryId" RENAME TO "ProfessionalContractCategoryRate_contractId_procedureCatego_key";
