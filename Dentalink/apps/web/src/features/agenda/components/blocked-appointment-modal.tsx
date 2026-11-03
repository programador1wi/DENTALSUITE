import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type BlockedAppointmentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; durationMinutes: number; notes: string }) => void;
  defaultDuration: number;
};

const BLOCK_REASONS = [
  { value: "Bloqueo Administrativo", label: "Bloqueo Administrativo" },
  { value: "Reunión", label: "Reunión" },
  { value: "Asunto Personal", label: "Asunto Personal" },
  { value: "Capacitación", label: "Capacitación" },
  { value: "Comida / Receso", label: "Comida / Receso" },
  { value: "Mantenimiento", label: "Mantenimiento" }
];

export function BlockedAppointmentModal({
  open,
  onClose,
  onSubmit,
  defaultDuration
}: BlockedAppointmentModalProps) {
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(defaultDuration);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setDurationMinutes(defaultDuration);
      setNotes("");
    }
  }, [open, defaultDuration]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      reason: reason || "Bloqueo de agenda",
      durationMinutes,
      notes
    });
  };

  return (
    <Modal open={open} title="Bloquear espacio" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        <div className="space-y-4">
          {/* Motivo de la atención */}
          <div className="space-y-1.5 text-center">
            <label className="text-sm font-bold text-slate-700 block">
              Motivo de la atención
            </label>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="text-center"
            >
              <option value="">Seleccione un motivo</option>
              {BLOCK_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Duración */}
          <div className="space-y-1.5 text-center">
            <label className="text-sm font-bold text-slate-700 block">
              Duración
            </label>
            <Select
              value={String(durationMinutes)}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="text-center"
            >
              <option value="10">10 minutos</option>
              <option value="20">20 minutos</option>
              <option value="30">30 minutos</option>
              <option value="40">40 minutos</option>
              <option value="50">50 minutos</option>
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
              <option value="120">120 minutos</option>
            </Select>
          </div>

          {/* Comentario... */}
          <div className="space-y-1.5">
            <Textarea
              placeholder="Comentario..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="px-5 py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md font-medium text-xs shadow-sm"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="px-5 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md font-medium text-xs shadow-sm border border-red-600"
          >
            Bloquear
          </Button>
        </div>
      </form>
    </Modal>
  );
}
