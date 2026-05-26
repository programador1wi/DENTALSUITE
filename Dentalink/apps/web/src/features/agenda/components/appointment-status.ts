import type { AppointmentStatus } from "../services/appointments.service";

const labels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  PENDING_CONFIRMATION: "Por confirmar",
  ARRIVED: "Llego",
  WAITING_ROOM: "Sala de espera",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Atendida",
  CANCELLED_BY_PATIENT: "Cancelada paciente",
  CANCELLED_BY_CLINIC: "Cancelada clinica",
  NO_SHOW: "No asistio",
  RESCHEDULED: "Reagendada",
  BLOCKED: "Bloqueada"
};

export function appointmentStatusLabel(status: AppointmentStatus) {
  return labels[status] ?? status;
}

export function appointmentStatusTone(status: AppointmentStatus): "default" | "success" | "warning" | "danger" {
  if (status === "COMPLETED" || status === "CONFIRMED") return "success";
  if (status === "CANCELLED_BY_PATIENT" || status === "CANCELLED_BY_CLINIC" || status === "NO_SHOW") return "danger";
  if (status === "ARRIVED" || status === "WAITING_ROOM" || status === "IN_PROGRESS" || status === "PENDING_CONFIRMATION") return "warning";
  return "default";
}

export type StatusColorPalette = {
  cardClass: string;
  dotClass: string;
};

export const appointmentColorPalette: Record<AppointmentStatus, StatusColorPalette> = {
  SCHEDULED: { cardClass: "bg-blue-50/60 border-blue-200 text-blue-900", dotClass: "bg-blue-500" },
  CONFIRMED: { cardClass: "bg-emerald-50/60 border-emerald-200 text-emerald-900", dotClass: "bg-emerald-500" },
  PENDING_CONFIRMATION: { cardClass: "bg-amber-50/60 border-amber-200 text-amber-900", dotClass: "bg-amber-500" },
  ARRIVED: { cardClass: "bg-indigo-50/60 border-indigo-200 text-indigo-900", dotClass: "bg-indigo-500" },
  WAITING_ROOM: { cardClass: "bg-purple-50/60 border-purple-200 text-purple-900", dotClass: "bg-purple-500" },
  IN_PROGRESS: { cardClass: "bg-cyan-50/60 border-cyan-200 text-cyan-900", dotClass: "bg-cyan-500" },
  COMPLETED: { cardClass: "bg-slate-50/60 border-slate-200 text-slate-900", dotClass: "bg-slate-500" },
  CANCELLED_BY_PATIENT: { cardClass: "bg-red-50/60 border-red-200 text-red-900", dotClass: "bg-red-500" },
  CANCELLED_BY_CLINIC: { cardClass: "bg-red-50/60 border-red-200 text-red-900", dotClass: "bg-red-500" },
  NO_SHOW: { cardClass: "bg-rose-50/60 border-rose-200 text-rose-900", dotClass: "bg-rose-500" },
  RESCHEDULED: { cardClass: "bg-orange-50/60 border-orange-200 text-orange-900", dotClass: "bg-orange-500" },
  BLOCKED: { cardClass: "bg-zinc-100 border-zinc-300 text-zinc-500 border-dashed opacity-80", dotClass: "bg-zinc-400" },
};
