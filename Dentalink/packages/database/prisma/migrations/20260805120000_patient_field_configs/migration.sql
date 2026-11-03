-- CreateTable
CREATE TABLE "patient_field_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "newPatientPresent" BOOLEAN NOT NULL DEFAULT false,
    "newPatientRequired" BOOLEAN NOT NULL DEFAULT false,
    "appointmentPresent" BOOLEAN NOT NULL DEFAULT false,
    "appointmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "onlineAgendaPresent" BOOLEAN NOT NULL DEFAULT false,
    "onlineAgendaRequired" BOOLEAN NOT NULL DEFAULT false,
    "checkInPresent" BOOLEAN NOT NULL DEFAULT false,
    "checkInRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSystemRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_field_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_field_configs_organizationId_fieldKey_key"
ON "patient_field_configs"("organizationId", "fieldKey");

-- CreateIndex
CREATE INDEX "patient_field_configs_organizationId_idx"
ON "patient_field_configs"("organizationId");

-- AddForeignKey
ALTER TABLE "patient_field_configs"
ADD CONSTRAINT "patient_field_configs_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
