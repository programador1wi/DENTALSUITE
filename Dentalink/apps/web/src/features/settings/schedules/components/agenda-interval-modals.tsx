import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface Professional {
  id: string;
  firstName: string;
  lastName: string;
  branchName: string;
  agendaSlotMinutes: number | null;
  defaultAppointmentDurationMinutes: number | null;
}

interface AgendaIntervalModalsProps {
  open: boolean;
  onClose: () => void;
  professional: Professional;
  onSave: (payload: {
    agendaSlotMinutes: number | null;
    defaultAppointmentDurationMinutes: number | null;
  }) => Promise<void>;
  isPending: boolean;
}

const slotOptions = [10, 15, 20, 30, 60];

export function AgendaIntervalModals({ open, onClose, professional, onSave, isPending }: AgendaIntervalModalsProps) {
  const [step, setStep] = useState<"view" | "edit">("view");
  const [slotMinutes, setSlotMinutes] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const slot = professional.agendaSlotMinutes ?? 30;
    setStep("view");
    setSlotMinutes(String(slot));
    setDurationMinutes(String(professional.defaultAppointmentDurationMinutes ?? slot));
  }, [open, professional]);

  useEffect(() => {
    const slot = Number(slotMinutes);
    const duration = Number(durationMinutes);
    if (!slot || !duration || duration % slot === 0) return;
    setDurationMinutes(String(slot));
  }, [durationMinutes, slotMinutes]);

  const handleSave = async () => {
    const nextSlot = slotMinutes ? Number(slotMinutes) : null;
    const nextDuration = durationMinutes ? Number(durationMinutes) : null;
    if (nextSlot && nextDuration && nextDuration % nextSlot !== 0) return;

    await onSave({
      agendaSlotMinutes: nextSlot,
      defaultAppointmentDurationMinutes: nextDuration
    });
    setStep("view");
  };

  const doctorName = `Dr(a). ${professional.firstName} ${professional.lastName}`;
  const currentSlot = professional.agendaSlotMinutes ?? 30;

  if (step === "view") {
    return (
      <Modal open={open} title="Intervalo de atencion" size="md" onClose={onClose}>
        <div className="space-y-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-[var(--space-3)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-lg)] font-bold text-[var(--text-brand-strong)]">
              {professional.firstName[0]}
            </div>
            <div>
              <p className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{doctorName}</p>
              <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                {professional.branchName} · Intervalo actual: {currentSlot} minutos
              </p>
            </div>
          </div>

          <div className="space-y-[var(--space-2)] text-[var(--text-sm)] leading-relaxed text-[var(--text-primary)]">
            <p className="font-medium">
              El intervalo de atencion es la base de la agenda de este profesional en esta sucursal.
            </p>
            <p className="text-[var(--text-secondary)]">
              El intervalo tambien define las duraciones validas. Por ejemplo, con 15 minutos se permiten citas de 15, 30, 45, 60 minutos, etc.
            </p>
          </div>

          <div className="flex flex-col gap-[var(--space-2)] border-t border-[var(--border-default)] pt-[var(--space-2)] sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep("edit")}
              className="text-left text-[var(--text-sm)] font-semibold text-[var(--text-brand-strong)] hover:underline"
            >
              Cambiar intervalo para esta sucursal
            </button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} title="Editar intervalo de atencion" size="md" onClose={() => setStep("view")}>
      <div className="space-y-[var(--space-4)]">
        <div className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-[var(--space-3)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-lg)] font-bold text-[var(--text-brand-strong)]">
            {professional.firstName[0]}
          </div>
          <div>
            <p className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{doctorName}</p>
            <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
              Configurar granularidad para {professional.branchName}
            </p>
          </div>
        </div>

        <div className="space-y-[var(--space-3)]">
          <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            Intervalo de atencion
            <Select value={slotMinutes} onChange={(event) => setSlotMinutes(event.target.value)}>
              {slotOptions.map((minutes) => (
                <option key={minutes} value={String(minutes)}>
                  {minutes} minutos
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-[var(--space-1)] text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            Duracion default de cita
            <Select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)}>
              {buildDurationOptions(Number(slotMinutes)).map((minutes) => (
                <option key={minutes} value={String(minutes)}>
                  {minutes} minutos
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="flex justify-end gap-[var(--space-2)] border-t border-[var(--border-default)] pt-[var(--space-2)]">
          <Button type="button" variant="secondary" onClick={() => setStep("view")} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Guardando..." : "Continuar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function buildDurationOptions(slotMinutes: number) {
  if (!slotMinutes) return [30, 60, 90, 120];
  return Array.from({ length: Math.floor(240 / slotMinutes) }, (_, index) => (index + 1) * slotMinutes);
}
