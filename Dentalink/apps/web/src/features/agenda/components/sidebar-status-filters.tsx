import { useMemo } from "react";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import { appointmentStatusLabel, appointmentColorPalette } from "./appointment-status";

type SidebarStatusFiltersProps = {
  appointments: Appointment[];
  selectedStatuses: AppointmentStatus[];
  onChange: (statuses: AppointmentStatus[]) => void;
};

type FilterItem = {
  status: AppointmentStatus;
  label: string;
  dotColor: string;
  borderColor: string;
};

const OPERATIONAL_FILTERS: FilterItem[] = [
  { status: "SCHEDULED", label: "Agendada", dotColor: "bg-blue-400", borderColor: "border-blue-400" },
  { status: "PENDING_CONFIRMATION", label: "Por confirmar", dotColor: "bg-amber-400", borderColor: "border-amber-400" },
  { status: "NOTIFIED_BY_WHATSAPP", label: "Notificada por WhatsApp", dotColor: "bg-sky-400", borderColor: "border-sky-400" },
  { status: "CONFIRMED_BY_WHATSAPP", label: "Confirmada por WhatsApp", dotColor: "bg-emerald-400", borderColor: "border-emerald-400" },
  { status: "NOTIFIED_BY_EMAIL", label: "Notificada por email", dotColor: "bg-sky-300", borderColor: "border-sky-300" },
  { status: "CONFIRMED_BY_EMAIL", label: "Confirmada por email", dotColor: "bg-teal-400", borderColor: "border-teal-400" },
  { status: "CONFIRMED_BY_PHONE", label: "Confirmada por teléfono", dotColor: "bg-indigo-400", borderColor: "border-indigo-400" },
  { status: "CONFIRMED", label: "Confirmada", dotColor: "bg-green-500", borderColor: "border-green-500" },
  { status: "ARRIVED", label: "Llegó", dotColor: "bg-cyan-500", borderColor: "border-cyan-500" },
  { status: "WAITING_ROOM", label: "En sala de espera", dotColor: "bg-violet-500", borderColor: "border-violet-500" },
  { status: "IN_PROGRESS", label: "En atención", dotColor: "bg-purple-500", borderColor: "border-purple-500" },
  { status: "COMPLETED", label: "Atendida", dotColor: "bg-zinc-400", borderColor: "border-zinc-400" },
  { status: "NO_SHOW", label: "No asistió", dotColor: "bg-red-500", borderColor: "border-red-500" },
  { status: "BLOCKED", label: "Bloqueada", dotColor: "bg-zinc-500", borderColor: "border-zinc-500" }
];

const CANCELLATION_FILTERS: FilterItem[] = [
  { status: "CANCELLED_BY_PATIENT", label: "Cancelada por paciente", dotColor: "bg-rose-400", borderColor: "border-rose-400" },
  { status: "CANCELLED_BY_CLINIC", label: "Cancelada por clínica", dotColor: "bg-rose-500", borderColor: "border-rose-500" },
  { status: "CANCELLED_CONFLICT", label: "Cancelada conflicto", dotColor: "bg-orange-400", borderColor: "border-orange-400" },
  { status: "CANCELLED_RESCHEDULED", label: "Anulada reprogramación", dotColor: "bg-zinc-300", borderColor: "border-zinc-300" },
  { status: "RESCHEDULED", label: "Cambio de fecha", dotColor: "bg-teal-500", borderColor: "border-teal-500" }
];

const ALL_STATUSES: AppointmentStatus[] = [
  ...OPERATIONAL_FILTERS.map(f => f.status),
  ...CANCELLATION_FILTERS.map(f => f.status)
];

export function SidebarStatusFilters({ appointments, selectedStatuses, onChange }: SidebarStatusFiltersProps) {
  // Contar dinámicamente cuántas citas hay por estado
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach((appt) => {
      counts[appt.status] = (counts[appt.status] ?? 0) + 1;
    });
    return counts;
  }, [appointments]);

  const allSelected = selectedStatuses.length === ALL_STATUSES.length;

  const handleToggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...ALL_STATUSES]);
    }
  };

  const handleToggleStatus = (status: AppointmentStatus) => {
    if (selectedStatuses.includes(status)) {
      onChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[var(--border-default)] rounded-[var(--radius-lg)] p-4 space-y-5 select-none shadow-sm overflow-y-auto">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-default)]">
        <span className="text-sm font-semibold text-zinc-700">Estados de citas</span>
        <button
          type="button"
          onClick={handleToggleAll}
          className="text-xs font-medium text-[var(--action-primary)] hover:underline cursor-pointer"
        >
          {allSelected ? "Desmarcar todos" : "Marcar todos"}
        </button>
      </div>

      {/* Grupo 1: Operacionales */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block">Operación Diaria</span>
        <div className="space-y-1.5">
          {OPERATIONAL_FILTERS.map(({ status, label, dotColor, borderColor }) => {
            const count = statusCounts[status] ?? 0;
            const isChecked = selectedStatuses.includes(status);
            return (
              <label
                key={status}
                className={`flex items-center justify-between px-2 py-1.5 rounded-[var(--radius-md)] border-l-[3px] text-xs font-medium cursor-pointer transition-colors ${
                  isChecked
                    ? "bg-zinc-50/80 border-l-[var(--action-primary)] text-zinc-800"
                    : "bg-white border-l-zinc-200 text-zinc-500 hover:bg-zinc-50/40"
                }`}
                style={{ borderLeftColor: isChecked ? undefined : "rgba(228, 228, 231, 1)" }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleStatus(status)}
                    className="h-3.5 w-3.5 rounded text-[var(--action-primary)] border-zinc-300 focus:ring-[var(--action-primary)] cursor-pointer"
                  />
                  <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                  <span className="truncate max-w-[140px]">{label}</span>
                </div>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 text-[10px] text-zinc-600 font-semibold">
                    {count}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Grupo 2: Cancelaciones / Modificaciones */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
        <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase block">Exclusiones e Historial</span>
        <div className="space-y-1.5">
          {CANCELLATION_FILTERS.map(({ status, label, dotColor }) => {
            const count = statusCounts[status] ?? 0;
            const isChecked = selectedStatuses.includes(status);
            return (
              <label
                key={status}
                className={`flex items-center justify-between px-2 py-1.5 rounded-[var(--radius-md)] border-l-[3px] text-xs font-medium cursor-pointer transition-colors ${
                  isChecked
                    ? "bg-zinc-50/80 border-l-rose-500 text-zinc-800"
                    : "bg-white border-l-zinc-200 text-zinc-500 hover:bg-zinc-50/40"
                }`}
                style={{ borderLeftColor: isChecked ? undefined : "rgba(228, 228, 231, 1)" }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleStatus(status)}
                    className="h-3.5 w-3.5 rounded text-[var(--action-primary)] border-zinc-300 focus:ring-[var(--action-primary)] cursor-pointer"
                  />
                  <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                  <span className="truncate max-w-[140px]">{label}</span>
                </div>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 text-[10px] text-zinc-600 font-semibold">
                    {count}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
