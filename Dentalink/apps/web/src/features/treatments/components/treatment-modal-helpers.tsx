import { ReactNode } from "react";
import type { InstallmentFrequency, PayableTreatmentItem } from "@/features/payments/services/payments.service";

export const FDI_PERMANENT_TEETH = [
  "18", "17", "16", "15", "14", "13", "12", "11",
  "21", "22", "23", "24", "25", "26", "27", "28",
  "48", "47", "46", "45", "44", "43", "42", "41",
  "31", "32", "33", "34", "35", "36", "37", "38"
];

export const FDI_TEMPORAL_TEETH = [
  "55", "54", "53", "52", "51",
  "61", "62", "63", "64", "65",
  "85", "84", "83", "82", "81",
  "71", "72", "73", "74", "75"
];

export const PIECE_SURFACES = [
  { code: "P", label: "Palatina" },
  { code: "M", label: "Mesial" },
  { code: "B", label: "Vestibular" },
  { code: "D", label: "Distal" },
  { code: "O", label: "Oclusal" }
];

export function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function SummaryLine({
  label,
  value,
  strong,
  hint
}: {
  label: string;
  value: string;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dotted border-slate-200 pb-1">
      <span className="text-slate-500" title={hint}>
        {label}
      </span>
      <span className={strong ? "font-bold text-slate-950" : "font-medium text-slate-700"}>{value}</span>
    </div>
  );
}

export function numericId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 1000000)
    .toString()
    .padStart(6, "0");
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function numberValue(value?: string | number | null): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function splitAmount(total: number, numberOfInstallments: number): number[] {
  if (numberOfInstallments <= 0) return [];
  const base = Math.floor((total / numberOfInstallments) * 100) / 100;
  const amounts = Array.from({ length: numberOfInstallments }, () => base);
  const currentTotal = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
  const diff = roundMoney(total - currentTotal);
  amounts[amounts.length - 1] = roundMoney(amounts[amounts.length - 1] + diff);
  return amounts;
}

export function addInstallmentPeriod(
  startDate: string,
  frequency: InstallmentFrequency | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
  index: number
): string {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return startDate;
  if (frequency === "WEEKLY") date.setDate(date.getDate() + index * 7);
  else if (frequency === "BIWEEKLY") date.setDate(date.getDate() + index * 14);
  else date.setMonth(date.getMonth() + index);
  return date.toISOString().slice(0, 10);
}

export function financeableAmount(item: PayableTreatmentItem): number {
  const total = numberValue(item.total);
  const paid = numberValue(item.paidAmount);
  const financed = numberValue(item.financedAmount);
  return roundMoney(Math.max(total - paid - financed, 0));
}

export function fdiLabel(value?: string | null): string {
  if (!value) return "-";
  return value.length >= 2 ? `${value[0]}.${value[1]}` : value;
}

export function surfaceValues(value?: string | null): string[] {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized === "ALL") return [];
  if (normalized.includes(","))
    return normalized
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  return [normalized];
}

export function surfaceLabel(value?: string | null): string {
  if (value?.trim().toUpperCase() === "ALL") return "Pieza completa";
  const values = surfaceValues(value);
  if (!values.length) return "";
  return values
    .map((surface) => PIECE_SURFACES.find((item) => item.code === surface)?.label ?? surface)
    .join(", ");
}

export function money(value: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);
}

export function priceForProcedure(
  priceList: { items: Array<{ procedureId: string; price?: string | number | null }> } | null | undefined,
  procedureId: string
): number {
  return numberValue(priceList?.items.find((item) => item.procedureId === procedureId)?.price);
}

export function treatmentPlanStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    PRESENTED: "Presentado",
    ACCEPTED: "Aceptado",
    IN_PROGRESS: "En ejecucion",
    COMPLETED: "Finalizado",
    CANCELLED: "Cancelado",
    REJECTED: "Rechazado"
  };
  return labels[status] ?? status;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "-";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(date);
}

export function finiteNumberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function planClinicalProgressPercentage(plan: {
  clinicalProgress?: { displayPercentage?: number; percentage?: number } | null;
  items?: Array<{ status: string; completionPercentage?: number | null }>;
}): number {
  const explicit = finiteNumberValue(
    plan.clinicalProgress?.displayPercentage ?? plan.clinicalProgress?.percentage,
    NaN
  );
  if (Number.isFinite(explicit)) return Math.min(100, Math.max(0, Math.round(explicit)));

  const activeItems = (plan.items ?? []).filter((item) => item.status !== "CANCELLED");
  if (!activeItems.length) return 0;
  const average =
    activeItems.reduce((sum, item) => {
      if (Number.isFinite(Number(item.completionPercentage))) return sum + Number(item.completionPercentage);
      if (item.status === "COMPLETED") return sum + 100;
      if (item.status === "IN_PROGRESS") return sum + 25;
      return sum;
    }, 0) / activeItems.length;
  return Math.min(100, Math.max(0, Math.round(average)));
}


export function financingDisabledReason(canCreateFinancing: boolean, financeableTotal: number): string | undefined {
  if (!canCreateFinancing) return "No tienes permisos para crear financiamientos.";
  if (financeableTotal <= 0) return "No existen prestaciones con saldo disponible para financiar.";
  return undefined;
}

export function collectDisabledReason(canCollectPayment: boolean, balance: number): string | undefined {
  if (!canCollectPayment) return "No tienes permisos para recaudar.";
  if (balance <= 0) return "No existen prestaciones con saldo pendiente.";
  return undefined;
}

export function payrollDiscountDisabledReason(
  agreement: { isActive?: boolean; payrollDiscount?: boolean } | null | undefined,
  financeableTotal: number
): string | undefined {
  if (!agreement) return "El paciente no esta afiliado a un convenio.";
  if (!agreement.isActive) return "El convenio no esta activo.";
  if (!agreement.payrollDiscount) return "El convenio no permite descuento por planilla.";
  if (financeableTotal <= 0) return "No existen prestaciones con cobertura empresarial pendiente.";
  return undefined;
}

export function progressPercentageValue(value: unknown): number {
  const raw =
    value && typeof value === "object" && "percentage" in value
      ? (value as { percentage?: unknown }).percentage
      : value;
  return Math.max(0, finiteNumberValue(raw));
}

export function normalizeCatalogText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function isKnownSymbolProcedure(procedure: { code: string; name: string }): boolean {
  const text = normalizeCatalogText(`${procedure.code} ${procedure.name}`);
  return text.includes("LIMPIEZA") && text.includes("BLANQUEAMIENTO");
}

export function procedureRequiresOdontogramSymbol(procedure: {
  code: string;
  name: string;
  requiresOdontogramSymbol?: boolean | null;
}): boolean {
  return Boolean(procedure.requiresOdontogramSymbol) || isKnownSymbolProcedure(procedure);
}

export function planHasFinancialDebt(plan: { financialSummary?: { debtAmount?: string | number | null } | null }): boolean {
  return numberValue(plan.financialSummary?.debtAmount) > 0;
}

export const PLAN_CLINICAL_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Sin iniciar",
  IN_PROGRESS: "En ejecucion",
  READY_TO_COMPLETE: "Listo para finalizar",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
  REJECTED: "Rechazado"
};

export function planClinicalStatus(plan: {
  status: string;
  clinicalStatus?: string;
}): string {
  return (
    plan.clinicalStatus ??
    (plan.status === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : plan.status === "COMPLETED"
        ? "COMPLETED"
        : plan.status === "CANCELLED"
          ? "CANCELLED"
          : plan.status === "REJECTED"
            ? "REJECTED"
            : "NOT_STARTED")
  );
}

export function planTotals(plan?: { items?: Array<{ quantity?: string | number | null; unitPrice?: string | number | null; discount?: string | number | null; total?: string | number | null; status: string; paymentAllocations?: Array<{ amount?: string | number | null }> }> } | null) {
  const items = plan?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + numberValue(item.quantity) * numberValue(item.unitPrice),
    0
  );
  const discount = items.reduce((sum, item) => sum + numberValue(item.discount), 0);
  const total = items.reduce((sum, item) => sum + numberValue(item.total), 0);
  const paid = items.reduce(
    (sum, item) => sum + (item.paymentAllocations ?? []).reduce((pSum, a) => pSum + numberValue(a.amount), 0),
    0
  );
  const completed = items
    .filter((item) => item.status === "COMPLETED")
    .reduce((sum, item) => sum + numberValue(item.total), 0);
  return { subtotal, discount, total, paid, completed, balance: Math.max(total - paid, 0) };
}

export function displayPlanSpecialty(plan: {
  kind?: string;
  specialtySnapshotName?: string | null;
  specialty?: { name: string } | null;
}): string {
  return (
    plan.specialtySnapshotName ??
    plan.specialty?.name ??
    (plan.kind === "ORTHODONTICS" ? "Ortodoncia" : "General / Integral")
  );
}

export function dateInputValue(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}





