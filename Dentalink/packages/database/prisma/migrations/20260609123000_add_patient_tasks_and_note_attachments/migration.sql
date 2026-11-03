CREATE TYPE "PatientTaskStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "PatientTask" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "assignedToId" TEXT,
  "createdById" TEXT NOT NULL,
  "status" "PatientTaskStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PatientTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientNoteAttachment" (
  "id" TEXT NOT NULL,
  "patientNoteId" TEXT NOT NULL,
  "fileAttachmentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientNoteAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientTask_organizationId_patientId_status_idx" ON "PatientTask"("organizationId", "patientId", "status");
CREATE INDEX "PatientTask_assignedToId_status_idx" ON "PatientTask"("assignedToId", "status");
CREATE INDEX "PatientTask_dueDate_idx" ON "PatientTask"("dueDate");

CREATE UNIQUE INDEX "PatientNoteAttachment_patientNoteId_fileAttachmentId_key" ON "PatientNoteAttachment"("patientNoteId", "fileAttachmentId");
CREATE INDEX "PatientNoteAttachment_fileAttachmentId_idx" ON "PatientNoteAttachment"("fileAttachmentId");

ALTER TABLE "PatientTask" ADD CONSTRAINT "PatientTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientTask" ADD CONSTRAINT "PatientTask_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientTask" ADD CONSTRAINT "PatientTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientTask" ADD CONSTRAINT "PatientTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientTask" ADD CONSTRAINT "PatientTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientNoteAttachment" ADD CONSTRAINT "PatientNoteAttachment_patientNoteId_fkey" FOREIGN KEY ("patientNoteId") REFERENCES "PatientNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientNoteAttachment" ADD CONSTRAINT "PatientNoteAttachment_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "FileAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
