import { appointmentColorPalette } from "./appointment-status";
import type { AppointmentStatus } from "../services/appointments.service";

type LegendItem = {
  status: AppointmentStatus;
  label: string;
};

const LEGEND_ITEMS: LegendItem[] = [
  { status: "SCHEDULED",            label: "Agendada" },
  { status: "CONFIRMED",            label: "Confirmada" },
  { status: "PENDING_CONFIRMATION", label: "Por confirmar" },
  { status: "ARRIVED",              label: "Llegó" },
  { status: "WAITING_ROOM",         label: "Sala de espera" },
  { status: "IN_PROGRESS",          label: "En atención" },
  { status: "COMPLETED",            label: "Atendida" },
  { status: "RESCHEDULED",          label: "Reagendada" },
  { status: "NO_SHOW",              label: "No asistió" },
  { status: "CANCELLED_BY_PATIENT", label: "Cancelada" },
  { status: "BLOCKED",              label: "Bloqueada" },
];

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-2">
      {LEGEND_ITEMS.map(({ status, label }) => {
        const palette = appointmentColorPalette[status];
        return (
          <div key={status} className="flex items-center gap-1.5 select-none">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/70 ${palette.dotClass}`}
            />
            <span className="text-[10px] font-medium text-zinc-500 whitespace-nowrap">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
