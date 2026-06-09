import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useDashboardReport } from "@/features/reports/hooks/use-reports";
import { ReportsFilters } from "@/features/reports/components/reports-filters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { AlertTriangle, CalendarDays, ClipboardCheck, DollarSign, FlaskConical, Package, UserPlus } from "lucide-react";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

function KpiCard({ title, value, icon }: KpiCardProps) {
  return (
    <Card className="group flex cursor-pointer items-center justify-between">
      <div className="space-y-1">
        <p className="text-[var(--text-sm)] font-normal text-[var(--text-secondary)]">{title}</p>
        <p className="text-[var(--text-3xl)] font-semibold leading-[var(--leading-3xl)] text-[var(--text-brand-strong)]">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)] opacity-70 transition-[background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] group-hover:bg-[var(--border-brand-light)]">
        {icon}
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const { branchId, setBranchId } = useActiveBranchFilter();

  const branches = useBranches(undefined, "ACTIVE");
  const report = useDashboardReport({ dateFrom, dateTo, branchId: branchId || undefined });

  const data = useMemo(() => (report.data?.data as any) ?? null, [report.data]);

  if (report.isLoading) return <LoadingState message="Cargando dashboard..." />;
  if (report.isError) return <ErrorState message={report.error.message} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Resumen operativo, financiero y clínico." />

      <ReportsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        branchId={branchId}
        branches={branches.data?.map((branch) => ({ id: branch.id, name: branch.name })) ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onBranchChange={setBranchId}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Citas"
          value={data?.agenda?.total ?? 0}
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <KpiCard
          title="Pacientes nuevos"
          value={data?.patients?.newPatients ?? 0}
          icon={<UserPlus className="h-5 w-5" />}
        />
        <KpiCard
          title="Ingresos"
          value={`$${Number(data?.finances?.income ?? 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KpiCard
          title="Saldos pendientes"
          value={`$${Number(data?.finances?.outstanding ?? 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="No asistencias"
          value={data?.agenda?.noShow ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <KpiCard
          title="Planes aceptados"
          value={data?.treatments?.plansAccepted ?? 0}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <KpiCard
          title="Laboratorio pendiente"
          value={data?.operation?.pendingLabOrders ?? 0}
          icon={<FlaskConical className="h-5 w-5" />}
        />
        <KpiCard
          title="Inventario bajo"
          value={data?.operation?.lowInventory ?? 0}
          icon={<Package className="h-5 w-5" />}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-[var(--space-6)] text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Ingresos vs Pendientes (Mensual)</h3>
          <div className="h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart
                data={[
                  { name: "Ene", ingresos: 4000, pendientes: 2400 },
                  { name: "Feb", ingresos: 3000, pendientes: 1398 },
                  { name: "Mar", ingresos: 2000, pendientes: 9800 },
                  { name: "Abr", ingresos: 2780, pendientes: 3908 },
                  { name: "May", ingresos: 1890, pendientes: 4800 },
                  { name: "Jun", ingresos: 2390, pendientes: 3800 },
                ]}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dx={-10} />
                <RechartsTooltip cursor={{ fill: "var(--bg-subtle)" }} contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card-hover)" }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "var(--space-5)" }} />
                <Bar dataKey="ingresos" name="Ingresos" fill="var(--action-primary)" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="pendientes" name="Pendientes" fill="var(--text-danger)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-[var(--space-6)] text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Citas Mensuales</h3>
          <div className="h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart
                data={[
                  { name: "Ene", citas: 120 },
                  { name: "Feb", citas: 150 },
                  { name: "Mar", citas: 180 },
                  { name: "Abr", citas: 140 },
                  { name: "May", citas: 190 },
                  { name: "Jun", citas: 210 },
                ]}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} dx={-10} />
                <RechartsTooltip contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-card-hover)" }} />
                <Line type="monotone" dataKey="citas" name="Total de Citas" stroke="var(--text-brand)" strokeWidth={3} dot={{ r: 4, fill: "var(--text-brand)", strokeWidth: 2, stroke: "var(--bg-surface)" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
