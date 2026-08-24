import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Play,
  Printer,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import {
  requestChartReport,
  requestExcelReport,
  useChartsCatalog,
} from "../hooks/use-reports";
import type {
  AnalyticsFilters,
  GeneratedChartReport,
} from "../services/reports.service";

type Row = Record<string, unknown>;
type FilterMode = "range" | "month" | "day" | "matrix" | "search" | "quarter";

const FILTER_MODES: Record<string, FilterMode> = {
  results: "range",
  "money-flow": "range",
  expenses: "matrix",
  "professional-efficiency": "month",
  "sales-by-procedure": "month",
  "sales-by-category": "month",
  "budget-capture-efficiency": "range",
  "daily-collection": "day",
  "professional-ranking": "month",
  "delinquent-patients": "search",
  "financing-status": "matrix",
  "payroll-discount-status": "matrix",
  "patient-referrals": "range",
  "captured-budgets": "quarter",
};

const COLUMN_CONFIG: Record<string, Array<[string, string]>> = {
  "professional-efficiency": [
    ["professional", "Profesional"],
    ["sales", "Ventas"],
    ["salesPerHour", "Ventas/Horas atendidas"],
    ["attendedHours", "Horas atendidas"],
    ["budgeted", "Presupuestado"],
  ],
  "sales-by-procedure": [
    ["procedure", "Procedimiento"],
    ["category", "Categoría"],
    ["total", "Total"],
    ["count", "Cantidad"],
  ],
  "sales-by-category": [
    ["category", "Categoría"],
    ["total", "Total"],
    ["count", "Cantidad"],
  ],
  "professional-ranking": [
    ["professional", "Nombre"],
    ["generated", "Generados"],
    ["captured", "Capturados"],
    ["rate", "Razón"],
  ],
  "delinquent-patients": [
    ["patient", "Nombre"],
    ["phone", "Teléfono"],
    ["mobile", "Móvil"],
    ["email", "Correo"],
    ["upTo30", "30 días o menos"],
    ["between31And60", "Entre 31 y 60 días"],
    ["over60", "61 días o más"],
    ["total", "Mora total"],
    ["balance", "Balance"],
  ],
  "patient-referrals": [
    ["fromBranch", "Sucursal origen"],
    ["fromProfessional", "Prof. origen"],
    ["fromTreatmentPlanId", "Tratamiento origen"],
    ["toBranch", "Sucursal destino"],
    ["toProfessional", "Profesional destino"],
    ["toTreatmentPlanId", "Tratamiento destino"],
    ["date", "Fecha"],
    ["reason", "Motivo"],
  ],
  "captured-budgets": [
    ["professional", "Profesional"],
    ["specialty", "Especialidad"],
    ["emitted", "Presupuestos emitidos"],
    ["captured", "Presupuestos capturados"],
    ["captureRate", "Tasa captación total"],
  ],
};

const MONEY_KEYS = new Set([
  "sales",
  "salesPerHour",
  "budgeted",
  "total",
  "balance",
  "upTo30",
  "between31And60",
  "over60",
  "emitted",
  "captured",
  "amount",
  "paid",
  "income",
  "costs",
  "result",
  "operational",
  "expenses",
]);
const PERCENT_KEYS = new Set(["percent", "rate", "captureRate"]);

function asRows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Row => Boolean(item) && typeof item === "object",
      )
    : [];
}

function asRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKeyInTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function monthStart(date = new Date()) {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthEnd(date = new Date()) {
  return localDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function shiftMonth(value: string, delta: number, endOfMonth = false) {
  const [year, month] = value.split("-").map(Number);
  return localDateKey(
    endOfMonth
      ? new Date(year, month - 1 + delta + 1, 0)
      : new Date(year, month - 1 + delta, 1),
  );
}

type DraftFilters = {
  dateFrom: string;
  dateTo: string;
  branchId: string;
  search: string;
  limit: number;
};

type AppliedFilters = {
  query: AnalyticsFilters;
  periodMode: "automatic" | "historical";
};

const MONTH_OPTIONS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function defaultDraftFilters(type: string, now = new Date()): DraftFilters {
  const today = localDateKey(now);
  const currentStart = monthStart(now);
  const currentEnd = monthEnd(now);
  if (
    type === "results" ||
    type === "money-flow" ||
    type === "budget-capture-efficiency"
  ) {
    return {
      dateFrom: shiftMonth(currentStart, -12),
      dateTo: currentEnd,
      branchId: "",
      search: "",
      limit: 50,
    };
  }
  if (type === "patient-referrals") {
    return {
      dateFrom: currentStart,
      dateTo: today,
      branchId: "",
      search: "",
      limit: 50,
    };
  }
  if (type === "daily-collection" || type === "delinquent-patients") {
    return {
      dateFrom: today,
      dateTo: today,
      branchId: "",
      search: "",
      limit: 50,
    };
  }
  if (type === "captured-budgets") {
    return {
      dateFrom: shiftMonth(currentStart, -2),
      dateTo: currentEnd,
      branchId: "",
      search: "",
      limit: 50,
    };
  }
  return {
    dateFrom: currentStart,
    dateTo: currentEnd,
    branchId: "",
    search: "",
    limit: 50,
  };
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
}

function formatValue(key: string, value: unknown, currency = "MXN") {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "date" || key.endsWith("At") || key.endsWith("Date"))
    return formatDate(value);
  if (typeof value === "number" && MONEY_KEYS.has(key))
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  if (typeof value === "number" && PERCENT_KEYS.has(key))
    return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value)}%`;
  if (typeof value === "number")
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(
      value,
    );
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function Summary({ report }: { report: GeneratedChartReport }) {
  const entries = Object.entries(report.summary);
  if (!entries.length) return null;
  return (
    <div className="grid flex-1 gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(([key, value]) => (
        <div key={key} className="bg-[var(--bg-surface)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {key}
          </p>
          <p className="mt-1 text-[16px] font-semibold text-[var(--text-primary)]">
            {formatValue(key, value, report.filters.currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

function tableColumns(report: GeneratedChartReport, rows: Row[]) {
  if (report.type === "captured-budgets") {
    const months = asRows(report.data?.months);
    return [
      ...COLUMN_CONFIG[report.type],
      ...months.map(
        (month, index) =>
          [`month_${index}`, String(month.label)] as [string, string],
      ),
    ];
  }
  return (
    COLUMN_CONFIG[report.type] ??
    Object.keys(rows[0] ?? {})
      .filter(
        (key) =>
          !["id", "professionalId", "values", "cells", "monthlyRates"].includes(
            key,
          ),
      )
      .map((key) => [key, key] as [string, string])
  );
}

function DenseTable({
  report,
  rows = report.rows,
}: {
  report: GeneratedChartReport;
  rows?: Row[];
}) {
  const columns = tableColumns(report, rows);
  if (!rows.length)
    return (
      <EmptyState
        title="Sin datos"
        description="No existen registros para los filtros seleccionados."
      />
    );
  return (
    <div data-responsive-overflow="contained" className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
      <table className="min-w-full border-collapse text-[12px]">
        <thead className="bg-[var(--bg-subtle)] text-left text-[var(--text-secondary)]">
          <tr>
            {columns.map(([key, title]) => (
              <th
                key={key}
                className="whitespace-nowrap border-b border-[var(--border-default)] px-3 py-2 font-semibold"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.id ?? row.professionalId ?? index)}
              className="border-b border-[var(--border-subtle)] last:border-0"
            >
              {columns.map(([key]) => (
                <td
                  key={key}
                  className="whitespace-nowrap px-3 py-2 text-[var(--text-primary)]"
                >
                  {formatValue(
                    key.startsWith("month_") ? "rate" : key,
                    row[key],
                    report.filters.currency,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HierarchicalMatrix({ report }: { report: GeneratedChartReport }) {
  const months = asRows(report.data?.months);
  const rows = asRows(report.data?.rows ?? report.rows);
  return (
    <div data-responsive-overflow="contained" className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
      <table className="min-w-max border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-56 bg-[var(--bg-subtle)] px-3 py-2 text-left">
              Concepto
            </th>
            {months.map((month) => (
              <th
                key={String(month.key)}
                className="min-w-24 bg-[var(--bg-subtle)] px-2 py-2 text-center"
              >
                {String(month.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.label ?? index)}
              className="border-t border-[var(--border-subtle)]"
            >
              <td
                className={`sticky left-0 z-10 bg-[var(--bg-surface)] px-3 py-2 ${Number(row.level) ? "pl-7 text-[var(--text-secondary)]" : "font-semibold"}`}
              >
                {String(row.label)}
              </td>
              {(Array.isArray(row.values) ? row.values : []).map(
                (value, cell) => (
                  <td key={cell} className="px-2 py-2 text-right">
                    {formatValue(
                      row.percent ? "percent" : "total",
                      value,
                      report.filters.currency,
                    )}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTableRenderer({ report }: { report: GeneratedChartReport }) {
  const dataKey = report.type === "results" ? "percent" : "total";
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="h-[320px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={1}
            minHeight={1}
          >
            <BarChart data={report.chart}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) =>
                  formatValue(dataKey, value, report.filters.currency)
                }
              />
              <Bar dataKey={dataKey} fill="#16a34a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <HierarchicalMatrix report={report} />
    </div>
  );
}

function ExpenseMatrix({
  report,
  title,
  matrix,
}: {
  report: GeneratedChartReport;
  title: string;
  matrix: Row;
}) {
  const months = asRows(report.data?.months);
  const rows = asRows(matrix.rows);
  const totals = Array.isArray(matrix.totals) ? matrix.totals : [];
  return (
    <section className="space-y-2">
      <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <div data-responsive-overflow="contained" className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
        <table className="min-w-max border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-52 bg-[var(--bg-subtle)] px-3 py-2 text-left">
                Categoría
              </th>
              {months.map((month) => (
                <th
                  key={String(month.key)}
                  className="min-w-24 bg-[var(--bg-subtle)] px-2 py-2"
                >
                  {String(month.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={String(row.label ?? index)}
                className="border-t border-[var(--border-subtle)]"
              >
                <td className="sticky left-0 z-10 bg-[var(--bg-surface)] px-3 py-2">
                  {String(row.label)}
                </td>
                {(Array.isArray(row.values) ? row.values : []).map(
                  (value, cell) => (
                    <td key={cell} className="px-2 py-2 text-right">
                      {formatValue("total", value, report.filters.currency)}
                    </td>
                  ),
                )}
              </tr>
            ))}
            <tr className="border-t border-[var(--border-strong)] font-semibold">
              <td className="sticky left-0 bg-[var(--bg-subtle)] px-3 py-2">
                Total
              </td>
              {totals.map((value, index) => (
                <td
                  key={index}
                  className="bg-[var(--bg-subtle)] px-2 py-2 text-right"
                >
                  {formatValue("total", value, report.filters.currency)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TemporalMatrix({ report }: { report: GeneratedChartReport }) {
  const months = asRows(report.data?.months);
  const rows = asRows(report.data?.rows ?? report.rows);
  const totals = Array.isArray(report.data?.totals) ? report.data.totals : [];
  const collected = Array.isArray(report.data?.collected)
    ? report.data.collected
    : [];
  return (
    <div data-responsive-overflow="contained" className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
      <table className="min-w-max border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-52 bg-[var(--bg-subtle)] px-3 py-2 text-left">
              Paciente / plan
            </th>
            {months.map((month) => (
              <th
                key={String(month.key)}
                className="min-w-24 bg-[var(--bg-subtle)] px-2 py-2"
              >
                {String(month.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="font-semibold">
            <td className="sticky left-0 bg-[var(--bg-subtle)] px-3 py-2">
              Suma de cuotas
            </td>
            {totals.map((value, index) => (
              <td
                key={index}
                className="bg-[var(--bg-subtle)] px-2 py-2 text-right"
              >
                {formatValue("total", value, report.filters.currency)}
              </td>
            ))}
          </tr>
          {rows.map((row, index) => (
            <tr
              key={String(row.treatmentPlanId ?? index)}
              className="border-t border-[var(--border-subtle)]"
            >
              <td className="sticky left-0 z-10 bg-[var(--bg-surface)] px-3 py-2">
                <div>{String(row.label)}</div>
                {row.company ? (
                  <small className="text-[var(--text-muted)]">
                    {String(row.company)}
                  </small>
                ) : null}
              </td>
              {(Array.isArray(row.cells) ? row.cells : []).map(
                (rawCell, cellIndex) => {
                  const cell = asRecord(rawCell);
                  const tone =
                    cell.status === "PAID"
                      ? "bg-emerald-600 text-white"
                      : cell.status === "PARTIAL"
                        ? "bg-yellow-300"
                        : cell.status === "UNPAID"
                          ? "bg-red-500 text-white"
                          : "";
                  return (
                    <td
                      key={cellIndex}
                      className={`px-2 py-2 text-right ${tone}`}
                    >
                      {rawCell ? (
                        <>
                          <div>
                            {formatValue(
                              "amount",
                              cell.amount,
                              report.filters.currency,
                            )}
                          </div>
                          <small>
                            {formatValue(
                              "paid",
                              cell.paid,
                              report.filters.currency,
                            )}{" "}
                            pagado
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                },
              )}
            </tr>
          ))}
          <tr className="border-t border-[var(--border-strong)] font-semibold">
            <td className="sticky left-0 bg-[var(--bg-subtle)] px-3 py-2">
              Cobrado
            </td>
            {collected.map((value, index) => (
              <td
                key={index}
                className="bg-[var(--bg-subtle)] px-2 py-2 text-right"
              >
                {formatValue("paid", value, report.filters.currency)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DailyCollectionMatrix({ report }: { report: GeneratedChartReport }) {
  const columns = asRows(report.data?.columns);
  const rows = asRows(report.data?.rows ?? report.rows);
  return (
    <div data-responsive-overflow="contained" className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
      <table className="min-w-max border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 min-w-52 bg-[var(--bg-subtle)] px-3 py-2 text-left">
              Concepto
            </th>
            {columns.map((column) => (
              <th
                key={String(column.id)}
                className="min-w-36 bg-[var(--bg-subtle)] px-3 py-2 text-left"
              >
                {String(column.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.label ?? index)}
              className={`border-t border-[var(--border-subtle)] ${row.section === "total" ? "bg-emerald-50 font-semibold" : row.section === "heading" ? "bg-[var(--bg-subtle)] font-semibold" : ""}`}
            >
              <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                {String(row.label)}
              </td>
              {(Array.isArray(row.cells) ? row.cells : []).map(
                (rawCell, cellIndex) => {
                  const cell = asRecord(rawCell);
                  return (
                    <td key={cellIndex} className="px-3 py-2">
                      <div>
                        {formatValue(
                          "amount",
                          cell.amount,
                          report.filters.currency,
                        )}
                      </div>
                      {Number(cell.count) > 0 ? (
                        <small className="text-[var(--text-muted)]">
                          {String(cell.count)} movimiento(s)
                        </small>
                      ) : null}
                    </td>
                  );
                },
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixRenderer({ report }: { report: GeneratedChartReport }) {
  if (report.type === "expenses")
    return (
      <div className="space-y-6">
        <ExpenseMatrix
          report={report}
          title="Gastos efectuados (fecha contable)"
          matrix={asRecord(report.data?.accounting)}
        />
        <ExpenseMatrix
          report={report}
          title="Gastos cobrados (fecha de pago)"
          matrix={asRecord(report.data?.paid)}
        />
      </div>
    );
  if (report.type === "daily-collection")
    return <DailyCollectionMatrix report={report} />;
  return <TemporalMatrix report={report} />;
}

function CohortRenderer({ report }: { report: GeneratedChartReport }) {
  const segmentKeys = Array.isArray(report.data?.segmentKeys)
    ? report.data.segmentKeys.map(String)
    : [];
  const colors = [
    "#0f766e",
    "#2563eb",
    "#7c3aed",
    "#0891b2",
    "#475569",
    "#94a3b8",
  ];
  return (
    <Card className="p-4">
      <div className="h-[380px]">
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={1}
          minHeight={1}
        >
          <BarChart data={report.chart}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip
              formatter={(value) =>
                formatValue("total", value, report.filters.currency)
              }
            />
            <Legend />
            {segmentKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                name={`Capturado ${key}`}
                stackId="capture"
                fill={colors[index % colors.length]}
              />
            ))}
            <Bar
              dataKey="pending"
              name="No capturado"
              stackId="capture"
              fill="#d1d5db"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function CapturedBudgetsRenderer({ report }: { report: GeneratedChartReport }) {
  const rows = report.rows.map((row) => ({
    ...row,
    ...Object.fromEntries(
      (Array.isArray(row.monthlyRates) ? row.monthlyRates : []).map(
        (value, index) => [`month_${index}`, value],
      ),
    ),
  }));
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="h-[520px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={1}
            minHeight={1}
          >
            <BarChart
              data={report.chart}
              layout="vertical"
              margin={{ left: 30 }}
            >
              <CartesianGrid stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fontSize: 10 }}
              />
              <Tooltip formatter={(value) => formatValue("rate", value)} />
              <Bar dataKey="rate" fill="#38bdf8" stroke="#0284c7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <DenseTable report={report} rows={rows} />
    </div>
  );
}

function ReportRenderer({ report }: { report: GeneratedChartReport }) {
  if (report.renderer === "chart-table")
    return <ChartTableRenderer report={report} />;
  if (report.renderer === "matrix") return <MatrixRenderer report={report} />;
  if (report.renderer === "stacked-cohort")
    return <CohortRenderer report={report} />;
  if (report.renderer === "captured-budgets")
    return <CapturedBudgetsRenderer report={report} />;
  return <DenseTable report={report} />;
}

export function ReportsChartsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedType = searchParams.get("reporte") || "results";
  const [draft, setDraft] = useState<DraftFilters>(() =>
    defaultDraftFilters(selectedType),
  );
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [lastAppliedDraft, setLastAppliedDraft] =
    useState<DraftFilters | null>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<GeneratedChartReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const requestSequence = useRef(0);
  const automaticType = useRef<string | null>(null);
  const catalog = useChartsCatalog();
  const branches = useBranches(undefined, "ACTIVE");
  const selected =
    catalog.data?.find((item) => item.type === selectedType) ??
    catalog.data?.[0];
  const mode = FILTER_MODES[selectedType] ?? "range";
  const branchName = useMemo(
    () => branches.data?.find((branch) => branch.id === draft.branchId)?.name,
    [branches.data, draft.branchId],
  );
  const anchorDate =
    selectedType === "financing-status" ||
    selectedType === "payroll-discount-status"
      ? draft.dateFrom
      : draft.dateTo;
  const anchorMonth = Number(anchorDate.slice(5, 7));
  const anchorYear = Number(anchorDate.slice(0, 4));
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () =>
      [
        ...new Set([
          ...Array.from(
            { length: 18 },
            (_, index) => currentYear + 2 - index,
          ),
          anchorYear,
        ]),
      ].sort((a, b) => b - a),
    [anchorYear, currentYear],
  );
  const hasPendingFilters = Boolean(
    lastAppliedDraft && JSON.stringify(lastAppliedDraft) !== JSON.stringify(draft),
  );

  const runReport = useCallback(
    async (
      type: string,
      query: AnalyticsFilters,
      periodMode: "automatic" | "historical",
    ) => {
      const sequence = ++requestSequence.current;
      setLoading(true);
      setError("");
      setExportStatus("");
      try {
        const data = await requestChartReport(type, query);
        if (sequence !== requestSequence.current) return;
        const timezone = data.filters.timezone || "America/Mexico_City";
        const effectiveDraft: DraftFilters = {
          dateFrom: dateKeyInTimezone(data.filters.dateFrom, timezone),
          dateTo: dateKeyInTimezone(data.filters.dateTo, timezone),
          branchId: data.filters.branchId ?? "",
          search: query.search ?? "",
          limit: query.limit ?? 50,
        };
        const frozenQuery: AnalyticsFilters = {
          ...query,
          preset: "custom",
          dateFrom: effectiveDraft.dateFrom,
          dateTo: effectiveDraft.dateTo,
          branchId: effectiveDraft.branchId || undefined,
        };
        setResult(data);
        setDraft(effectiveDraft);
        setLastAppliedDraft(effectiveDraft);
        setApplied({ query: frozenQuery, periodMode });
        setPage(query.page ?? 1);
      } catch (cause) {
        if (sequence !== requestSequence.current) return;
        setResult(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo generar el reporte",
        );
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedType === "patient-analysis") {
      navigate("/pacientes/analisis", { replace: true });
      return;
    }
    if (!selected || automaticType.current === selectedType) return;
    automaticType.current = selectedType;
    const defaults = defaultDraftFilters(selectedType);
    setDraft(defaults);
    setLastAppliedDraft(null);
    setApplied(null);
    setResult(null);
    setError("");
    setExportStatus("");
    setPage(1);
    void runReport(
      selectedType,
      {
        currency: "MXN",
        limit: defaults.limit,
        page: 1,
        pageSize: 50,
      },
      "automatic",
    );
  }, [navigate, runReport, selected, selectedType]);

  function selectReport(type: string) {
    if (type === "patient-analysis") {
      navigate("/pacientes/analisis");
      return;
    }
    setSearchParams({ reporte: type });
  }

  function shiftQuarter(delta: number) {
    setDraft((current) => ({
      ...current,
      dateFrom: shiftMonth(current.dateFrom, delta * 3),
      dateTo: shiftMonth(current.dateTo, delta * 3, true),
    }));
  }

  function setAnchorMonth(month: number, year = anchorYear) {
    const start = localDateKey(new Date(year, month - 1, 1));
    const end = localDateKey(new Date(year, month, 0));
    setDraft((current) => ({ ...current, dateFrom: start, dateTo: end }));
  }

  function generateHistorical() {
    const dateTo = mode === "day" ? draft.dateFrom : draft.dateTo;
    void runReport(
      selectedType,
      {
        preset: "custom",
        dateFrom: draft.dateFrom,
        dateTo,
        branchId: draft.branchId || undefined,
        currency: "MXN",
        search: draft.search || undefined,
        limit: draft.limit,
        page: 1,
        pageSize: 50,
      },
      "historical",
    );
  }

  function paginate(nextPage: number) {
    if (!applied) return;
    void runReport(
      selectedType,
      { ...applied.query, page: nextPage },
      applied.periodMode,
    );
  }

  async function requestExport() {
    if (!result?.exportCode || !applied) return;
    setExportStatus("Creando solicitud persistente...");
    try {
      const request = await requestExcelReport({
        reportCode: result.exportCode,
        format: "xlsx",
        parameters: {
          dateFrom: applied.query.dateFrom,
          dateTo: applied.query.dateTo,
          branchId: applied.query.branchId,
          search: applied.query.search,
          professionalId: applied.query.professionalId,
          specialtyId: applied.query.specialtyId,
        },
      });
      setExportStatus(
        `${request.status}: ${request.reportName}. Descarga disponible en Reportes Excel al completar.`,
      );
    } catch (cause) {
      setExportStatus(
        cause instanceof Error
          ? cause.message
          : "No se pudo solicitar la exportación",
      );
    }
  }

  if (catalog.isLoading)
    return <LoadingState message="Cargando catálogo de reportes..." />;
  if (catalog.isError) return <ErrorState message={catalog.error.message} />;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Reportes gráficos"
        description="Consultas conciliadas con producción, cobranza, cuotas y presupuestos reales."
      />
      <Card className="overflow-hidden p-0 shadow-sm border border-[var(--border-default)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold leading-tight text-[var(--text-primary)]">
                {selected?.title ?? "Reporte gráfico"}
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                {selected?.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:shrink-0">
            <Select
              value={selectedType}
              onChange={(event) => selectReport(event.target.value)}
              aria-label="Otros gráficos"
              className="h-9 w-full min-w-[240px] text-[13px] sm:w-[280px]"
            >
              {(catalog.data ?? []).map((item) => (
                <option key={item.type} value={item.type}>
                  {item.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="bg-[var(--bg-subtle)]/30 p-5">
          <div className="flex flex-wrap items-end gap-3">
            {mode === "quarter" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Trimestre
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => shiftQuarter(-1)}
                    title="Trimestre anterior"
                    aria-label="Trimestre anterior"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-slate-300 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 active:scale-95 cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5 stroke-[2.5] text-slate-700" />
                  </button>
                  <Input
                    type="date"
                    value={draft.dateFrom}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                    aria-label="Desde"
                    className="h-9 text-[13px] w-[140px] font-medium"
                  />
                  <span className="text-[var(--text-muted)] text-[13px] font-medium">-</span>
                  <Input
                    type="date"
                    value={draft.dateTo}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                    aria-label="Hasta"
                    className="h-9 text-[13px] w-[140px] font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => shiftQuarter(1)}
                    title="Trimestre siguiente"
                    aria-label="Trimestre siguiente"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-slate-300 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 active:scale-95 cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5 stroke-[2.5] text-slate-700" />
                  </button>
                </div>
              </div>
            ) : null}

            {mode === "range" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Desde
                  </label>
                  <Input
                    type="date"
                    value={draft.dateFrom}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                    aria-label="Desde"
                    className="h-9 text-[13px] w-[145px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Hasta
                  </label>
                  <Input
                    type="date"
                    value={draft.dateTo}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                    aria-label="Hasta"
                    className="h-9 text-[13px] w-[145px]"
                  />
                </div>
              </>
            ) : null}

            {mode === "month" || mode === "matrix" ? (
              <>
                <div className="flex flex-col gap-1.5 min-w-[150px]">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Mes
                  </label>
                  <Select
                    value={String(anchorMonth)}
                    onChange={(event) =>
                      setAnchorMonth(Number(event.target.value))
                    }
                    aria-label="Mes"
                    className="h-9 text-[13px]"
                  >
                    {MONTH_OPTIONS.map((label, index) => (
                      <option key={label} value={index + 1}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5 w-[110px]">
                  <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Año
                  </label>
                  <Select
                    value={String(anchorYear)}
                    onChange={(event) =>
                      setAnchorMonth(anchorMonth, Number(event.target.value))
                    }
                    aria-label="Año"
                    className="h-9 text-[13px]"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            ) : null}

            {mode === "day" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Día
                </label>
                <Input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dateFrom: event.target.value,
                      dateTo: event.target.value,
                    }))
                  }
                  aria-label="Día"
                  className="h-9 text-[13px] w-[150px]"
                />
              </div>
            ) : null}

            {mode === "search" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Fecha de corte
                </label>
                <Input
                  type="date"
                  value={draft.dateTo}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dateFrom: event.target.value,
                      dateTo: event.target.value,
                    }))
                  }
                  aria-label="Fecha de corte"
                  className="h-9 text-[13px] w-[150px]"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px] max-w-[280px]">
              <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                Sucursal
              </label>
              <Select
                value={draft.branchId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    branchId: event.target.value,
                  }))
                }
                aria-label="Sucursal"
                className="h-9 text-[13px]"
              >
                <option value="">Todas las sucursales</option>
                {branches.data?.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>

            {selectedType === "sales-by-procedure" ? (
              <div className="flex flex-col gap-1.5 w-[110px]">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Límite
                </label>
                <Select
                  value={String(draft.limit)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      limit: Number(event.target.value),
                    }))
                  }
                  aria-label="Número de filas"
                  className="h-9 text-[13px]"
                >
                  <option value="25">25 filas</option>
                  <option value="50">50 filas</option>
                  <option value="100">100 filas</option>
                </Select>
              </div>
            ) : null}

            {selectedType === "delinquent-patients" ? (
              <div className="flex flex-col gap-1.5 flex-1 min-w-[180px] max-w-[280px]">
                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
                  Buscar paciente
                </label>
                <Input
                  value={draft.search}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Nombre o apellido..."
                  aria-label="Buscar paciente"
                  className="h-9 text-[13px]"
                />
              </div>
            ) : null}

            <div className="flex flex-col justify-end">
              <Button
                type="button"
                onClick={generateHistorical}
                disabled={loading}
                className="h-9 px-5 text-[13px] font-medium shrink-0 shadow-sm"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {loading ? "Generando..." : "Generar"}
              </Button>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-[var(--border-default)] bg-white px-2 py-1 font-medium text-[var(--text-secondary)]">
              {hasPendingFilters
                ? "Filtros sin aplicar"
                : applied?.periodMode === "historical"
                  ? "Período histórico"
                  : "Período actual"}
            </span>
          </div>

          {branchName ? (
            <p className="mt-2.5 text-[11px] text-[var(--text-muted)]">
              Sucursal activa para el reporte: <span className="font-medium text-[var(--text-secondary)]">{branchName}</span>
            </p>
          ) : null}
        </div>
      </Card>
      {error ? <ErrorState message={error} /> : null}
      {loading ? (
        <LoadingState message="Conciliando datos del reporte..." />
      ) : null}
      {!loading && result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Summary report={result} />
            <div className="ml-auto flex gap-2">
              {result.type === "delinquent-patients" ? (
                <Button type="button" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              ) : null}
              {result.exportCode ? (
                <Button type="button" onClick={() => void requestExport()}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar a Excel
                </Button>
              ) : null}
            </div>
          </div>
          {exportStatus ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[12px]">
              {exportStatus}
            </p>
          ) : null}
          <ReportRenderer report={result} />
          {Number(asRecord(result.data?.pagination).total ?? 0) > 0 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => paginate(page - 1)}
              >
                Anterior
              </Button>
              <span className="text-[12px]">Página {page}</span>
              <Button
                type="button"
                disabled={
                  page *
                    Number(asRecord(result.data?.pagination).pageSize ?? 50) >=
                    Number(asRecord(result.data?.pagination).total) || loading
                }
                onClick={() => paginate(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!loading && !result && !error ? (
        <LoadingState message="Preparando período vigente..." />
      ) : null}
    </div>
  );
}
