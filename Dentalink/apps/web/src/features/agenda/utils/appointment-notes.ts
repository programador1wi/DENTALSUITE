import type { Appointment } from "../services/appointments.service";

type AppointmentNoteSignal = Pick<Appointment, "notes" | "appointmentNotes" | "_count">;

export function hasAppointmentNotes(appointment: AppointmentNoteSignal) {
  return Boolean(
    appointment.notes?.trim() ||
      appointment.appointmentNotes?.length ||
      (appointment._count?.appointmentNotes ?? 0) > 0
  );
}
