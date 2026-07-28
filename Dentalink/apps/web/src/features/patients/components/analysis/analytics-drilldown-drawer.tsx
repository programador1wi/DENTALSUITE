import { useMemo, useState } from "react";
import { Download, ExternalLink, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  useExportPatientAnalysis,
  usePatientAnalysisDetail
} from "../../hooks/use-patients";
import type { PatientAnalysisQuery } from "../../services/patients.service";

const LABELS: Record<string, string> = {
  patientName: "Paciente",
  scheduledAt: "Fecha",
  createdAt: "Alta",
  status: "Estado",
  branch: "Sucursal",
  professional: "Profesional",
  treatmentPlan: "Plan",
  procedure: "Prestacion",
  currency: "Moneda",
  total: "Total",
  paid: "Pagado",
  balance: "Saldo",
  performed: "Realizado",
  pending: "Pendiente",
  lastAppointmentAt: "Ultima cita",
  lastActivityAt: "Ultima actividad"
};

export function AnalyticsDrilldownDrawer({
  metric,
  title,
  filters,
  canExport,
  onClose
}: {
  metric: string | null;
  title: string;
  filters: PatientAnalysisQuery;
  canExport: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const detail = usePatientAnalysisDetail(
    metric ?? undefined,
    { ...filters, page, pageSize: 25, search: search || undefined },
    Boolean(metric)
  );
  const exportMutation = useExportPatientAnalysis();
  const columns = useMemo(() => {
    const firstRow = detail.data?.rows[0];
    if (!firstRow) return [];
    return Object.keys(firstRow).filter((key) => !["id", "patientUrl"].includes(key));
  }, [detail.data?.rows]);

  const download = async () => {
    if (!metric) return;
    const blob = await exportMutation.mutateAsync({
      metric,
      params: { ...filters, search: search || undefined }
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analisis-pacientes-${metric}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Drawer open={Boolean(metric)} title={title} onClose={onClose}>
      <div className="flex h-[calc(100vh-100px)] flex-col gap-4">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--text-tertiary)]" />
            <Input
              value={search}
              className="pl-9"
              placeholder="Buscar paciente..."
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          {canExport ? (
            <Button type="button" variant="secondary" disabled={exportMutation.isPending} onClick={() => void download()}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          ) : null}
        </div>

        {detail.isLoading ? (
          <LoadingState message="Cargando detalle paginado..." />
        ) : detail.isError ? (
          <ErrorState message={detail.error.message} />
        ) : detail.data ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--border-default)]">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)]">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="border-b border-[var(--border-default)] px-3 py-2 font-semibold text-[var(--text-secondary)]">
                        {LABELS[column] ?? column}
                      </th>
                    ))}
                    <th className="border-b border-[var(--border-default)] px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {detail.data.rows.map((row) => (
                    <tr key={String(row.id)} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]">
                      {columns.map((column) => (
                        <td key={column} className="whitespace-nowrap px-3 py-2 text-[var(--text-primary)]">
                          {formatCell(column, row[column])}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {typeof row.patientUrl === "string" ? (
                          <Link
                            to={row.patientUrl}
                            className="inline-flex items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline"
                          >
                            Ficha <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!detail.data.rows.length ? (
                <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
                  No hay registros para este corte.
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-[var(--text-secondary)]">
                {detail.data.pagination.total} registros · pagina {detail.data.pagination.page} de{" "}
                {Math.max(detail.data.pagination.totalPages, 1)}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={page >= detail.data.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Drawer>
  );
}

function formatCell(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (["total", "paid", "balance", "performed", "pending"].includes(key) && typeof value === "number") {
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value);
  }
  if ((key.endsWith("At") || key === "scheduledAt" || key === "createdAt") && typeof value === "string") {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }
  return String(value);
}
