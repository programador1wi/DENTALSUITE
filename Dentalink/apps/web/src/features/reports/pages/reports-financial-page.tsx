import { useState } from "react";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useFinancialReport } from "../hooks/use-reports";
import { ReportsFilters } from "../components/reports-filters";
import { downloadReportExport, getFinancialReport } from "../services/reports.service";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsFinancialPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [branchId, setBranchId] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const report = useFinancialReport({ dateFrom, dateTo, branchId: branchId || undefined });
  const data = (report.data?.data as any) ?? {};

  if (report.isLoading) return <LoadingState message="Cargando reporte financiero..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Reporte financiero" description="Ingresos, saldos, morosidad y producción." />
      <ReportsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        branchId={branchId}
        branches={branches.data?.map((branch) => ({ id: branch.id, name: branch.name })) ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onBranchChange={setBranchId}
        onExportCsv={async () => downloadReportExport((await getFinancialReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "csv" })).export)}
        onExportXlsx={async () => downloadReportExport((await getFinancialReport({ dateFrom, dateTo, branchId: branchId || undefined, format: "xlsx" })).export)}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Ingresos</p>
          <p className="text-2xl font-semibold">${Number(data?.summary?.incomeTotal ?? 0).toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Saldos pendientes</p>
          <p className="text-2xl font-semibold">${Number(data?.summary?.outstandingBalance ?? 0).toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Morosidad</p>
          <p className="text-2xl font-semibold">${Number(data?.summary?.delinquency ?? 0).toFixed(2)}</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Ingresos por método de pago</h3>
        <DataTable
          rows={data?.incomeByMethod ?? []}
          empty={<EmptyState title="Sin datos" description="No hay ingresos por método para este rango." />}
          columns={[
            { key: "method", title: "Método" },
            { key: "amount", title: "Monto" }
          ]}
        />
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Caja por sucursal</h3>
        <DataTable
          rows={data?.cashByBranch ?? []}
          empty={<EmptyState title="Sin datos" description="No hay movimientos de caja en el periodo." />}
          columns={[
            { key: "branchName", title: "Sucursal" },
            { key: "netAmount", title: "Neto" }
          ]}
        />
      </Card>
    </div>
  );
}
