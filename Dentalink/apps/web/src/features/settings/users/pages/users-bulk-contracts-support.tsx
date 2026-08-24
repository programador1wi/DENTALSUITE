import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { PriceList } from "@/features/settings/price-lists/services/price-lists.service";
import type { BulkProfessionalContractPayload, Professional } from "@/features/settings/professionals/services/professionals.service";
import { cn } from "@/lib/utils/cn";

export type SelectionMap = Record<string, string[]>;
export type FixedAmountMap = Record<string, string>;

export type BulkContractForm = {
  commissionRate: string;
  commissionBase: BulkProfessionalContractPayload["commissionBase"];
  paymentDiscount: BulkProfessionalContractPayload["paymentDiscount"];
  paymentCondition: BulkProfessionalContractPayload["paymentCondition"];
  contractType: BulkProfessionalContractPayload["contractType"];
  priceListId: string;
  categoryRates: Record<string, string>;
  fixedAmounts: FixedAmountMap;
};

export const STEPS = [
  { key: 1 as const, label: "Seleccion" },
  { key: 2 as const, label: "Contrato" },
  { key: 3 as const, label: "Montos fijos" },
  { key: 4 as const, label: "Porcentajes" },
  { key: 5 as const, label: "Resumen" }
];

export type StepKey = (typeof STEPS)[number]["key"];

export const ZONE_LABELS: Record<string, string> = {
  NORTE: "Norte",
  SUR: "Sur",
  DJWARNER: "DJWarner"
};

export const OPERATIONAL_ZONES = ["NORTE", "SUR", "DJWARNER"] as const;

export const EMPTY_FORM: BulkContractForm = {
  commissionRate: "",
  commissionBase: "clinical",
  paymentDiscount: "no",
  paymentCondition: "no_due_date",
  contractType: "performed_and_paid",
  priceListId: "",
  categoryRates: {},
  fixedAmounts: {}
};

export const COMMISSION_BASE_LABELS: Record<BulkContractForm["commissionBase"], string> = {
  clinical: "Acciones clinicas",
  lab: "Laboratorio",
  all: "Todas las prestaciones"
};

export const PAYMENT_DISCOUNT_LABELS: Record<BulkContractForm["paymentDiscount"], string> = {
  no: "No",
  yes: "Si",
  fixed: "Valor fijo"
};

export const PAYMENT_CONDITION_LABELS: Record<BulkContractForm["paymentCondition"], string> = {
  no_due_date: "Sin importar fecha de vencimiento",
  on_due: "Al vencer plazo",
  thirty_days: "A los 30 dias"
};

export const CONTRACT_TYPE_LABELS: Record<BulkContractForm["contractType"], string> = {
  performed_and_paid: "Prestacion realizada y pagada",
  performed: "Prestacion realizada"
};

export function zoneCodeForBranch(branch: { name: string; zone?: { code: string } | null }) {
  const code = branch.zone?.code?.toUpperCase();
  if (code) return code;
  return branch.name.toLowerCase().includes("j.warner") || branch.name.toLowerCase().includes("jwarner")
    ? "DJWARNER"
    : "SIN_ZONA";
}

export function branchIsOperable(branch: Pick<Branch, "status" | "isActive" | "dentalinkPlatformCode" | "dentalinkSucursalId" | "name">) {
  if (branch.dentalinkPlatformCode === "DJWARNER" && branch.dentalinkSucursalId === 22 && branch.name.trim() === ".") {
    return false;
  }
  return branch.status === "ACTIVE" && branch.isActive !== false;
}

export function money(value: string | number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function professionalGroup(professional: Professional) {
  return professional.specialties.some((specialty) => specialty.name.toLowerCase().includes("ortodon"))
    ? "Ortodoncia"
    : "General";
}

export function categoryRateRows(priceList: PriceList | null) {
  if (!priceList) return [];
  return priceList.categories
    .filter((category) => category.isActive && category.procedureCategoryId)
    .map((category) => ({
      id: category.procedureCategoryId ?? "",
      priceListCategoryId: category.id,
      name: category.name,
      itemCount: category.items.length
    }));
}

export function activeRateCount(categoryRates: Record<string, string>) {
  return Object.values(categoryRates).filter((value) => {
    const parsed = numberOrNull(value);
    return parsed !== null && parsed > 0;
  }).length;
}

export function Stepper({ current }: { current: StepKey }) {
  return (
    <ol className="grid gap-[var(--space-2)] border-b border-[var(--border-default)] pb-[var(--space-4)] md:grid-cols-5">
      {STEPS.map((step) => {
        const active = current === step.key;
        const done = current > step.key;
        return (
          <li
            key={step.key}
            className={cn(
              "flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)]",
              active && "border-[var(--border-brand)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]",
              done && "border-[var(--border-brand-light)] bg-[var(--bg-surface)] text-[var(--text-brand)]",
              !active && !done && "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-full)] border text-[var(--text-xs)] font-semibold",
                active && "border-[var(--border-brand)] bg-[var(--action-brand)] text-[var(--text-inverse)]",
                done && "border-[var(--border-brand)] text-[var(--text-brand)]",
                !active && !done && "border-[var(--border-default)] text-[var(--text-secondary)]"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : step.key}
            </span>
            <span className="truncate font-medium" title={step.label}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function StepFooter({
  step,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onSave,
  saving
}: {
  step: StepKey;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)] border-t border-[var(--border-default)] pt-[var(--space-4)]">
      <Button variant="secondary" disabled={!canGoBack} onClick={onBack}>
        <ChevronLeft className="h-4 w-4" />
        Volver
      </Button>
      {step < 5 ? (
        <Button disabled={!canGoForward} onClick={onForward}>
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button disabled={!canGoForward || saving} onClick={onSave}>
          <Check className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar contratos"}
        </Button>
      )}
    </div>
  );
}

export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-[var(--space-1)]">
      <h2 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">{title}</h2>
      {description ? <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">{description}</p> : null}
    </div>
  );
}

export function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] py-[var(--space-2)]">
      <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{label}</p>
      <p className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">{value}</p>
    </div>
  );
}
