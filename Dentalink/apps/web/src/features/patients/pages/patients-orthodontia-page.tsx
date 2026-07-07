import { Link } from "react-router-dom";
import { Download, Maximize2 } from "lucide-react";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import type { TreatmentPlan, TreatmentPlanStatus } from "@/features/treatments/services/treatments.service";
import { PatientsModuleTabs } from "../components/patients-module-tabs";

const ACTIVE_STATUSES = new Set<TreatmentPlanStatus>(["ACCEPTED", "IN_PROGRESS"]);
const CLOSED_STATUSES = new Set<TreatmentPlanStatus>(["COMPLETED", "CANCELLED", "REJECTED"]);

const STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  DRAFT: "Diagnostico",
  PRESENTED: "Presentado",
  ACCEPTED: "Aceptado",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  REJECTED: "Rechazado"
};

export function PatientsOrthodontiaPage() {
  const plans = useTreatmentPlans({ kind: "ORTHODONTICS" });
  const rows = plans.data ?? [];
  const openRows = rows.filter((row) => !CLOSED_STATUSES.has(row.status));
  const uniquePatients = new Set(rows.map((row) => row.patient.id)).size;
  const overdueRows = openRows.filter((row) => isPast(row.orthodonticProfile?.nextControlAt));
  const noNextControlRows = openRows.filter((row) => !row.orthodonticProfile?.nextControlAt);
  const pausedRows = openRows.filter((row) => row.orthodonticSummary?.isPaused);
  const missingPlanningRows = openRows.filter(
    (row) => !row.orthodonticProfile?.startDate || !row.orthodonticSummary?.estimatedControls
  );
  const alertRows = openRows.filter((row) => row.orthodonticProfile?.alert);

  if (plans.isError) return <ErrorState message={plans.error.message} />;

  return (
    <WarnerSuitePanel className="min-h-[720px]">
      <PatientsModuleTabs />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Seguimiento clinico
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Pacientes de Ortodoncia</h1>
            <p className="mt-1 text-sm text-slate-500">
              Planes ortodonticos reales, controles, alertas y progreso por sucursal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={!rows.length} onClick={() => downloadReport(rows)}>
              <Download className="mr-1.5 h-4 w-4" />
              Descargar reporte
            </Button>
            <Button variant="secondary" onClick={() => void requestFullscreen()}>
              <Maximize2 className="mr-1.5 h-4 w-4" />
              Pantalla completa
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric label="Pacientes" value={uniquePatients} />
          <Metric
            label="Planes activos"
            value={openRows.filter((row) => ACTIVE_STATUSES.has(row.status)).length}
          />
          <Metric label="Atrasados" value={overdueRows.length} tone="danger" />
          <Metric label="Sin proximo control" value={noNextControlRows.length} tone="warning" />
          <Metric label="Pausados" value={pausedRows.length} />
          <Metric label="Sin planificacion" value={missingPlanningRows.length} tone="warning" />
        </div>

        {alertRows.length ? (
          <section className="border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-amber-900">
              <span className="font-semibold">Alertas activas:</span>
              {alertRows.slice(0, 4).map((row) => (
                <Link
                  key={row.id}
                  to={`/patients/${row.patient.id}/treatments?planId=${row.id}`}
                  className="rounded border border-amber-200 bg-white px-2 py-1 font-medium hover:text-amber-700"
                >
                  {patientName(row)}: {row.orthodonticProfile?.alert}
                </Link>
              ))}
              {alertRows.length > 4 ? <span className="text-xs">+{alertRows.length - 4} mas</span> : null}
            </div>
          </section>
        ) : null}

        {plans.isLoading ? (
          <LoadingState message="Cargando pacientes de ortodoncia..." />
        ) : !rows.length ? (
          <EmptyState
            title="Sin pacientes de ortodoncia"
            description="No hay planes de ortodoncia en las sucursales visibles."
          />
        ) : (
          <div className="overflow-hidden border border-slate-200 bg-white">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[1120px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <HeaderCell>Paciente</HeaderCell>
                    <HeaderCell>Plan</HeaderCell>
                    <HeaderCell>Sucursal</HeaderCell>
                    <HeaderCell>Dr.(a) tratante</HeaderCell>
                    <HeaderCell>Inicio</HeaderCell>
                    <HeaderCell>Proximo control</HeaderCell>
                    <HeaderCell>Controles</HeaderCell>
                    <HeaderCell>Progreso</HeaderCell>
                    <HeaderCell>Estado</HeaderCell>
                    <HeaderCell>Alerta</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((plan) => (
                    <tr key={plan.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-3">
                        <Link
                          to={`/patients/${plan.patient.id}/treatments?planId=${plan.id}`}
                          className="font-semibold text-[#0879d5] hover:underline"
                        >
                          {patientName(plan)}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[220px]">
                          <p className="truncate font-medium text-slate-900">{plan.name}</p>
                          <p className="text-xs text-slate-400">#{shortId(plan.id)}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{plan.branch.name}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {plan.professional.firstName} {plan.professional.lastName}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatDate(plan.orthodonticProfile?.startDate)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            isPast(plan.orthodonticProfile?.nextControlAt)
                              ? "font-semibold text-red-700"
                              : "text-slate-600"
                          }
                        >
                          {formatDate(plan.orthodonticProfile?.nextControlAt)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {plan.orthodonticSummary?.realControlsCount ?? 0} /{" "}
                        {plan.orthodonticSummary?.estimatedControls ?? "-"}
                      </td>
                      <td className="px-3 py-3">
                        <ProgressPair
                          calendar={plan.orthodonticSummary?.calendarProgress ?? 0}
                          real={plan.orthodonticSummary?.realProgress ?? 0}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Badge value={STATUS_LABELS[plan.status]} tone={statusTone(plan.status)} />
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {plan.orthodonticProfile?.alert ? (
                          <span className="font-medium text-amber-700">{plan.orthodonticProfile.alert}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </WarnerSuitePanel>
  );
}

function Metric({
  label,
  value,
  tone = "brand"
}: {
  label: string;
  value: number;
  tone?: "brand" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-[#0879d5]";

  return (
    <div className="border border-slate-200 bg-white px-4 py-3">
      <p className={`text-3xl font-semibold leading-none ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
    </div>
  );
}

function HeaderCell({ children }: { children: string }) {
  return <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold">{children}</th>;
}

function ProgressPair({ calendar, real }: { calendar: number; real: number }) {
  return (
    <div className="min-w-[150px] space-y-1.5">
      <ProgressLine label="Cal." value={calendar} />
      <ProgressLine label="Real" value={real} />
    </div>
  );
}

function ProgressLine({ label, value }: { label: string; value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="grid grid-cols-[34px_1fr_38px] items-center gap-2 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="h-2 overflow-hidden rounded bg-slate-100">
        <span className="block h-full bg-[#0879d5]" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-right font-semibold text-slate-700">{percent}%</span>
    </div>
  );
}

function patientName(plan: TreatmentPlan) {
  return `${plan.patient.firstName} ${plan.patient.lastName}`;
}

function shortId(id: string) {
  return id.replace(/\D/g, "").slice(-6) || id.slice(-6).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

function isPast(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function statusTone(status: TreatmentPlanStatus): "default" | "success" | "warning" | "danger" | "brand" {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED" || status === "REJECTED") return "danger";
  if (status === "DRAFT" || status === "PRESENTED") return "warning";
  if (status === "IN_PROGRESS") return "brand";
  return "default";
}

async function requestFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  }
}

function downloadReport(rows: TreatmentPlan[]) {
  const headers = [
    "Paciente",
    "Plan",
    "Sucursal",
    "Profesional",
    "Estado",
    "Inicio",
    "Proximo control",
    "Controles reales",
    "Controles estimados",
    "Progreso calendario",
    "Progreso real",
    "Alerta"
  ];
  const body = rows.map((row) => [
    patientName(row),
    row.name,
    row.branch.name,
    `${row.professional.firstName} ${row.professional.lastName}`,
    STATUS_LABELS[row.status],
    row.orthodonticProfile?.startDate ?? "",
    row.orthodonticProfile?.nextControlAt ?? "",
    String(row.orthodonticSummary?.realControlsCount ?? 0),
    String(row.orthodonticSummary?.estimatedControls ?? ""),
    String(Math.round(row.orthodonticSummary?.calendarProgress ?? 0)),
    String(Math.round(row.orthodonticSummary?.realProgress ?? 0)),
    row.orthodonticProfile?.alert ?? ""
  ]);

  const csv = [headers, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pacientes-ortodoncia.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
