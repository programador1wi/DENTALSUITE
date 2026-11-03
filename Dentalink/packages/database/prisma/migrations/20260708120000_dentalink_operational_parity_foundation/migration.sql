CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'PHONE', 'INTERNAL');
CREATE TYPE "CommunicationJobStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'RESPONDED', 'FAILED');
CREATE TYPE "SurveyType" AS ENUM ('SATISFACTION', 'NPS', 'CUSTOM');
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TelemedicineSessionStatus" AS ENUM ('SCHEDULED', 'STARTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ImportJobType" AS ENUM ('PATIENTS', 'PROCEDURES', 'INVENTORY', 'PAYMENTS', 'CUSTOM');
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "DocumentRequirementStatus" AS ENUM ('PENDING', 'SATISFIED', 'WAIVED', 'CANCELLED');
CREATE TYPE "DocumentRequirementScope" AS ENUM ('PATIENT', 'TREATMENT_PLAN', 'PROCEDURE');
CREATE TYPE "PaymentWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "AiUseCase" AS ENUM ('RADIOGRAPHY', 'CLINICAL_NOTE', 'REPORT', 'CRM', 'CONTROL', 'SMILE_SIMULATOR');
CREATE TYPE "AiRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "CommunicationJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "paymentId" TEXT,
    "createdById" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "templateKey" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommunicationJobStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerMessageId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "communicationJobId" TEXT NOT NULL,
    "status" "MessageDeliveryStatus" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerMessageId" TEXT,
    "rawPayload" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "type" "SurveyType" NOT NULL DEFAULT 'SATISFACTION',
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'EMAIL',
    "title" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "comment" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NpsResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "comment" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NpsResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "threadKey" TEXT,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelemedicineSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "professionalId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "joinUrl" TEXT,
    "status" "TelemedicineSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemedicineSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "treatmentPlanId" TEXT,
    "procedureId" TEXT,
    "clinicalDocumentId" TEXT,
    "consentId" TEXT,
    "fileAttachmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "waivedById" TEXT,
    "scope" "DocumentRequirementScope" NOT NULL DEFAULT 'PATIENT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requiredBefore" TEXT,
    "status" "DocumentRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "satisfiedAt" TIMESTAMP(3),
    "waivedAt" TIMESTAMP(3),
    "waiverReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "paymentLinkId" TEXT,
    "paymentId" TEXT,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "requestedById" TEXT NOT NULL,
    "useCase" "AiUseCase" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "prompt" TEXT,
    "input" JSONB,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiRequestId" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "summary" TEXT,
    "confidence" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationJob_organizationId_status_scheduledAt_idx" ON "CommunicationJob"("organizationId", "status", "scheduledAt");
CREATE INDEX "CommunicationJob_patientId_createdAt_idx" ON "CommunicationJob"("patientId", "createdAt");
CREATE INDEX "CommunicationJob_appointmentId_idx" ON "CommunicationJob"("appointmentId");
CREATE INDEX "CommunicationJob_paymentId_idx" ON "CommunicationJob"("paymentId");
CREATE INDEX "MessageDelivery_communicationJobId_createdAt_idx" ON "MessageDelivery"("communicationJobId", "createdAt");
CREATE INDEX "MessageDelivery_providerMessageId_idx" ON "MessageDelivery"("providerMessageId");
CREATE INDEX "MessageDelivery_status_createdAt_idx" ON "MessageDelivery"("status", "createdAt");
CREATE UNIQUE INDEX "Survey_token_key" ON "Survey"("token");
CREATE INDEX "Survey_organizationId_status_createdAt_idx" ON "Survey"("organizationId", "status", "createdAt");
CREATE INDEX "Survey_patientId_createdAt_idx" ON "Survey"("patientId", "createdAt");
CREATE INDEX "Survey_appointmentId_idx" ON "Survey"("appointmentId");
CREATE UNIQUE INDEX "NpsResponse_surveyId_key" ON "NpsResponse"("surveyId");
CREATE INDEX "NpsResponse_category_respondedAt_idx" ON "NpsResponse"("category", "respondedAt");
CREATE INDEX "ChatMessage_organizationId_threadKey_createdAt_idx" ON "ChatMessage"("organizationId", "threadKey", "createdAt");
CREATE INDEX "ChatMessage_patientId_createdAt_idx" ON "ChatMessage"("patientId", "createdAt");
CREATE INDEX "ChatMessage_senderUserId_createdAt_idx" ON "ChatMessage"("senderUserId", "createdAt");
CREATE INDEX "TelemedicineSession_organizationId_status_startsAt_idx" ON "TelemedicineSession"("organizationId", "status", "startsAt");
CREATE INDEX "TelemedicineSession_patientId_startsAt_idx" ON "TelemedicineSession"("patientId", "startsAt");
CREATE INDEX "TelemedicineSession_appointmentId_idx" ON "TelemedicineSession"("appointmentId");
CREATE INDEX "TelemedicineSession_professionalId_startsAt_idx" ON "TelemedicineSession"("professionalId", "startsAt");
CREATE INDEX "ImportJob_organizationId_type_status_idx" ON "ImportJob"("organizationId", "type", "status");
CREATE INDEX "ImportJob_createdById_createdAt_idx" ON "ImportJob"("createdById", "createdAt");
CREATE INDEX "DocumentRequirement_organizationId_status_dueAt_idx" ON "DocumentRequirement"("organizationId", "status", "dueAt");
CREATE INDEX "DocumentRequirement_patientId_status_idx" ON "DocumentRequirement"("patientId", "status");
CREATE INDEX "DocumentRequirement_treatmentPlanId_status_idx" ON "DocumentRequirement"("treatmentPlanId", "status");
CREATE INDEX "DocumentRequirement_procedureId_status_idx" ON "DocumentRequirement"("procedureId", "status");
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_idempotencyKey_key" ON "PaymentWebhookEvent"("provider", "idempotencyKey");
CREATE INDEX "PaymentWebhookEvent_organizationId_status_receivedAt_idx" ON "PaymentWebhookEvent"("organizationId", "status", "receivedAt");
CREATE INDEX "PaymentWebhookEvent_paymentLinkId_idx" ON "PaymentWebhookEvent"("paymentLinkId");
CREATE INDEX "PaymentWebhookEvent_paymentId_idx" ON "PaymentWebhookEvent"("paymentId");
CREATE INDEX "AiRequest_organizationId_useCase_status_idx" ON "AiRequest"("organizationId", "useCase", "status");
CREATE INDEX "AiRequest_patientId_createdAt_idx" ON "AiRequest"("patientId", "createdAt");
CREATE INDEX "AiRequest_requestedById_createdAt_idx" ON "AiRequest"("requestedById", "createdAt");
CREATE UNIQUE INDEX "AiResult_aiRequestId_key" ON "AiResult"("aiRequestId");
CREATE INDEX "AiResult_organizationId_createdAt_idx" ON "AiResult"("organizationId", "createdAt");

ALTER TABLE "CommunicationJob" ADD CONSTRAINT "CommunicationJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationJob" ADD CONSTRAINT "CommunicationJob_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationJob" ADD CONSTRAINT "CommunicationJob_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationJob" ADD CONSTRAINT "CommunicationJob_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationJob" ADD CONSTRAINT "CommunicationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_communicationJobId_fkey" FOREIGN KEY ("communicationJobId") REFERENCES "CommunicationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NpsResponse" ADD CONSTRAINT "NpsResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelemedicineSession" ADD CONSTRAINT "TelemedicineSession_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_clinicalDocumentId_fkey" FOREIGN KEY ("clinicalDocumentId") REFERENCES "ClinicalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "Consent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_fileAttachmentId_fkey" FOREIGN KEY ("fileAttachmentId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentRequirement" ADD CONSTRAINT "DocumentRequirement_waivedById_fkey" FOREIGN KEY ("waivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "PaymentLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiResult" ADD CONSTRAINT "AiResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiResult" ADD CONSTRAINT "AiResult_aiRequestId_fkey" FOREIGN KEY ("aiRequestId") REFERENCES "AiRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
