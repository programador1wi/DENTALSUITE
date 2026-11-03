CREATE TABLE "LabProcedureAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "procedureId" TEXT NOT NULL,
  "labProviderId" TEXT NOT NULL,
  "patientPrice" DECIMAL(10,2),
  "currency" "CurrencyCode" NOT NULL DEFAULT 'MXN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LabProcedureAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LabProcedureAssignment_procedureId_labProviderId_key" ON "LabProcedureAssignment"("procedureId", "labProviderId");
CREATE INDEX "LabProcedureAssignment_organizationId_isActive_idx" ON "LabProcedureAssignment"("organizationId", "isActive");
CREATE INDEX "LabProcedureAssignment_labProviderId_isActive_idx" ON "LabProcedureAssignment"("labProviderId", "isActive");

ALTER TABLE "LabProcedureAssignment" ADD CONSTRAINT "LabProcedureAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabProcedureAssignment" ADD CONSTRAINT "LabProcedureAssignment_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabProcedureAssignment" ADD CONSTRAINT "LabProcedureAssignment_labProviderId_fkey" FOREIGN KEY ("labProviderId") REFERENCES "LabProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
