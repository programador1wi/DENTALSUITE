-- CRM satisfaction surveys are modeled separately from the legacy per-patient
-- Survey record so existing integrations keep their current contract.
CREATE TYPE "SurveyDefinitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "SurveyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
CREATE TYPE "SurveyQuestionType" AS ENUM ('LIKERT_5', 'NPS_10', 'YES_NO', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'FREE_TEXT', 'STAR_RATING');
CREATE TYPE "SurveyInvitationStatus" AS ENUM ('CREATED', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'STARTED', 'RESPONDED', 'EXPIRED', 'BOUNCED', 'FAILED');
CREATE TYPE "SurveyResponseStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');
CREATE TYPE "SurveyDeliveryEventType" AS ENUM ('QUEUED', 'ACCEPTED', 'DELIVERED', 'OPENED', 'BOUNCED', 'FAILED');

CREATE TABLE "SurveyDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT,
  "name" TEXT NOT NULL DEFAULT 'Encuesta sin nombre',
  "type" "SurveyType" NOT NULL DEFAULT 'SATISFACTION',
  "channel" "CommunicationChannel" NOT NULL DEFAULT 'EMAIL',
  "status" "SurveyDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
  "activeVersionId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyVersion" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "SurveyVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "emailSubject" TEXT NOT NULL DEFAULT 'Tu opinión nos interesa',
  "emailHeaderHtml" TEXT NOT NULL DEFAULT '¡Hola {nombrePaciente}! Te invitamos a responder la siguiente encuesta referente al servicio dental que recibiste el día {fechaAtencion} en {nombreSucursal}.',
  "emailFooterHtml" TEXT NOT NULL DEFAULT '',
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveySection" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Sección sin nombre',
  "description" TEXT,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveySection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyQuestion" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "text" TEXT NOT NULL DEFAULT 'Edita esta pregunta',
  "description" TEXT,
  "type" "SurveyQuestionType" NOT NULL DEFAULT 'LIKERT_5',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL,
  "validationJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyQuestionOption" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyQuestionOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveySendConfiguration" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "branchIds" JSONB,
  "professionalIds" JSONB,
  "specialtyIds" JSONB,
  "appointmentTypes" JSONB,
  "channel" "CommunicationChannel" NOT NULL DEFAULT 'EMAIL',
  "triggerEvent" TEXT NOT NULL DEFAULT 'APPOINTMENT_COMPLETED',
  "delayMinutes" INTEGER NOT NULL DEFAULT 120,
  "minimumFrequencyDays" INTEGER NOT NULL DEFAULT 30,
  "sendWindowStart" TEXT NOT NULL DEFAULT '08:00',
  "sendWindowEnd" TEXT NOT NULL DEFAULT '20:00',
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  "reminderDelayMinutes" INTEGER,
  "requireConsent" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveySendConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "surveyVersionId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "channel" "CommunicationChannel" NOT NULL DEFAULT 'EMAIL',
  "recipientEmail" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "status" "SurveyInvitationStatus" NOT NULL DEFAULT 'CREATED',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "queuedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "provider" TEXT,
  "providerMessageId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyResponse" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "surveyVersionId" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "status" "SurveyResponseStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyAnswer" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "optionId" TEXT,
  "optionIdsJson" JSONB,
  "valueText" TEXT,
  "valueNumber" DOUBLE PRECISION,
  "valueBoolean" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyDeliveryEvent" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "type" "SurveyDeliveryEventType" NOT NULL,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SurveyDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SurveyVersion_surveyId_version_key" ON "SurveyVersion"("surveyId", "version");
CREATE UNIQUE INDEX "SurveySection_versionId_position_key" ON "SurveySection"("versionId", "position");
CREATE UNIQUE INDEX "SurveyQuestion_sectionId_position_key" ON "SurveyQuestion"("sectionId", "position");
CREATE UNIQUE INDEX "SurveyQuestionOption_questionId_position_key" ON "SurveyQuestionOption"("questionId", "position");
CREATE UNIQUE INDEX "SurveySendConfiguration_surveyId_key" ON "SurveySendConfiguration"("surveyId");
CREATE UNIQUE INDEX "SurveyInvitation_tokenHash_key" ON "SurveyInvitation"("tokenHash");
CREATE UNIQUE INDEX "SurveyInvitation_appointmentId_surveyVersionId_channel_key" ON "SurveyInvitation"("appointmentId", "surveyVersionId", "channel");
CREATE UNIQUE INDEX "SurveyResponse_invitationId_key" ON "SurveyResponse"("invitationId");
CREATE UNIQUE INDEX "SurveyAnswer_responseId_questionId_key" ON "SurveyAnswer"("responseId", "questionId");

CREATE INDEX "SurveyDefinition_organizationId_status_updatedAt_idx" ON "SurveyDefinition"("organizationId", "status", "updatedAt");
CREATE INDEX "SurveyDefinition_organizationId_branchId_type_channel_status_idx" ON "SurveyDefinition"("organizationId", "branchId", "type", "channel", "status");
CREATE INDEX "SurveyVersion_surveyId_status_idx" ON "SurveyVersion"("surveyId", "status");
CREATE INDEX "SurveySection_versionId_idx" ON "SurveySection"("versionId");
CREATE INDEX "SurveyQuestion_sectionId_idx" ON "SurveyQuestion"("sectionId");
CREATE INDEX "SurveyQuestionOption_questionId_idx" ON "SurveyQuestionOption"("questionId");
CREATE INDEX "SurveySendConfiguration_organizationId_isActive_idx" ON "SurveySendConfiguration"("organizationId", "isActive");
CREATE INDEX "SurveyInvitation_organizationId_status_scheduledAt_idx" ON "SurveyInvitation"("organizationId", "status", "scheduledAt");
CREATE INDEX "SurveyInvitation_organizationId_patientId_createdAt_idx" ON "SurveyInvitation"("organizationId", "patientId", "createdAt");
CREATE INDEX "SurveyInvitation_surveyId_createdAt_idx" ON "SurveyInvitation"("surveyId", "createdAt");
CREATE INDEX "SurveyInvitation_branchId_professionalId_createdAt_idx" ON "SurveyInvitation"("branchId", "professionalId", "createdAt");
CREATE INDEX "SurveyResponse_organizationId_surveyId_submittedAt_idx" ON "SurveyResponse"("organizationId", "surveyId", "submittedAt");
CREATE INDEX "SurveyResponse_branchId_professionalId_submittedAt_idx" ON "SurveyResponse"("branchId", "professionalId", "submittedAt");
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");
CREATE INDEX "SurveyAnswer_optionId_idx" ON "SurveyAnswer"("optionId");
CREATE INDEX "SurveyDeliveryEvent_invitationId_occurredAt_idx" ON "SurveyDeliveryEvent"("invitationId", "occurredAt");
CREATE INDEX "SurveyDeliveryEvent_providerMessageId_idx" ON "SurveyDeliveryEvent"("providerMessageId");
CREATE INDEX "SurveyDeliveryEvent_type_occurredAt_idx" ON "SurveyDeliveryEvent"("type", "occurredAt");

ALTER TABLE "SurveyVersion" ADD CONSTRAINT "SurveyVersion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "SurveyDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveySection" ADD CONSTRAINT "SurveySection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SurveyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "SurveySection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyQuestionOption" ADD CONSTRAINT "SurveyQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveySendConfiguration" ADD CONSTRAINT "SurveySendConfiguration_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "SurveyDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyInvitation" ADD CONSTRAINT "SurveyInvitation_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "SurveyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyInvitation" ADD CONSTRAINT "SurveyInvitation_surveyVersionId_fkey" FOREIGN KEY ("surveyVersionId") REFERENCES "SurveyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "SurveyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyVersionId_fkey" FOREIGN KEY ("surveyVersionId") REFERENCES "SurveyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SurveyInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SurveyQuestionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SurveyDeliveryEvent" ADD CONSTRAINT "SurveyDeliveryEvent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SurveyInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
