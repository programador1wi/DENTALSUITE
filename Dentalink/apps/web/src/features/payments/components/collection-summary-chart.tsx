import { useMemo, type ReactNode } from "react";
import { CalendarRange, CircleDollarSign, Gauge, ReceiptText, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { CollectionSummaryResponse } from "../services/payments.service";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type CollectionChartPoint = {
  date: string;
  amount: number;
  paymentsCount: number;
  averageTicket: number;
  share: number;
};

export function buildCollectionSummaryModel(data: CollectionSummaryResponse) {
  const start = new Date(data.dateFrom);
  const end = new Date(data.dateTo);
  const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS));
  const valuesByDate = new Map(data.byDay.map((row) => [row.date, row]));
  const firstDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const days = Array.from({ length: periodDays }, (_, index): CollectionChartPoint => {
    const currentDate = new Date(firstDay);
    currentDate.setUTCDate(firstDay.getUTCDate() + index);
    const date = currentDate.toISOString().slice(0, 10);
    const source = valuesByDate.get(date);
    const amount = Number(source?.amount ?? 0);
    const paymentsCount = Number(source?.paymentsCount ?? 0);

    return {
      date,
      amount,
      paymentsCount,
      averageTicket: paymentsCount > 0 ? amount / paymentsCount : 0,
      share: data.total > 0 ? (amount / data.total) * 100 : 0
    };
  });

  return {
    days,
    periodDays,
    activeDays: days.filter((day) => day.amount > 0).length,
    averagePerDay: data.total / periodDays,
    peakDay: days.reduce<CollectionChartPoint | null>(
      (peak, day) => (!peak || day.amount > peak.amount ? day : peak),
      null
    )
  };
}

function money(value: number) {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  });
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function dateFromKey(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-MX", options).format(new Date(`${value}T12:00:00`));
}

function shortDate(value: string) {
  return dateFromKey(value, { day: "2-digit", month: "short" });
}

function longDate(value: string) {
  return dateFromKey(value, { weekday: "long", day: "2-digit", month: "long" });
}

function periodDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  emphasized = false
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-[var(--radius-lg)] border-[0.5px] p-[var(--space-4)] ${
        emphasized
          ? "border-[var(--border-brand-light)] bg-[var(--bg-brand-light)]"
          : "border-[var(--border-default)] bg-[var(--bg-surface)]"
      }`}
    >
      <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)] text-[var(--text-secondary)]">
        {icon}
        <span className="text-xs font-medium uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p
        className={`truncate text-2xl font-semibold tabular-nums ${
          emphasized ? "text-[var(--text-brand-strong)]" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-[var(--space-1)] truncate text-xs text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

export function CollectionSummaryTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: CollectionChartPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  if (point.amount <= 0) {
    return (
      <div className="min-w-56 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] p-[var(--space-4)] shadow-[var(--shadow-card-hover)]">
        <p className="font-semibold capitalize text-[var(--text-primary)]">{longDate(point.date)}</p>
        <div className="my-[var(--space-3)] h-px bg-[var(--border-default)]" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">Sin recaudación registrada</p>
        <p className="mt-[var(--space-1)] text-xs text-[var(--text-secondary)]">
          No hubo pagos incluidos en reportería durante este día.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-56 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-strong)] bg-[var(--bg-surface)] p-[var(--space-4)] shadow-[var(--shadow-card-hover)]">
      <p className="font-semibold capitalize text-[var(--text-primary)]">{longDate(point.date)}</p>
      <div className="my-[var(--space-3)] h-px bg-[var(--border-default)]" />
      <dl className="space-y-[var(--space-2)] text-sm">
        <TooltipRow label="Recaudado" value={money(point.amount)} tone="success" />
        <TooltipRow label="Pagos incluidos" value={String(point.paymentsCount)} />
        <TooltipRow label="Ticket del día" value={money(point.averageTicket)} />
        <TooltipRow label="Participación" value={`${point.share.toFixed(1)}%`} />
      </dl>
    </div>
  );
}

function TooltipRow({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  const valueClass = tone === "success" ? "text-[var(--text-success)]" : "text-[var(--text-primary)]";
  return (
    <div className="flex items-center justify-between gap-[var(--space-6)]">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className={`font-medium tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}

export function CollectionSummaryChart({ data }: { data: CollectionSummaryResponse }) {
  const model = useMemo(() => buildCollectionSummaryModel(data), [data]);
  const peak = model.peakDay;
  const totalPayments = Number(
    data.totalPayments ?? data.byDay.reduce((sum, day) => sum + Number(day.paymentsCount ?? 0), 0)
  );
  const averageTicket = Number(
    data.averageTicket ?? (totalPayments > 0 ? data.total / totalPayments : 0)
  );

  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)]">
      <header className="border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-6)] py-[var(--space-5)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--space-4)]">
          <div>
            <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-brand)]">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              Comportamiento de recaudación
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-brand-strong)]">Recaudación diaria confirmada</h2>
            <p className="mt-[var(--space-1)] text-sm text-[var(--text-secondary)]">
              Del {periodDate(data.dateFrom)} al {periodDate(data.dateTo)} · medios incluidos en reportería
            </p>
          </div>
          <div className="rounded-[var(--radius-full)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] px-[var(--space-3)] py-[var(--space-2)] text-xs font-medium text-[var(--text-brand-strong)]">
            {model.activeDays} de {model.periodDays} días con actividad
          </div>
        </div>
      </header>

      <div className="p-[var(--space-6)]">
        <div className="grid gap-[var(--space-3)] sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            emphasized
            icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
            label="Total recaudado"
            value={money(data.total)}
            detail={`Promedio diario ${money(model.averagePerDay)}`}
          />
          <Metric
            icon={<ReceiptText className="h-4 w-4" aria-hidden="true" />}
            label="Pagos incluidos"
            value={totalPayments.toLocaleString("es-MX")}
            detail="Operaciones consideradas en reportería"
          />
          <Metric
            icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
            label="Ticket promedio"
            value={money(averageTicket)}
            detail="Promedio por pago incluido"
          />
          <Metric
            icon={<CalendarRange className="h-4 w-4" aria-hidden="true" />}
            label="Día de mayor ingreso"
            value={peak ? money(peak.amount) : money(0)}
            detail={peak ? shortDate(peak.date) : "Sin actividad en el periodo"}
          />
        </div>

        <div className="mt-[var(--space-6)] rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)] sm:p-[var(--space-5)]">
          <div className="mb-[var(--space-4)] flex flex-wrap items-center justify-between gap-[var(--space-3)]">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Recaudación por día</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Muestra únicamente el importe realmente recaudado en cada fecha.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-[var(--space-4)] text-xs text-[var(--text-secondary)]">
              <LegendMark className="bg-[var(--action-primary)]" label="Recaudación confirmada" />
              <LegendMark className="w-5 border-t border-dashed border-[var(--border-strong)]" label="Promedio diario" />
            </div>
          </div>

          <div
            className="h-[360px] w-full"
            role="img"
            aria-label={`Gráfica de recaudación del ${periodDate(data.dateFrom)} al ${periodDate(data.dateTo)}. Total ${money(data.total)}.`}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 960, height: 360 }}
            >
              <BarChart data={model.days} margin={{ top: 24, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="collectionAmountGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--action-primary)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--action-primary)" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border-default)" strokeDasharray="3 4" />
                <XAxis
                  dataKey="date"
                  axisLine={{ stroke: "var(--border-strong)" }}
                  tickLine={false}
                  tickFormatter={(value) => shortDate(String(value))}
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  minTickGap={18}
                />
                <YAxis
                  yAxisId="daily"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => compactMoney(Number(value))}
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  width={68}
                />
                <Tooltip
                  content={<CollectionSummaryTooltip />}
                  cursor={{ fill: "var(--bg-brand-light)", opacity: 0.5 }}
                />
                <ReferenceLine
                  yAxisId="daily"
                  y={model.averagePerDay}
                  stroke="var(--border-strong)"
                  strokeDasharray="5 5"
                />
                <Bar
                  yAxisId="daily"
                  dataKey="amount"
                  fill="url(#collectionAmountGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={52}
                  animationDuration={400}
                >
                  <LabelList
                    dataKey="amount"
                    position="top"
                    formatter={(value) => (Number(value) > 0 ? compactMoney(Number(value)) : "")}
                    fill="var(--text-primary)"
                    fontSize={11}
                    fontWeight={500}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="sr-only">
            <caption>Detalle diario de recaudación</caption>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Monto</th>
                <th>Pagos</th>
              </tr>
            </thead>
            <tbody>
              {model.days.map((day) => (
                <tr key={day.date}>
                  <td>{longDate(day.date)}</td>
                  <td>{money(day.amount)}</td>
                  <td>{day.paymentsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LegendMark({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-[var(--space-2)]">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} aria-hidden="true" /> {label}
    </span>
  );
}
