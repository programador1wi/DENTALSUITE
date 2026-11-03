import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import {
  useCreateMassReprogrammingBatch,
  usePreviewMassReprogramming,
  useRetryReprogrammingBatch
} from "../hooks/use-appointment-reprogramming";
import type {
  ReprogrammingBatch,
  ReprogrammingCriteria
} from "../services/appointment-reprogramming.service";

const REASONS = [
  ["PROFESSIONAL_SCHEDULE_CHANGE", "Cambio de horario del profesional"],
  ["AGENDA_INTERVAL_CHANGE", "Cambio de intervalo de agenda"],
  ["SCHEDULE_EXCEPTION", "Excepción o día no laborable"],
  ["BRANCH_CLOSURE", "Cierre temporal de sucursal"],
  ["CHAIR_UNAVAILABLE", "Box o sillón no disponible"],
  ["CAPACITY_CHANGE", "Cambio de capacidad simultánea"],
  ["OTHER", "Otro motivo operativo"]
] as const;

export function MassReprogrammingModal({
  open,
  onClose,
  branches,
  professionals,
  initialBranchId,
  onCompleted
}: {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  professionals: Professional[];
  initialBranchId: string;
  onCompleted: () => void;
}) {
  const [step, setStep] = useState(1);
  const [criteria, setCriteria] = useState<ReprogrammingCriteria>(() => defaultCriteria(initialBranchId));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<ReprogrammingBatch | null>(null);
  const previewMutation = usePreviewMassReprogramming();
  const createMutation = useCreateMassReprogrammingBatch();
  const retryMutation = useRetryReprogrammingBatch();
  const branchProfessionals = useMemo(
    () =>
      professionals.filter(
        (professional) =>
          !criteria.branchId || professional.branches.some((branch) => branch.id === criteria.branchId)
      ),
    [criteria.branchId, professionals]
  );
  const preview = previewMutation.data;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCriteria(defaultCriteria(initialBranchId));
    setSelected(new Set());
    setBatch(null);
    previewMutation.reset();
    createMutation.reset();
  }, [initialBranchId, open]);

  const close = () => {
    if (createMutation.isPending || retryMutation.isPending) return;
    onClose();
  };

  const runPreview = async () => {
    const result = await previewMutation.mutateAsync(criteria);
    setSelected(new Set(result.appointments.map((appointment) => appointment.id)));
    setStep(2);
  };

  const processBatch = async () => {
    if (!preview) return;
    const result = await createMutation.mutateAsync({
      payload: {
        ...criteria,
        selectedAppointmentIds: [...selected],
        excludedAppointmentIds: preview.appointments
          .map((appointment) => appointment.id)
          .filter((id) => !selected.has(id))
      },
      idempotencyKey: createIdempotencyKey()
    });
    setBatch(result);
    setStep(4);
    onCompleted();
  };

  const retryFailed = async () => {
    if (!batch) return;
    const result = await retryMutation.mutateAsync(batch.id);
    setBatch(result);
    onCompleted();
  };

  const selectedAppointments =
    preview?.appointments.filter((appointment) => selected.has(appointment.id)) ?? [];

  return (
    <Modal open={open} onClose={close} title="Anulación masiva para reprogramación" size="2xl">
      <div className="mb-5 grid grid-cols-4 gap-2">
        {["Configuración", "Vista previa", "Confirmación", "Resultado"].map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const done = number < step;
          return (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                active
                  ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]"
                  : done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-[var(--border-default)] text-[var(--text-secondary)]"
              }`}
            >
              {number}. {label}
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <Alert variant="warning" size="sm">
            Este flujo no elimina ni mueve citas. Las seleccionadas conservarán fecha e historial original y pasarán a la cola de reprogramación.
          </Alert>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sucursal">
              <Select
                value={criteria.branchId}
                onChange={(event) =>
                  setCriteria((current) => ({
                    ...current,
                    branchId: event.target.value,
                    professionalId: ""
                  }))
                }
              >
                <option value="">Selecciona sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Profesional">
              <Select
                value={criteria.professionalId}
                onChange={(event) =>
                  setCriteria((current) => ({ ...current, professionalId: event.target.value }))
                }
              >
                <option value="">Selecciona profesional</option>
                {branchProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.firstName} {professional.lastName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha inicial">
              <Input
                type="date"
                value={criteria.startDate}
                onChange={(event) =>
                  setCriteria((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </Field>
            <Field label="Fecha final">
              <Input
                type="date"
                min={criteria.startDate}
                value={criteria.endDate}
                onChange={(event) =>
                  setCriteria((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </Field>
            <Field label="Motivo" className="md:col-span-2">
              <Select
                value={criteria.reasonCode}
                onChange={(event) => {
                  const reasonCode = event.target.value;
                  const reasonText = REASONS.find(([code]) => code === reasonCode)?.[1] ?? "";
                  setCriteria((current) => ({ ...current, reasonCode, reasonText }));
                }}
              >
                <option value="">Selecciona motivo</option>
                {REASONS.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Observación opcional" className="md:col-span-2">
              <Textarea
                value={criteria.observation ?? ""}
                onChange={(event) =>
                  setCriteria((current) => ({ ...current, observation: event.target.value }))
                }
                rows={3}
                placeholder="Contexto operativo para recepción y auditoría"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancelar</Button>
            <Button
              onClick={() => void runPreview()}
              disabled={!isCriteriaComplete(criteria) || previewMutation.isPending}
            >
              {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generar vista previa
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 && preview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{preview.total} citas encontradas</p>
              <p className="text-sm text-[var(--text-secondary)]">{selected.size} seleccionadas</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setSelected(new Set(preview.appointments.map((appointment) => appointment.id)))}
              >
                Seleccionar todas
              </Button>
              <Button variant="secondary" onClick={() => setSelected(new Set())}>Deseleccionar</Button>
            </div>
          </div>
          <Table containerClassName="max-h-[430px] overflow-auto">
            <TableHead>
              <TableRow>
                <TableHeader>
                  <input
                    type="checkbox"
                    checked={selected.size === preview.appointments.length && preview.total > 0}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? new Set(preview.appointments.map((appointment) => appointment.id))
                          : new Set()
                      )
                    }
                    aria-label="Seleccionar todas las citas"
                  />
                </TableHeader>
                <TableHeader>Paciente</TableHeader>
                <TableHeader>Fecha y horario</TableHeader>
                <TableHeader>Box</TableHeader>
                <TableHeader>Estado</TableHeader>
                <TableHeader wrap>Advertencias</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(appointment.id)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(appointment.id)) next.delete(appointment.id);
                          else next.add(appointment.id);
                          return next;
                        })
                      }
                      aria-label={`Seleccionar cita de ${appointment.patient?.firstName ?? "paciente"}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-[var(--text-brand-strong)]">
                      {appointment.patient
                        ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
                        : "Paciente no asignado"}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {appointment.patient?.phone || "Sin teléfono"} · {appointment.attentionReason}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{formatDate(appointment.startAt, preview.criteria.timezone)}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {formatTime(appointment.startAt, preview.criteria.timezone)}–{formatTime(appointment.endAt, preview.criteria.timezone)}
                      {" · "}{appointment.durationMinutes} min
                    </div>
                  </TableCell>
                  <TableCell>{appointment.chair?.name || "Sin asignar"}</TableCell>
                  <TableCell><Badge value={appointment.status} tone="default" /></TableCell>
                  <TableCell wrap>
                    {appointment.warnings.length ? (
                      <ul className="space-y-1 text-xs text-amber-700">
                        {appointment.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                      </ul>
                    ) : (
                      <span className="text-xs text-emerald-700">Sin advertencias</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Volver
            </Button>
            <Button onClick={() => setStep(3)} disabled={!selected.size}>
              Revisar confirmación <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 && preview ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Summary label="Citas seleccionadas" value={String(selected.size)} />
              <Summary label="Citas excluidas" value={String(preview.total - selected.size)} />
              <Summary label="Sucursal" value={branches.find((item) => item.id === criteria.branchId)?.name ?? "—"} />
              <Summary
                label="Profesional"
                value={professionalName(professionals.find((item) => item.id === criteria.professionalId))}
              />
              <Summary label="Rango" value={`${criteria.startDate} a ${criteria.endDate}`} />
              <Summary label="Motivo" value={criteria.reasonText} />
            </dl>
          </div>
          <Alert variant="danger" size="sm" title="Confirmación explícita">
            {selected.size} citas cambiarán a anuladas por reprogramación y se crearán casos pendientes. Fechas, pagos e información clínica no se modificarán.
          </Alert>
          <div className="max-h-36 overflow-auto rounded-lg border border-[var(--border-default)] p-3 text-xs text-[var(--text-secondary)]">
            {selectedAppointments.map((appointment) => (
              <div key={appointment.id} className="flex justify-between border-b py-1.5 last:border-0">
                <span>{appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "Paciente"}</span>
                <span>{formatDate(appointment.startAt, preview.criteria.timezone)} {formatTime(appointment.startAt, preview.criteria.timezone)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Volver
            </Button>
            <Button onClick={() => void processBatch()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar y procesar
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 && batch ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              Lote procesado con estado {batch.status}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Procesadas" value={batch.processedCount} tone="emerald" />
              <Metric label="Omitidas" value={batch.skippedCount} tone="slate" />
              <Metric label="Excluidas" value={batch.excludedCount} tone="slate" />
              <Metric label="Fallidas" value={batch.failedCount} tone="red" />
            </div>
          </div>
          {batch.failedCount ? (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Paciente</TableHeader>
                  <TableHeader>Código</TableHeader>
                  <TableHeader wrap>Motivo</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {batch.items.filter((item) => item.status === "FAILED").map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.appointment.patient
                        ? `${item.appointment.patient.firstName} ${item.appointment.patient.lastName}`
                        : "Paciente"}
                    </TableCell>
                    <TableCell>{item.errorCode}</TableCell>
                    <TableCell wrap>{item.errorMessage}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          <div className="flex justify-end gap-2">
            {batch.failedCount ? (
              <Button variant="secondary" onClick={() => void retryFailed()} disabled={retryMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reintentar fallidas
              </Button>
            ) : null}
            <Button onClick={close}>Cerrar</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`space-y-1.5 text-sm font-medium text-[var(--text-primary)] ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-[var(--text-secondary)]">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "red" | "slate" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-slate-700";
  return <div className="rounded-lg bg-white p-3 text-center"><div className={`text-2xl font-bold ${color}`}>{value}</div><div className="text-xs text-slate-500">{label}</div></div>;
}

function defaultCriteria(branchId: string): ReprogrammingCriteria {
  const today = new Date().toISOString().slice(0, 10);
  return { branchId, professionalId: "", startDate: today, endDate: today, reasonCode: "", reasonText: "" };
}

function isCriteriaComplete(criteria: ReprogrammingCriteria) {
  return Boolean(
    criteria.branchId &&
      criteria.professionalId &&
      criteria.startDate &&
      criteria.endDate &&
      criteria.reasonCode &&
      criteria.reasonText
  );
}

function createIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `reprogramming-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

function professionalName(professional?: Professional) {
  return professional ? `${professional.firstName} ${professional.lastName}` : "—";
}
