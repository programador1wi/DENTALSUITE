import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useProfessionalsReport } from "../hooks/use-reports";
import { ReportsFilters } from "../components/reports-filters";
import { downloadReportExport, getProfessionalsReport } from "../services/reports.service";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsProfessionalsPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const { branchId, setBranchId } = useActiveBranchFilter();

  const branches = useBranches(undefined, "ACTIVE");
  const report = useProfessionalsReport({ dateFrom, dateTo, branchId: branchId || undefined });
  const data = (report.data?.data as any) ?? {};

  if (report.isLoading) return <LoadingState message="Cargando reporte por profesionales..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Reporte por profesional" description="Productividad, agenda y laboratorio por profesional." />
      <ReportsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        branchId={branchId}
        branches={branches.data?.map((branch) => ({ id: branch.id, name: branch.name })) ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onBranchChange={setBranchId}
        onExportCsv={async () =>
          downloadReportExport((await getProfessionalsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "csv" })).export)
        }
        onExportXlsx={async () =>
          downloadReportExport((await getProfessionalsReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "xlsx" })).export)
        }
      />

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Rendimiento profesional</h3>
        <DataTable
          rows={data?.rows ?? []}
          empty={<EmptyState title="Sin datos" description="No hay rendimiento profesional para el filtro." />}
          columns={[
            { key: "name", title: "Profesional" },
            { key: "appointments", title: "Citas" },
            { key: "bookedMinutes", title: "Minutos" },
            { key: "production", title: "Producción" },
            { key: "cancellationRate", title: "Cancelación %" },
            { key: "noShowRate", title: "No show %" },
            { key: "labPending", title: "Lab pendiente" }
          ]}
        />
      </Card>
    </div>
  );
}
