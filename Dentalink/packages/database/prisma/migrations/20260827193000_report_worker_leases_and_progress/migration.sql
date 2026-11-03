ALTER TABLE "ReportRequest"
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "progressRows" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "progressPercent" INTEGER,
  ADD COLUMN "errorCode" TEXT;

CREATE INDEX "ReportRequest_status_nextAttemptAt_createdAt_idx"
  ON "ReportRequest"("status", "nextAttemptAt", "createdAt");
