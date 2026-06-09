import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { usePatientsReport } from "../hooks/use-reports";
import { ReportsFilters } from "../components/reports-filters";
import { downloadReportExport, getPatientsReport } from "../services/reports.service";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsPatientsPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const { branchId, setBranchId } = useActiveBranchFilter();

  const branches = useBranches(undefined, "ACTIVE");
  const report = usePatientsReport({ dateFrom, dateTo, branchId: branchId || undefined });
  const data = (report.data?.data as any) ?? {};

  if (report.isLoading) return <LoadingState message="Cargando reporte de pacientes..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Reporte de pacientes" description="Indicadores de captación, actividad y seguimiento." />
      <ReportsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        branchId={branchId}
        branches={branches.data?.map((branch) => ({ id: branch.id, name: branch.name })) ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onBranchChange={setBranchId}
        onExportCsv={async () => downloadReportExport((await getPatientsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "csv" })).export)}
        onExportXlsx={async () => downloadReportExport((await getPatientsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "xlsx" })).export)}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Nuevos</p>
          <p className="text-2xl font-semibold">{data?.summary?.newPatients ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Activos</p>
          <p className="text-2xl font-semibold">{data?.summary?.activePatients ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Sin cita futura</p>
          <p className="text-2xl font-semibold">{data?.summary?.withoutFutureAppointment ?? 0}</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Pacientes por fuente</h3>
        <DataTable
          rows={data?.bySource ?? []}
          empty={<EmptyState title="Sin datos" description="No hay fuentes de pacientes para este filtro." />}
          columns={[
            { key: "source", title: "Fuente" },
            { key: "count", title: "Pacientes" }
          ]}
        />
      </Card>
    </div>
  );
}
