-- CreateEnum
CREATE TYPE "CollectionCaseStatus" AS ENUM ('PENDING', 'CONTACTED', 'PROMISE_TO_PAY', 'PAID', 'UNCOLLECTIBLE', 'CANCELLED');

-- CreateTable
CREATE TABLE "CollectionCase" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "installmentId" TEXT,
    "treatmentPlanId" TEXT,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "daysOverdue" INTEGER NOT NULL,
    "status" "CollectionCaseStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT NOT NULL,
    "lastContactAt" TIMESTAMP(3),
    "nextContactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionActivity" (
    "id" TEXT NOT NULL,
    "collectionCaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionCase_patientId_status_idx" ON "CollectionCase"("patientId", "status");

-- CreateIndex
CREATE INDEX "CollectionCase_installmentId_idx" ON "CollectionCase"("installmentId");

-- CreateIndex
CREATE INDEX "CollectionCase_treatmentPlanId_idx" ON "CollectionCase"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "CollectionCase_assignedToId_status_idx" ON "CollectionCase"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "CollectionActivity_collectionCaseId_createdAt_idx" ON "CollectionActivity"("collectionCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionActivity_userId_createdAt_idx" ON "CollectionActivity"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CollectionCase" ADD CONSTRAINT "CollectionCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionCase" ADD CONSTRAINT "CollectionCase_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionCase" ADD CONSTRAINT "CollectionCase_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionCase" ADD CONSTRAINT "CollectionCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionActivity" ADD CONSTRAINT "CollectionActivity_collectionCaseId_fkey" FOREIGN KEY ("collectionCaseId") REFERENCES "CollectionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionActivity" ADD CONSTRAINT "CollectionActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
