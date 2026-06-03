import type { AppointmentStatus } from "../services/appointments.service";

export type AppointmentStatusMenuAction =
  | "markPendingConfirmation"
  | "markScheduled"
  | "confirm"
  | "arrive"
  | "waitingRoom"
  | "start"
  | "complete"
  | "noShow"
  | "reschedule"
  | "cancelPatient"
  | "cancelClinic"
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
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  PENDING_CONFIRMATION: [
    { action: "markScheduled", label: "Volver a agendada", nextStatus: "SCHEDULED" },
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  CONFIRMED: [
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "waitingRoom", label: "Pasar a sala de espera", nextStatus: "WAITING_ROOM", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  ARRIVED: [
    { action: "waitingRoom", label: "Pasar a sala de espera", nextStatus: "WAITING_ROOM", tone: "brand" },
    { action: "start", label: "Iniciar atención", nextStatus: "IN_PROGRESS", tone: "success" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
    { action: "history", label: "Ver historial" }
  ],
  WAITING_ROOM: [
    { action: "start", label: "Iniciar atención", nextStatus: "IN_PROGRESS", tone: "success" },
    { action: "complete", label: "Marcar atendida", nextStatus: "COMPLETED", tone: "success" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
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
  NO_SHOW: [{ action: "history", label: "Ver historial" }],
  RESCHEDULED: [
    { action: "markScheduled", label: "Volver a agendada", nextStatus: "SCHEDULED" },
    { action: "markPendingConfirmation", label: "Marcar por confirmar", nextStatus: "PENDING_CONFIRMATION", tone: "warning" },
    { action: "confirm", label: "Confirmar cita", nextStatus: "CONFIRMED", tone: "success" },
    { action: "arrive", label: "Llegó a clínica", nextStatus: "ARRIVED", tone: "brand" },
    { action: "noShow", label: "No asistió", nextStatus: "NO_SHOW", tone: "danger" },
    { action: "reschedule", label: "Reagendar" },
    { action: "cancelPatient", label: "Cancelar por paciente", nextStatus: "CANCELLED_BY_PATIENT", tone: "danger" },
    { action: "cancelClinic", label: "Cancelar por clínica", nextStatus: "CANCELLED_BY_CLINIC", tone: "danger" },
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
      Boolean(item.nextStatus) && item.action !== "cancelPatient" && item.action !== "cancelClinic"
  );
}
