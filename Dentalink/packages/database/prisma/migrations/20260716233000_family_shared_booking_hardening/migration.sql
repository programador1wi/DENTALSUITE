ALTER TABLE "FamilyGroupContact"
  ADD COLUMN "actorPatientId" TEXT;

UPDATE "FamilyGroupContact" AS contact
SET "actorPatientId" = member."patientId"
FROM "FamilyGroupMember" AS member
WHERE member."familyGroupId" = contact."familyGroupId"
  AND member."role" = 'GROUP_OWNER'
  AND member."consentStatus" = 'ACCEPTED'
  AND member."validUntil" IS NULL;

ALTER TABLE "FamilyBookingGrant"
  ADD COLUMN "canViewAppointmentSummary" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canViewFinancialInformation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canViewClinicalInformation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canSignConsents" BOOLEAN NOT NULL DEFAULT false;

UPDATE "FamilyBookingGrant"
SET "canViewAppointmentSummary" = true
WHERE "canBook" = true AND "consentStatus" = 'ACCEPTED';

UPDATE "ContactPoint" AS contact
SET "status" = 'FAMILY_SHARED'
WHERE EXISTS (
  SELECT 1 FROM "FamilyGroupContact" AS family_contact
  WHERE family_contact."contactPointId" = contact."id"
);

UPDATE "ContactPoint" AS contact
SET "status" = 'AMBIGUOUS'
WHERE (
    contact."status" = 'SHARED'
    OR (
      SELECT COUNT(DISTINCT link."patientId")
      FROM "PatientContactLink" AS link
      WHERE link."contactPointId" = contact."id"
        AND (link."validUntil" IS NULL OR link."validUntil" > CURRENT_TIMESTAMP)
    ) > 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "FamilyGroupContact" AS family_contact
    WHERE family_contact."contactPointId" = contact."id"
  );

ALTER TABLE "BookingIdentitySession"
  ADD COLUMN "bookingActorPatientId" TEXT,
  ADD COLUMN "contactVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "contactVerificationMethod" TEXT,
  ADD COLUMN "selectedAt" TIMESTAMP(3),
  ADD COLUMN "selectionExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastActionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "BookingIdentityIncident" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "familyGroupId" TEXT,
  "reasonCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "privacyMode" BOOLEAN NOT NULL DEFAULT true,
  "correlationId" TEXT,
  "metadata" JSONB,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingIdentityIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingIdentityIncident_sessionId_key" ON "BookingIdentityIncident"("sessionId");
CREATE INDEX "BookingIdentityIncident_organizationId_status_createdAt_idx" ON "BookingIdentityIncident"("organizationId", "status", "createdAt");
CREATE INDEX "BookingIdentityIncident_familyGroupId_idx" ON "BookingIdentityIncident"("familyGroupId");
CREATE INDEX "FamilyBookingGrant_familyGroupId_patientId_consentStatus_idx" ON "FamilyBookingGrant"("familyGroupId", "patientId", "consentStatus");
CREATE INDEX "BookingIdentitySession_selectionExpiresAt_idx" ON "BookingIdentitySession"("selectionExpiresAt");

ALTER TABLE "FamilyGroupContact"
  ADD CONSTRAINT "FamilyGroupContact_actorPatientId_fkey"
  FOREIGN KEY ("actorPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingIdentitySession"
  ADD CONSTRAINT "BookingIdentitySession_bookingActorPatientId_fkey"
  FOREIGN KEY ("bookingActorPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingIdentityIncident"
  ADD CONSTRAINT "BookingIdentityIncident_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingIdentityIncident"
  ADD CONSTRAINT "BookingIdentityIncident_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "BookingIdentitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingIdentityIncident"
  ADD CONSTRAINT "BookingIdentityIncident_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "FamilyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
