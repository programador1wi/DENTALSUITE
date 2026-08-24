CREATE TYPE "ReportRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

CREATE TABLE "ReportRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reportCode" TEXT NOT NULL,
  "reportNameSnapshot" TEXT NOT NULL,
  "categorySnapshot" TEXT NOT NULL,
  "surface" TEXT NOT NULL DEFAULT 'PERIOD',
  "format" TEXT NOT NULL DEFAULT 'xlsx',
  "parametersJson" JSONB NOT NULL,
  "resolvedBranchIds" TEXT[] NOT NULL,
  "branchWindowsJson" JSONB NOT NULL,
  "status" "ReportRequestStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "rowCount" INTEGER,
  "fileName" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "storageKey" TEXT,
  "checksum" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportRequest_organizationId_requestedById_idempotencyKey_key"
  ON "ReportRequest"("organizationId", "requestedById", "idempotencyKey");
CREATE INDEX "ReportRequest_organizationId_requestedById_createdAt_idx"
  ON "ReportRequest"("organizationId", "requestedById", "createdAt");
CREATE INDEX "ReportRequest_organizationId_status_createdAt_idx"
  ON "ReportRequest"("organizationId", "status", "createdAt");
CREATE INDEX "ReportRequest_status_leaseExpiresAt_idx" ON "ReportRequest"("status", "leaseExpiresAt");
CREATE INDEX "ReportRequest_expiresAt_idx" ON "ReportRequest"("expiresAt");

ALTER TABLE "ReportRequest" ADD CONSTRAINT "ReportRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportRequest" ADD CONSTRAINT "ReportRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
