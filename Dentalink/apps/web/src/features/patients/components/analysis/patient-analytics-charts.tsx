import { ArrowDownRight, Eye, ShieldCheck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import type {
  PatientAnalysisDistribution,
  PatientAnalysisResponse
} from "../../services/patients.service";

const COLORS = ["#087f73", "#2b6cb0", "#d97706", "#be123c", "#7c3aed", "#0f766e", "#64748b", "#c2410c"];
const FUNNEL_COLORS = ["#176b87", "#16877b", "#d88914"];
const GLOBAL_DETAIL_METRICS: Record<string, string> = {
  totalPatients: "patients",
  averageAttendance: "attendance",
  accumulatedDebt: "debt",
  pendingBudgets: "pending-budgets"
};

export function resolvePatientAnalyticsGlobalDetailMetric(metric: string) {
  return GLOBAL_DETAIL_METRICS[metric] ?? metric;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function ConversionSection({
  analysis,
  onOpenDetail
}: {
  analysis: PatientAnalysisResponse;
  onOpenDetail: (metric: string, title: string) => void;
}) {
  const totals = analysis.conversion.totals;
  return (
    <section className="space-y-4" aria-labelledby="conversion-title">
      <SectionHeading
        id="conversion-title"
        eyebrow="Ruta comercial-clinica"
        title="Conversion de pacientes"
        description="Cada cita entra una sola vez. Confirmacion usa historial auditable; aceptacion exige evidencia clinica al 100% en el plan vinculado."
        headingLevel="h2"
      />

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.8fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Embudo del periodo</h3>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Base: {formatNumber(totals.scheduledAppointments)} citas agendadas
            </p>
          </div>
          <div className="space-y-3 p-5">
            {analysis.conversion.funnel.map((stage, index) => (
              <button
                key={stage.key}
                type="button"
                data-allow-multiline
                className="group block w-full text-left"
                onClick={() => onOpenDetail(stage.key, stage.label)}
              >
                <div
                  className="mx-auto rounded-md px-4 py-3 text-white shadow-sm transition-transform group-hover:-translate-y-0.5"
                  style={{
                    width: `${Math.max(48, 100 - index * 20)}%`,
                    backgroundColor: FUNNEL_COLORS[index]
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold">{stage.label}</span>
                    <strong className="text-lg">{Math.round(stage.percent)}%</strong>
                  </div>
                  <span className="text-[11px] text-white/80">{formatNumber(stage.value)} registros</span>
                </div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <div className="border-r border-[var(--border-subtle)] p-3 text-center">
              <p className="text-[11px] text-[var(--text-secondary)]">Confirmadas / agendadas</p>
              <strong className="text-sm text-[var(--text-primary)]">{formatPercent(totals.confirmedRate)}%</strong>
            </div>
            <div className="p-3 text-center">
              <p className="text-[11px] text-[var(--text-secondary)]">Aceptadas / confirmadas</p>
              <strong className="text-sm text-[var(--text-primary)]">
                {formatPercent(totals.confirmedToAcceptedRate)}%
              </strong>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Evolucion en el tiempo</h3>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                Cantidades y tasas calculadas con zona horaria {analysis.metadata.timezone}.
              </p>
            </div>
            <Badge value={analysis.metadata.granularity} tone="brand" />
          </div>
          <div className="sr-only">
            <table aria-label="Evolución de la conversión de pacientes en el tiempo">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Citas agendadas</th>
                  <th>Citas confirmadas</th>
                  <th>Presupuestos aceptados</th>
                </tr>
              </thead>
              <tbody>
                {analysis.conversion.trend.map(point => (
                  <tr key={point.label}>
                    <td>{point.label}</td>
                    <td>{point.scheduledAppointments}</td>
                    <td>{point.confirmedAppointments} ({formatPercent(point.confirmedRate)}%)</td>
                    <td>{point.acceptedBudgets} ({formatPercent(point.acceptedRate)}%)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-[310px] min-w-0" aria-hidden="true">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 1, height: 1 }}
            >
              <LineChart data={analysis.conversion.trend} margin={{ top: 8, right: 10, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 5" stroke="var(--border-subtle)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
                <Tooltip
                  formatter={(value, name, item) => {
                    const point = item.payload as PatientAnalysisResponse["conversion"]["trend"][number];
                    const suffix =
                      name === "Citas confirmadas"
                        ? ` (${formatPercent(point.confirmedRate)}%)`
                        : name === "Presupuestos aceptados"
                          ? ` (${formatPercent(point.acceptedRate)}%)`
                          : "";
                    return [`${formatNumber(Number(value))}${suffix}`, name];
                  }}
                  contentStyle={{
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-card-hover)"
                  }}
                />
                <Line type="monotone" dataKey="scheduledAppointments" name="Citas agendadas" stroke={FUNNEL_COLORS[0]} strokeWidth={2.4} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="confirmedAppointments" name="Citas confirmadas" stroke={FUNNEL_COLORS[1]} strokeWidth={2.4} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="acceptedBudgets" name="Presupuestos aceptados" stroke={FUNNEL_COLORS[2]} strokeWidth={2.4} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}

export function DemographicsSection({ analysis }: { analysis: PatientAnalysisResponse }) {
  return (
    <section className="space-y-4" aria-labelledby="demographics-title">
      <SectionHeading
        id="demographics-title"
        eyebrow="Calidad y composicion"
        title="Datos genericos de pacientes"
        description="Cada grafica declara su universo. Los valores sin informacion permanecen visibles: ocultarlos falsearia la calidad del expediente."
        headingLevel="h2"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {analysis.demographics.map((metric) => (
          <DistributionCard key={metric.key} metric={metric} />
        ))}
      </div>
    </section>
  );
}

function DistributionCard({
  metric
}: {
  metric: PatientAnalysisResponse["demographics"][number];
}) {
  const visible = metric.data.slice(0, 7);
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{metric.label}</h3>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{metric.universe}</p>
        </div>
        <HelpTooltip content={`${metric.formula}. Omitidos: ${metric.omitted}.`} />
      </div>
      <div className="sr-only">
        <table aria-label={`Distribución de pacientes por ${metric.label.toLowerCase()}`}>
          <thead>
            <tr>
              <th>{metric.label}</th>
              <th>Cantidad</th>
              <th>Porcentaje</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(item => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td>{item.value}</td>
                <td>{formatPercent(item.percent ?? 0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mx-auto mt-2 h-[150px] w-full min-w-0 max-w-[220px]" aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={1}
          minHeight={1}
          initialDimension={{ width: 1, height: 1 }}
        >
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="label"
              innerRadius={43}
              outerRadius={64}
              paddingAngle={2}
              stroke="transparent"
            >
              {visible.map((item, index) => (
                <Cell key={item.key} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, _name, item) => [`${formatNumber(Number(value))} (${formatPercent((item.payload as PatientAnalysisDistribution).percent)}%)`, (item.payload as PatientAnalysisDistribution).label]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5">
        {visible.slice(0, 5).map((item, index) => (
          <div key={item.key} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="min-w-0 truncate text-[var(--text-secondary)]">
              <i className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              {item.label}
            </span>
            <strong className="shrink-0 text-[var(--text-primary)]">{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-tertiary)]">
        <span>n={formatNumber(metric.denominator)}</span>
        <span>Omitidos: {formatNumber(metric.omitted)}</span>
      </div>
    </Card>
  );
}

export function GlobalMetricsSection({
  analysis,
  onOpenDetail
}: {
  analysis: PatientAnalysisResponse;
  onOpenDetail: (metric: string, title: string) => void;
}) {
  return (
    <section className="space-y-4" aria-labelledby="global-title">
      <SectionHeading
        id="global-title"
        eyebrow="Lectura ejecutiva"
        title="Estadisticas globales"
        description="Indicadores consolidados sin mezclar monedas. Los importes financieros desaparecen por contrato API cuando falta permiso."
        headingLevel="h2"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analysis.globalMetrics.map((metric, index) => (
          <Card key={metric.key} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  {metric.label}
                </p>
                <MetricValue metric={metric} />
              </div>
              <HelpTooltip content={`${metric.formula}. Universo: ${metric.denominator}`} />
            </div>
            {metric.trend.length ? (
              <div className="mt-5 flex h-12 items-end gap-1" aria-label="Tendencia de seis periodos">
                {metric.trend.map((value, trendIndex) => {
                  const max = Math.max(...metric.trend, 1);
                  return (
                    <span
                      key={`${metric.key}-${trendIndex}`}
                      className="flex-1 rounded-t-sm bg-[var(--brand-primary)]/70"
                      style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 flex h-12 items-center rounded-md bg-[var(--bg-subtle)] px-3 text-[11px] text-[var(--text-secondary)]">
                <ShieldCheck className="mr-2 h-4 w-4 text-[var(--brand-primary)]" />
                Importe reconciliado por moneda
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full justify-between"
              onClick={() => onOpenDetail(resolvePatientAnalyticsGlobalDetailMetric(metric.key), metric.label)}
            >
              Ver detalles
              <Eye className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}

function MetricValue({ metric }: { metric: PatientAnalysisResponse["globalMetrics"][number] }) {
  if (metric.values?.length) {
    return (
      <div className="mt-3 space-y-1">
        {metric.values.map((entry) => (
          <div key={entry.currency} className="flex items-baseline gap-2">
            <strong className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {formatMoney(entry.value, entry.currency)}
            </strong>
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">{entry.currency}</span>
          </div>
        ))}
        {!metric.values.length ? <span className="text-xl font-semibold">Sin saldo</span> : null}
      </div>
    );
  }
  const value = metric.value ?? 0;
  return (
    <div className="mt-3 flex items-end gap-2">
      <strong className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
        {metric.format === "percent" ? `${formatPercent(value)}%` : formatNumber(value)}
      </strong>
      <ArrowDownRight className="mb-1 h-4 w-4 text-[var(--brand-primary)]" />
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  headingLevel: Heading = "h2"
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-col gap-2 border-l-4 border-[var(--brand-primary)] pl-4 md:flex-row md:items-end md:justify-between md:gap-8">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-primary)]">{eyebrow}</p>
        <Heading id={id} className="mt-1 text-xl font-semibold text-[var(--text-brand-strong)]">
          {title}
        </Heading>
      </div>
      <p className="max-w-2xl text-[12px] leading-5 text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
