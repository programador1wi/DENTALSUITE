CREATE TABLE "RichTextSanitizationBackup" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "originalContent" TEXT NOT NULL,
  "originalChecksum" TEXT NOT NULL,
  "sanitizedChecksum" TEXT NOT NULL,
  "sanitizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RichTextSanitizationBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RichTextSanitizationBackup_entityType_entityId_fieldName_originalChecksum_key"
  ON "RichTextSanitizationBackup"("entityType", "entityId", "fieldName", "originalChecksum");
CREATE INDEX "RichTextSanitizationBackup_organizationId_sanitizedAt_idx"
  ON "RichTextSanitizationBackup"("organizationId", "sanitizedAt");
CREATE INDEX "RichTextSanitizationBackup_entityType_entityId_idx"
  ON "RichTextSanitizationBackup"("entityType", "entityId");
