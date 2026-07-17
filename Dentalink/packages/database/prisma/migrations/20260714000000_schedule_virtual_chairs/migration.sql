CREATE TYPE "AttendanceMode" AS ENUM ('PRESENTIAL', 'TELECONSULTATION', 'BOTH');

ALTER TABLE "ProfessionalSchedule"
ADD COLUMN "simultaneousChairs" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "attendanceMode" "AttendanceMode" NOT NULL DEFAULT 'PRESENTIAL';

ALTER TABLE "ProfessionalSpecialSchedule"
ADD COLUMN "simultaneousChairs" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "attendanceMode" "AttendanceMode" NOT NULL DEFAULT 'PRESENTIAL';

ALTER TABLE "Appointment"
ADD COLUMN "chairIndex" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "isOverbooking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "attendanceMode" "AttendanceMode" NOT NULL DEFAULT 'PRESENTIAL';

CREATE INDEX "Appointment_professionalId_chairIndex_startAt_endAt_idx" ON "Appointment"("professionalId", "chairIndex", "startAt", "endAt");
CREATE INDEX "Appointment_isOverbooking_startAt_idx" ON "Appointment"("isOverbooking", "startAt");
