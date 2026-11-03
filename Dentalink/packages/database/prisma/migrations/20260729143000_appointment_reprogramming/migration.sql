CREATE TYPE "AppointmentReprogrammingCaseStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'RESCHEDULED',
  'DEFINITIVELY_CANCELLED',
  'EXCLUDED'
);

CREATE TYPE "AppointmentReprogrammingBatchStatus" AS ENUM (
  'CREATED',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL',
  'FAILED'
);

CREATE TYPE "AppointmentReprogrammingBatchItemStatus" AS ENUM (
  'PENDING',
  'PROCESSED',
  'SKIPPED',
  'FAILED',
  'EXCLUDED'
);

CREATE TABLE "AppointmentReprogrammingBatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reasonText" TEXT NOT NULL,
  "observation" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "AppointmentReprogrammingBatchStatus" NOT NULL DEFAULT 'CREATED',
  "selectedCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "excludedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AppointmentReprogrammingBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentReprogrammingCase" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "originalAppointmentId" TEXT NOT NULL,
  "newAppointmentId" TEXT,
  "batchId" TEXT,
  "patientId" TEXT NOT NULL,
  "originalProfessionalId" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reasonText" TEXT NOT NULL,
  "status" "AppointmentReprogrammingCaseStatus" NOT NULL DEFAULT 'PENDING',
  "originalStartAt" TIMESTAMP(3) NOT NULL,
  "originalEndAt" TIMESTAMP(3) NOT NULL,
  "originalDurationMinutes" INTEGER NOT NULL,
  "originalBoxId" TEXT,
  "originalAttentionReason" TEXT,
  "originalSnapshot" JSONB NOT NULL,
  "assignedUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "closedReason" TEXT,
  "closedObservation" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "AppointmentReprogrammingCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentReprogrammingBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "caseId" TEXT,
  "status" "AppointmentReprogrammingBatchItemStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentReprogrammingBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppointmentReprogrammingBatch_organizationId_idempotencyKey_key"
  ON "AppointmentReprogrammingBatch"("organizationId", "idempotencyKey");
CREATE INDEX "AppointmentReprogrammingBatch_organizationId_branchId_createdAt_idx"
  ON "AppointmentReprogrammingBatch"("organizationId", "branchId", "createdAt");
CREATE INDEX "AppointmentReprogrammingBatch_professionalId_startAt_endAt_idx"
  ON "AppointmentReprogrammingBatch"("professionalId", "startAt", "endAt");
CREATE INDEX "AppointmentReprogrammingBatch_status_createdAt_idx"
  ON "AppointmentReprogrammingBatch"("status", "createdAt");

CREATE UNIQUE INDEX "AppointmentReprogrammingCase_originalAppointmentId_key"
  ON "AppointmentReprogrammingCase"("originalAppointmentId");
CREATE UNIQUE INDEX "AppointmentReprogrammingCase_newAppointmentId_key"
  ON "AppointmentReprogrammingCase"("newAppointmentId");
CREATE INDEX "AppointmentReprogrammingCase_organizationId_branchId_status_createdAt_idx"
  ON "AppointmentReprogrammingCase"("organizationId", "branchId", "status", "createdAt");
CREATE INDEX "AppointmentReprogrammingCase_originalProfessionalId_status_createdAt_idx"
  ON "AppointmentReprogrammingCase"("originalProfessionalId", "status", "createdAt");
CREATE INDEX "AppointmentReprogrammingCase_patientId_status_idx"
  ON "AppointmentReprogrammingCase"("patientId", "status");
CREATE INDEX "AppointmentReprogrammingCase_batchId_idx"
  ON "AppointmentReprogrammingCase"("batchId");

CREATE UNIQUE INDEX "AppointmentReprogrammingBatchItem_caseId_key"
  ON "AppointmentReprogrammingBatchItem"("caseId");
CREATE UNIQUE INDEX "AppointmentReprogrammingBatchItem_batchId_appointmentId_key"
  ON "AppointmentReprogrammingBatchItem"("batchId", "appointmentId");
CREATE INDEX "AppointmentReprogrammingBatchItem_batchId_status_idx"
  ON "AppointmentReprogrammingBatchItem"("batchId", "status");
CREATE INDEX "AppointmentReprogrammingBatchItem_appointmentId_idx"
  ON "AppointmentReprogrammingBatchItem"("appointmentId");

ALTER TABLE "AppointmentReprogrammingBatch"
  ADD CONSTRAINT "AppointmentReprogrammingBatch_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingBatch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingBatch_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingBatch_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AppointmentReprogrammingCase"
  ADD CONSTRAINT "AppointmentReprogrammingCase_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_originalAppointmentId_fkey"
  FOREIGN KEY ("originalAppointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_newAppointmentId_fkey"
  FOREIGN KEY ("newAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "AppointmentReprogrammingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_originalProfessionalId_fkey"
  FOREIGN KEY ("originalProfessionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingCase_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AppointmentReprogrammingBatchItem"
  ADD CONSTRAINT "AppointmentReprogrammingBatchItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "AppointmentReprogrammingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingBatchItem_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentReprogrammingBatchItem_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "AppointmentReprogrammingCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
