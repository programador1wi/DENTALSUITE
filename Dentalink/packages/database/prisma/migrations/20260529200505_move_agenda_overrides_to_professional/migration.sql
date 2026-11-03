/*
  Warnings:

  - You are about to drop the column `agendaSlotMinutes` on the `ProfessionalBranch` table. All the data in the column will be lost.
  - You are about to drop the column `defaultAppointmentDurationMinutes` on the `ProfessionalBranch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "agendaSlotMinutes" INTEGER,
ADD COLUMN     "defaultAppointmentDurationMinutes" INTEGER;

-- AlterTable
ALTER TABLE "ProfessionalBranch" DROP COLUMN "agendaSlotMinutes",
DROP COLUMN "defaultAppointmentDurationMinutes";
