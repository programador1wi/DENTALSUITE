ALTER TYPE "PatientStatus" ADD VALUE IF NOT EXISTS 'PROVISIONAL';
ALTER TYPE "PatientStatus" ADD VALUE IF NOT EXISTS 'MERGED';

CREATE TABLE "PatientIdentityConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "shadowMode" BOOLEAN NOT NULL DEFAULT true,
  "adminResolutionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "publicBookingResolutionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappResolutionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "familyGroupsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "safeMergeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "legacyPhoneReadDisabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultCountry" TEXT NOT NULL DEFAULT 'MX',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatientIdentityConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactPoint" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "rawValue" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "countryCode" TEXT,
  "nationalNumber" TEXT,
  "callingCode" TEXT,
  "phoneType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedAt" TIMESTAMP(3),
  "provider" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientContactLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "contactPointId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PERSONAL',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "canReceiveReminders" BOOLEAN NOT NULL DEFAULT true,
  "consentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatientContactLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactVerificationEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactPointId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "provider" TEXT,
  "providerEventId" TEXT,
  "actorType" TEXT,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactVerificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyGroup" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyGroupMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "familyGroupId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "relationship" TEXT,
  "consentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyGroupContact" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "familyGroupId" TEXT NOT NULL,
  "contactPointId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyGroupContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyBookingGrant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "familyGroupId" TEXT NOT NULL,
  "actorContactPointId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "canBook" BOOLEAN NOT NULL DEFAULT true,
  "canReschedule" BOOLEAN NOT NULL DEFAULT false,
  "canCancel" BOOLEAN NOT NULL DEFAULT false,
  "canReceiveReminders" BOOLEAN NOT NULL DEFAULT true,
  "consentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FamilyBookingGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingIdentitySession" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contactPointId" TEXT,
  "selectedPatientId" TEXT,
  "familyGroupId" TEXT,
  "source" TEXT NOT NULL,
  "conversationId" TEXT,
  "channelMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "resolution" TEXT NOT NULL DEFAULT 'NO_MATCH',
  "resolutionMethod" TEXT,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingIdentitySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientDuplicateCandidate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "patientAId" TEXT NOT NULL,
  "patientBId" TEXT NOT NULL,
  "classification" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL,
  "reasons" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatientDuplicateCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientMerge" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetPatientId" TEXT NOT NULL,
  "sourcePatientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW',
  "reason" TEXT NOT NULL,
  "preview" JSONB NOT NULL,
  "expectedVersion" INTEGER,
  "executedById" TEXT,
  "executedAt" TIMESTAMP(3),
  "correlationId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatientMerge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientMergeRelation" (
  "id" TEXT NOT NULL,
  "mergeId" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "oldPatientId" TEXT NOT NULL,
  "newPatientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientMergeRelation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentBookingActor" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorPatientId" TEXT,
  "contactPointId" TEXT,
  "familyGroupId" TEXT,
  "relationship" TEXT,
  "bookingSource" TEXT NOT NULL,
  "identityResolutionMethod" TEXT NOT NULL,
  "identityConfidence" INTEGER NOT NULL,
  "conversationId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentBookingActor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingIdempotency" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "appointmentId" TEXT,
  "response" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientIdentityConfig_organizationId_key" ON "PatientIdentityConfig"("organizationId");
CREATE UNIQUE INDEX "ContactPoint_organizationId_type_normalizedValue_key" ON "ContactPoint"("organizationId", "type", "normalizedValue");
CREATE INDEX "ContactPoint_organizationId_status_idx" ON "ContactPoint"("organizationId", "status");
CREATE UNIQUE INDEX "PatientContactLink_patientId_contactPointId_role_key" ON "PatientContactLink"("patientId", "contactPointId", "role");
CREATE INDEX "PatientContactLink_organizationId_contactPointId_idx" ON "PatientContactLink"("organizationId", "contactPointId");
CREATE INDEX "PatientContactLink_patientId_isPrimary_idx" ON "PatientContactLink"("patientId", "isPrimary");
CREATE INDEX "ContactVerificationEvent_contactPointId_createdAt_idx" ON "ContactVerificationEvent"("contactPointId", "createdAt");
CREATE INDEX "ContactVerificationEvent_organizationId_outcome_idx" ON "ContactVerificationEvent"("organizationId", "outcome");
CREATE INDEX "FamilyGroup_organizationId_status_idx" ON "FamilyGroup"("organizationId", "status");
CREATE UNIQUE INDEX "FamilyGroupMember_familyGroupId_patientId_key" ON "FamilyGroupMember"("familyGroupId", "patientId");
CREATE INDEX "FamilyGroupMember_organizationId_patientId_idx" ON "FamilyGroupMember"("organizationId", "patientId");
CREATE UNIQUE INDEX "FamilyGroupContact_familyGroupId_contactPointId_key" ON "FamilyGroupContact"("familyGroupId", "contactPointId");
CREATE INDEX "FamilyGroupContact_organizationId_contactPointId_idx" ON "FamilyGroupContact"("organizationId", "contactPointId");
CREATE UNIQUE INDEX "FamilyBookingGrant_familyGroupId_actorContactPointId_patientId_key" ON "FamilyBookingGrant"("familyGroupId", "actorContactPointId", "patientId");
CREATE INDEX "FamilyBookingGrant_organizationId_actorContactPointId_idx" ON "FamilyBookingGrant"("organizationId", "actorContactPointId");
CREATE UNIQUE INDEX "BookingIdentitySession_organizationId_source_conversationId_key" ON "BookingIdentitySession"("organizationId", "source", "conversationId");
CREATE INDEX "BookingIdentitySession_organizationId_contactPointId_status_idx" ON "BookingIdentitySession"("organizationId", "contactPointId", "status");
CREATE INDEX "BookingIdentitySession_expiresAt_idx" ON "BookingIdentitySession"("expiresAt");
CREATE UNIQUE INDEX "PatientDuplicateCandidate_organizationId_patientAId_patientBId_key" ON "PatientDuplicateCandidate"("organizationId", "patientAId", "patientBId");
CREATE INDEX "PatientDuplicateCandidate_organizationId_status_confidence_idx" ON "PatientDuplicateCandidate"("organizationId", "status", "confidence");
CREATE INDEX "PatientMerge_organizationId_status_idx" ON "PatientMerge"("organizationId", "status");
CREATE INDEX "PatientMerge_sourcePatientId_idx" ON "PatientMerge"("sourcePatientId");
CREATE INDEX "PatientMerge_targetPatientId_idx" ON "PatientMerge"("targetPatientId");
CREATE INDEX "PatientMergeRelation_mergeId_entity_idx" ON "PatientMergeRelation"("mergeId", "entity");
CREATE UNIQUE INDEX "AppointmentBookingActor_appointmentId_key" ON "AppointmentBookingActor"("appointmentId");
CREATE INDEX "AppointmentBookingActor_organizationId_bookingSource_createdAt_idx" ON "AppointmentBookingActor"("organizationId", "bookingSource", "createdAt");
CREATE INDEX "AppointmentBookingActor_contactPointId_idx" ON "AppointmentBookingActor"("contactPointId");
CREATE UNIQUE INDEX "BookingIdempotency_organizationId_source_idempotencyKey_key" ON "BookingIdempotency"("organizationId", "source", "idempotencyKey");
CREATE INDEX "BookingIdempotency_appointmentId_idx" ON "BookingIdempotency"("appointmentId");
CREATE INDEX "BookingIdempotency_expiresAt_idx" ON "BookingIdempotency"("expiresAt");

ALTER TABLE "PatientIdentityConfig" ADD CONSTRAINT "PatientIdentityConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientContactLink" ADD CONSTRAINT "PatientContactLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientContactLink" ADD CONSTRAINT "PatientContactLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientContactLink" ADD CONSTRAINT "PatientContactLink_contactPointId_fkey" FOREIGN KEY ("contactPointId") REFERENCES "ContactPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactVerificationEvent" ADD CONSTRAINT "ContactVerificationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactVerificationEvent" ADD CONSTRAINT "ContactVerificationEvent_contactPointId_fkey" FOREIGN KEY ("contactPointId") REFERENCES "ContactPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyGroup" ADD CONSTRAINT "FamilyGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyGroupMember" ADD CONSTRAINT "FamilyGroupMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyGroupMember" ADD CONSTRAINT "FamilyGroupMember_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyGroupMember" ADD CONSTRAINT "FamilyGroupMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FamilyGroupContact" ADD CONSTRAINT "FamilyGroupContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyGroupContact" ADD CONSTRAINT "FamilyGroupContact_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyGroupContact" ADD CONSTRAINT "FamilyGroupContact_contactPointId_fkey" FOREIGN KEY ("contactPointId") REFERENCES "ContactPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyBookingGrant" ADD CONSTRAINT "FamilyBookingGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyBookingGrant" ADD CONSTRAINT "FamilyBookingGrant_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyBookingGrant" ADD CONSTRAINT "FamilyBookingGrant_actorContactPointId_fkey" FOREIGN KEY ("actorContactPointId") REFERENCES "ContactPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyBookingGrant" ADD CONSTRAINT "FamilyBookingGrant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingIdentitySession" ADD CONSTRAINT "BookingIdentitySession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingIdentitySession" ADD CONSTRAINT "BookingIdentitySession_contactPointId_fkey" FOREIGN KEY ("contactPointId") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingIdentitySession" ADD CONSTRAINT "BookingIdentitySession_selectedPatientId_fkey" FOREIGN KEY ("selectedPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingIdentitySession" ADD CONSTRAINT "BookingIdentitySession_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientDuplicateCandidate" ADD CONSTRAINT "PatientDuplicateCandidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientDuplicateCandidate" ADD CONSTRAINT "PatientDuplicateCandidate_patientAId_fkey" FOREIGN KEY ("patientAId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientDuplicateCandidate" ADD CONSTRAINT "PatientDuplicateCandidate_patientBId_fkey" FOREIGN KEY ("patientBId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientMerge" ADD CONSTRAINT "PatientMerge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientMerge" ADD CONSTRAINT "PatientMerge_targetPatientId_fkey" FOREIGN KEY ("targetPatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientMerge" ADD CONSTRAINT "PatientMerge_sourcePatientId_fkey" FOREIGN KEY ("sourcePatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientMergeRelation" ADD CONSTRAINT "PatientMergeRelation_mergeId_fkey" FOREIGN KEY ("mergeId") REFERENCES "PatientMerge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentBookingActor" ADD CONSTRAINT "AppointmentBookingActor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentBookingActor" ADD CONSTRAINT "AppointmentBookingActor_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentBookingActor" ADD CONSTRAINT "AppointmentBookingActor_actorPatientId_fkey" FOREIGN KEY ("actorPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppointmentBookingActor" ADD CONSTRAINT "AppointmentBookingActor_contactPointId_fkey" FOREIGN KEY ("contactPointId") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AppointmentBookingActor" ADD CONSTRAINT "AppointmentBookingActor_familyGroupId_fkey" FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingIdempotency" ADD CONSTRAINT "BookingIdempotency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingIdempotency" ADD CONSTRAINT "BookingIdempotency_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
