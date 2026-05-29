import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment, AppointmentPayload, AppointmentStatus } from "../services/appointments.service";
import { getAppointment } from "../services/appointments.service";
import { appointmentStatusLabel } from "./appointment-status";

export type AppointmentEmailMode = "dataRequest" | "notification";

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "SCHEDULED", label: "Agendada" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "PENDING_CONFIRMATION", label: "Por confirmar" },
  { value: "ARRIVED", label: "Llego a clinica" },
  { value: "WAITING_ROOM", label: "Sala de espera" },
  { value: "IN_PROGRESS", label: "En atencion" },
  { value: "COMPLETED", label: "Atendida" },
  { value: "RESCHEDULED", label: "Reagendada" },
  { value: "NO_SHOW", label: "No asistio" },
  { value: "CANCELLED_BY_PATIENT", label: "Cancelada por paciente" },
  { value: "CANCELLED_BY_CLINIC", label: "Cancelada por clinica" },
  { value: "BLOCKED", label: "Bloqueada" }
];

export function AppointmentDurationModal({
  appointment,
  onClose,
  onConfirm
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (id: string, payload: Partial<AppointmentPayload>) => Promise<void>;
}) {
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setDurationMinutes(String(appointment.durationMinutes || diffMinutes(appointment.startAt, appointment.endAt)));
  }, [appointment]);

  const confirm = async () => {
    if (!appointment) return;
    const minutes = Number(durationMinutes);
    if (!Number.isInteger(minutes) || minutes < 5) {
      toast.error("Ingresa una duracion valida");
      return;
    }

    const startAt = new Date(appointment.startAt);
    const endAt = new Date(startAt.getTime() + minutes * 60000);

    setSubmitting(true);
    try {
      await onConfirm(appointment.id, {
        startAt: appointment.startAt,
        endAt: endAt.toISOString(),
        durationMinutes: minutes
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} title="Modificar duracion" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{appointment?.title}</span>
          <span className="block">{appointment ? formatDateTime(appointment.startAt) : ""}</span>
        </div>
        <Input
          min={5}
          step={5}
          type="number"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
          placeholder="Minutos"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cerrar</Button>
          <Button disabled={submitting || !durationMinutes} onClick={() => void confirm()}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AppointmentCommentModal({
  appointment,
  onClose,
  onConfirm
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (id: string, payload: Partial<AppointmentPayload>) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setComment("");
  }, [appointment]);

  const confirm = async () => {
    if (!appointment || !comment.trim()) return;
    const prefix = formatDateTime(new Date().toISOString());
    const nextNotes = appointment.notes?.trim()
      ? `${appointment.notes.trim()}\n\n${prefix} - ${comment.trim()}`
      : `${prefix} - ${comment.trim()}`;

    setSubmitting(true);
    try {
      await onConfirm(appointment.id, { notes: nextNotes });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} title="Agregar comentario" onClose={onClose}>
      <div className="space-y-3">
        {appointment?.notes ? (
          <div className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
            {appointment.notes}
          </div>
        ) : null}
        <Textarea rows={4} placeholder="Comentario" value={comment} onChange={(event) => setComment(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cerrar</Button>
          <Button disabled={submitting || !comment.trim()} onClick={() => void confirm()}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AppointmentStatusModal({
  appointment,
  onClose,
  onConfirm
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (id: string, status: AppointmentStatus) => Promise<void>;
}) {
  const [status, setStatus] = useState<AppointmentStatus>("SCHEDULED");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setStatus(appointment.status);
  }, [appointment]);

  const confirm = async () => {
    if (!appointment) return;
    setSubmitting(true);
    try {
      await onConfirm(appointment.id, status);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} title="Cambiar estado" onClose={onClose}>
      <div className="space-y-3">
        <Select value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cerrar</Button>
          <Button disabled={submitting || status === appointment?.status} onClick={() => void confirm()}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AppointmentEmailModal({
  appointment,
  mode,
  onClose
}: {
  appointment: Appointment | null;
  mode: AppointmentEmailMode;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!appointment) return;
    const patientName = appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "paciente";
    const dataLink = appointment.patientId ? `${window.location.origin}/patients/${appointment.patientId}/profile` : "";
    const appointmentDate = formatDateTime(appointment.startAt);

    setTo(appointment.patient?.email ?? "");
    setSubject(mode === "dataRequest" ? "Solicitud de actualizacion de datos" : "Recordatorio de cita");
    setBody(
      mode === "dataRequest"
        ? `Hola ${patientName},\n\nPor favor actualiza o confirma tus datos en este enlace:\n${dataLink}\n\nGracias.`
        : `Hola ${patientName},\n\nTe recordamos tu cita: ${appointmentDate}.\n\nGracias.`
    );
  }, [appointment, mode]);

  const send = () => {
    const href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    toast.success("Correo listo para enviar");
    onClose();
  };

  return (
    <Modal open={Boolean(appointment)} title={mode === "dataRequest" ? "Solicitud de datos" : "Notificar por e-mail"} onClose={onClose}>
      <div className="space-y-3">
        <Input placeholder="Correo destinatario" value={to} onChange={(event) => setTo(event.target.value)} />
        <Input placeholder="Asunto" value={subject} onChange={(event) => setSubject(event.target.value)} />
        <Textarea rows={6} placeholder="Mensaje" value={body} onChange={(event) => setBody(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cerrar</Button>
          <Button disabled={!subject.trim() || !body.trim()} onClick={send}>Abrir correo</Button>
        </div>
      </div>
    </Modal>
  );
}

export function AppointmentHistoryModal({
  appointment,
  onClose
}: {
  appointment: Appointment | null;
  onClose: () => void;
}) {
  const appointmentId = appointment?.id ?? "";
  const detail = useQuery({
    queryKey: ["appointment-history", appointmentId],
    queryFn: () => getAppointment(appointmentId),
    enabled: Boolean(appointmentId)
  });
  const history = detail.data?.statusHistory ?? [];
  const notes = detail.data?.appointmentNotes ?? [];

  return (
    <Modal open={Boolean(appointment)} title="Ver historial de cambios" size="lg" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{appointment?.title}</span>
          <span className="block">{appointment ? formatDateTime(appointment.startAt) : ""}</span>
        </div>

        {detail.isLoading ? (
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Cargando historial...</p>
        ) : detail.isError ? (
          <p className="text-[var(--text-sm)] text-[var(--text-danger)]">
            {detail.error instanceof Error ? detail.error.message : "No se pudo cargar el historial"}
          </p>
        ) : (
          <>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {history.length ? (
                history.map((item) => (
                  <div key={item.id} className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-[var(--space-3)] py-[var(--space-2)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
                        {item.previousStatus ? appointmentStatusLabel(item.previousStatus) : "Creada"}{" -> "}{appointmentStatusLabel(item.newStatus)}
                      </p>
                      <span className="text-[var(--text-xs)] text-[var(--text-secondary)]">{formatDateTime(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">
                      {formatUser(item.changedBy)}
                      {item.reason ? ` - ${item.reason}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-4)] text-center text-[var(--text-sm)] text-[var(--text-secondary)]">
                  No hay cambios registrados.
                </p>
              )}
            </div>

            {notes.length ? (
              <div className="border-t border-[var(--border-default)] pt-3">
                <h4 className="mb-2 text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">Comentarios</h4>
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
                      <p className="whitespace-pre-wrap text-[var(--text-primary)]">{note.note}</p>
                      <p className="mt-1">{formatUser(note.user)} - {formatDateTime(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

function diffMinutes(startAt: string, endAt: string) {
  return Math.max(5, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatUser(user?: { firstName: string; lastName: string } | null) {
  if (!user) return "Sistema";
  return `${user.firstName} ${user.lastName}`;
}
