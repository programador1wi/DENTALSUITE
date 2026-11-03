ALTER TYPE "SurveyInvitationStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "SurveyInvitationStatus" ADD VALUE IF NOT EXISTS 'UNCERTAIN';
ALTER TYPE "SurveyDeliveryEventType" ADD VALUE IF NOT EXISTS 'UNCERTAIN';

ALTER TABLE "SurveyInvitation"
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "terminalAt" TIMESTAMP(3),
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3);

CREATE INDEX "SurveyInvitation_status_nextAttemptAt_leaseExpiresAt_idx"
  ON "SurveyInvitation"("status", "nextAttemptAt", "leaseExpiresAt");

-- A process that disappeared while delivering may already have reached SMTP.
-- Preserve it for reconciliation instead of authorizing an automatic resend.
UPDATE "SurveyInvitation"
SET "terminalAt" = NOW()
WHERE status = 'FAILED' AND attempts >= 3;
