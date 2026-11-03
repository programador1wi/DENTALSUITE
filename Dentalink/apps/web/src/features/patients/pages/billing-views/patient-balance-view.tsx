import { useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { Activity, BarChart3, BookOpen, ClipboardList, CreditCard, Gauge, Landmark } from "lucide-react";
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  usePatientBalance,
  usePatientBalanceByPlan,
  usePatientLedger,
  usePatientPaymentBehavior,
  usePatientPaymentDistribution
} from "@/features/payments/hooks/use-payments";
import type {
  BalanceByPlanRow,
  PatientBalance,
  PatientLedgerEntry,
  PaymentBehaviorPoint,
  PaymentDistributionRow
} from "@/features/payments/services/payments.service";
import { dateOnly, money } from "./shared-helpers";

const distributionColors: Record<string, string> = {
  performedProcedures: "#5acb69",
  pendingProcedures: "#61c96f",
  overdueInstallments: "#f2a24a",
  futureInstallments: "#2f80c1"
};

const entryTypeLabels: Record<string, string> = {
  CHARGE: "Cargo",
  PAYMENT: "Pago",
  REFUND: "Devolucion",
  VOID: "Anulacion",
  ADJUSTMENT: "Ajuste",
  COVERAGE: "Cobertura"
};

export function PatientBalanceView() {
  const { id = "" } = useParams();
  const balance = usePatientBalance(id);
  const behavior = usePatientPaymentBehavior(id);
  const distribution = usePatientPaymentDistribution(id);
  const byPlan = usePatientBalanceByPlan(id);
  const ledger = usePatientLedger(id);

  if (balance.isLoading) return <LoadingState message="Cargando balance del paciente..." />;
  if (balance.isError) return <ErrorState message={balance.error.message} />;
  if (!balance.data) {
    return (
      <EmptyState
        title="No existen movimientos financieros para calcular el Balance."
        description="No hay datos financieros disponibles para este paciente."
      />
    );
  }

  const generalBalance = balance.data.confirmedBalance - balance.data.freeCreditBalance;
  const assignedPayments = Math.max(balance.data.totalPaidAmount - balance.data.freeCreditBalance, 0);
  const balanceState = generalBalance > 0 ? "Pendiente" : generalBalance < 0 ? "A favor" : "Sin saldo";
  const paidRatio = percentOf(balance.data.allocatedPaidAmount, balance.data.plannedAmount);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Balance paciente</h2>
          <p className="text-sm text-slate-500">Estado financiero consolidado del paciente.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <Landmark className="h-4 w-4 text-[#0879d5]" />
          <span className="font-medium text-slate-900">Planificado {money(balance.data.plannedAmount)}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.5fr)]">
        <BalanceHero
          balance={balance.data}
          generalBalance={generalBalance}
          assignedPayments={assignedPayments}
          balanceState={balanceState}
          paidRatio={paidRatio}
        />

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Gauge className="h-4 w-4 text-[#0879d5]" />
              Lectura rapida
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            <FinancialSignal label="Saldo exigible" value={money(balance.data.currentDueBalance)} tone="danger" />
            <FinancialSignal label="Saldo futuro" value={money(balance.data.futureBalance)} />
            <FinancialSignal label="Cobertura pendiente" value={money(balance.data.projectedCoverage)} tone="success" />
            <FinancialSignal label="Saldo proyectado" value={money(balance.data.projectedBalance)} />
            <FinancialSignal label="Devoluciones" value={money(balance.data.refundedAmount)} tone="danger" />
          </div>
        </Card>
      </div>

      <BalancePanel title="Comportamiento de pago del paciente" icon={<Activity className="h-4 w-4" />}>
        {behavior.isLoading ? (
          <LoadingState message="Cargando comportamiento de pago..." />
        ) : behavior.isError ? (
          <ErrorState message={behavior.error.message} />
        ) : (
          <PaymentBehaviorChart rows={behavior.data ?? []} />
        )}
      </BalancePanel>

      <BalancePanel title="Distribucion de los pagos del paciente" icon={<BarChart3 className="h-4 w-4" />}>
        {distribution.isLoading ? (
          <LoadingState message="Cargando distribucion..." />
        ) : distribution.isError ? (
          <ErrorState message={distribution.error.message} />
        ) : (
          <PaymentDistributionPanel rows={distribution.data ?? []} />
        )}
      </BalancePanel>

      <BalancePanel title="Balance por plan" icon={<ClipboardList className="h-4 w-4" />}>
        {byPlan.isLoading ? (
          <LoadingState message="Cargando balance por plan..." />
        ) : byPlan.isError ? (
          <ErrorState message={byPlan.error.message} />
        ) : (
          <BalanceByPlanPanel rows={byPlan.data ?? []} />
        )}
      </BalancePanel>

      <BalancePanel title="Libro financiero" icon={<BookOpen className="h-4 w-4" />}>
        {ledger.isLoading ? (
          <LoadingState message="Cargando libro financiero..." />
        ) : ledger.isError ? (
          <ErrorState message={ledger.error.message} />
        ) : (
          <LedgerPanel rows={ledger.data ?? []} />
        )}
      </BalancePanel>
    </div>
  );
}

function BalanceHero({
  balance,
  generalBalance,
  assignedPayments,
  balanceState,
  paidRatio
}: {
  balance: PatientBalance;
  generalBalance: number;
  assignedPayments: number;
  balanceState: string;
  paidRatio: number;
}) {
  const isCredit = generalBalance < 0;
  const hasDebt = generalBalance > 0;
  const mainToneClass = hasDebt ? "text-amber-700" : "text-emerald-700";
  const badgeTone = hasDebt ? "warning" : "success";

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#e8f5ff_100%)] px-6 py-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Balance general</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <span className={`text-[42px] font-semibold leading-none ${mainToneClass}`}>
            {money(Math.abs(generalBalance))}
          </span>
          <Badge value={isCredit ? "Credito a favor" : balanceState} tone={badgeTone} />
        </div>
        <div className="mx-auto mt-5 max-w-xl">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Progreso de abonos</span>
            <span>{formatPercent(paidRatio)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-md bg-slate-200">
            <div
              className="h-full rounded-md bg-[linear-gradient(90deg,#43b65f,#0879d5)]"
              style={{ width: `${clampPercent(paidRatio)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
        <BalancePillar
          label="Abonos consumidos"
          value={money(balance.allocatedPaidAmount)}
          caption={`${formatPercent(percentOf(balance.allocatedPaidAmount, balance.totalPaidAmount))} de pagos recibidos`}
          tone="default"
        />
        <BalancePillar
          label="Abonos asignados"
          value={money(assignedPayments)}
          caption={`${formatPercent(percentOf(assignedPayments, balance.plannedAmount))} del planificado`}
          tone="success"
        />
        <BalancePillar
          label="Abonos libres"
          value={money(balance.freeCreditBalance)}
          caption="Credito disponible"
          tone={balance.freeCreditBalance > 0 ? "success" : "default"}
        />
      </div>
    </Card>
  );
}

function BalancePillar({
  label,
  value,
  caption,
  tone
}: {
  label: string;
  value: string;
  caption: string;
  tone: "default" | "success";
}) {
  const valueClass = tone === "success" ? "text-emerald-700" : "text-slate-950";
  return (
    <div className="min-h-[116px] px-5 py-4 text-center">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold leading-none ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

function FinancialSignal({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  const toneClass = tone === "danger" ? "text-rose-700" : tone === "success" ? "text-emerald-700" : "text-slate-950";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function BalancePanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {icon}
          {title}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function PaymentBehaviorChart({ rows }: { rows: PaymentBehaviorPoint[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No existen movimientos financieros para calcular el Balance."
        description="No hay cargos ni pagos reales para graficar."
      />
    );
  }

  const chartRows = rows.map((row) => ({
    ...row,
    dateLabel: compactDate(row.date)
  }));
  const totals = rows.reduce(
    (acc, row) => ({
      charges: acc.charges + row.charges,
      payments: acc.payments + row.payments,
      runningBalance: row.runningBalance
    }),
    { charges: 0, payments: 0, runningBalance: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <ChartKpi label="Cargos" value={money(totals.charges)} color="#f07f51" />
        <ChartKpi label="Pagos" value={money(totals.payments)} color="#18a34a" />
        <ChartKpi label="Saldo acumulado" value={money(Math.abs(totals.runningBalance))} color="#0f766e" />
      </div>

      <div className="h-[360px] min-w-0 rounded-md border border-slate-200 bg-white p-3">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <ComposedChart data={chartRows} margin={{ top: 12, right: 22, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#e2e8f0" vertical />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#d9e2ec" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickFormatter={shortMoney}
              tickLine={false}
              axisLine={{ stroke: "#d9e2ec" }}
              width={68}
            />
            <Tooltip
              formatter={(value, name) => [money(Number(value ?? 0)), String(name)]}
              labelFormatter={(label) => `Fecha ${label}`}
              cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }}
              contentStyle={{
                border: "1px solid #dbe3ee",
                borderRadius: 8,
                boxShadow: "0 16px 32px rgba(15,23,42,0.12)"
              }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Area
              type="monotone"
              dataKey="runningBalance"
              name="Saldo acumulado"
              stroke="#0f766e"
              strokeWidth={2}
              fill="#ccfbf1"
              fillOpacity={0.45}
            />
            <Line
              type="monotone"
              dataKey="charges"
              name="Cargos"
              stroke="#f07f51"
              strokeWidth={3}
              dot={{ r: 3, fill: "white", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="payments"
              name="Pagos"
              stroke="#18a34a"
              strokeWidth={3}
              dot={{ r: 3, fill: "white", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
            {chartRows.length > 1 ? (
              <Brush
                dataKey="dateLabel"
                height={34}
                travellerWidth={10}
                stroke="#8cc3d6"
                fill="#e8f6fb"
                tickFormatter={(value) => String(value)}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      </div>
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
    </div>
  );
}

function PaymentDistributionPanel({ rows }: { rows: PaymentDistributionRow[] }) {
  const hasData = rows.some((row) => row.amount > 0 || row.count > 0);
  if (!hasData) {
    return (
      <EmptyState
        title="No existen aplicaciones de pago para distribuir."
        description="No hay pagos aplicados a prestaciones o cuotas."
      />
    );
  }

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <div className="space-y-6">
      {rows.map((row) => (
        <DistributionRow key={row.key} row={row} totalAmount={totalAmount} />
      ))}
    </div>
  );
}

function DistributionRow({ row, totalAmount }: { row: PaymentDistributionRow; totalAmount: number }) {
  const percentage = clampPercent(row.percentage);
  const color = distributionColors[row.key] ?? "#0879d5";
  const background = row.amount > 0 ? `${color}22` : "#f1f5f9";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{row.label}</p>
            <p className="text-xs text-slate-500">{row.count ? `${row.count} aplicaciones` : "Sin aplicaciones registradas"}</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-950">
          {money(row.amount)} / {money(totalAmount)}
        </p>
      </div>
      <div className="h-4 overflow-hidden rounded-md border border-slate-200" style={{ backgroundColor: background }}>
        <div
          className="h-full rounded-[5px]"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 8px, transparent 8px, transparent 16px)"
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{formatPercent(row.percentage)}</span>
        <span>{row.amount > 0 ? money(row.amount) : "Sin monto"}</span>
      </div>
    </div>
  );
}

function BalanceByPlanPanel({ rows }: { rows: BalanceByPlanRow[] }) {
  if (!rows.length) {
    return <EmptyState title="Sin planes con movimientos financieros." description="El paciente no tiene planes con saldos calculables." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {rows.slice(0, 3).map((row) => (
          <PlanSummary key={row.planId} row={row} />
        ))}
      </div>
      <DataTable
        rows={rows}
        empty={<EmptyState title="Sin planes con movimientos financieros." description="El paciente no tiene planes con saldos calculables." />}
        columns={[
          { key: "planName", title: "Plan", render: (row) => row.planName },
          { key: "subtotal", title: "Subtotal", render: (row) => money(row.subtotal) },
          { key: "discount", title: "Descuento", render: (row) => money(row.discount) },
          { key: "totalNet", title: "Total neto", render: (row) => money(row.totalNet) },
          { key: "realized", title: "Realizado", render: (row) => money(row.realized) },
          { key: "paid", title: "Pagado", render: (row) => money(row.paid) },
          { key: "coverage", title: "Cobertura", render: (row) => money(row.coverage) },
          { key: "refunded", title: "Devuelto", render: (row) => money(row.refunded) },
          { key: "currentDueBalance", title: "Saldo exigible", render: (row) => money(row.currentDueBalance) },
          { key: "futureBalance", title: "Saldo futuro", render: (row) => money(row.futureBalance) },
          { key: "totalBalance", title: "Saldo total", render: (row) => money(row.totalBalance) }
        ]}
      />
    </div>
  );
}

function PlanSummary({ row }: { row: BalanceByPlanRow }) {
  const paidProgress = percentOf(row.paid + row.coverage, row.totalNet);
  const realizedProgress = percentOf(row.realized, row.totalNet);
  return (
    <div className="min-h-[142px] rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{row.planName}</p>
          <p className="mt-1 text-xs text-slate-500">Saldo total {money(row.totalBalance)}</p>
        </div>
        <CreditCard className="h-4 w-4 shrink-0 text-[#0879d5]" />
      </div>
      <div className="mt-4 space-y-3">
        <PlanProgress label="Pagado + cobertura" value={paidProgress} color="#18a34a" />
        <PlanProgress label="Realizado" value={realizedProgress} color="#0879d5" />
      </div>
    </div>
  );
}

function PlanProgress({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-700">{formatPercent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-md bg-white">
        <div className="h-full rounded-md" style={{ width: `${clampPercent(value)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function LedgerPanel({ rows }: { rows: PatientLedgerEntry[] }) {
  return (
    <DataTable
      rows={rows}
      empty={
        <EmptyState
          title="No existen movimientos financieros para calcular el Balance."
          description="El libro financiero no tiene entradas para este paciente."
        />
      }
      columns={[
        { key: "occurredAt", title: "Fecha", render: (row) => dateOnly(row.occurredAt) },
        { key: "entryType", title: "Tipo", render: (row) => entryTypeLabels[row.entryType] ?? row.entryType },
        { key: "descriptionSnapshot", title: "Descripcion", render: (row) => row.descriptionSnapshot ?? "-" },
        { key: "treatmentPlan", title: "Plan", render: (row) => row.treatmentPlan?.name ?? "-" },
        { key: "debitAmount", title: "Debito", render: (row) => money(row.debitAmount) },
        { key: "creditAmount", title: "Credito", render: (row) => money(row.creditAmount) },
        { key: "status", title: "Estado", render: (row) => <Badge value={row.status} tone={row.status === "APPLIED" ? "success" : "warning"} /> }
      ]}
    />
  );
}

function compactDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function shortMoney(value: number | string) {
  const amount = Number(value ?? 0);
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(0)}k`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function percentOf(value: number, total: number) {
  if (!total || total <= 0) return 0;
  return (value / total) * 100;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(Number.isFinite(value) ? value : 0, 100));
}

function formatPercent(value: number) {
  return `${clampPercent(value).toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
