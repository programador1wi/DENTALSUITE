import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BellRing, RefreshCw, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableResultCount, TableToolbar } from "@/components/ui/table-toolbar";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api/error";
import {
  appointmentRemindersService,
  type BranchReminderPolicy,
  type ReminderOperation,
  type ReminderPolicy,
  type ReminderSettings
} from "../services/appointment-reminders.service";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PROCESSING: "Procesando",
  SENT: "Enviado",
  FAILED: "Fallido",
  UNCERTAIN: "Incierto",
  SKIPPED: "Omitido",
  EXPIRED: "Vencido",
  STALE: "Obsoleto"
};
const STAGE_LABELS = { FIRST_48H: "Primer recordatorio", FINAL_24H: "Recordatorio final" } as const;

function today() {
  return new Date().toLocaleDateString("en-CA");
}
function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "No fue posible cargar los recordatorios.";
}
function formatMoment(value: string | null, timezone?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone || undefined
    }).format(new Date(value));
  } catch {
    return "Zona horaria inválida";
  }
}
function statusTone(status: string): "default" | "success" | "warning" | "danger" | "brand" {
  if (status === "SENT") return "success";
  if (["FAILED", "UNCERTAIN"].includes(status)) return "danger";
  if (["PENDING", "PROCESSING"].includes(status)) return "warning";
  return "default";
}

export function AppointmentRemindersPage() {
  const [params, setParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("appointments.reminders.manage");
  const [data, setData] = useState<Awaited<ReturnType<typeof appointmentRemindersService.list>> | null>(null);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [draft, setDraft] = useState<ReminderPolicy | null>(null);
  const [branchPolicyId, setBranchPolicyId] = useState("");
  const [branchDraft, setBranchDraft] = useState<BranchReminderPolicy>({});
  const [saving, setSaving] = useState(false);
  const [retryTarget, setRetryTarget] = useState<ReminderOperation | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ReminderOperation | null>(null);
  const [resolutionReason, setResolutionReason] = useState("");

  const date = params.get("date") || today();
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = 25;
  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams(params);
      query.set("date", date);
      query.set("page", String(page));
      query.set("pageSize", String(pageSize));
      const [operations, currentSettings] = await Promise.all([
        appointmentRemindersService.list(query),
        appointmentRemindersService.settings()
      ]);
      setData(operations);
      setSettings(currentSettings);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [params, date, page]);

  useEffect(() => {
    document.title = "Recordatorios de citas | Dentalink";
    void load();
  }, [load]);

  const openSettings = () => {
    if (settings) {
      setDraft({ ...settings.policy, retryDelaysMinutes: [...settings.policy.retryDelaysMinutes] });
      setConfigOpen(true);
    }
  };
  const saveSettings = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await appointmentRemindersService.updatePolicy(draft);
      setConfigOpen(false);
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };
  const selectBranchPolicy = (branchId: string) => {
    setBranchPolicyId(branchId);
    const override = settings?.branches.find((branch) => branch.id === branchId)?.appointmentReminderPolicy;
    setBranchDraft(override ? { ...override } : {});
  };
  const saveBranchSettings = async () => {
    if (!branchPolicyId) return;
    setSaving(true);
    try {
      await appointmentRemindersService.updateBranch(branchPolicyId, {
        enabled: branchDraft.enabled,
        firstOffsetHours: branchDraft.firstOffsetHours,
        finalOffsetHours: branchDraft.finalOffsetHours,
        sendWindowStartMinutes: branchDraft.sendWindowStartMinutes,
        sendWindowEndMinutes: branchDraft.sendWindowEndMinutes
      });
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };
  const doRetry = async () => {
    if (!retryTarget) return;
    setSaving(true);
    try {
      await appointmentRemindersService.retry(retryTarget.id);
      setRetryTarget(null);
      await load();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setSaving(false);
    }
  };
  const doResolve = async (resolution: "MARK_SENT" | "MARK_NOT_SENT_AND_RETRY") => {
    if (!resolveTarget || !resolutionReason.trim()) return;
    setSaving(true);
    try {
      await appointmentRemindersService.resolve(resolveTarget.id, resolution, resolutionReason.trim());
      setResolveTarget(null);
      setResolutionReason("");
      await load();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<DataTableColumn<ReminderOperation>[]>(
    () => [
      {
        key: "patient",
        title: "Paciente",
        primary: true,
        render: (row) => (
          <div>
            <p className="font-semibold text-[var(--text-primary)]">
              {row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : "Sin paciente"}
            </p>
            <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{row.branch.name}</p>
          </div>
        )
      },
      {
        key: "appointmentStartAt",
        title: "Cita",
        render: (row) => formatMoment(row.appointmentStartAt, row.branch.timezone)
      },
      { key: "stage", title: "Etapa", render: (row) => STAGE_LABELS[row.stage] },
      {
        key: "status",
        title: "Operación",
        render: (row) => (
          <Badge value={STATUS_LABELS[row.status] || row.status} tone={statusTone(row.status)} dot />
        )
      },
      {
        key: "nextAttemptAt",
        title: "Próximo intento",
        priority: "P3",
        render: (row) => formatMoment(row.nextAttemptAt, row.branch.timezone)
      },
      {
        key: "errorMessage",
        title: "Último error",
        priority: "P3",
        wrap: true,
        render: (row) => row.errorMessage || row.failureCode || "—"
      },
      {
        key: "id",
        title: "Acciones",
        actions: true,
        render: (row) =>
          canManage ? (
            <div className="flex justify-end gap-2">
              {row.status === "FAILED" ? (
                <Button size="sm" variant="secondary" onClick={() => setRetryTarget(row)}>
                  Reintentar
                </Button>
              ) : null}
              {row.status === "UNCERTAIN" ? (
                <Button size="sm" variant="secondary" onClick={() => setResolveTarget(row)}>
                  Resolver
                </Button>
              ) : null}
            </div>
          ) : (
            "—"
          )
      }
    ],
    [canManage]
  );

  const summary = data?.summary ?? {};
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <main className="min-w-0 p-[var(--space-4)] sm:p-[var(--space-6)]">
      <PageHeader
        eyebrow="Agenda"
        title="Recordatorios automáticos"
        description="Seguimiento operativo de solicitudes de confirmación por correo, con ciclo 48H/24H y trazabilidad por cita."
        primaryAction={
          canManage ? (
            <Button onClick={openSettings}>
              <Settings2 className="h-4 w-4" />
              Configurar
            </Button>
          ) : undefined
        }
        secondaryActions={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        }
      />

      <section
        className="mb-[var(--space-4)] grid gap-[var(--space-3)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
        aria-label="Resumen del día"
      >
        {[
          ["Citas elegibles", summary.eligible ?? 0],
          ["Primeros enviados", summary.SENT_FIRST_48H ?? 0],
          ["Finales enviados", summary.SENT_FINAL_24H ?? 0],
          ["Pendientes de respuesta", summary.pendingResponse ?? 0],
          ["Confirmadas tras correo", summary.confirmedAfterEmail ?? 0],
          ["Requieren atención", (summary.FAILED ?? 0) + (summary.UNCERTAIN ?? 0)]
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)]"
          >
            <p className="text-[var(--text-xs)] font-medium text-[var(--text-secondary)]">{label}</p>
            <p className="mt-1 text-[var(--text-xl)] font-semibold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </section>

      <TableToolbar
        leading={<TableResultCount>{data?.total ?? 0} operaciones para fecha seleccionada</TableResultCount>}
        search={
          <Input
            aria-label="Buscar paciente"
            placeholder="Buscar paciente"
            value={params.get("patient") || ""}
            onChange={(event) => updateParam("patient", event.target.value)}
          />
        }
        filters={
          <>
          <div className="w-40">
            <DatePicker ariaLabel="Fecha local" value={date} onChange={(value) => updateParam("date", value)} />
          </div>
            <Select
              aria-label="Sucursal"
              value={params.get("branchId") || ""}
              onChange={(event) => updateParam("branchId", event.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {settings?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Etapa"
              value={params.get("stage") || ""}
              onChange={(event) => updateParam("stage", event.target.value)}
            >
              <option value="">Todas las etapas</option>
              <option value="FIRST_48H">Primer recordatorio</option>
              <option value="FINAL_24H">Recordatorio final</option>
            </Select>
            <Select
              aria-label="Estado"
              value={params.get("status") || ""}
              onChange={(event) => updateParam("status", event.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </>
        }
      />

      <div className="mt-[var(--space-4)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        {loading ? (
          <div className="p-[var(--space-4)]">
            <LoadingState variant="skeleton" rows={6} message="Cargando recordatorios" />
          </div>
        ) : error ? (
          <div className="p-[var(--space-4)]">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.items ?? []}
              getRowKey={(row) => row.id}
              mobileView="cards"
              empty={
                <EmptyState
                  icon={<BellRing className="h-5 w-5" />}
                  title="Sin operaciones"
                  description="No hay recordatorios para los filtros y la fecha seleccionados."
                />
              }
            />
            <TablePagination
              page={page}
              totalPages={totalPages}
              totalItems={data?.total}
              itemLabel="operaciones"
              onPageChange={(next) => updateParam("page", String(next))}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(retryTarget)}
        title="Reintentar envío"
        description="Se volverá a intentar este correo cuando el worker y el circuito SMTP estén disponibles."
        confirmLabel="Solicitar reintento"
        variant="warning"
        isLoading={saving}
        onCancel={() => setRetryTarget(null)}
        onConfirm={() => void doRetry()}
      />

      <Modal
        open={Boolean(resolveTarget)}
        title="Resolver entrega incierta"
        description="Verifica el proveedor antes de elegir; un envío incierto nunca se reintenta automáticamente."
        onClose={() => setResolveTarget(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={saving || !resolutionReason.trim()}
              onClick={() => void doResolve("MARK_NOT_SENT_AND_RETRY")}
            >
              Confirmado no enviado; reprogramar
            </Button>
            <Button disabled={saving || !resolutionReason.trim()} onClick={() => void doResolve("MARK_SENT")}>
              Marcar enviado
            </Button>
          </div>
        }
      >
        <label
          className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]"
          htmlFor="resolution-reason"
        >
          Evidencia o motivo
        </label>
        <Textarea
          id="resolution-reason"
          className="mt-2"
          value={resolutionReason}
          onChange={(event) => setResolutionReason(event.target.value)}
          placeholder="Ej. Verificado en el registro SMTP del proveedor"
        />
      </Modal>

      <Modal
        open={configOpen}
        title="Política de recordatorios"
        description="La política permanece subordinada a MAIL_ENABLED y APPOINTMENT_REMINDER_WORKER_ENABLED."
        onClose={() => setConfigOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfigOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={saving || !draft} onClick={() => void saveSettings()}>
              Guardar política
            </Button>
          </div>
        }
      >
        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              />
              Activar envíos automáticos
            </label>
            <div />
            <Field
              label="Primer umbral (horas)"
              value={draft.firstOffsetHours}
              onChange={(value) => setDraft({ ...draft, firstOffsetHours: value })}
            />
            <Field
              label="Umbral final (horas)"
              value={draft.finalOffsetHours}
              onChange={(value) => setDraft({ ...draft, finalOffsetHours: value })}
            />
            <Field
              label="Inicio de ventana (minutos)"
              value={draft.sendWindowStartMinutes}
              onChange={(value) => setDraft({ ...draft, sendWindowStartMinutes: value })}
            />
            <Field
              label="Fin de ventana (minutos)"
              value={draft.sendWindowEndMinutes}
              onChange={(value) => setDraft({ ...draft, sendWindowEndMinutes: value })}
            />
            <Field
              label="Máximo de intentos"
              value={draft.maxAttempts}
              onChange={(value) => setDraft({ ...draft, maxAttempts: value })}
            />
            <label className="text-sm font-medium">
              Reintentos (minutos)
              <Input
                className="mt-1"
                value={draft.retryDelaysMinutes.join(", ")}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    retryDelaysMinutes: event.target.value.split(",").map(Number).filter(Number.isFinite)
                  })
                }
              />
            </label>
          <div className="flex justify-end sm:col-span-2">
            <Button
                variant="secondary"
                disabled={saving}
                onClick={() =>
                  void appointmentRemindersService
                    .testEmail()
                    .catch((testError) => setError(errorMessage(testError)))
                }
              >
                Probar SMTP con mi correo
            </Button>
          </div>
          <section className="border-t border-[var(--border-default)] pt-4 sm:col-span-2" aria-labelledby="branch-policy-title">
            <h3 id="branch-policy-title" className="text-sm font-semibold text-[var(--text-primary)]">Override por sucursal</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Los campos vacíos heredan la política general.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Sucursal<Select className="mt-1" value={branchPolicyId} onChange={(event) => selectBranchPolicy(event.target.value)}><option value="">Seleccionar sucursal</option>{settings?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label>
              <label className="text-sm font-medium">Activación<Select className="mt-1" value={branchDraft.enabled == null ? "" : String(branchDraft.enabled)} disabled={!branchPolicyId} onChange={(event) => setBranchDraft({ ...branchDraft, enabled: event.target.value === "" ? null : event.target.value === "true" })}><option value="">Heredar</option><option value="true">Activada</option><option value="false">Desactivada</option></Select></label>
              <OptionalField label="Primer umbral" value={branchDraft.firstOffsetHours} disabled={!branchPolicyId} onChange={(value) => setBranchDraft({ ...branchDraft, firstOffsetHours: value })} />
              <OptionalField label="Umbral final" value={branchDraft.finalOffsetHours} disabled={!branchPolicyId} onChange={(value) => setBranchDraft({ ...branchDraft, finalOffsetHours: value })} />
              <OptionalField label="Inicio de ventana" value={branchDraft.sendWindowStartMinutes} disabled={!branchPolicyId} onChange={(value) => setBranchDraft({ ...branchDraft, sendWindowStartMinutes: value })} />
              <OptionalField label="Fin de ventana" value={branchDraft.sendWindowEndMinutes} disabled={!branchPolicyId} onChange={(value) => setBranchDraft({ ...branchDraft, sendWindowEndMinutes: value })} />
              <div className="flex justify-end sm:col-span-2"><Button type="button" variant="secondary" disabled={!branchPolicyId || saving} onClick={() => void saveBranchSettings()}>Guardar override</Button></div>
            </div>
          </section>
        </div>
        ) : null}
      </Modal>
    </main>
  );
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <Input
        className="mt-1"
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function OptionalField({ label, value, disabled, onChange }: { label: string; value?: number | null; disabled: boolean; onChange: (value: number | null) => void }) {
  return <label className="text-sm font-medium">{label}<Input className="mt-1" type="number" value={value ?? ""} disabled={disabled} placeholder="Heredar" onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /></label>;
}
