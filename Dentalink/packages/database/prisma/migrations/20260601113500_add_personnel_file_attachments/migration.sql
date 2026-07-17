-- Add optional personnel ownership to file attachments while preserving patient files.
ALTER TABLE "FileAttachment"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "professionalId" TEXT;

CREATE INDEX "FileAttachment_userId_createdAt_idx" ON "FileAttachment"("userId", "createdAt");
CREATE INDEX "FileAttachment_professionalId_createdAt_idx" ON "FileAttachment"("professionalId", "createdAt");

ALTER TABLE "FileAttachment"
  ADD CONSTRAINT "FileAttachment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FileAttachment"
  ADD CONSTRAINT "FileAttachment_professionalId_fkey"
  FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
