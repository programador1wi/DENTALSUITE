import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  useSpecialSchedules,
  useCreateSpecialSchedule,
  useDeactivateSpecialSchedule
} from "../hooks/use-schedules";
import { EmptyState } from "@/components/feedback/empty-state";

type Props = {
  professionalId: string;
  branchId: string;
  chairs: { id: string; name: string }[];
};

export function SpecialSchedulesSection({ professionalId, branchId, chairs }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("19:00");
  const [chairId, setChairId] = useState("");
  
  const query = useSpecialSchedules({ professionalId, branchId, active: "true" }, Boolean(professionalId && branchId));
  const createMutation = useCreateSpecialSchedule();
  const deactivateMutation = useDeactivateSpecialSchedule();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime) return;
    
    await createMutation.mutateAsync({
      professionalId,
      branchId,
      date,
      startTime,
      endTime,
      chairId: chairId || undefined
    });
    
    setIsOpen(false);
    setDate("");
  };

  const handleDeactivate = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este horario especial?")) {
      deactivateMutation.mutate(id);
    }
  };

  return (
    <Card className="space-y-[var(--space-4)]">
      <div className="flex flex-col gap-[var(--space-3)] md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Horarios Especiales</h3>
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
            Abre la agenda en un día específico (ej. un Domingo, o un feriado) sin modificar la disponibilidad semanal habitual.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setIsOpen(true)}>
          <Plus className="h-4 w-4" />
          Añadir Horario Especial
        </Button>
      </div>

      {query.isLoading ? <LoadingState message="Cargando horarios especiales..." /> : null}
      {query.isError ? <ErrorState message={query.error.message} /> : null}

      {!query.isLoading && query.data ? (
        query.data.length ? (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
            <table className="w-full min-w-[480px] md:min-w-full border-collapse bg-[var(--bg-surface)] text-[var(--text-sm)]">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-hover)]">
                  <th className="px-[var(--space-3)] py-[var(--space-3)] text-left font-medium">Fecha</th>
                  <th className="px-[var(--space-3)] py-[var(--space-3)] text-left font-medium">Horario</th>
                  <th className="px-[var(--space-3)] py-[var(--space-3)] text-left font-medium">Box</th>
                  <th className="w-[80px] px-[var(--space-3)] py-[var(--space-3)] text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {query.data.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="px-[var(--space-3)] py-[var(--space-3)]">{schedule.date}</td>
                    <td className="px-[var(--space-3)] py-[var(--space-3)]">
                      {schedule.startTime} - {schedule.endTime}
                    </td>
                    <td className="px-[var(--space-3)] py-[var(--space-3)]">{schedule.chair?.name || "Sin Box"}</td>
                    <td className="px-[var(--space-3)] py-[var(--space-3)] text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] p-0"
                        onClick={() => handleDeactivate(schedule.id)}
                        disabled={deactivateMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin horarios especiales" description="No se han registrado horarios especiales para este profesional." />
        )
      ) : null}

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Añadir Horario Especial">
        <form onSubmit={handleCreate} className="space-y-[var(--space-4)]">
          <div className="space-y-[var(--space-2)]">
            <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Fecha</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-[var(--space-4)]">
            <div className="space-y-[var(--space-2)]">
              <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Hora Inicio</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-[var(--space-2)]">
              <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Hora Fin</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-[var(--space-2)]">
            <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Box asignado (Opcional)</label>
            <Select value={chairId} onChange={(e) => setChairId(e.target.value)}>
              <option value="">(Sin asignar)</option>
              {chairs.map((chair) => (
                <option key={chair.id} value={chair.id}>
                  {chair.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-[var(--space-3)] pt-[var(--space-4)]">
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
