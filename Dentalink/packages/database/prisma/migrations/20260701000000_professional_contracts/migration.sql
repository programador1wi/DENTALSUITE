-- CreateEnum
CREATE TYPE "ProfessionalContractType" AS ENUM ('PERFORMED_AND_PAID', 'PERFORMED');

-- CreateEnum
CREATE TYPE "ProfessionalContractCommissionBase" AS ENUM ('CLINICAL', 'LAB', 'ALL');

-- CreateEnum
CREATE TYPE "ProfessionalContractPaymentDiscount" AS ENUM ('NONE', 'PAYMENT_METHOD', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "ProfessionalContractPaymentCondition" AS ENUM ('ANY_DUE_DATE', 'ON_DUE', 'THIRTY_DAYS');

-- CreateTable
CREATE TABLE "ProfessionalContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "contractType" "ProfessionalContractType" NOT NULL DEFAULT 'PERFORMED_AND_PAID',
    "commissionBase" "ProfessionalContractCommissionBase" NOT NULL DEFAULT 'CLINICAL',
    "paymentDiscount" "ProfessionalContractPaymentDiscount" NOT NULL DEFAULT 'NONE',
    "paymentCondition" "ProfessionalContractPaymentCondition" NOT NULL DEFAULT 'ANY_DUE_DATE',
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "priceListId" TEXT,
    "priceListName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalContractBranch" (
    "contractId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalContractBranch_pkey" PRIMARY KEY ("contractId","branchId")
);

-- CreateTable
CREATE TABLE "ProfessionalContractCategoryRate" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "procedureCategoryId" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalContractCategoryRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalContractFixedAmount" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "priceListId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalContractFixedAmount_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PayrollLiquidation"
ADD COLUMN "professionalContractId" TEXT,
ADD COLUMN "contractSnapshot" JSONB;

-- AlterTable
ALTER TABLE "PayrollLiquidationItem"
ADD COLUMN "commissionRate" DECIMAL(5,2),
ADD COLUMN "contractRule" JSONB;

-- CreateIndex
CREATE INDEX "ProfessionalContract_organizationId_isActive_idx" ON "ProfessionalContract"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ProfessionalContract_professionalId_isActive_startsAt_idx" ON "ProfessionalContract"("professionalId", "isActive", "startsAt");

-- CreateIndex
CREATE INDEX "ProfessionalContractBranch_branchId_idx" ON "ProfessionalContractBranch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalContractCategoryRate_contractId_procedureCategoryId_key" ON "ProfessionalContractCategoryRate"("contractId", "procedureCategoryId");

-- CreateIndex
CREATE INDEX "ProfessionalContractCategoryRate_procedureCategoryId_idx" ON "ProfessionalContractCategoryRate"("procedureCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalContractFixedAmount_contractId_procedureId_key" ON "ProfessionalContractFixedAmount"("contractId", "procedureId");

-- CreateIndex
CREATE INDEX "ProfessionalContractFixedAmount_procedureId_idx" ON "ProfessionalContractFixedAmount"("procedureId");

-- CreateIndex
CREATE INDEX "PayrollLiquidation_professionalContractId_idx" ON "PayrollLiquidation"("professionalContractId");

-- AddForeignKey
ALTER TABLE "ProfessionalContract" ADD CONSTRAINT "ProfessionalContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContract" ADD CONSTRAINT "ProfessionalContract_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContractBranch" ADD CONSTRAINT "ProfessionalContractBranch_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProfessionalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContractBranch" ADD CONSTRAINT "ProfessionalContractBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContractCategoryRate" ADD CONSTRAINT "ProfessionalContractCategoryRate_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProfessionalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContractCategoryRate" ADD CONSTRAINT "ProfessionalContractCategoryRate_procedureCategoryId_fkey" FOREIGN KEY ("procedureCategoryId") REFERENCES "ProcedureCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContractFixedAmount" ADD CONSTRAINT "ProfessionalContractFixedAmount_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ProfessionalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalContractFixedAmount" ADD CONSTRAINT "ProfessionalContractFixedAmount_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLiquidation" ADD CONSTRAINT "PayrollLiquidation_professionalContractId_fkey" FOREIGN KEY ("professionalContractId") REFERENCES "ProfessionalContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
