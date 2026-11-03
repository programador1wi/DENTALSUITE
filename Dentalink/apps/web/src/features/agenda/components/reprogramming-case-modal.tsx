import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, Loader2, Phone, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { useChairs } from "@/features/settings/chairs/hooks/use-chairs";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import {
  useDefinitivelyCancelReprogrammingCase,
  useReprogrammingAvailability,
  useRescheduleAppointmentCase
} from "../hooks/use-appointment-reprogramming";
import type { ReprogrammingCase } from "../services/appointment-reprogramming.service";

export function ReprogrammingCaseModal({
  item,
  open,
  branches,
  professionals,
  onClose
}: {
  item: ReprogrammingCase | null;
  open: boolean;
  branches: Branch[];
  professionals: Professional[];
  onClose: () => void;
}) {
  const { hasPermission } = usePermissions();
  const [mode, setMode] = useState<"reschedule" | "cancel">("reschedule");
  const [branchId, setBranchId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [chairId, setChairId] = useState("");
  const [date, setDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [selectedSlot, setSelectedSlot] = useState<{ startAt: string; endAt: string } | null>(null);
  const [initialStatus, setInitialStatus] = useState<"SCHEDULED" | "PENDING_CONFIRMATION" | "CONFIRMED">("SCHEDULED");
  const [notes, setNotes] = useState("");
  const [notifyPatient, setNotifyPatient] = useState(true);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelObservation, setCancelObservation] = useState("");
  const chairs = useChairs(undefined, "true", branchId || undefined);
  const rescheduleMutation = useRescheduleAppointmentCase();
  const cancelMutation = useDefinitivelyCancelReprogrammingCase();
  const timezone = item?.branch.timezone || "America/Mexico_City";
  const canChangeBranch = hasPermission("agenda.reprogramming.change_branch");
  const canChangeProfessional = hasPermission("agenda.reprogramming.change_professional");
  const canDefinitivelyCancel = hasPermission("agenda.reprogramming.definitive_cancel");

  useEffect(() => {
    if (!open || !item) return;
    setMode("reschedule");
    setBranchId(item.branchId);
    setProfessionalId(item.originalProfessionalId);
    setChairId(item.originalBoxId ?? "");
    setDate(nextSuggestedDate(item.originalStartAt, timezone));
    setDurationMinutes(item.originalDurationMinutes);
    setSelectedSlot(null);
    setInitialStatus("SCHEDULED");
    setNotes(item.originalAppointment.notes ?? "");
    setNotifyPatient(Boolean(item.originalAppointment.patient?.email || item.originalAppointment.patient?.phone));
    setCancelReason("");
    setCancelObservation("");
  }, [item, open, timezone]);

  useEffect(() => setSelectedSlot(null), [branchId, professionalId, chairId, date, durationMinutes]);

  const availableProfessionals = useMemo(
    () =>
      professionals.filter(
        (professional) => !branchId || professional.branches.some((branch) => branch.id === branchId)
      ),
    [branchId, professionals]
  );
  const availability = useReprogrammingAvailability({
    branchId,
    professionalId,
    chairId: chairId || undefined,
    date,
    durationMinutes: String(durationMinutes)
  });
  const slots = (availability.data?.slots ?? []).filter((slot) => slot.available);

  if (!item) return null;

  const submitReschedule = async () => {
    if (!selectedSlot) return;
    await rescheduleMutation.mutateAsync({
      caseId: item.id,
      payload: {
        version: item.version,
        branchId,
        professionalId,
        chairId: chairId || undefined,
        durationMinutes,
        initialStatus,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        notes: notes.trim() || undefined,
        notifyPatient
      }
    });
    onClose();
  };

  const submitDefinitiveCancellation = async () => {
    await cancelMutation.mutateAsync({
      caseId: item.id,
      payload: {
        version: item.version,
        reason: cancelReason,
        observation: cancelObservation.trim() || undefined
      }
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "reschedule" ? "Reprogramar cita" : "Cancelar definitivamente"}
      size="2xl"
    >
      {mode === "reschedule" ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Cita original</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-brand-strong)]">
                {patientName(item)}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <Phone className="h-3.5 w-3.5" />
                {item.originalAppointment.patient?.phone || "Sin teléfono"}
              </div>
            </div>
            <Detail
              icon={<CalendarClock className="h-4 w-4" />}
              label="Fecha y horario original"
              value={`${formatDate(item.originalStartAt, timezone)} · ${formatTime(item.originalStartAt, timezone)}–${formatTime(item.originalEndAt, timezone)}`}
            />
            <Detail
              icon={<Stethoscope className="h-4 w-4" />}
              label="Profesional y box"
              value={`${professionalName(item.originalProfessional)} · ${item.originalAppointment.chair?.name || "Sin box"}`}
            />
            <Detail label="Motivo de atención" value={item.originalAttentionReason || "Sin motivo"} />
            <Detail label="Motivo de reprogramación" value={item.reasonText} />
            <Detail
              label="Situación administrativa"
              value={
                item.financialSituation
                  ? `${item.financialSituation.label}${item.financialSituation.amount ? ` · ${item.financialSituation.currency} ${item.financialSituation.amount}` : ""}`
                  : "Sin información visible"
              }
            />
            {item.originalAppointment.appointmentNotes.length ? (
              <div>
                <div className="text-xs font-semibold text-[var(--text-secondary)]">Observaciones</div>
                <div className="mt-1 max-h-24 space-y-1 overflow-auto text-sm">
                  {item.originalAppointment.appointmentNotes.map((note) => (
                    <p key={note.id} className="rounded-md bg-white p-2">{note.note}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nueva sucursal">
                <Select
                  value={branchId}
                  disabled={!canChangeBranch}
                  onChange={(event) => {
                    setBranchId(event.target.value);
                    setProfessionalId("");
                    setChairId("");
                  }}
                >
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </Field>
              <Field label="Nuevo profesional">
                <Select
                  value={professionalId}
                  disabled={!canChangeProfessional}
                  onChange={(event) => setProfessionalId(event.target.value)}
                >
                  <option value="">Selecciona profesional</option>
                  {availableProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professionalName(professional)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nueva fecha">
                <Input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              <Field label="Duración">
                <Select
                  value={String(durationMinutes)}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                >
                  {[15, 20, 30, 40, 45, 60, 90, 120].map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} minutos</option>
                  ))}
                </Select>
              </Field>
              <Field label="Box o sillón">
                <Select value={chairId} onChange={(event) => setChairId(event.target.value)}>
                  <option value="">Asignación automática</option>
                  {(chairs.data ?? []).map((chair) => <option key={chair.id} value={chair.id}>{chair.name}</option>)}
                </Select>
              </Field>
              <Field label="Estado inicial">
                <Select
                  value={initialStatus}
                  onChange={(event) => setInitialStatus(event.target.value as typeof initialStatus)}
                >
                  <option value="SCHEDULED">Agendada</option>
                  <option value="PENDING_CONFIRMATION">Pendiente de confirmación</option>
                  <option value="CONFIRMED">Confirmada</option>
                </Select>
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Horario disponible</span>
                {availability.isFetching ? <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" /> : null}
              </div>
              <div className="max-h-40 overflow-auto rounded-lg border border-[var(--border-default)] p-3">
                {slots.length ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {slots.map((slot) => {
                      const active = selectedSlot?.startAt === slot.startAt;
                      return (
                        <button
                          type="button"
                          key={`${slot.startAt}-${slot.chairIndex}`}
                          onClick={() => setSelectedSlot({ startAt: slot.startAt, endAt: slot.endAt })}
                          className={`rounded-md border px-2 py-2 text-sm font-semibold transition ${
                            active
                              ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]"
                              : "border-[var(--border-default)] hover:border-[var(--border-brand)] hover:bg-[var(--bg-subtle)]"
                          }`}
                        >
                          {formatTime(slot.startAt, timezone)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-5 text-center text-sm text-[var(--text-secondary)]">
                    {availability.isFetching ? "Consultando disponibilidad…" : "No hay horarios disponibles con estos criterios."}
                  </p>
                )}
              </div>
            </div>

            <Field label="Observaciones">
              <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
            <label className="flex items-start gap-2 rounded-lg border border-[var(--border-default)] p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={notifyPatient}
                onChange={(event) => setNotifyPatient(event.target.checked)}
              />
              <span>
                <strong>Notificar al paciente</strong>
                <span className="block text-xs text-[var(--text-secondary)]">
                  La cita se confirma aunque el proveedor de mensajería falle; la notificación queda pendiente para reintento.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--border-default)] pt-4">
              {canDefinitivelyCancel ? (
                <Button variant="danger" onClick={() => setMode("cancel")}>
                  Cancelar definitivamente
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>Cerrar</Button>
                <Button
                  onClick={() => void submitReschedule()}
                  disabled={!selectedSlot || rescheduleMutation.isPending}
                >
                  {rescheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirmar nueva cita
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              Esta acción cierra el caso sin crear una nueva cita. La cita original seguirá anulada por
              reprogramación y todo el historial permanecerá disponible.
            </p>
          </div>
          <Field label="Motivo obligatorio">
            <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </Field>
          <Field label="Observación">
            <Textarea
              rows={4}
              value={cancelObservation}
              onChange={(event) => setCancelObservation(event.target.value)}
            />
          </Field>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setMode("reschedule")}>Volver</Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              onClick={() => void submitDefinitiveCancellation()}
            >
              {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar cancelación definitiva
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5 text-sm font-medium text-[var(--text-primary)]"><span>{label}</span>{children}</label>;
}

function Detail({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">{icon}{label}</div>
      <div className="mt-1 text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function patientName(item: ReprogrammingCase) {
  const patient = item.originalAppointment.patient;
  return patient ? `${patient.firstName} ${patient.lastName}` : "Paciente no asignado";
}

function professionalName(professional: { firstName: string; lastName: string }) {
  return `${professional.firstName} ${professional.lastName}`.trim();
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: timezone }).format(new Date(value));
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone
  }).format(new Date(value));
}

function nextSuggestedDate(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
