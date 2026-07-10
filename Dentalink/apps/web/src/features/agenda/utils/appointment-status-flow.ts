import type { AppointmentStatus } from "../services/appointments.service";

export type AppointmentStatusMenuAction =
  | "markPendingConfirmation"
  | "markScheduled"
  | "confirm"
  | "confirmWhatsApp"
  | "confirmPhone"
  | "confirmEmail"
  | "notifyWhatsApp"
  | "notifyEmail"
  | "arrive"
  | "waitingRoom"
  | "start"
  | "complete"
  | "noShow"
  | "reschedule"
  | "cancelPatient"
  | "cancelClinic"
  | "cancelConflict"
  | "cancelRescheduled"
  | "history";

export type AppointmentStatusMenuItem = {
  action: AppointmentStatusMenuAction;
  label: string;
  nextStatus?: AppointmentStatus;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
};

export type DirectAppointmentStatusMenuItem = AppointmentStatusMenuItem & {
  nextStatus: AppointmentStatus;
};

export const APPOINTMENT_STATUS_MENU: Record<AppointmentStatus, AppointmentStatusMenuItem[]> = {
  SCHEDULED: [
    { action: "markPendingConfirmation", label: "Marcar por confirmar", nextStatus: "PENDING_CONFIRMATION", tone: "warning" },
    { action: "notifyWhatsApp", label: "Notificar por WhatsApp", nextStatus: "NOTIFIED_BY_WHATSAPP", tone: "warning" },
    { action: "notifyEmail", label: "Enviar confirmación por email", nextStatus: "NOTIFIED_BY_EMAIL", tone: "warning" },
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "confirmWhatsApp", label: "Confirmar por WhatsApp", nextStatus: "CONFIRMED_BY_WHATSAPP", tone: "success" },
    { action: "confirmPhone", label: "Confirmar por teléfono", nextStatus: "CONFIRMED_BY_PHONE", tone: "success" },
    { action: "confirmEmail", label: "Marcar confirmado por email", nextStatus: "CONFIRMED_BY_EMAIL", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  PENDING_CONFIRMATION: [
    { action: "markScheduled", label: "Volver a agendada", nextStatus: "SCHEDULED" },
    { action: "notifyWhatsApp", label: "Notificar por WhatsApp", nextStatus: "NOTIFIED_BY_WHATSAPP", tone: "warning" },
    { action: "notifyEmail", label: "Enviar confirmación por email", nextStatus: "NOTIFIED_BY_EMAIL", tone: "warning" },
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "confirmWhatsApp", label: "Confirmar por WhatsApp", nextStatus: "CONFIRMED_BY_WHATSAPP", tone: "success" },
    { action: "confirmPhone", label: "Confirmar por teléfono", nextStatus: "CONFIRMED_BY_PHONE", tone: "success" },
    { action: "confirmEmail", label: "Marcar confirmado por email", nextStatus: "CONFIRMED_BY_EMAIL", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  NOTIFIED_BY_WHATSAPP: [
    { action: "markScheduled", label: "Volver a agendada", nextStatus: "SCHEDULED" },
    { action: "markPendingConfirmation", label: "Marcar por confirmar", nextStatus: "PENDING_CONFIRMATION", tone: "warning" },
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "confirmWhatsApp", label: "Confirmar por WhatsApp", nextStatus: "CONFIRMED_BY_WHATSAPP", tone: "success" },
    { action: "confirmPhone", label: "Confirmar por teléfono", nextStatus: "CONFIRMED_BY_PHONE", tone: "success" },
    { action: "confirmEmail", label: "Marcar confirmado por email", nextStatus: "CONFIRMED_BY_EMAIL", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  NOTIFIED_BY_EMAIL: [
    { action: "markScheduled", label: "Volver a agendada", nextStatus: "SCHEDULED" },
    { action: "markPendingConfirmation", label: "Marcar por confirmar", nextStatus: "PENDING_CONFIRMATION", tone: "warning" },
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "confirmWhatsApp", label: "Confirmar por WhatsApp", nextStatus: "CONFIRMED_BY_WHATSAPP", tone: "success" },
    { action: "confirmPhone", label: "Confirmar por teléfono", nextStatus: "CONFIRMED_BY_PHONE", tone: "success" },
    { action: "confirmEmail", label: "Marcar confirmado por email", nextStatus: "CONFIRMED_BY_EMAIL", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  CONFIRMED: [
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "waitingRoom", label: "Pasar a sala de espera", nextStatus: "WAITING_ROOM", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  CONFIRMED_BY_WHATSAPP: [
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "waitingRoom", label: "Pasar a sala de espera", nextStatus: "WAITING_ROOM", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  CONFIRMED_BY_PHONE: [
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "waitingRoom", label: "Pasar a sala de espera", nextStatus: "WAITING_ROOM", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  CONFIRMED_BY_EMAIL: [
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "waitingRoom", label: "Pasar a sala de espera", nextStatus: "WAITING_ROOM", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  ARRIVED: [
    { action: "waitingRoom", label: "Pasar a sala de espera", nextStatus: "WAITING_ROOM", tone: "brand" },
    { action: "start", label: "Iniciar atención", nextStatus: "IN_PROGRESS", tone: "success" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  WAITING_ROOM: [
    { action: "start", label: "Iniciar atención", nextStatus: "IN_PROGRESS", tone: "success" },
    { action: "complete", label: "Marcar atendida", nextStatus: "COMPLETED", tone: "success" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  IN_PROGRESS: [
    { action: "complete", label: "Finalizar como atendida", nextStatus: "COMPLETED", tone: "success" },
    { action: "waitingRoom", label: "Volver a sala de espera", nextStatus: "WAITING_ROOM", tone: "warning" },
    { action: "history", label: "Ver historial" }
  ],
  COMPLETED: [{ action: "history", label: "Ver historial" }],
  CANCELLED_BY_PATIENT: [{ action: "history", label: "Ver historial" }],
  CANCELLED_BY_CLINIC: [{ action: "history", label: "Ver historial" }],
  CANCELLED_CONFLICT: [{ action: "history", label: "Ver historial" }],
  CANCELLED_RESCHEDULED: [{ action: "history", label: "Ver historial" }],
  NO_SHOW: [{ action: "history", label: "Ver historial" }],
  RESCHEDULED: [
    { action: "markScheduled", label: "Volver a agendada", nextStatus: "SCHEDULED" },
    { action: "markPendingConfirmation", label: "Marcar por confirmar", nextStatus: "PENDING_CONFIRMATION", tone: "warning" },
    { action: "notifyWhatsApp", label: "Notificar por WhatsApp", nextStatus: "NOTIFIED_BY_WHATSAPP", tone: "warning" },
    { action: "notifyEmail", label: "Enviar confirmación por email", nextStatus: "NOTIFIED_BY_EMAIL", tone: "warning" },
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "confirmWhatsApp", label: "Confirmar por WhatsApp", nextStatus: "CONFIRMED_BY_WHATSAPP", tone: "success" },
    { action: "confirmPhone", label: "Confirmar por teléfono", nextStatus: "CONFIRMED_BY_PHONE", tone: "success" },
    { action: "confirmEmail", label: "Marcar confirmado por email", nextStatus: "CONFIRMED_BY_EMAIL", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "cancelConflict", label: "Cancelar por conflicto", nextStatus: "CANCELLED_CONFLICT", tone: "danger" },
    { action: "cancelRescheduled", label: "Anular por reprogramación", nextStatus: "CANCELLED_RESCHEDULED", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  BLOCKED: [{ action: "history", label: "Ver historial" }]
};

export function getAppointmentStatusMenuItems(status: AppointmentStatus) {
  return APPOINTMENT_STATUS_MENU[status] ?? [];
}

export function getDirectAppointmentStatusOptions(status: AppointmentStatus) {
  return getAppointmentStatusMenuItems(status).filter(
    (item): item is DirectAppointmentStatusMenuItem =>
      Boolean(item.nextStatus) &&
      item.action !== "cancelPatient" &&
      item.action !== "cancelClinic" &&
      item.action !== "cancelConflict" &&
      item.action !== "cancelRescheduled"
  );
}
