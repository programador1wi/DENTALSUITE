CREATE TYPE "MarketingConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'DENIED', 'UNSUBSCRIBED');
CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'QUEUED', 'SENDING', 'SENT', 'PARTIALLY_SENT', 'FAILED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "EmailRecipientEligibilityStatus" AS ENUM ('ELIGIBLE', 'REJECTED');
CREATE TYPE "EmailRecipientStatus" AS ENUM ('PENDING', 'ELIGIBILITY_REJECTED', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED', 'FAILED', 'SKIPPED');
CREATE TYPE "EmailTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "EmailDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'INACTIVE');
CREATE TYPE "EmailEventType" AS ENUM ('ACCEPTED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'SOFT_BOUNCE', 'HARD_BOUNCE', 'COMPLAINED', 'UNSUBSCRIBED', 'FAILED');

ALTER TABLE "Patient"
  ADD COLUMN "marketingConsent" "MarketingConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "marketingConsentedAt" TIMESTAMP(3),
  ADD COLUMN "marketingUnsubscribedAt" TIMESTAMP(3);

CREATE TABLE "MarketingSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaignCooldownDays" INTEGER NOT NULL DEFAULT 30,
  "maxRecipientsPerCampaign" INTEGER NOT NULL DEFAULT 5000,
  "maxCampaignsPerMonth" INTEGER NOT NULL DEFAULT 20,
  "maxDailyEmails" INTEGER NOT NULL DEFAULT 2000,
  "allowAttachments" BOOLEAN NOT NULL DEFAULT false,
  "allowInlineImages" BOOLEAN NOT NULL DEFAULT true,
  "requireMarketingConsent" BOOLEAN NOT NULL DEFAULT true,
  "requireVerifiedDomain" BOOLEAN NOT NULL DEFAULT false,
  "sendWindowStart" TEXT NOT NULL DEFAULT '08:00',
  "sendWindowEnd" TEXT NOT NULL DEFAULT '20:00',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingSegment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "reportCode" TEXT NOT NULL,
  "parametersJson" JSONB NOT NULL,
  "name" TEXT NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "html" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" "EmailTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailCampaign" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "segmentId" TEXT,
  "templateId" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'MARKETING',
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "fromName" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "replyTo" TEXT,
  "domain" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "contentHtmlSnapshot" TEXT NOT NULL,
  "contentTextSnapshot" TEXT NOT NULL,
  "reportCodeSnapshot" TEXT,
  "reportParametersJson" JSONB,
  "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailCampaignRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "patientId" TEXT,
  "branchId" TEXT,
  "emailSnapshot" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "eligibilityStatus" "EmailRecipientEligibilityStatus" NOT NULL,
  "eligibilityReason" TEXT,
  "deliveryStatus" "EmailRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  "unsubscribedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSuppression" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DomainVerification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "fromName" TEXT NOT NULL,
  "fromLocalPart" TEXT NOT NULL DEFAULT 'notificaciones',
  "replyTo" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'smtp',
  "status" "EmailDomainStatus" NOT NULL DEFAULT 'PENDING',
  "verificationToken" TEXT NOT NULL,
  "dnsRecordsJson" JSONB NOT NULL,
  "spfStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "dkimStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "dmarcStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "lastCheckedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DomainVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "recipientId" TEXT,
  "providerEventId" TEXT,
  "providerMessageId" TEXT,
  "eventType" "EmailEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payloadJson" JSONB,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingSettings_organizationId_key" ON "MarketingSettings"("organizationId");
CREATE INDEX "MarketingSegment_organizationId_reportCode_createdAt_idx" ON "MarketingSegment"("organizationId", "reportCode", "createdAt");
CREATE INDEX "MarketingSegment_branchId_idx" ON "MarketingSegment"("branchId");
CREATE UNIQUE INDEX "EmailTemplate_organizationId_name_version_key" ON "EmailTemplate"("organizationId", "name", "version");
CREATE INDEX "EmailTemplate_organizationId_status_category_idx" ON "EmailTemplate"("organizationId", "status", "category");
CREATE UNIQUE INDEX "EmailCampaign_organizationId_idempotencyKey_key" ON "EmailCampaign"("organizationId", "idempotencyKey");
CREATE INDEX "EmailCampaign_organizationId_status_scheduledAt_idx" ON "EmailCampaign"("organizationId", "status", "scheduledAt");
CREATE INDEX "EmailCampaign_branchId_createdAt_idx" ON "EmailCampaign"("branchId", "createdAt");
CREATE INDEX "EmailCampaign_segmentId_idx" ON "EmailCampaign"("segmentId");
CREATE UNIQUE INDEX "EmailCampaignRecipient_idempotencyKey_key" ON "EmailCampaignRecipient"("idempotencyKey");
CREATE UNIQUE INDEX "EmailCampaignRecipient_campaignId_normalizedEmail_key" ON "EmailCampaignRecipient"("campaignId", "normalizedEmail");
CREATE INDEX "EmailCampaignRecipient_campaignId_deliveryStatus_idx" ON "EmailCampaignRecipient"("campaignId", "deliveryStatus");
CREATE INDEX "EmailCampaignRecipient_patientId_idx" ON "EmailCampaignRecipient"("patientId");
CREATE INDEX "EmailCampaignRecipient_normalizedEmail_idx" ON "EmailCampaignRecipient"("normalizedEmail");
CREATE UNIQUE INDEX "EmailSuppression_organizationId_normalizedEmail_key" ON "EmailSuppression"("organizationId", "normalizedEmail");
CREATE INDEX "EmailSuppression_organizationId_reason_createdAt_idx" ON "EmailSuppression"("organizationId", "reason", "createdAt");
CREATE UNIQUE INDEX "DomainVerification_organizationId_domain_key" ON "DomainVerification"("organizationId", "domain");
CREATE INDEX "DomainVerification_organizationId_status_idx" ON "DomainVerification"("organizationId", "status");
CREATE UNIQUE INDEX "EmailEvent_organizationId_providerEventId_key" ON "EmailEvent"("organizationId", "providerEventId");
CREATE INDEX "EmailEvent_campaignId_eventType_occurredAt_idx" ON "EmailEvent"("campaignId", "eventType", "occurredAt");
CREATE INDEX "EmailEvent_recipientId_occurredAt_idx" ON "EmailEvent"("recipientId", "occurredAt");
CREATE INDEX "EmailEvent_providerMessageId_idx" ON "EmailEvent"("providerMessageId");

ALTER TABLE "MarketingSettings" ADD CONSTRAINT "MarketingSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSegment" ADD CONSTRAINT "MarketingSegment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingSegment" ADD CONSTRAINT "MarketingSegment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketingSegment" ADD CONSTRAINT "MarketingSegment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "MarketingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailCampaignRecipient" ADD CONSTRAINT "EmailCampaignRecipient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DomainVerification" ADD CONSTRAINT "DomainVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "EmailCampaignRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
