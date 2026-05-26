-- CreateEnum
CREATE TYPE "SpecialtyClinicalTemplateType" AS ENUM ('PRESCRIPTION', 'EVOLUTION');

-- CreateTable
CREATE TABLE "SpecialtyClinicalTemplate" (
    "id" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "type" "SpecialtyClinicalTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyClinicalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialtyAppointmentReason" (
    "id" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialtyAppointmentReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyClinicalTemplate_specialtyId_type_name_key" ON "SpecialtyClinicalTemplate"("specialtyId", "type", "name");

-- CreateIndex
CREATE INDEX "SpecialtyClinicalTemplate_specialtyId_type_isActive_idx" ON "SpecialtyClinicalTemplate"("specialtyId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialtyAppointmentReason_specialtyId_name_key" ON "SpecialtyAppointmentReason"("specialtyId", "name");

-- CreateIndex
CREATE INDEX "SpecialtyAppointmentReason_specialtyId_isActive_idx" ON "SpecialtyAppointmentReason"("specialtyId", "isActive");

-- AddForeignKey
ALTER TABLE "SpecialtyClinicalTemplate" ADD CONSTRAINT "SpecialtyClinicalTemplate_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialtyAppointmentReason" ADD CONSTRAINT "SpecialtyAppointmentReason_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
