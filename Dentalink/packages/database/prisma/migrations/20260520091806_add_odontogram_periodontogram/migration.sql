-- CreateEnum
CREATE TYPE "ToothProcedureStatus" AS ENUM ('PLANNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PeriodontalPosition" AS ENUM ('MB', 'B', 'DB', 'ML', 'L', 'DL');

-- CreateTable
CREATE TABLE "OdontogramRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "toothNumber" TEXT NOT NULL,
    "surface" TEXT,
    "condition" TEXT NOT NULL,
    "diagnosis" TEXT,
    "procedureId" TEXT,
    "status" "ToothProcedureStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OdontogramRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothCondition" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "odontogramRecordId" TEXT,
    "toothNumber" TEXT NOT NULL,
    "surface" TEXT,
    "condition" TEXT NOT NULL,
    "diagnosis" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToothCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothProcedure" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "procedureId" TEXT,
    "odontogramRecordId" TEXT,
    "clinicalEvolutionId" TEXT,
    "treatmentPlanId" TEXT,
    "toothNumber" TEXT NOT NULL,
    "surface" TEXT,
    "diagnosis" TEXT,
    "status" "ToothProcedureStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToothProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodontalChart" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "chartDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodontalChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodontalMeasurement" (
    "id" TEXT NOT NULL,
    "periodontalChartId" TEXT NOT NULL,
    "toothNumber" TEXT NOT NULL,
    "position" "PeriodontalPosition" NOT NULL,
    "probingDepth" INTEGER NOT NULL,
    "bleeding" BOOLEAN NOT NULL DEFAULT false,
    "plaque" BOOLEAN NOT NULL DEFAULT false,
    "recession" INTEGER,
    "mobility" INTEGER,
    "furcation" TEXT,
    "suppuration" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodontalMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OdontogramRecord_patientId_toothNumber_createdAt_idx" ON "OdontogramRecord"("patientId", "toothNumber", "createdAt");

-- CreateIndex
CREATE INDEX "OdontogramRecord_professionalId_createdAt_idx" ON "OdontogramRecord"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "OdontogramRecord_appointmentId_idx" ON "OdontogramRecord"("appointmentId");

-- CreateIndex
CREATE INDEX "ToothCondition_patientId_toothNumber_createdAt_idx" ON "ToothCondition"("patientId", "toothNumber", "createdAt");

-- CreateIndex
CREATE INDEX "ToothCondition_odontogramRecordId_idx" ON "ToothCondition"("odontogramRecordId");

-- CreateIndex
CREATE INDEX "ToothProcedure_patientId_toothNumber_createdAt_idx" ON "ToothProcedure"("patientId", "toothNumber", "createdAt");

-- CreateIndex
CREATE INDEX "ToothProcedure_professionalId_createdAt_idx" ON "ToothProcedure"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "ToothProcedure_appointmentId_idx" ON "ToothProcedure"("appointmentId");

-- CreateIndex
CREATE INDEX "ToothProcedure_status_createdAt_idx" ON "ToothProcedure"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PeriodontalChart_patientId_chartDate_idx" ON "PeriodontalChart"("patientId", "chartDate");

-- CreateIndex
CREATE INDEX "PeriodontalChart_professionalId_chartDate_idx" ON "PeriodontalChart"("professionalId", "chartDate");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodontalMeasurement_periodontalChartId_toothNumber_position_key" ON "PeriodontalMeasurement"("periodontalChartId", "toothNumber", "position");

-- CreateIndex
CREATE INDEX "PeriodontalMeasurement_toothNumber_idx" ON "PeriodontalMeasurement"("toothNumber");

-- AddForeignKey
ALTER TABLE "OdontogramRecord" ADD CONSTRAINT "OdontogramRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramRecord" ADD CONSTRAINT "OdontogramRecord_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramRecord" ADD CONSTRAINT "OdontogramRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdontogramRecord" ADD CONSTRAINT "OdontogramRecord_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothCondition" ADD CONSTRAINT "ToothCondition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothCondition" ADD CONSTRAINT "ToothCondition_odontogramRecordId_fkey" FOREIGN KEY ("odontogramRecordId") REFERENCES "OdontogramRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothProcedure" ADD CONSTRAINT "ToothProcedure_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothProcedure" ADD CONSTRAINT "ToothProcedure_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothProcedure" ADD CONSTRAINT "ToothProcedure_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothProcedure" ADD CONSTRAINT "ToothProcedure_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothProcedure" ADD CONSTRAINT "ToothProcedure_odontogramRecordId_fkey" FOREIGN KEY ("odontogramRecordId") REFERENCES "OdontogramRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothProcedure" ADD CONSTRAINT "ToothProcedure_clinicalEvolutionId_fkey" FOREIGN KEY ("clinicalEvolutionId") REFERENCES "ClinicalEvolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodontalChart" ADD CONSTRAINT "PeriodontalChart_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodontalChart" ADD CONSTRAINT "PeriodontalChart_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodontalChart" ADD CONSTRAINT "PeriodontalChart_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodontalMeasurement" ADD CONSTRAINT "PeriodontalMeasurement_periodontalChartId_fkey" FOREIGN KEY ("periodontalChartId") REFERENCES "PeriodontalChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
