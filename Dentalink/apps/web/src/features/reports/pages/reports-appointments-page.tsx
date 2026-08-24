import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useAppointmentsReport } from "../hooks/use-reports";
import { ReportsFilters } from "../components/reports-filters";
import { downloadReportExport, getAppointmentsReport } from "../services/reports.service";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsAppointmentsPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const { branchId, setBranchId } = useActiveBranchFilter();

  const branches = useBranches(undefined, "ACTIVE");
  const report = useAppointmentsReport({ dateFrom, dateTo, branchId: branchId || undefined });
  const data = (report.data?.data as any) ?? {};

  if (report.isLoading) return <LoadingState message="Cargando reporte de agenda..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Reporte de agenda" description="Citas por día, profesional, cancelaciones y ocupación." />
      <ReportsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        branchId={branchId}
        branches={branches.data?.map((branch) => ({ id: branch.id, name: branch.name })) ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onBranchChange={setBranchId}
        onExportCsv={async () => downloadReportExport((await getAppointmentsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "csv" })).export)}
        onExportXlsx={async () => downloadReportExport((await getAppointmentsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "xlsx" })).export)}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Total citas</p>
          <p className="text-2xl font-semibold">{data?.totals?.total ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Canceladas</p>
          <p className="text-2xl font-semibold">{data?.totals?.cancelled ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">No asistencias</p>
          <p className="text-2xl font-semibold">{data?.totals?.noShow ?? 0}</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Citas por día</h3>
        <DataTable
          rows={data?.byDay ?? []}
          empty={<EmptyState title="Sin datos" description="No hay citas en el periodo seleccionado." />}
          columns={[
            { key: "date", title: "Fecha" },
            { key: "total", title: "Total" },
            { key: "cancelled", title: "Canceladas" },
            { key: "noShow", title: "No asistencias" }
          ]}
        />
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Ocupación por profesional</h3>
        <DataTable
          rows={data?.byProfessional ?? []}
          empty={<EmptyState title="Sin datos" description="No hay ocupación por profesional para mostrar." />}
          columns={[
            { key: "name", title: "Profesional" },
            { key: "total", title: "Citas" },
            { key: "bookedMinutes", title: "Min. ocupados" },
            { key: "availableMinutes", title: "Min. disponibles" },
            { key: "occupancyPercent", title: "Ocupación %" }
          ]}
        />
      </Card>
    </div>
  );
}
