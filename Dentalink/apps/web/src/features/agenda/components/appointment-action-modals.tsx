import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment, AppointmentNote, AppointmentPayload, AppointmentReminderPayload, AppointmentStatus } from "../services/appointments.service";
import { getAppointment } from "../services/appointments.service";
import { useAppointmentNotes } from "../hooks/use-appointments";
import { getDirectAppointmentStatusOptions } from "../utils/appointment-status-flow";
import { appointmentStatusLabel, translateReason } from "./appointment-status";

export type AppointmentEmailMode = "dataRequest" | "notification";

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
      toast.error("Ingresa una duración válida");
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
    } catch {
      // The mutation hook surfaces the backend validation error and the modal stays open.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} title="Modificar duración" onClose={onClose}>
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
  anchorRect,
  onClose,
  onConfirm
}: {
  appointment: Appointment | null;
  anchorRect?: Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width" | "height"> | null;
  onClose: () => void;
  onConfirm: (id: string, comment: string) => Promise<void>;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextComment = comment.trim();
  const comments = useAppointmentNotes(appointment?.id ?? "", Boolean(appointment));
  const legacyComment = useMemo(() => buildLegacyAppointmentComment(appointment), [appointment]);
  const historicalComments = useMemo(
    () => [legacyComment, ...(comments.data ?? [])].filter(Boolean) as AppointmentCommentHistoryItem[],
    [comments.data, legacyComment]
  );

  useEffect(() => {
    if (!appointment) return;
    setComment("");
  }, [appointment]);

  useEffect(() => {
    if (!appointment) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, { capture: true });

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, { capture: true });
    };
  }, [appointment, onClose]);

  const confirm = async () => {
    if (!appointment || !nextComment) return;

    setSubmitting(true);
    try {
      await onConfirm(appointment.id, nextComment);
      setComment("");
      await comments.refetch();
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment || typeof document === "undefined") return null;

  const position = resolveCommentPopoverPosition(anchorRect);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="appointment-comment-title"
      className="fixed z-[1100] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)] ring-1 ring-black/[0.04] animate-in fade-in-0 zoom-in-95"
      style={{ top: position.top, left: position.left }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-4)] py-[var(--space-3)]">
        <h3 id="appointment-comment-title" className="text-[var(--text-base)] font-semibold text-[var(--text-primary)]">
          Comentario
        </h3>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <div className="space-y-3 px-[var(--space-4)] py-[var(--space-3)]">
        <Textarea
          rows={3}
          placeholder="Ingrese un nuevo comentario"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <div className="max-h-44 space-y-2 overflow-y-auto border-y border-[var(--border-default)] py-[var(--space-2)]">
          {comments.isLoading ? (
            <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">Cargando comentarios...</p>
          ) : comments.isError ? (
            <p className="text-[var(--text-xs)] text-[var(--text-danger)]">
              {comments.error instanceof Error ? comments.error.message : "No se pudo cargar el historial de comentarios"}
            </p>
          ) : historicalComments.length ? (
            historicalComments.map((item) => (
              <div key={item.id} className="flex gap-2 rounded-[var(--radius-sm)] px-[var(--space-1)] py-[var(--space-1)]">
                <span className="mt-0.5 text-[var(--text-secondary)]">
                  <MessageSquare className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                  {formatUser(item.user)} - {formatDateTime(item.createdAt)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[var(--text-sm)] text-[var(--text-primary)]">{item.note}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-[var(--text-xs)] text-[var(--text-secondary)]">Sin comentarios registrados.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-[var(--space-3)]">
          <Button variant="secondary" onClick={onClose} type="button">Cerrar</Button>
          <Button disabled={submitting || !nextComment} onClick={() => void confirm()}>
            {submitting ? "Agregando..." : "Agregar"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

type AppointmentCommentHistoryItem = Pick<AppointmentNote, "id" | "note" | "createdAt" | "user">;

function buildLegacyAppointmentComment(appointment: Appointment | null): AppointmentCommentHistoryItem | null {
  const note = appointment?.notes?.trim();
  if (!appointment || !note) return null;

  return {
    id: `${appointment.id}-initial-comment`,
    note,
    createdAt: appointment.createdAt ?? appointment.updatedAt ?? appointment.startAt,
    user: appointment.createdBy ?? null
  };
}

function resolveCommentPopoverPosition(anchorRect?: Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width" | "height"> | null) {
  const popoverWidth = Math.min(420, Math.max(320, window.innerWidth - 24));
  const estimatedHeight = 320;
  const margin = 12;

  if (!anchorRect) {
    return {
      top: Math.max(margin, (window.innerHeight - estimatedHeight) / 2),
      left: Math.max(margin, (window.innerWidth - popoverWidth) / 2)
    };
  }

  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  const opensUp = anchorRect.bottom + estimatedHeight + margin > window.innerHeight && anchorRect.top > estimatedHeight;
  const top = opensUp ? anchorRect.top - estimatedHeight - 8 : anchorRect.bottom + 8;
  const left = Math.min(
    window.innerWidth - popoverWidth - margin,
    Math.max(margin, anchorCenter - popoverWidth / 2)
  );

  return {
    top: Math.max(margin, top),
    left
  };
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
  const statusOptions = useMemo(
    () => (appointment ? getDirectAppointmentStatusOptions(appointment.status) : []),
    [appointment?.status]
  );

  useEffect(() => {
    if (!appointment) return;
    setStatus(statusOptions[0]?.nextStatus ?? appointment.status);
  }, [appointment, statusOptions]);

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
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
          Estado actual: <span className="font-semibold text-[var(--text-primary)]">{appointment ? appointmentStatusLabel(appointment.status) : ""}</span>
        </div>
        {statusOptions.length ? (
          <Select value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus)}>
            {statusOptions.map((option) => (
              <option key={`${option.action}-${option.nextStatus}`} value={option.nextStatus}>{option.label}</option>
            ))}
          </Select>
        ) : (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-4)] text-center text-[var(--text-sm)] text-[var(--text-secondary)]">
            Este estado no tiene cambios directos disponibles.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cerrar</Button>
          <Button disabled={submitting || !statusOptions.length || status === appointment?.status} onClick={() => void confirm()}>
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
  onClose,
  onScheduleReminder
}: {
  appointment: Appointment | null;
  mode: AppointmentEmailMode;
  onClose: () => void;
  onScheduleReminder?: (id: string, payload: AppointmentReminderPayload) => Promise<void>;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<AppointmentReminderPayload["channel"]>("EMAIL");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    const patientName = appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "paciente";
    const dataLink = appointment.patientId ? `${window.location.origin}/patients/${appointment.patientId}/profile` : "";
    const appointmentDate = formatDateTime(appointment.startAt);

    setTo(appointment.patient?.email ?? "");
    setSubject(mode === "dataRequest" ? "Solicitud de actualización de datos" : "Recordatorio de cita");
    setBody(
      mode === "dataRequest"
        ? `Hola ${patientName},\n\nPor favor actualiza o confirma tus datos en este enlace:\n${dataLink}\n\nGracias.`
        : `Hola ${patientName},\n\nTe recordamos tu cita: ${appointmentDate}.\n\nGracias.`
    );
    setChannel(mode === "notification" ? "WHATSAPP" : "EMAIL");
    setScheduledAt(defaultReminderLocalInput(appointment.startAt));
  }, [appointment, mode]);

  const send = () => {
    const href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    toast.success("Correo listo para enviar");
    onClose();
  };

  const scheduleReminder = async () => {
    if (!appointment || !onScheduleReminder || !scheduledAt) return;

    setScheduling(true);
    try {
      await onScheduleReminder(appointment.id, {
        channel,
        scheduledAt: new Date(scheduledAt).toISOString(),
        status: "PENDING"
      });
      onClose();
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Modal open={Boolean(appointment)} title={mode === "dataRequest" ? "Solicitud de datos" : "Notificar por email"} onClose={onClose} size="lg">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Destinatario</label>
              <Input 
                type="email"
                placeholder="ejemplo@correo.com" 
                value={to} 
                onChange={(event) => setTo(event.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Asunto</label>
              <Input 
                placeholder="Asunto del correo" 
                value={subject} 
                onChange={(event) => setSubject(event.target.value)} 
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Mensaje</label>
            <Textarea 
              rows={5} 
              className="resize-none"
              placeholder="Escribe el mensaje aquí..." 
              value={body} 
              onChange={(event) => setBody(event.target.value)} 
            />
          </div>
        </div>
        
        <div className="grid gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Canal del recordatorio
            </label>
            <Select value={channel} onChange={(event) => setChannel(event.target.value as AppointmentReminderPayload["channel"])}>
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PHONE">Teléfono</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[var(--text-xs)] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Programar para
            </label>
            <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="secondary" onClick={onClose} type="button" className="w-full sm:w-auto">
            Cancelar
          </Button>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-none"
              disabled={!appointment || !onScheduleReminder || !scheduledAt || scheduling}
              onClick={() => void scheduleReminder()}
              type="button"
            >
              {scheduling ? "Registrando..." : "Programar"}
            </Button>
            <Button 
              className="flex-1 sm:flex-none"
              disabled={!subject.trim() || !body.trim()} 
              onClick={send}
            >
              Enviar ahora
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function AppointmentHistoryModal({
  appointment,
  onClose,
  onUpdateReminderStatus
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onUpdateReminderStatus?: (appointmentId: string, reminderId: string, status: "SENT" | "CANCELLED") => Promise<void>;
}) {
  const appointmentId = appointment?.id ?? "";
  const [updatingReminderId, setUpdatingReminderId] = useState("");
  const detail = useQuery({
    queryKey: ["appointment-history", appointmentId],
    queryFn: () => getAppointment(appointmentId),
    enabled: Boolean(appointmentId)
  });
  const history = detail.data?.statusHistory ?? [];
  const notes = detail.data?.appointmentNotes ?? [];
  const reminders = detail.data?.reminders ?? [];

  const updateReminderStatus = async (reminderId: string, status: "SENT" | "CANCELLED") => {
    if (!appointmentId || !onUpdateReminderStatus) return;
    setUpdatingReminderId(reminderId);
    try {
      await onUpdateReminderStatus(appointmentId, reminderId, status);
      await detail.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el recordatorio");
    } finally {
      setUpdatingReminderId("");
    }
  };

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
                      {item.reason ? ` - ${translateReason(item.reason)}` : ""}
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

            {reminders.length ? (
              <div className="border-t border-[var(--border-default)] pt-3">
                <h4 className="mb-2 text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">Recordatorios</h4>
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {reminders.map((reminder) => (
                    <div key={reminder.id} className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] text-[var(--text-secondary)]">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {reminderChannelLabel(reminder.channel)} - {reminderStatusLabel(reminder.status)}
                      </p>
                      <p>Programado: {formatDateTime(reminder.scheduledAt)}</p>
                      {reminder.sentAt ? <p>Enviado: {formatDateTime(reminder.sentAt)}</p> : null}
                      {reminder.errorMessage ? <p className="text-[var(--text-danger)]">{reminder.errorMessage}</p> : null}
                      {onUpdateReminderStatus && reminder.status === "PENDING" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updatingReminderId === reminder.id}
                            onClick={() => void updateReminderStatus(reminder.id, "SENT")}
                          >
                            Marcar enviado
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={updatingReminderId === reminder.id}
                            onClick={() => void updateReminderStatus(reminder.id, "CANCELLED")}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : null}
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

function defaultReminderLocalInput(appointmentStartAt: string) {
  const appointmentDate = new Date(appointmentStartAt);
  const now = new Date();
  const reminderDate = new Date(appointmentDate.getTime() - 24 * 60 * 60000);
  return toLocalInput(reminderDate > now ? reminderDate.toISOString() : now.toISOString());
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function reminderChannelLabel(channel: string) {
  const labels: Record<string, string> = {
    EMAIL: "Email",
    WHATSAPP: "WhatsApp",
    PHONE: "Teléfono"
  };
  return labels[channel] ?? channel;
}

function reminderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendiente",
    SENT: "Enviado",
    FAILED: "Fallido",
    CANCELLED: "Cancelado"
  };
  return labels[status] ?? status;
}
