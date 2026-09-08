ALTER TABLE "FileAttachment"
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "detectedMimeType" TEXT,
  ADD COLUMN "scanStatus" TEXT,
  ADD COLUMN "encryptionVersion" INTEGER;

CREATE INDEX "FileAttachment_organizationId_storageProvider_createdAt_idx"
  ON "FileAttachment"("organizationId", "storageProvider", "createdAt");
