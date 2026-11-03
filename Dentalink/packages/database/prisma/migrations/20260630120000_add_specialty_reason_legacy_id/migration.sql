ALTER TABLE "SpecialtyAppointmentReason" ADD COLUMN "legacyId" INTEGER;

CREATE UNIQUE INDEX "SpecialtyAppointmentReason_specialtyId_legacyId_key" ON "SpecialtyAppointmentReason"("specialtyId", "legacyId");
