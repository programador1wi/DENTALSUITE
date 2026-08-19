import { useState } from "react";
import { AlertCircle, Building2, CheckCircle2, Clock, ListChecks, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useBranchStore } from "@/stores/branch.store";
import { cn } from "@/lib/utils/cn";
import { useCrmTaskStatistics } from "../hooks/use-crm-tasks";

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).format(new Date());
}

export function CrmTasksStatisticsPage() {
  const [viewMode, setViewMode] = useState<"historico" | "mes">("historico");
  const [month, setMonth] = useState(currentMonth());
  const branches = useBranches(undefined, "ACTIVE");
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const activeBranchName = branches.data?.find((branch) => branch.id === activeBranchId)?.name || "Sucursal actual";
  const statistics = useCrmTaskStatistics(activeBranchId, viewMode === "mes" ? month : undefined);

  if (!activeBranchId) return <EmptyState title="Selecciona una sucursal" description="Las estadísticas siempre están aisladas por sucursal." />;
  if (statistics.isLoading) return <LoadingState message="Calculando estadísticas..." />;
  if (statistics.isError) return <ErrorState message={statistics.error.message} />;
  const data = statistics.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><Building2 size={20} className="text-slate-400" /><h1 className="text-lg font-bold text-slate-700">{activeBranchName}</h1></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button onClick={() => setViewMode("historico")} className={cn("rounded-md px-4 py-1.5 text-xs font-semibold", viewMode === "historico" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>Resultados históricos</button>
            <button onClick={() => setViewMode("mes")} className={cn("rounded-md px-4 py-1.5 text-xs font-semibold", viewMode === "mes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>Por mes</button>
          </div>
          {viewMode === "mes" ? <Input aria-label="Mes estadístico" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-40" /> : null}
        </div>
      </div>

      {!data || data.total === 0 ? (
        <Card className="flex min-h-[360px] items-center justify-center border-slate-200 bg-slate-50/50"><EmptyState title="No hay tareas" description={viewMode === "mes" ? "No se encontraron tareas creadas en el mes seleccionado." : "No existen tareas registradas en esta sucursal."} /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Metric label="Total" value={data.total} icon={ListChecks} />
            <Metric label="Completadas" value={data.completed} icon={CheckCircle2} tone="success" />
            <Metric label="Pendientes" value={data.pending} icon={Clock} tone="warning" />
            <Metric label="Atrasadas" value={data.overdue} icon={AlertCircle} tone="danger" />
            <Metric label="Canceladas" value={data.cancelled} icon={AlertCircle} />
            <Metric label="Cumplimiento" value={`${data.completionRate}%`} icon={TrendingUp} tone="brand" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5"><h2 className="mb-4 text-sm font-bold text-slate-800">Por tipo</h2><div className="space-y-3">{data.byType.map((item) => <Distribution key={item.type} label={item.type} value={item.count} total={data.total} />)}</div></Card>
            <Card className="p-5"><h2 className="mb-4 text-sm font-bold text-slate-800">Por responsable</h2><div className="space-y-3">{data.byAssignee.map((item) => <Distribution key={item.assignedToId ?? "unassigned"} label={item.name} value={item.count} total={data.total} />)}</div></Card>
          </div>
          <p className="text-xs text-slate-500">Fórmula de cumplimiento: {data.metricDefinition}. Las canceladas no forman parte del denominador.</p>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone = "neutral" }: { label: string; value: number | string; icon: typeof Clock; tone?: "neutral" | "success" | "warning" | "danger" | "brand" }) {
  const colors = { neutral: "text-slate-600", success: "text-emerald-600", warning: "text-amber-600", danger: "text-red-600", brand: "text-blue-600" };
  return <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{value}</p></div><Icon className={cn("h-5 w-5", colors[tone])} /></div></Card>;
}

function Distribution({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return <div><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">{label}</span><span className="text-slate-500">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-500" style={{ width: `${percent}%` }} /></div></div>;
}
