import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useAvailability } from "../hooks/use-appointments";

export function AvailabilityPicker({
  branchId,
  professionalId,
  chairId,
  date,
  durationMinutes,
  onSelectSlot
}: {
  branchId: string;
  professionalId: string;
  chairId?: string;
  date: string;
  durationMinutes: string;
  onSelectSlot?: (slot: { startAt: string; endAt: string }) => void;
}) {
  const availability = useAvailability({ branchId, professionalId, chairId, date, durationMinutes });

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Disponibilidad</h3>
        <HelpTooltip content="Encuentra de forma automática los espacios vacíos del doctor y sillón seleccionados en la fecha de consulta para agendar rápidamente." />
      </div>
      {!branchId || !professionalId ? (
        <EmptyState title="Selecciona filtros" description="Elige sucursal y profesional para consultar espacios." />
      ) : availability.isLoading ? (
        <LoadingState message="Consultando disponibilidad..." />
      ) : !availability.data?.slots.length ? (
        <EmptyState title="Sin horario" description="No hay horario activo para la fecha seleccionada." />
      ) : (
        <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
          {availability.data.slots.map((slot) => (
            <button
              type="button"
              key={slot.startAt}
              disabled={!slot.available}
              onClick={() => onSelectSlot?.({ startAt: slot.startAt, endAt: slot.endAt })}
              className={`rounded-lg border px-3 py-2 text-sm ${
                slot.available ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-400"
              } ${slot.available ? "text-left transition hover:border-emerald-300 hover:bg-emerald-100" : "cursor-not-allowed text-left"}`}
            >
              {new Date(slot.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
              {new Date(slot.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
