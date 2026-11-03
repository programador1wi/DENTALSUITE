CREATE TYPE "PhotographicSessionType" AS ENUM ('INITIAL', 'FOLLOW_UP', 'REEVALUATION', 'FINAL', 'CUSTOM', 'IMPORTED');
CREATE TYPE "PhotographicSessionStatus" AS ENUM ('DRAFT', 'INCOMPLETE', 'COMPLETE', 'ARCHIVED', 'VOIDED');
CREATE TYPE "PhotographicImageStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'READY', 'ERROR', 'REPLACED', 'VOIDED');
CREATE TYPE "PhotographicLinkedEntityType" AS ENUM ('APPOINTMENT', 'ORTHODONTIC_CONTROL', 'CLINICAL_EVOLUTION');
CREATE TYPE "PhotographicFrequency" AS ENUM ('NONE', 'EVERY_CONTROL', 'EVERY_3_MONTHS', 'EVERY_6_MONTHS', 'EVERY_12_MONTHS', 'INITIAL_AND_FINAL', 'CUSTOM');
CREATE TYPE "PhotographicUploadSessionStatus" AS ENUM ('ACTIVE', 'CLAIMED', 'COMPLETED', 'EXPIRED', 'REVOKED');

CREATE TABLE "PhotographicSession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sessionType" "PhotographicSessionType" NOT NULL DEFAULT 'FOLLOW_UP',
  "clinicalDate" DATE NOT NULL,
  "professionalId" TEXT NOT NULL,
  "status" "PhotographicSessionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "voidedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "idempotencyKey" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PhotographicSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotographicSlot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "columnNumber" INTEGER NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "recommendedOrientation" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotographicSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotographicSessionImage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "originalFileId" TEXT NOT NULL,
  "previewFileId" TEXT,
  "thumbnailFileId" TEXT,
  "editedFileId" TEXT,
  "checksum" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "status" "PhotographicImageStatus" NOT NULL DEFAULT 'PROCESSING',
  "transformationsJson" JSONB,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replacedImageId" TEXT,
  "voidedById" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotographicSessionImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotographicSessionLink" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "linkedEntityType" "PhotographicLinkedEntityType" NOT NULL,
  "linkedEntityId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL DEFAULT 'CLINICAL_CONTEXT',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedById" TEXT,
  "removedAt" TIMESTAMP(3),
  "removalReason" TEXT,
  CONSTRAINT "PhotographicSessionLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotographicUploadSession" (
  "id" TEXT NOT NULL,
  "photographicSessionId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "PhotographicUploadSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PhotographicUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhotographicPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "treatmentPlanId" TEXT NOT NULL,
  "frequency" "PhotographicFrequency" NOT NULL DEFAULT 'NONE',
  "customIntervalDays" INTEGER,
  "reminderDismissedAt" TIMESTAMP(3),
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotographicPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotographicSession_idempotencyKey_key" ON "PhotographicSession"("idempotencyKey");
CREATE INDEX "PhotographicSession_organizationId_patientId_clinicalDate_c_idx" ON "PhotographicSession"("organizationId", "patientId", "clinicalDate", "createdAt");
CREATE INDEX "PhotographicSession_treatmentPlanId_status_clinicalDate_idx" ON "PhotographicSession"("treatmentPlanId", "status", "clinicalDate");
CREATE INDEX "PhotographicSession_branchId_clinicalDate_idx" ON "PhotographicSession"("branchId", "clinicalDate");
CREATE UNIQUE INDEX "PhotographicSlot_organizationId_code_key" ON "PhotographicSlot"("organizationId", "code");
CREATE UNIQUE INDEX "PhotographicSlot_organizationId_rowNumber_columnNumber_key" ON "PhotographicSlot"("organizationId", "rowNumber", "columnNumber");
CREATE INDEX "PhotographicSlot_organizationId_isActive_sortOrder_idx" ON "PhotographicSlot"("organizationId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "PhotographicSessionImage_originalFileId_key" ON "PhotographicSessionImage"("originalFileId");
CREATE UNIQUE INDEX "PhotographicSessionImage_previewFileId_key" ON "PhotographicSessionImage"("previewFileId");
CREATE UNIQUE INDEX "PhotographicSessionImage_thumbnailFileId_key" ON "PhotographicSessionImage"("thumbnailFileId");
CREATE UNIQUE INDEX "PhotographicSessionImage_editedFileId_key" ON "PhotographicSessionImage"("editedFileId");
CREATE INDEX "PhotographicSessionImage_sessionId_slotId_status_idx" ON "PhotographicSessionImage"("sessionId", "slotId", "status");
CREATE INDEX "PhotographicSessionImage_checksum_idx" ON "PhotographicSessionImage"("checksum");
CREATE INDEX "PhotographicSessionImage_replacedImageId_idx" ON "PhotographicSessionImage"("replacedImageId");
CREATE UNIQUE INDEX "PhotographicSessionImage_active_slot_key" ON "PhotographicSessionImage"("sessionId", "slotId") WHERE "voidedAt" IS NULL AND "status" NOT IN ('REPLACED', 'VOIDED');
CREATE INDEX "PhotographicSessionLink_sessionId_removedAt_idx" ON "PhotographicSessionLink"("sessionId", "removedAt");
CREATE INDEX "PhotographicSessionLink_linkedEntityType_linkedEntityId_idx" ON "PhotographicSessionLink"("linkedEntityType", "linkedEntityId");
CREATE UNIQUE INDEX "PhotographicSessionLink_active_entity_key" ON "PhotographicSessionLink"("sessionId", "linkedEntityType", "linkedEntityId") WHERE "removedAt" IS NULL;
CREATE UNIQUE INDEX "PhotographicUploadSession_tokenHash_key" ON "PhotographicUploadSession"("tokenHash");
CREATE INDEX "PhotographicUploadSession_photographicSessionId_status_idx" ON "PhotographicUploadSession"("photographicSessionId", "status");
CREATE INDEX "PhotographicUploadSession_expiresAt_status_idx" ON "PhotographicUploadSession"("expiresAt", "status");
CREATE UNIQUE INDEX "PhotographicPolicy_treatmentPlanId_key" ON "PhotographicPolicy"("treatmentPlanId");
CREATE INDEX "PhotographicPolicy_organizationId_frequency_idx" ON "PhotographicPolicy"("organizationId", "frequency");

ALTER TABLE "PhotographicSession" ADD CONSTRAINT "PhotographicSession_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionImage" ADD CONSTRAINT "PhotographicSessionImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PhotographicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionImage" ADD CONSTRAINT "PhotographicSessionImage_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PhotographicSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionImage" ADD CONSTRAINT "PhotographicSessionImage_originalFileId_fkey" FOREIGN KEY ("originalFileId") REFERENCES "FileAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionImage" ADD CONSTRAINT "PhotographicSessionImage_previewFileId_fkey" FOREIGN KEY ("previewFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionImage" ADD CONSTRAINT "PhotographicSessionImage_thumbnailFileId_fkey" FOREIGN KEY ("thumbnailFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionImage" ADD CONSTRAINT "PhotographicSessionImage_editedFileId_fkey" FOREIGN KEY ("editedFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionImage" ADD CONSTRAINT "PhotographicSessionImage_replacedImageId_fkey" FOREIGN KEY ("replacedImageId") REFERENCES "PhotographicSessionImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhotographicSessionLink" ADD CONSTRAINT "PhotographicSessionLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PhotographicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotographicUploadSession" ADD CONSTRAINT "PhotographicUploadSession_photographicSessionId_fkey" FOREIGN KEY ("photographicSessionId") REFERENCES "PhotographicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotographicPolicy" ADD CONSTRAINT "PhotographicPolicy_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
