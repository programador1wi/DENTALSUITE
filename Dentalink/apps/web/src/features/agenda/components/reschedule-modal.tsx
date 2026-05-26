import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment } from "../services/appointments.service";

export function RescheduleModal({
  appointment,
  onClose,
  onConfirm
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (id: string, startAt: string, endAt: string, reason?: string) => Promise<void>;
}) {
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setStartAt(toLocalInput(appointment.startAt));
    setEndAt(toLocalInput(appointment.endAt));
    setReason("");
  }, [appointment]);

  const confirm = async () => {
    if (!appointment) return;
    setSubmitting(true);
    try {
      await onConfirm(appointment.id, new Date(startAt).toISOString(), new Date(endAt).toISOString(), reason || undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} title="Reagendar cita" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
          <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
        </div>
        <Textarea rows={2} placeholder="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button disabled={!startAt || !endAt || submitting} onClick={() => void confirm()}>
            {submitting ? "Reagendando..." : "Reagendar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
