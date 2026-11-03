-- Add per professional+branch agenda config overrides
ALTER TABLE "ProfessionalBranch" ADD COLUMN     "agendaSlotMinutes" INTEGER;
ALTER TABLE "ProfessionalBranch" ADD COLUMN     "defaultAppointmentDurationMinutes" INTEGER;
