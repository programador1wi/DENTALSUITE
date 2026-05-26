import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useDashboardReport } from "@/features/reports/hooks/use-reports";
import { ReportsFilters } from "@/features/reports/components/reports-filters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

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
    <Card
      className="hover:border-zinc-300/80 transition-all duration-200 flex items-center justify-between bg-white group cursor-pointer shadow-none"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-semibold text-zinc-900 tracking-tight">{value}</p>
      </div>
      <div className="h-10 w-10 rounded-lg bg-zinc-50 border border-zinc-100/80 text-zinc-400 group-hover:border-zinc-200/80 group-hover:bg-zinc-100/50 group-hover:text-zinc-600 flex items-center justify-center transition-all duration-200">
        {icon}
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const [dateFrom, setDateFrom] = useState(monthStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [branchId, setBranchId] = useState("");

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
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
            </svg>
          }
        />
        <KpiCard
          title="Pacientes nuevos"
          value={data?.patients?.newPatients ?? 0}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
        />
        <KpiCard
          title="Ingresos"
          value={`$${Number(data?.finances?.income ?? 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          title="Saldos pendientes"
          value={`$${Number(data?.finances?.outstanding ?? 0).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="No asistencias"
          value={data?.agenda?.noShow ?? 0}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          title="Planes aceptados"
          value={data?.treatments?.plansAccepted ?? 0}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        <KpiCard
          title="Laboratorio pendiente"
          value={data?.operation?.pendingLabOrders ?? 0}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          }
        />
        <KpiCard
          title="Inventario bajo"
          value={data?.operation?.lowInventory ?? 0}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-6 text-base font-semibold text-zinc-900">Ingresos vs Pendientes (Mensual)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="pendientes" name="Pendientes" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-6 text-base font-semibold text-zinc-900">Citas Mensuales</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="citas" name="Total de Citas" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}


