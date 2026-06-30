import { appointmentColorPalette } from "./appointment-status";
import type { AppointmentStatus } from "../services/appointments.service";

type LegendItem = {
  status: AppointmentStatus;
  label: string;
};

const LEGEND_ITEMS: LegendItem[] = [
  { status: "SCHEDULED",            label: "Agendada" },
  { status: "CONFIRMED",            label: "Confirmada" },
  { status: "CONFIRMED_BY_WHATSAPP",label: "Confirmada por WhatsApp" },
  { status: "CONFIRMED_BY_PHONE",   label: "Confirmada por teléfono" },
  { status: "CONFIRMED_BY_EMAIL",   label: "Confirmada por email" },
  { status: "PENDING_CONFIRMATION", label: "Por confirmar" },
  { status: "NOTIFIED_BY_WHATSAPP", label: "Notificada por WhatsApp" },
  { status: "NOTIFIED_BY_EMAIL",    label: "Notificada por email" },
  { status: "ARRIVED",              label: "Llegó" },
  { status: "WAITING_ROOM",         label: "Sala de espera" },
  { status: "IN_PROGRESS",          label: "En atención" },
  { status: "COMPLETED",            label: "Atendida" },
  { status: "RESCHEDULED",          label: "Reagendada" },
  { status: "NO_SHOW",              label: "No asistió" },
  { status: "CANCELLED_BY_PATIENT", label: "Cancelada por paciente" },
  { status: "CANCELLED_BY_CLINIC",  label: "Cancelada por clínica" },
  { status: "CANCELLED_CONFLICT",   label: "Cancelada conflicto" },
  { status: "CANCELLED_RESCHEDULED",label: "Anulada reprogramación" },
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
