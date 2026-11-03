import { useMemo } from "react";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import { appointmentStatusLabel, appointmentColorPalette } from "./appointment-status";

type SidebarStatusFiltersProps = {
  appointments: Appointment[];
  selectedStatuses: AppointmentStatus[];
  onChange: (statuses: AppointmentStatus[]) => void;
  professionalFilterNode?: React.ReactNode;
};

type FilterItem = {
  status: AppointmentStatus;
  label: string;
  dotColor: string;
};

const OPERATIONAL_FILTERS: FilterItem[] = [
  { status: "NOTIFIED_BY_WHATSAPP", label: "Notificado por WhatsApp", dotColor: "bg-sky-500" },
  { status: "CONFIRMED_BY_WHATSAPP", label: "Confirmado por WhatsApp", dotColor: "bg-emerald-500" },
  { status: "CANCELLED_BY_PATIENT", label: "Anulado por pcte. via WhatsApp", dotColor: "bg-rose-500" },
  { status: "CONFIRMED", label: "Confirmado", dotColor: "bg-blue-600" },
  { status: "PENDING_CONFIRMATION", label: "No confirmado", dotColor: "bg-amber-500" },
  { status: "SCHEDULED", label: "Agenda Online", dotColor: "bg-blue-400" },
  { status: "NOTIFIED_BY_EMAIL", label: "Notificado via email", dotColor: "bg-sky-400" },
  { status: "CONFIRMED_BY_PHONE", label: "Confirmado por teléfono", dotColor: "bg-indigo-500" },
  { status: "CONFIRMED_BY_EMAIL", label: "Confirmado por email", dotColor: "bg-teal-500" },
  { status: "WAITING_ROOM", label: "En sala de espera", dotColor: "bg-violet-500" },
  { status: "IN_PROGRESS", label: "Atendiéndose", dotColor: "bg-purple-500" },
  { status: "COMPLETED", label: "Atendido", dotColor: "bg-emerald-600" },
  { status: "ARRIVED", label: "Llegó", dotColor: "bg-cyan-500" },
  { status: "NO_SHOW", label: "No asiste", dotColor: "bg-red-500" },
  { status: "BLOCKED", label: "Bloqueada", dotColor: "bg-zinc-400" }
];

const CANCELLATION_FILTERS: FilterItem[] = [
  { status: "CANCELLED_BY_CLINIC", label: "Cancelado", dotColor: "bg-rose-500" },
  { status: "CANCELLED_CONFLICT", label: "Cancelado por sesiones en conflicto", dotColor: "bg-orange-500" },
  { status: "CANCELLED_RESCHEDULED", label: "Anulado por reprogramación", dotColor: "bg-zinc-400" },
  { status: "RESCHEDULED", label: "Cambio de fecha", dotColor: "bg-teal-600" }
];

const ALL_STATUSES: AppointmentStatus[] = [
  ...OPERATIONAL_FILTERS.map(f => f.status),
  ...CANCELLATION_FILTERS.map(f => f.status)
];

export function SidebarStatusFilters({ appointments, selectedStatuses, onChange, professionalFilterNode }: SidebarStatusFiltersProps) {
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
    <div className="flex flex-col bg-white border border-zinc-200 rounded-lg p-2 space-y-2 select-none shadow-xs text-xs min-w-0">
      {/* 1. Doctor Filter Select (Identical to Dentalink top dropdown) */}
      {professionalFilterNode && (
        <div className="w-full min-w-0">
          {professionalFilterNode}
        </div>
      )}

      {/* 2. Marcar Todos Checkbox / Link */}
      <div className="flex items-center gap-1.5 px-1 py-0.5 border-b border-zinc-100 pb-1.5">
        <input
          type="checkbox"
          id="toggle-all-statuses"
          checked={allSelected}
          onChange={handleToggleAll}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
        <label htmlFor="toggle-all-statuses" className="text-[11px] font-medium text-blue-600 hover:underline cursor-pointer">
          {allSelected ? "Desmarcar todos" : "Marcar todos"}
        </label>
      </div>

      {/* 3. Operational Status List (Ultra-compact Dentalink style) */}
      <div className="space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5 no-scrollbar">
        {OPERATIONAL_FILTERS.map(({ status, label }) => {
          const count = statusCounts[status] ?? 0;
          const isChecked = selectedStatuses.includes(status);
          return (
            <label
              key={status}
              className="flex items-center justify-between px-1 py-0.5 rounded hover:bg-slate-50 text-[11px] font-normal text-blue-600 cursor-pointer transition-colors leading-tight"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleStatus(status)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="truncate min-w-0 flex-1 text-blue-600 hover:text-blue-800" title={label}>{label}</span>
              </div>
              {count > 0 && (
                <span className="px-1 py-0.2 shrink-0 rounded-full bg-blue-50 text-[9px] text-blue-700 font-semibold">
                  {count}
                </span>
              )}
            </label>
          );
        })}

        {/* Separador de cancelaciones */}
        <div className="pt-1.5 mt-1 border-t border-zinc-100 space-y-0.5">
          {CANCELLATION_FILTERS.map(({ status, label }) => {
            const count = statusCounts[status] ?? 0;
            const isChecked = selectedStatuses.includes(status);
            return (
              <label
                key={status}
                className="flex items-center justify-between px-1 py-0.5 rounded hover:bg-slate-50 text-[11px] font-normal text-sky-600 cursor-pointer transition-colors leading-tight"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleStatus(status)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-zinc-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <span className="truncate min-w-0 flex-1 text-sky-600 hover:text-sky-800" title={label}>{label}</span>
                </div>
                {count > 0 && (
                  <span className="px-1 py-0.2 shrink-0 rounded-full bg-slate-100 text-[9px] text-slate-600 font-semibold">
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
