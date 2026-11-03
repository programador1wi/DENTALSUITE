-- Add lifecycle metadata to professional-branch assignments and track controlled replacements.
CREATE TYPE "ProfessionalBranchStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

ALTER TABLE "ProfessionalBranch"
  ADD COLUMN "status" "ProfessionalBranchStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "endedReason" TEXT,
  ADD COLUMN "lastTransferredToId" TEXT,
  ADD COLUMN "lastTransferredAt" TIMESTAMP(3);

CREATE TABLE "ProfessionalBranchTransfer" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "fromProfessionalId" TEXT NOT NULL,
  "toProfessionalId" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "moveFutureAppointments" BOOLEAN NOT NULL DEFAULT true,
  "moveFutureBlocks" BOOLEAN NOT NULL DEFAULT true,
  "copySchedules" BOOLEAN NOT NULL DEFAULT true,
  "copyAgendaConfig" BOOLEAN NOT NULL DEFAULT true,
  "endSourceAssignment" BOOLEAN NOT NULL DEFAULT true,
  "appointmentsTransferred" INTEGER NOT NULL DEFAULT 0,
  "blocksTransferred" INTEGER NOT NULL DEFAULT 0,
  "schedulesCopied" INTEGER NOT NULL DEFAULT 0,
  "conflicts" JSONB,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfessionalBranchTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfessionalBranch_branchId_status_idx" ON "ProfessionalBranch"("branchId", "status");
CREATE INDEX "ProfessionalBranch_professionalId_status_idx" ON "ProfessionalBranch"("professionalId", "status");
CREATE INDEX "ProfessionalBranchTransfer_organizationId_createdAt_idx" ON "ProfessionalBranchTransfer"("organizationId", "createdAt");
CREATE INDEX "ProfessionalBranchTransfer_branchId_effectiveAt_idx" ON "ProfessionalBranchTransfer"("branchId", "effectiveAt");
CREATE INDEX "ProfessionalBranchTransfer_fromProfessionalId_effectiveAt_idx" ON "ProfessionalBranchTransfer"("fromProfessionalId", "effectiveAt");
CREATE INDEX "ProfessionalBranchTransfer_toProfessionalId_effectiveAt_idx" ON "ProfessionalBranchTransfer"("toProfessionalId", "effectiveAt");

ALTER TABLE "ProfessionalBranch"
  ADD CONSTRAINT "ProfessionalBranch_lastTransferredToId_fkey"
  FOREIGN KEY ("lastTransferredToId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalBranchTransfer"
  ADD CONSTRAINT "ProfessionalBranchTransfer_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalBranchTransfer_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalBranchTransfer_fromProfessionalId_fkey"
  FOREIGN KEY ("fromProfessionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalBranchTransfer_toProfessionalId_fkey"
  FOREIGN KEY ("toProfessionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalBranchTransfer_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
