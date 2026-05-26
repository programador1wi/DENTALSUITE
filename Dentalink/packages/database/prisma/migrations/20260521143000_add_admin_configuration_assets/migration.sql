-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "FinancialInstitution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialInstitution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInstitution_organizationId_name_key" ON "FinancialInstitution"("organizationId", "name");

-- CreateIndex
CREATE INDEX "FinancialInstitution_organizationId_isActive_idx" ON "FinancialInstitution"("organizationId", "isActive");

-- AddForeignKey
ALTER TABLE "FinancialInstitution"
ADD CONSTRAINT "FinancialInstitution_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
