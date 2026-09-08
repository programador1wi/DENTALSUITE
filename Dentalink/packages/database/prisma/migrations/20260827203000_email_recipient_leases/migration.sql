ALTER TYPE "EmailRecipientStatus" ADD VALUE IF NOT EXISTS 'UNCERTAIN';

ALTER TABLE "EmailCampaignRecipient"
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

CREATE INDEX "EmailCampaignRecipient_campaignId_deliveryStatus_nextAttemptAt_selectedAt_idx"
  ON "EmailCampaignRecipient"("campaignId", "deliveryStatus", "nextAttemptAt", "selectedAt");

CREATE INDEX "EmailCampaignRecipient_deliveryStatus_leaseExpiresAt_idx"
  ON "EmailCampaignRecipient"("deliveryStatus", "leaseExpiresAt");
