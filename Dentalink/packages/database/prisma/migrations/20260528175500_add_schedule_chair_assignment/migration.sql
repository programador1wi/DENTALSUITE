-- AlterTable
ALTER TABLE "ProfessionalSchedule" ADD COLUMN "chairId" TEXT;

-- CreateIndex
CREATE INDEX "ProfessionalSchedule_chairId_dayOfWeek_isActive_idx" ON "ProfessionalSchedule"("chairId", "dayOfWeek", "isActive");

-- AddForeignKey
ALTER TABLE "ProfessionalSchedule" ADD CONSTRAINT "ProfessionalSchedule_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
