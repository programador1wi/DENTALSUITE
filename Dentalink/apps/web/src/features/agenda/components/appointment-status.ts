import type { AppointmentStatus } from "../services/appointments.service";

const labels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  PENDING_CONFIRMATION: "Por confirmar",
  ARRIVED: "Llegó",
  WAITING_ROOM: "Sala de espera",
  IN_PROGRESS: "En atención",
  COMPLETED: "Atendida",
  CANCELLED_BY_PATIENT: "Cancelada paciente",
  CANCELLED_BY_CLINIC: "Cancelada clínica",
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
      return "success";
    case "CANCELLED_BY_PATIENT":
    case "CANCELLED_BY_CLINIC":
    case "NO_SHOW":
      return "danger";
    case "WAITING_ROOM":
    case "PENDING_CONFIRMATION":
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
  PENDING_CONFIRMATION: { cardClass: "bg-[var(--status-warning-bg)] border-[var(--status-warning-bg)] text-[var(--status-warning-text)]", dotClass: "bg-[var(--text-warning)]" },
  ARRIVED: { cardClass: "bg-[var(--bg-brand-light)] border-[var(--border-brand-light)] text-[var(--text-brand)]", dotClass: "bg-[var(--text-brand)]" },
  WAITING_ROOM: { cardClass: "bg-[var(--status-purple-bg)] border-[var(--status-purple-bg)] text-[var(--status-purple-text)]", dotClass: "bg-[var(--status-purple-text)]" },
  IN_PROGRESS: { cardClass: "bg-[var(--bg-brand-light)] border-[var(--border-brand-light)] text-[var(--text-brand-strong)]", dotClass: "bg-[var(--text-brand)]" },
  COMPLETED: { cardClass: "bg-[var(--status-neutral-bg)] border-[var(--border-default)] text-[var(--text-primary)]", dotClass: "bg-[var(--text-secondary)]" },
  CANCELLED_BY_PATIENT: { cardClass: "bg-[var(--status-danger-bg)] border-[var(--status-danger-bg)] text-[var(--status-danger-text)]", dotClass: "bg-[var(--text-danger)]" },
  CANCELLED_BY_CLINIC: { cardClass: "bg-[var(--status-danger-bg)] border-[var(--status-danger-bg)] text-[var(--status-danger-text)]", dotClass: "bg-[var(--text-danger)]" },
  NO_SHOW: { cardClass: "bg-[var(--status-danger-bg)] border-[var(--status-danger-bg)] text-[var(--status-no-show-text)]", dotClass: "bg-[var(--status-no-show-text)]" },
  RESCHEDULED: { cardClass: "bg-[var(--status-warning-bg)] border-[var(--status-warning-bg)] text-[var(--status-rescheduled-text)]", dotClass: "bg-[var(--status-rescheduled-text)]" },
  BLOCKED: { cardClass: "border-dashed bg-[var(--status-neutral-bg)] border-[var(--border-strong)] text-[var(--text-secondary)] opacity-80", dotClass: "bg-[var(--text-secondary)]" },
};
