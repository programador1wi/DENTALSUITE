-- CreateTable
CREATE TABLE "PayrollLiquidation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "branchId" TEXT,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "completedItems" INTEGER NOT NULL,
    "collectedAmount" DECIMAL(10,2) NOT NULL,
    "payableAmount" DECIMAL(10,2) NOT NULL,
    "lastCompletedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollLiquidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLiquidationItem" (
    "id" TEXT NOT NULL,
    "liquidationId" TEXT NOT NULL,
    "treatmentPlanItemId" TEXT NOT NULL,
    "collectedAmount" DECIMAL(10,2) NOT NULL,
    "payableAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLiquidationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollLiquidation_organizationId_finalizedAt_idx" ON "PayrollLiquidation"("organizationId", "finalizedAt");

-- CreateIndex
CREATE INDEX "PayrollLiquidation_professionalId_finalizedAt_idx" ON "PayrollLiquidation"("professionalId", "finalizedAt");

-- CreateIndex
CREATE INDEX "PayrollLiquidation_branchId_finalizedAt_idx" ON "PayrollLiquidation"("branchId", "finalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLiquidationItem_treatmentPlanItemId_key" ON "PayrollLiquidationItem"("treatmentPlanItemId");

-- CreateIndex
CREATE INDEX "PayrollLiquidationItem_liquidationId_idx" ON "PayrollLiquidationItem"("liquidationId");

-- AddForeignKey
ALTER TABLE "PayrollLiquidation" ADD CONSTRAINT "PayrollLiquidation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLiquidation" ADD CONSTRAINT "PayrollLiquidation_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLiquidation" ADD CONSTRAINT "PayrollLiquidation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLiquidation" ADD CONSTRAINT "PayrollLiquidation_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLiquidationItem" ADD CONSTRAINT "PayrollLiquidationItem_liquidationId_fkey" FOREIGN KEY ("liquidationId") REFERENCES "PayrollLiquidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLiquidationItem" ADD CONSTRAINT "PayrollLiquidationItem_treatmentPlanItemId_fkey" FOREIGN KEY ("treatmentPlanItemId") REFERENCES "TreatmentPlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
