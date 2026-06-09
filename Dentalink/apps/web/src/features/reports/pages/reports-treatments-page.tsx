import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useTreatmentsReport } from "../hooks/use-reports";
import { ReportsFilters } from "../components/reports-filters";
import { downloadReportExport, getTreatmentsReport } from "../services/reports.service";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsTreatmentsPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const { branchId, setBranchId } = useActiveBranchFilter();

  const branches = useBranches(undefined, "ACTIVE");
  const report = useTreatmentsReport({ dateFrom, dateTo, branchId: branchId || undefined });
  const data = (report.data?.data as any) ?? {};

  if (report.isLoading) return <LoadingState message="Cargando reporte de tratamientos..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Reporte de tratamientos" description="Seguimiento de planes creados, aceptados y finalizados." />
      <ReportsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        branchId={branchId}
        branches={branches.data?.map((branch) => ({ id: branch.id, name: branch.name })) ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onBranchChange={setBranchId}
        onExportCsv={async () => downloadReportExport((await getTreatmentsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "csv" })).export)}
        onExportXlsx={async () => downloadReportExport((await getTreatmentsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "xlsx" })).export)}
      />

      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <p className="text-sm text-slate-500">Creados</p>
          <p className="text-2xl font-semibold">{data?.summary?.plansCreated ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Aceptados</p>
          <p className="text-2xl font-semibold">{data?.summary?.plansAccepted ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Tasa aceptación</p>
          <p className="text-2xl font-semibold">{data?.summary?.acceptanceRate ?? 0}%</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">En progreso</p>
          <p className="text-2xl font-semibold">{data?.summary?.inProgress ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Finalizados</p>
          <p className="text-2xl font-semibold">{data?.summary?.completed ?? 0}</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Planes en rango</h3>
        <DataTable
          rows={data?.plans ?? []}
          empty={<EmptyState title="Sin datos" description="No hay planes en el rango seleccionado." />}
          columns={[
            { key: "name", title: "Plan" },
            { key: "status", title: "Estado" },
            { key: "patient", title: "Paciente" },
            { key: "professional", title: "Profesional" },
            {
              key: "createdAt",
              title: "Fecha",
              render: (row) => new Date(String(row.createdAt ?? "")).toLocaleDateString()
            }
          ]}
        />
      </Card>
    </div>
  );
}
