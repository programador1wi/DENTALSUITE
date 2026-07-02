import { Calendar, Download, ListTodo, Target, Users } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { OnlineSchedulingNav } from "../components/online-scheduling-nav";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getDashboardStats } from "../services/online-scheduling.service";

const periods = [
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "3 meses" },
  { id: "180", label: "6 meses" }
];

const days = [
  "Abr 23",
  "Abr 24",
  "Abr 25",
  "Abr 26",
  "Abr 27",
  "Abr 28",
  "Abr 29",
  "Abr 30",
  "May 1",
  "May 2"
];

export function DashboardTab() {
  const [activeTab, setActiveTab] = useState<"visits" | "campaigns">("visits");
  const [period, setPeriod] = useState("30");
  const [grain, setGrain] = useState("day");

  const { data, isLoading } = useQuery({
    queryKey: ['online-scheduling-dashboard', period, grain],
    queryFn: () => getDashboardStats(period, grain)
  });

  const summary = data?.summary || { visits: 0, appointments: 0, conversionRate: 0 };
  const byDay = data?.byDay || [];
  const byCampaign = data?.byCampaign || [];

  return (
    <OnlineSchedulingNav>
      <div className="space-y-4 bg-slate-50 px-5 py-5">
        <div className="flex gap-6 border-b border-slate-200 text-sm font-semibold">
          <DashboardSubtab active={activeTab === "visits"} label="Analisis visitas" onClick={() => setActiveTab("visits")} />
          <DashboardSubtab
            active={activeTab === "campaigns"}
            label="Analisis campanas"
            onClick={() => setActiveTab("campaigns")}
          />
        </div>

        {activeTab === "campaigns" ? (
          <Card className="flex flex-col min-h-72 items-center justify-center p-6 text-sm text-slate-800">
            {isLoading ? (
              <p>Cargando campañas...</p>
            ) : byCampaign.length === 0 ? (
              <p className="text-slate-400">No hay datos de campañas para el periodo seleccionado.</p>
            ) : (
              <table className="w-full text-left mt-4 border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 border-b">Campaña</th>
                    <th className="px-4 py-2 border-b text-right">Visitas</th>
                    <th className="px-4 py-2 border-b text-right">Citas</th>
                    <th className="px-4 py-2 border-b text-right">Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {byCampaign.map((c: any) => (
                    <tr key={c.campaignCode} className="border-b">
                      <td className="px-4 py-2">{c.campaignName} ({c.campaignCode})</td>
                      <td className="px-4 py-2 text-right">{c.visits}</td>
                      <td className="px-4 py-2 text-right">{c.appointments}</td>
                      <td className="px-4 py-2 text-right">{c.conversionRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <span className="px-1 font-medium text-slate-600">Ultimos:</span>
              <div className="flex overflow-hidden rounded border border-slate-200 bg-white">
                {periods.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPeriod(item.id)}
                    className={cn(
                      "px-3 py-2 transition-colors",
                      period === item.id ? "bg-[#0679c8] text-white" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button type="button" className="flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-2 text-slate-600">
                <Calendar className="h-4 w-4" />
                Fecha personalizada
              </button>
              <Button type="button" variant="secondary" className="h-10 gap-1.5 bg-white">
                Descargar reporte <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Metric icon={<Users className="h-7 w-7 text-sky-500" />} label="Visitas unicas totales" value={summary.visits} />
              <Metric icon={<Calendar className="h-7 w-7 text-sky-500" />} label="Citas agendadas" value={summary.appointments} />
              <Metric icon={<Target className="h-7 w-7 text-sky-500" />} label="Conversion" value={`${summary.conversionRate.toFixed(1)}%`} />
            </div>

            <Card className="rounded-lg p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-950">Visitas vs Citas agendadas</h3>
                <div className="flex overflow-hidden rounded text-xs">
                  {[
                    { id: "day", label: "Dia" },
                    { id: "week", label: "Semana" },
                    { id: "month", label: "Mes" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGrain(item.id)}
                      className={cn(
                        "px-3 py-2",
                        grain === item.id ? "bg-sky-100 font-semibold text-sky-700" : "bg-white text-slate-300"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative flex h-64 min-w-0 flex-col justify-center">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <LineChart
                    data={byDay}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Line type="monotone" dataKey="visitas" stroke="#3498db" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="citas" stroke="#e74c3c" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-slate-600">
                <Legend color="#3498db" label="Visitas" />
                <Legend color="#e74c3c" label="Citas agendadas" />
              </div>
            </Card>

            <Card className="overflow-hidden rounded-lg p-0">
              <div className="grid min-w-[720px] grid-cols-[170px_1fr] overflow-x-auto">
                <div className="border-r border-slate-200 text-center text-sm font-medium text-slate-400">
                  <div className="border-b border-slate-200 px-3 py-3">Eventos</div>
                  <div className="border-b border-slate-100 px-3 py-3">Total visitas</div>
                  <div className="border-b border-slate-100 px-3 py-3">Total citas agendadas</div>
                  <div className="px-3 py-3">Citas agendadas / Visitas</div>
                </div>
                <div>
                  <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `repeat(${byDay.length || 1}, minmax(0, 1fr))` }}>
                    {byDay.map((d: any) => (
                      <div key={d.date} className="border-r border-slate-100 px-2 py-3 text-center text-xs text-slate-400 last:border-r-0">
                        {d.date}
                      </div>
                    ))}
                  </div>
                  <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `repeat(${byDay.length || 1}, minmax(0, 1fr))` }}>
                    {byDay.map((d: any) => (
                      <div key={`v-${d.date}`} className="border-r border-slate-100 px-2 py-3 text-center text-xs text-slate-800 last:border-r-0">
                        {d.visitas}
                      </div>
                    ))}
                  </div>
                  <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `repeat(${byDay.length || 1}, minmax(0, 1fr))` }}>
                    {byDay.map((d: any) => (
                      <div key={`c-${d.date}`} className="border-r border-slate-100 px-2 py-3 text-center text-xs text-slate-800 last:border-r-0">
                        {d.citas}
                      </div>
                    ))}
                  </div>
                  <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `repeat(${byDay.length || 1}, minmax(0, 1fr))` }}>
                    {byDay.map((d: any) => (
                      <div key={`r-${d.date}`} className="border-r border-slate-100 px-2 py-3 text-center text-xs text-slate-800 last:border-r-0">
                        {d.visitas > 0 ? ((d.citas / d.visitas) * 100).toFixed(1) + '%' : '0%'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </OnlineSchedulingNav>
  );
}

function DashboardSubtab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("border-b-2 pb-2", active ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500")}
    >
      {label}
    </button>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="flex min-h-28 items-center gap-4 rounded-lg p-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-300">{icon}</span>
      <span>
        <span className="block text-sm font-medium text-slate-500">{label}</span>
        <span className="block text-2xl font-semibold text-slate-800">{value}</span>
      </span>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
