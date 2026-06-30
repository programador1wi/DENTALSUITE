import type { AppointmentStatus } from "../services/appointments.service";

const labels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  CONFIRMED_BY_WHATSAPP: "Confirmada WhatsApp",
  CONFIRMED_BY_PHONE: "Confirmada Teléfono",
  CONFIRMED_BY_EMAIL: "Confirmada Email",
  PENDING_CONFIRMATION: "Por confirmar",
  NOTIFIED_BY_WHATSAPP: "Notificada WhatsApp",
  NOTIFIED_BY_EMAIL: "Notificada Email",
  ARRIVED: "Llegó",
  WAITING_ROOM: "Sala de espera",
  IN_PROGRESS: "En atención",
  COMPLETED: "Atendida",
  CANCELLED_BY_PATIENT: "Cancelada paciente",
  CANCELLED_BY_CLINIC: "Cancelada clínica",
  CANCELLED_CONFLICT: "Cancelada conflicto",
  CANCELLED_RESCHEDULED: "Anulada reprogramación",
  NO_SHOW: "No asistió",
  RESCHEDULED: "Reagendada",
  BLOCKED: "Bloqueada"
};

export function appointmentStatusLabel(status: AppointmentStatus) {
  return labels[status] ?? status;
}

export function appointmentStatusTone(status: AppointmentStatus): "default" | "success" | "warning" | "danger" | "brand" {
  switch (status) {
    case "SCHEDULED":
    case "ARRIVED":
    case "IN_PROGRESS":
      return "brand";
    case "COMPLETED":
    case "CONFIRMED":
    case "CONFIRMED_BY_WHATSAPP":
    case "CONFIRMED_BY_PHONE":
    case "CONFIRMED_BY_EMAIL":
      return "success";
    case "CANCELLED_BY_PATIENT":
    case "CANCELLED_BY_CLINIC":
    case "CANCELLED_CONFLICT":
    case "CANCELLED_RESCHEDULED":
    case "NO_SHOW":
      return "danger";
    case "WAITING_ROOM":
    case "PENDING_CONFIRMATION":
    case "NOTIFIED_BY_WHATSAPP":
    case "NOTIFIED_BY_EMAIL":
    case "RESCHEDULED":
      return "warning";
    default:
      return "default";
  }
}

export type StatusColorPalette = {
  cardClass: string;
  dotClass: string;
};

export const appointmentColorPalette: Record<AppointmentStatus, StatusColorPalette> = {
  SCHEDULED: { cardClass: "bg-[var(--bg-brand-light)] border-[var(--border-brand-light)] text-[var(--text-brand-strong)]", dotClass: "bg-[var(--text-brand)]" },
  CONFIRMED: { cardClass: "bg-[var(--status-success-bg)] border-[var(--status-success-bg)] text-[var(--status-success-text)]", dotClass: "bg-[var(--text-success)]" },
  CONFIRMED_BY_WHATSAPP: { cardClass: "bg-cyan-50 border-cyan-200 text-cyan-700", dotClass: "bg-cyan-500" },
  CONFIRMED_BY_PHONE: { cardClass: "bg-emerald-50 border-emerald-200 text-emerald-700", dotClass: "bg-emerald-500" },
  CONFIRMED_BY_EMAIL: { cardClass: "bg-teal-50 border-teal-200 text-teal-700", dotClass: "bg-teal-500" },
  PENDING_CONFIRMATION: { cardClass: "bg-[var(--status-warning-bg)] border-[var(--status-warning-bg)] text-[var(--status-warning-text)]", dotClass: "bg-[var(--text-warning)]" },
  NOTIFIED_BY_WHATSAPP: { cardClass: "bg-sky-50 border-sky-200 text-sky-700", dotClass: "bg-sky-500" },
  NOTIFIED_BY_EMAIL: { cardClass: "bg-amber-50 border-amber-200 text-amber-700", dotClass: "bg-amber-500" },
  ARRIVED: { cardClass: "bg-[var(--bg-brand-light)] border-[var(--border-brand-light)] text-[var(--text-brand)]", dotClass: "bg-[var(--text-brand)]" },
  WAITING_ROOM: { cardClass: "bg-[var(--status-purple-bg)] border-[var(--status-purple-bg)] text-[var(--status-purple-text)]", dotClass: "bg-[var(--status-purple-text)]" },
  IN_PROGRESS: { cardClass: "bg-[var(--bg-brand-light)] border-[var(--border-brand-light)] text-[var(--text-brand-strong)]", dotClass: "bg-[var(--text-brand)]" },
  COMPLETED: { cardClass: "bg-[var(--status-neutral-bg)] border-[var(--border-default)] text-[var(--text-primary)]", dotClass: "bg-[var(--text-secondary)]" },
  CANCELLED_BY_PATIENT: { cardClass: "bg-[var(--status-danger-bg)] border-[var(--status-danger-bg)] text-[var(--status-danger-text)]", dotClass: "bg-[var(--text-danger)]" },
  CANCELLED_BY_CLINIC: { cardClass: "bg-[var(--status-danger-bg)] border-[var(--status-danger-bg)] text-[var(--status-danger-text)]", dotClass: "bg-[var(--text-danger)]" },
  CANCELLED_CONFLICT: { cardClass: "bg-rose-50 border-rose-200 text-rose-700", dotClass: "bg-rose-500" },
  CANCELLED_RESCHEDULED: { cardClass: "bg-orange-50 border-orange-200 text-orange-700", dotClass: "bg-orange-500" },
  NO_SHOW: { cardClass: "bg-[var(--status-danger-bg)] border-[var(--status-danger-bg)] text-[var(--status-no-show-text)]", dotClass: "bg-[var(--status-no-show-text)]" },
  RESCHEDULED: { cardClass: "bg-[var(--status-warning-bg)] border-[var(--status-warning-bg)] text-[var(--status-rescheduled-text)]", dotClass: "bg-[var(--status-rescheduled-text)]" },
  BLOCKED: { cardClass: "border-dashed bg-[var(--status-neutral-bg)] border-[var(--border-strong)] text-[var(--text-secondary)] opacity-80", dotClass: "bg-[var(--text-secondary)]" },
};

const reasonTranslations: Record<string, string> = {
  "manual update": "Actualización manual",
  "deleted via api": "Eliminado vía API",
  "confirmed": "Confirmado",
  "arrived": "Llegó",
  "started": "En atención",
  "completed": "Atendido",
  "no show": "No asistió",
  "waiting room": "Sala de espera",
  "rescheduled": "Reagendado"
};

export function translateReason(reason: string): string {
  return reasonTranslations[reason.toLowerCase()] ?? reason;
}
