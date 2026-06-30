import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment } from "../services/appointments.service";

export function CancelAppointmentModal({
  appointment,
  cancelledBy = "clinic",
  onClose,
  onConfirm
}: {
  appointment: Appointment | null;
  cancelledBy?: "patient" | "clinic" | "conflict" | "rescheduled";
  onClose: () => void;
  onConfirm: (id: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!appointment) return;
    setSubmitting(true);
    try {
      await onConfirm(appointment.id, reason);
      setReason("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (cancelledBy) {
      case "patient": return "Cancelar por paciente";
      case "conflict": return "Cancelar por conflicto";
      case "rescheduled": return "Anular por reprogramación";
      default: return "Cancelar por clínica";
    }
  };

  return (
    <Modal open={Boolean(appointment)} title={getTitle()} onClose={onClose}>
      <div className="space-y-3">
        <Textarea rows={3} placeholder="Motivo de cancelación" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button variant="danger" disabled={!reason.trim() || submitting} onClick={() => void confirm()}>
            {submitting ? "Cancelando..." : "Cancelar cita"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
