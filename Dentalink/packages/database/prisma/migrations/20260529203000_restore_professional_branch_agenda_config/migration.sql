-- Restore agenda configuration to the professional+branch assignment.
-- Values temporarily stored on Professional are copied to every assigned branch
-- before the global columns are removed.
ALTER TABLE "ProfessionalBranch" ADD COLUMN IF NOT EXISTS "agendaSlotMinutes" INTEGER;
ALTER TABLE "ProfessionalBranch" ADD COLUMN IF NOT EXISTS "defaultAppointmentDurationMinutes" INTEGER;

UPDATE "ProfessionalBranch" pb
SET
  "agendaSlotMinutes" = COALESCE(pb."agendaSlotMinutes", p."agendaSlotMinutes"),
  "defaultAppointmentDurationMinutes" = COALESCE(
    pb."defaultAppointmentDurationMinutes",
    p."defaultAppointmentDurationMinutes"
  )
FROM "Professional" p
WHERE p."id" = pb."professionalId";

ALTER TABLE "Professional" DROP COLUMN IF EXISTS "agendaSlotMinutes";
ALTER TABLE "Professional" DROP COLUMN IF EXISTS "defaultAppointmentDurationMinutes";
