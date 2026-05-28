import { useMemo, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CalendarCheck2, CheckCircle2, FileCheck2, RefreshCw, Search, UsersRound } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePatientsAnalysis } from "../hooks/use-patients";
import type { PatientAnalysisDistribution, PatientAnalysisResponse } from "../services/patients.service";
import { PatientsModuleTabs } from "../components/patients-module-tabs";

const chartColors = [
  "#2f80c1",
  "#55b95a",
  "#f2ab43",
  "#d95555",
  "#26a6a1",
  "#7967c5",
  "#8aa0b6",
  "#d8843f",
  "#4f8f4a"
];

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthsAgo(offset: number) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - offset);
  return monthValue(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(value);
}

function formatUpdatedAt(value?: string) {
  if (!value) return "Sin actualizar";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-[890px] text-center">
      <h1 className="text-[18px] font-bold uppercase text-[#0784d8]">{title}</h1>
      <div className="mx-auto my-5 flex max-w-[760px] items-center justify-center">
        <div className="h-px flex-1 bg-slate-200" />
        <div className="mx-4 h-8 w-8 rotate-45 border border-slate-200 bg-[#0784d8]" />
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <p className="mx-auto max-w-[780px] text-[14px] leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function MetricTile({
  title,
  value,
  detail,
  color,
  icon
}: {
  title: string;
  value: string;
  detail: string;
  color: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-h-[112px] border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase text-slate-500">{title}</p>
          <p className="mt-2 text-[28px] font-bold leading-none" style={{ color }}>
            {value}
          </p>
        </div>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-white"
          style={{ backgroundColor: color }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function ConversionFunnel({ data }: { data: PatientAnalysisResponse["conversion"]["funnel"] }) {
  if (!data.length) return null;

  return (
    <div>
      <h3 className="mb-4 text-center text-[14px] font-bold text-slate-800">Conversion total del periodo</h3>
      <div className="mx-auto flex w-[260px] flex-col items-center gap-[3px]">
        {data.map((stage, index) => {
          const width = 260 - index * 38;
          const height = index === data.length - 1 ? 34 : 84 - index * 14;
          return (
            <div
              key={stage.key}
              className="flex items-center justify-center px-5 text-center text-white"
              style={{
                width,
                height,
                backgroundColor: stage.color,
                clipPath: "polygon(0 0, 100% 0, 84% 100%, 16% 100%)"
              }}
            >
              <div>
                <p className="text-[22px] font-bold leading-none">{Math.round(stage.percent)}%</p>
                <p className="mt-1 text-[11px] font-medium leading-4">{formatNumber(stage.value)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: PatientAnalysisResponse["conversion"]["monthly"] }) {
  return (
    <div>
      <h3 className="mb-4 text-center text-[14px] font-bold text-slate-800">
        Conversion de pacientes a traves del tiempo
      </h3>
      <div className="h-[290px] border border-slate-200 bg-white p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#e5e7eb" vertical />
            <XAxis
              dataKey="month"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#d9e2ec" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#d9e2ec" }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
              contentStyle={{
                border: "1px solid #dbe3ee",
                borderRadius: 6,
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)"
              }}
            />
            <Line
              type="monotone"
              name="Citas agendadas"
              dataKey="scheduledAppointments"
              stroke="#2f80c1"
              strokeWidth={3}
              dot={{ r: 4, fill: "white", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              name="Citas confirmadas"
              dataKey="confirmedAppointments"
              stroke="#55b95a"
              strokeWidth={3}
              dot={{ r: 4, fill: "white", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              name="Presupuestos aceptados"
              dataKey="acceptedBudgets"
              stroke="#f2ab43"
              strokeWidth={3}
              dot={{ r: 4, fill: "white", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DistributionDonut({ title, data }: { title: string; data: PatientAnalysisDistribution[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-center text-[13px] font-semibold text-slate-700">{title}</h3>
      <div className="h-[122px]">
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={34}
                outerRadius={55}
                paddingAngle={2}
                stroke="white"
                strokeWidth={2}
              >
                {data.map((item, index) => (
                  <Cell key={item.label} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [formatNumber(Number(value ?? 0)), String(name)]}
                contentStyle={{ borderRadius: 6, border: "1px solid #dbe3ee" }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-slate-200 text-[12px] text-slate-400">
            Sin datos
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        {data.slice(0, 6).map((item, index) => (
          <div
            key={item.label}
            className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-[11px] leading-4 text-slate-600"
          >
            <span
              className="h-2.5 w-2.5"
              style={{ backgroundColor: chartColors[index % chartColors.length] }}
            />
            <span className="truncate">{item.label}</span>
            <span className="font-medium text-slate-700">{Math.round(item.percent)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalsPanel({ analysis }: { analysis: PatientAnalysisResponse }) {
  const totals = analysis.conversion.totals;
  return (
    <div className="mx-auto max-w-[540px] text-center">
      <h3 className="mb-3 text-[14px] font-bold text-slate-800">
        Valores totales de conversion para el periodo
      </h3>
      <div className="grid grid-cols-1 border border-slate-200 bg-white sm:grid-cols-3">
        <MetricBox
          title="Citas agendadas"
          value="100%"
          count={totals.scheduledAppointments}
          color="#2f80c1"
        />
        <MetricBox
          title="Citas confirmadas"
          value={`${Math.round(totals.confirmedRate)}%`}
          count={totals.confirmedAppointments}
          color="#55b95a"
        />
        <MetricBox
          title="Presupuestos aceptados"
          value={`${Math.round(totals.acceptedRate)}%`}
          count={totals.acceptedBudgets}
          color="#f2ab43"
        />
      </div>
      <p className="mt-3 text-[12px] text-slate-500">
        Presupuestos aceptados: {formatMoney(totals.acceptedBudgetAmount)}
      </p>
    </div>
  );
}

function MetricBox({
  title,
  value,
  count,
  color
}: {
  title: string;
  value: string;
  count: number;
  color: string;
}) {
  return (
    <div
      className="border-b border-slate-200 p-4 text-white last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
      style={{ backgroundColor: color }}
    >
      <p className="text-[12px] font-medium leading-4">{title}</p>
      <p className="mt-2 text-[28px] font-bold leading-none">{value}</p>
      <p className="mt-2 bg-white/85 py-1 text-[12px] font-semibold" style={{ color }}>
        {formatNumber(count)}
      </p>
    </div>
  );
}

function GlobalStatCard({ stat }: { stat: PatientAnalysisResponse["globalStats"][number] }) {
  const tone = {
    green: { bg: "#55b95a", bar: "#e6f4e7" },
    red: { bg: "#d95555", bar: "#fde8e8" },
    blue: { bg: "#2f80c1", bar: "#e4f0fb" },
    amber: { bg: "#f2ab43", bar: "#fff0d8" }
  }[stat.tone];
  const max = Math.max(...stat.trend, 1);
  const value =
    stat.format === "money"
      ? formatMoney(stat.value)
      : stat.format === "percent"
        ? `${Math.round(stat.value)}%`
        : formatNumber(stat.value);

  return (
    <div className="overflow-hidden border border-slate-200 bg-white">
      <div className="p-4 text-white" style={{ backgroundColor: tone.bg }}>
        <p className="text-[22px] font-bold leading-none">{value}</p>
        <p className="mt-1 text-[13px] font-semibold leading-4">{stat.label}</p>
      </div>
      <div className="flex h-[78px] items-end gap-2 px-5 pt-4" style={{ backgroundColor: tone.bar }}>
        {stat.trend.map((value, index) => (
          <span
            key={`${stat.key}-${index}`}
            className="min-h-[5px] flex-1"
            style={{ height: `${Math.max(8, (value / max) * 58)}px`, backgroundColor: tone.bg }}
          />
        ))}
      </div>
      <div
        className="border-t border-white/50 px-4 py-3 text-[12px] font-semibold"
        style={{ color: tone.bg }}
      >
        Ver detalles
      </div>
    </div>
  );
}

function DetailList({ title, data }: { title: string; data: PatientAnalysisDistribution[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-[13px] font-bold uppercase text-slate-700">{title}</h3>
      <div className="space-y-2">
        {data.length ? (
          data.slice(0, 6).map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[12px] text-slate-600">
                <span className="truncate">{item.label}</span>
                <span className="font-semibold text-slate-800">{formatNumber(item.value)}</span>
              </div>
              <div className="h-1.5 bg-slate-100">
                <div
                  className="h-full bg-[#0784d8]"
                  style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-[12px] text-slate-400">Sin datos para este filtro.</p>
        )}
      </div>
    </div>
  );
}

export function PatientsAnalysisPage() {
  const [draftFrom, setDraftFrom] = useState(monthsAgo(11));
  const [draftTo, setDraftTo] = useState(monthsAgo(0));
  const [draftBranchId, setDraftBranchId] = useState("");
  const [filters, setFilters] = useState({ from: draftFrom, to: draftTo, branchId: "" });

  const branches = useBranches(undefined, "ACTIVE");
  const analysis = usePatientsAnalysis({
    from: filters.from,
    to: filters.to,
    branchId: filters.branchId || undefined
  });
  const selectedBranchName = useMemo(() => {
    if (!filters.branchId) return "Todas las sucursales";
    return (
      branches.data?.find((branch) => branch.id === filters.branchId)?.name ??
      analysis.data?.filters.branchName ??
      "Sucursal"
    );
  }, [analysis.data?.filters.branchName, branches.data, filters.branchId]);

  return (
    <WarnerSuitePanel className="min-h-[720px]">
      <PatientsModuleTabs />
      <div className="px-5 py-10 md:px-9 md:py-14">
        <SectionTitle
          title="Conversion de los pacientes"
          description="Esta vista cruza citas, confirmaciones, presupuestos aceptados y datos generales de pacientes para medir como se comporta cada sucursal durante el periodo seleccionado."
        />

        <div className="mx-auto mt-12 max-w-[760px]">
          <h2 className="mb-4 text-center text-[14px] font-bold text-slate-800">Filtrar los resultados</h2>
          <div className="grid gap-2 md:grid-cols-[150px_150px_1fr_auto]">
            <Input
              type="month"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              aria-label="Mes inicial"
            />
            <Input
              type="month"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              aria-label="Mes final"
            />
            <Select
              value={draftBranchId}
              onChange={(event) => setDraftBranchId(event.target.value)}
              aria-label="Sucursal"
            >
              <option value="">Todas las sucursales</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="h-10 bg-[#086ccc] px-4 text-white hover:bg-[#075eb1] hover:text-white"
              onClick={() => setFilters({ from: draftFrom, to: draftTo, branchId: draftBranchId })}
            >
              <Search className="h-4 w-4" />
              Filtrar
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[12px] text-slate-500">
            <span>Sucursal: {selectedBranchName}</span>
            <span>Ultima actualizacion: {formatUpdatedAt(analysis.data?.filters.updatedAt)}</span>
            <button
              className="inline-flex items-center gap-1 text-[#0784d8]"
              type="button"
              onClick={() => void analysis.refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar
            </button>
          </div>
        </div>

        {analysis.isLoading ? (
          <div className="mt-10">
            <LoadingState message="Cargando analisis de pacientes..." />
          </div>
        ) : analysis.isError ? (
          <div className="mt-10">
            <ErrorState message={analysis.error.message} />
          </div>
        ) : analysis.data ? (
          <AnalysisContent analysis={analysis.data} />
        ) : null}
      </div>
    </WarnerSuitePanel>
  );
}

function AnalysisContent({ analysis }: { analysis: PatientAnalysisResponse }) {
  const totals = analysis.conversion.totals;
  const distributions = analysis.patientData.distributions;

  return (
    <div className="mt-10 space-y-14">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile
          title="Citas agendadas"
          value={formatNumber(totals.scheduledAppointments)}
          detail="Citas con paciente dentro del periodo."
          color="#2f80c1"
          icon={<CalendarCheck2 className="h-5 w-5" />}
        />
        <MetricTile
          title="Citas confirmadas"
          value={formatNumber(totals.confirmedAppointments)}
          detail={`${Math.round(totals.confirmedRate)}% sobre citas agendadas.`}
          color="#55b95a"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricTile
          title="Presupuestos aceptados"
          value={formatNumber(totals.acceptedBudgets)}
          detail={`${Math.round(totals.acceptedRate)}% sobre citas agendadas.`}
          color="#f2ab43"
          icon={<FileCheck2 className="h-5 w-5" />}
        />
        <MetricTile
          title="Usuarios vinculados"
          value={formatNumber(analysis.branchContext.userCount)}
          detail={analysis.branchContext.name}
          color="#26a6a1"
          icon={<UsersRound className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        <ConversionFunnel data={analysis.conversion.funnel} />
        <TrendChart data={analysis.conversion.monthly} />
      </div>

      <TotalsPanel analysis={analysis} />

      <SectionTitle
        title="Datos genericos de los pacientes"
        description="Los datos representan la poblacion visible para la sucursal seleccionada. Algunas categorias pueden mostrar valores sin clasificar cuando el expediente no tiene ese campo capturado."
      />

      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DistributionDonut title="Edad" data={distributions.age} />
        <DistributionDonut title="Genero" data={distributions.gender} />
        <DistributionDonut title="Delegacion" data={distributions.delegation} />
        <DistributionDonut title="Medios de pago" data={distributions.paymentMethods} />
        <DistributionDonut title="Categoria de acciones" data={distributions.actionCategories} />
        <DistributionDonut title="Estado de las citas" data={distributions.appointmentStatus} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailList title="Fuente de pacientes" data={distributions.sources} />
        <DetailList title="Estado de pacientes" data={distributions.patientStatus} />
      </div>

      <SectionTitle
        title="Estadisticas globales de los pacientes"
        description="Estos indicadores resumen el volumen de pacientes, deuda, asistencia y presupuestos pendientes. Las barras muestran la evolucion mensual dentro del rango filtrado."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analysis.globalStats.map((stat) => (
          <GlobalStatCard key={stat.key} stat={stat} />
        ))}
      </div>

      {analysis.branchContext.users.length ? (
        <div className="border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-[13px] font-bold uppercase text-slate-700">
            Usuarios vinculados a la sucursal
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {analysis.branchContext.users.map((user) => (
              <div
                key={user.id}
                className="flex min-w-0 items-center justify-between gap-3 border border-slate-100 px-3 py-2 text-[12px]"
              >
                <span className="truncate font-semibold text-slate-700">{user.name}</span>
                <span className="truncate text-slate-500">{user.email}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
