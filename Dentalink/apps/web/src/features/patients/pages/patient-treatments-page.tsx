import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { APP_ROUTES } from "@/lib/routes";
import {
  AlertTriangle,
  Activity,
  Building2,
  Briefcase,
  CalendarClock,
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileText,
  FolderOpen,
  GripVertical,
  ImageIcon,
  Link2Off,
  MessageSquarePlus,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Send,
  Save,
  ShoppingCart,
  Stethoscope,
  Trash2,
  UploadCloud,
  UserCircle,
  UserRound,
  X,
  ChevronDown,
  Settings
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ProgressDonut } from "@/components/ui/progress-donut";
import { OdontogramView } from "@/features/clinical/components/odontogram-view";
import {
  ODONTOGRAM_PROCEDURE_SYMBOL_OPTIONS,
  getDiagnosisMark,
  type DiagnosisMark
} from "@/features/clinical/components/tooth-diagnosis-symbols";
import { SurfaceSelector } from "@/features/clinical/components/surface-selector";
import {
  MultipleToothSelectionModal,
  ToothInformationModal
} from "@/features/clinical/components/tooth-action-modals";
import {
  ToothDiagnosisModal as DiagnosisModal,
  ToothDiagnosisPickerWindow
} from "@/features/clinical/components/tooth-diagnosis-modal";
import {
  useClinicalAppointmentHistory,
  useClinicalMutations,
  useOdontogram,
  useToothHistory
} from "@/features/clinical/hooks/use-clinical";
import { useDocumentsMutations, usePatientFiles } from "@/features/documents/hooks/use-documents";
import type { FileAttachment } from "@/features/documents/services/documents.service";
import { usePatientPayments, usePaymentsMutations, useRefunds } from "@/features/payments/hooks/use-payments";
import { PrintCenterModal } from "@/features/treatments/components/print-center-modal";
import type {
  InstallmentFrequency,
  PayableTreatmentItem,
  Refund,
  RefundStatus
} from "@/features/payments/services/payments.service";
import {
  useAgreements,
  useCreatePayrollDiscountPlan
} from "@/features/settings/admin-workflows/hooks/use-admin-workflows";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import type { Procedure } from "@/features/settings/procedures/services/procedures.service";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import { useBranchStore } from "@/stores/branch.store";
import { useOdontogramStore } from "@/stores/odontogram.store";
import { usePermissions } from "@/hooks/use-permissions";
import { useAddPatientNote, usePatient, useUpdatePatient } from "../hooks/use-patients";
import { PatientSectionPage } from "../components/patient-section-page";
import {
  budgetCatalogCategoryMatchesSearch,
  budgetCatalogItemMatchesSearch,
  buildTreatmentBudgetCatalog,
  flatSearchBudgetCatalog
} from "../utils/treatment-budget-catalog";
import {
  useBudgets,
  useOrthodonticDiagnosis,
  useOrthodonticDiagnosisCatalog,
  useOrthodonticDiagnosisStatus,
  useOrthodonticOptionFields,
  useOrthodonticSummary,
  useTreatmentPlanProcedures,
  useTreatmentPlanPriceCatalog,
  useTreatmentMutations,
  useTreatmentPlan,
  useTreatmentPlanPrintOptions,
  useTreatmentPlans
} from "@/features/treatments/hooks/use-treatments";
import { ClinicalEvolutionModal } from "../../clinical/components/clinical-evolution-modal";
import { PhotographicTemplatesPanel } from "@/features/treatments/components/photographic-templates-panel";
import type {
  Budget,
  OrthodonticClinicalFieldSource,
  OrthodonticCatalogField,
  OrthodonticCatalogOption,
  OrthodonticDiagnosisCatalogField,
  OrthodonticDiagnosisCatalogSection,
  OrthodonticDiagnosisResult,
  OrthodonticDiagnosisValuePayload,
  OrthodonticProfilePayload,
  OrthodonticSummary,
  TreatmentPlanClinicalStatus,
  TreatmentPlanDetail,
  TreatmentPlanFinancialSummary,
  TreatmentPlanItem,
  TreatmentPlanRepricePreview,
  TreatmentPriceCatalog,
  TreatmentPriceCatalogItem,
  TreatmentPlanItemStatus,
  TreatmentPlanKind,
  TreatmentPlanPrintOption,
  TreatmentPlanPrintDocumentType,
  TreatmentPlanProceduresResult,
  TreatmentPlanStatus
} from "@/features/treatments/services/treatments.service";

function numericId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 1000000)
    .toString()
    .padStart(6, "0");
}

const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  DRAFT: "Diagnóstico",
  PRESENTED: "Presentado",
  ACCEPTED: "Aceptado",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  REJECTED: "Rechazado"
};

const PLAN_CLINICAL_STATUS_LABELS: Record<TreatmentPlanClinicalStatus, string> = {
  NOT_STARTED: "Sin iniciar",
  IN_PROGRESS: "En ejecucion",
  READY_TO_COMPLETE: "Listo para finalizar",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
  REJECTED: "Rechazado"
};

const ITEM_STATUS_LABELS: Record<TreatmentPlanItemStatus, string> = {
  PLANNED: "Planificado",
  ACCEPTED: "Aceptado",
  PAID: "Pagado",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Realizado",
  CANCELLED: "Cancelado"
};

const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  PENDING: "Pendiente",
  PROCESSED: "Procesado",
  REJECTED: "Rechazado"
};

const PRICE_SOURCE_LABELS = {
  PRICE_LIST: "Arancel",
  MANUAL: "Manual",
  UNPRICED: "Sin precio"
} as const;

const PLAN_KIND_LABELS: Record<TreatmentPlanKind, string> = {
  GENERAL: "General / Integral",
  ORTHODONTICS: "Ortodoncia"
};

const ORTHODONTIC_RX_CATEGORY = "ORTHODONTIC_RX_CF";

const FDI_PERMANENT_TEETH = [
  "18",
  "17",
  "16",
  "15",
  "14",
  "13",
  "12",
  "11",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "48",
  "47",
  "46",
  "45",
  "44",
  "43",
  "42",
  "41",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38"
];

const FDI_TEMPORAL_TEETH = [
  "55",
  "54",
  "53",
  "52",
  "51",
  "61",
  "62",
  "63",
  "64",
  "65",
  "85",
  "84",
  "83",
  "82",
  "81",
  "71",
  "72",
  "73",
  "74",
  "75"
];

const PIECE_SURFACES = [
  { code: "P", label: "Palatina" },
  { code: "M", label: "Mesial" },
  { code: "B", label: "Vestibular" },
  { code: "D", label: "Distal" },
  { code: "O", label: "Oclusal" }
];

function numberValue(value?: string | number | null) {
  return Number(value ?? 0) || 0;
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function splitAmount(total: number, numberOfInstallments: number) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / numberOfInstallments);
  const remainder = cents - base * numberOfInstallments;
  return Array.from(
    { length: numberOfInstallments },
    (_, index) => (base + (index === numberOfInstallments - 1 ? remainder : 0)) / 100
  );
}

function addInstallmentPeriod(startDate: string, frequency: InstallmentFrequency, index: number) {
  const date = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return startDate;
  if (frequency === "WEEKLY") date.setDate(date.getDate() + index * 7);
  else if (frequency === "BIWEEKLY") date.setDate(date.getDate() + index * 14);
  else {
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth() + index;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const target = new Date(year, month, Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function financeableAmount(item: PayableTreatmentItem) {
  return roundMoney(
    Math.max(item.financeableAmount ?? item.outstandingAmount - (item.financedAmount ?? 0), 0)
  );
}

function financingDisabledReason(canCreateFinancing: boolean, financeableTotal: number) {
  if (!canCreateFinancing) return "No tienes permisos para crear financiamientos.";
  if (financeableTotal <= 0) return "No existen prestaciones con saldo disponible para financiar.";
  return undefined;
}

function collectDisabledReason(canCollectPayment: boolean, balance: number) {
  if (!canCollectPayment) return "No tienes permisos para recaudar.";
  if (balance <= 0) return "No existen prestaciones con saldo pendiente.";
  return undefined;
}

type PatientAgreementOption = {
  id: string;
  name: string;
  discountPercent?: string | number | null;
  payrollDiscount?: boolean;
  isActive?: boolean;
  status?: string | null;
  priceListId?: string | null;
  priceList?: { id: string; name: string; isDefault?: boolean | null } | null;
};

function payrollDiscountDisabledReason(
  agreement: { isActive?: boolean; payrollDiscount?: boolean } | null | undefined,
  financeableTotal: number
) {
  if (!agreement) return "El paciente no esta afiliado a un convenio.";
  if (!agreement.isActive) return "El convenio no esta activo.";
  if (!agreement.payrollDiscount) return "El convenio no permite descuento por planilla.";
  if (financeableTotal <= 0) return "No existen prestaciones con cobertura empresarial pendiente.";
  return undefined;
}

function finiteNumberValue(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function progressPercentageValue(value: unknown) {
  const raw =
    value && typeof value === "object" && "percentage" in value
      ? (value as { percentage?: unknown }).percentage
      : value;
  return Math.max(0, finiteNumberValue(raw));
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function agreementSnapshotString(snapshot: unknown, key: string) {
  const value = recordValue(snapshot)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function agreementFromSnapshot(snapshot: unknown): PatientAgreementOption | null {
  const agreementId = agreementSnapshotString(snapshot, "agreementId");
  if (!agreementId) return null;
  const priceListId = agreementSnapshotString(snapshot, "priceListId");
  const priceListName = agreementSnapshotString(snapshot, "priceListName");
  return {
    id: agreementId,
    name: agreementSnapshotString(snapshot, "agreementName") ?? "Convenio del plan",
    priceListId,
    priceList: priceListId
      ? { id: priceListId, name: priceListName ?? "Arancel del convenio", isDefault: false }
      : null
  };
}

function treatmentPlanAgreementId(plan?: TreatmentPlanDetail | null) {
  return (
    plan?.agreementId ??
    plan?.agreement?.id ??
    agreementSnapshotString(plan?.agreementSnapshot, "agreementId")
  );
}

function resolveEffectiveTreatmentAgreement({
  plan,
  patientAgreement,
  agreements
}: {
  plan?: TreatmentPlanDetail | null;
  patientAgreement?: PatientAgreementOption | null;
  agreements: PatientAgreementOption[];
}) {
  const planAgreementId = treatmentPlanAgreementId(plan);
  const effectiveAgreementId = planAgreementId ?? patientAgreement?.id ?? null;
  const catalogAgreement = effectiveAgreementId
    ? (agreements.find((agreement) => agreement.id === effectiveAgreementId) ?? null)
    : null;
  const planAgreement =
    plan?.agreement && (!effectiveAgreementId || plan.agreement.id === effectiveAgreementId)
      ? plan.agreement
      : null;
  const snapshotAgreement =
    planAgreementId && planAgreementId === effectiveAgreementId
      ? agreementFromSnapshot(plan?.agreementSnapshot)
      : null;
  const patientCurrentAgreement =
    patientAgreement && (!effectiveAgreementId || patientAgreement.id === effectiveAgreementId)
      ? patientAgreement
      : null;
  const agreement = catalogAgreement ?? planAgreement ?? snapshotAgreement ?? patientCurrentAgreement ?? null;
  const source = catalogAgreement
    ? "catalog"
    : planAgreement
      ? "plan"
      : snapshotAgreement
        ? "snapshot"
        : patientCurrentAgreement
          ? "patient"
          : "none";
  const priceListId =
    agreement?.priceList?.id ??
    agreement?.priceListId ??
    (planAgreementId === effectiveAgreementId
      ? agreementSnapshotString(plan?.agreementSnapshot, "priceListId")
      : null);

  return {
    agreementId: effectiveAgreementId,
    agreement,
    source,
    priceListId: priceListId ?? ""
  };
}

function planClinicalStatus(plan: {
  status: TreatmentPlanStatus;
  clinicalStatus?: TreatmentPlanClinicalStatus;
}) {
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

function planClinicalProgressPercentage(plan: {
  clinicalProgress?: { displayPercentage?: number; percentage?: number } | null;
  items?: Array<{ status: TreatmentPlanItemStatus; completionPercentage?: number | null }>;
}) {
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

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(value);
}

function planHasFinancialDebt(plan: { financialSummary?: TreatmentPlanFinancialSummary | null }) {
  return numberValue(plan.financialSummary?.debtAmount) > 0;
}

function PlanFinancialStatus({ summary }: { summary?: TreatmentPlanFinancialSummary | null }) {
  if (!summary) return <span className="text-xs font-medium text-slate-400">Sin cálculo</span>;
  const tone =
    summary.situation.code === "DEBT"
      ? "bg-red-50 text-red-700 border-red-200/80"
      : summary.situation.code === "NO_AVAILABLE_BALANCE"
        ? "bg-amber-50 text-amber-800 border-amber-200/80"
        : summary.situation.code === "CANCELLED"
          ? "bg-slate-100 text-slate-600 border-slate-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200/80";
  const amount = summary.situation.amount ? ` ${money(numberValue(summary.situation.amount))}` : "";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shadow-xs ${tone}`}>
      {summary.situation.label}
      {amount}
    </span>
  );
}

function fdiLabel(value?: string | null) {
  if (!value) return "-";
  return value.length >= 2 ? `${value[0]}.${value[1]}` : value;
}

function surfaceValues(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized === "ALL") return [];
  if (normalized.includes(","))
    return normalized
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  return [normalized];
}

function surfaceLabel(value?: string | null) {
  if (value?.trim().toUpperCase() === "ALL") return "Pieza completa";
  const values = surfaceValues(value);
  if (!values.length) return "";
  return values
    .map((surface) => PIECE_SURFACES.find((item) => item.code === surface)?.label ?? surface)
    .join(", ");
}

function normalizeCatalogText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isKnownSymbolProcedure(procedure: TreatmentPriceCatalogItem["procedure"]) {
  const text = normalizeCatalogText(`${procedure.code} ${procedure.name}`);
  return text.includes("LIMPIEZA") && text.includes("BLANQUEAMIENTO");
}

function procedureRequiresOdontogramSymbol(procedure: TreatmentPriceCatalogItem["procedure"]) {
  return procedure.requiresOdontogramSymbol || isKnownSymbolProcedure(procedure);
}

function defaultOdontogramSymbol(procedure: TreatmentPriceCatalogItem["procedure"]): DiagnosisMark {
  return getDiagnosisMark(procedure.defaultOdontogramSymbol) ?? "other";
}

type CatalogToothSelection = {
  teeth: string[];
  surface: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

function clinicalPlainText(value?: string | null) {
  if (!value) return "";
  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = value;
    return (container.textContent ?? container.innerText ?? "").replace(/\s+/g, " ").trim();
  }
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemPaidAmount(item: TreatmentPlanItem) {
  return (item.paymentAllocations ?? []).reduce((sum, allocation) => sum + numberValue(allocation.amount), 0);
}

function planTotals(plan?: TreatmentPlanDetail | null) {
  const items = plan?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + numberValue(item.quantity) * numberValue(item.unitPrice),
    0
  );
  const discount = items.reduce((sum, item) => sum + numberValue(item.discount), 0);
  const total = items.reduce((sum, item) => sum + numberValue(item.total), 0);
  const paid = items.reduce((sum, item) => sum + itemPaidAmount(item), 0);
  const completed = items
    .filter((item) => item.status === "COMPLETED")
    .reduce((sum, item) => sum + numberValue(item.total), 0);
  return { subtotal, discount, total, paid, completed, balance: Math.max(total - paid, 0) };
}

function itemStatusDotClass(status: TreatmentPlanItemStatus) {
  if (status === "COMPLETED" || status === "PAID") return "bg-green-600";
  if (status === "CANCELLED") return "bg-slate-400";
  if (status === "IN_PROGRESS") return "bg-sky-600";
  return "bg-red-600";
}

function itemCompletionPercentage(item: TreatmentPlanItem) {
  if (typeof item.completionPercentage === "number") {
    return Number.isFinite(item.completionPercentage)
      ? Math.min(100, Math.max(0, item.completionPercentage))
      : 0;
  }
  if (item.status === "COMPLETED") return 100;
  if (item.status === "IN_PROGRESS") return 25;
  return 0;
}

function itemDiscountPercent(item: TreatmentPlanItem) {
  const base = itemDiscountBase(item);
  if (!base) return 0;
  return Math.round((numberValue(item.discount) / base) * 100);
}

function ProgressRing({ percentage, active }: { percentage: number; active?: boolean }) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0;
  const offset = circumference - (safePercentage / 100) * circumference;

  return (
    <svg className="h-8 w-8" viewBox="0 0 32 32" aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="white"
        stroke={active ? "#38bdf8" : "#cbd5e1"}
        strokeWidth="4"
      />
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        stroke="#2563eb"
        strokeLinecap="round"
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 16 16)"
      />
      <text x="16" y="19" textAnchor="middle" className="fill-slate-700 text-[8px] font-bold">
        {Math.round(safePercentage)}
      </text>
    </svg>
  );
}

function priceForProcedure(priceList: TreatmentPriceCatalog | null, procedureId: string) {
  return numberValue(priceList?.items.find((item) => item.procedureId === procedureId)?.price);
}

function normalizeSpecialtyKey(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function specialtyKind(name?: string | null): TreatmentPlanKind | null {
  const key = normalizeSpecialtyKey(name);
  if (!key) return null;
  if (key === "ortodoncia" || key.includes("orthodontics")) return "ORTHODONTICS";
  if (key.includes("general") || key.includes("integral")) return "GENERAL";
  return null;
}

function professionalPlanKinds(professional?: Professional | null) {
  const kinds = new Map<TreatmentPlanKind, string>();
  for (const specialty of professional?.specialties ?? []) {
    const kind = specialtyKind(specialty.name);
    if (kind) kinds.set(kind, specialty.name);
  }
  return kinds;
}

function displayPlanSpecialty(plan: {
  kind?: TreatmentPlanKind;
  specialtySnapshotName?: string | null;
  specialty?: { name: string } | null;
}) {
  return (
    plan.specialtySnapshotName ??
    plan.specialty?.name ??
    (plan.kind ? PLAN_KIND_LABELS[plan.kind] : "General / Integral")
  );
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function todayInputValue() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function addCalendarMonthsInput(value: string, months: number) {
  if (!value || !months) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const targetMonthIndex = month - 1 + months;
  const lastDay = new Date(year, targetMonthIndex + 1, 0).getDate();
  const date = new Date(year, targetMonthIndex, Math.min(day, lastDay));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function orthodonticStartDurationValue(value?: number | null) {
  if (value && value >= 3 && value <= 36) return value;
  return 24;
}

function dateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function PatientTreatmentsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPlanId = searchParams.get("planId") ?? "";

  const setSelectedPlanId = (newId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newId) next.set("planId", newId);
      else next.delete("planId");
      return next;
    });
  };
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [autoSectionIdsByName, setAutoSectionIdsByName] = useState<Record<string, string>>({});
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [agreementDetailModalOpen, setAgreementDetailModalOpen] = useState(false);
  const [financingModalOpen, setFinancingModalOpen] = useState(false);
  const [payrollDiscountModalOpen, setPayrollDiscountModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [refundsModalOpen, setRefundsModalOpen] = useState(false);
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
  const [repricePreview, setRepricePreview] = useState<TreatmentPlanRepricePreview | null>(null);
  const [repriceReason, setRepriceReason] = useState("");
  const [budgetDrawerAddedItems, setBudgetDrawerAddedItems] = useState(0);
  const [printCenterOption, setPrintCenterOption] = useState<TreatmentPlanPrintOption | null>(null);
  const [pieceAssignmentItem, setPieceAssignmentItem] = useState<TreatmentPlanItem | null>(null);
  const [evolutionContext, setEvolutionContext] = useState<{
    treatmentPlanId: string;
    treatmentPlanItemId?: string;
  } | null>(null);
  const [pendingAppointmentMove, setPendingAppointmentMove] = useState<{
    planId: string;
    branchId: string;
    professionalId: string;
    futureAppointmentsCount: number;
  } | null>(null);

  const patient = usePatient(id);
  const plans = useTreatmentPlans({ patientId: id });
  const selectedPlan = useTreatmentPlan(selectedPlanId);
  const budgets = useBudgets({ patientId: id, treatmentPlanId: selectedPlanId || undefined });
  const odontogram = useOdontogram(id);
  const appointments = useClinicalAppointmentHistory(id);
  const payments = usePatientPayments(id);
  const branches = useBranches(undefined, "ACTIVE");
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const planList = Array.isArray(plans.data) ? plans.data : [];
  const plan = selectedPlan.data ?? null;
  const professionalBranchId = patient.data?.branchId ?? activeBranchId;
  const professionals = useProfessionals(undefined, "true", {
    branchId: professionalBranchId || undefined,
    pageSize: 100
  });
  const procedures = useProcedures(undefined, "true");
  const agreementsForPricing = useAgreements(undefined, "true");
  const effectiveAgreement = resolveEffectiveTreatmentAgreement({
    plan,
    patientAgreement: patient.data?.agreement ?? null,
    agreements: agreementsForPricing.data ?? []
  });
  const agreementPriceListId = effectiveAgreement.priceListId;
  const treatmentPriceCatalog = useTreatmentPlanPriceCatalog(plan?.id ?? "", Boolean(plan?.id));
  const clinicalMutations = useClinicalMutations(id);
  const treatmentMutations = useTreatmentMutations();
  const paymentMutations = usePaymentsMutations();
  const addNote = useAddPatientNote();
  const updatePatient = useUpdatePatient();
  const { hasPermission } = usePermissions();

  const selectedTooth = useOdontogramStore((state) => state.selectedTooth);
  const selectedTeeth = useOdontogramStore((state) => state.selectedTeeth);
  const selectedSurface = useOdontogramStore((state) => state.selectedSurface);
  const activeModal = useOdontogramStore((state) => state.activeModal);
  const storeSelectTooth = useOdontogramStore((state) => state.selectTooth);
  const setSelectedSurface = useOdontogramStore((state) => state.setSelectedSurface);
  const setActiveTool = useOdontogramStore((state) => state.setActiveTool);
  const openOdontogramModal = useOdontogramStore((state) => state.openModal);
  const closeOdontogramModal = useOdontogramStore((state) => state.closeModal);
  const resetWorkspace = useOdontogramStore((state) => state.resetWorkspace);

  const selectTooth = (tooth: string, options?: { additive?: boolean }) => {
    storeSelectTooth(tooth, options);
  };

  const handleSelectTooth = (tooth: string, options?: { additive?: boolean }) => {
    storeSelectTooth(tooth, options);
    if (plan) {
      openBudgetDrawer();
    }
  };
  const toothHistory = useToothHistory(id, selectedTooth, selectedSurface || undefined);

  const planProcedures = useTreatmentPlanProcedures(plan?.id ?? "", Boolean(plan?.id));
  const printOptions = useTreatmentPlanPrintOptions(plan?.id ?? "", Boolean(plan?.id));
  const printOptionsByType = useMemo(
    () => new Map((printOptions.data ?? []).map((option) => [option.document_type, option] as const)),
    [printOptions.data]
  );
  const payablePlan = useMemo(
    () => (payments.data?.payablePlans ?? []).find((candidate) => candidate.id === plan?.id) ?? null,
    [payments.data?.payablePlans, plan?.id]
  );
  const financeableItems = useMemo(
    () => payablePlan?.items.filter((item) => financeableAmount(item) > 0) ?? [],
    [payablePlan]
  );
  const financeableTotal = useMemo(
    () => roundMoney(financeableItems.reduce((sum, item) => sum + financeableAmount(item), 0)),
    [financeableItems]
  );
  const payrollChargeItems = useMemo(
    () =>
      plan?.items.filter((item) => item.status !== "CANCELLED" && numberValue(item.agreementCoverage) > 0) ??
      [],
    [plan]
  );
  const payrollChargeTotal = useMemo(
    () => roundMoney(payrollChargeItems.reduce((sum, item) => sum + numberValue(item.agreementCoverage), 0)),
    [payrollChargeItems]
  );
  const totals = useMemo(() => planTotals(plan), [plan]);
  const priceList = treatmentPriceCatalog.data ?? null;
  const upcomingAppointments = (appointments.data ?? []).slice(0, 3);
  const latestBudget = (plan?.budgets?.[0] ?? budgets.data?.[0] ?? null) as Budget | null;
  const completeBudgetPrintOption = printOptionsByType.get("BUDGET_COMPLETE");
  const planHasAgreementLock = Boolean(
    effectiveAgreement.agreement && plan && (plan.items.length || plan.budgets.length || latestBudget)
  );
  const professionalOptions = (professionals.data ?? []).map((professional) => ({
    id: professional.id,
    label: `${professional.firstName} ${professional.lastName}`
  }));
  const actionTeeth = selectedTeeth.length ? selectedTeeth : selectedTooth ? [selectedTooth] : [];
  const canCreateFinancing = hasPermission("installments.create") || hasPermission("system.manage_all");
  const canCollectPayment = hasPermission("payments.create") || hasPermission("system.manage_all");
  const canUsePayrollDiscount =
    (hasPermission("agreements.payments.create") ||
      hasPermission("settings.update") ||
      hasPermission("system.manage_all")) &&
    Boolean(patient.data?.agreement?.isActive && patient.data.agreement.payrollDiscount);
  const createPayrollDiscountPlan = useCreatePayrollDiscountPlan();

  useEffect(() => {
    resetWorkspace();
  }, [id, resetWorkspace]);

  useEffect(() => {
    setAutoSectionIdsByName({});
  }, [plan?.id]);

  // No auto-selection on load, user must select a plan card manually.

  const openCreatePlan = () => {
    const patientRow = patient.data;
    if (!patientRow) {
      toast.error("Necesitas un paciente cargado para crear el plan.");
      return;
    }
    setPlanModalOpen(true);
  };

  const createPlanFromModal = async (payload: {
    branchId: string;
    professionalId: string;
    kind: TreatmentPlanKind;
    name: string;
    description?: string;
  }) => {
    const created = await treatmentMutations.createTreatmentPlan.mutateAsync({
      branchId: payload.branchId,
      patientId: id,
      professionalId: payload.professionalId,
      kind: payload.kind,
      name: payload.name,
      description: payload.description,
      status: "DRAFT"
    });
    setPlanModalOpen(false);
    setSelectedPlanId(created.id);
  };

  const createDiagnosisForSelectedTeeth = async (diagnosis: string, notes?: string) => {
    const professionalId = professionalOptions[0]?.id ?? plan?.professional.id;
    if (!professionalId) {
      toast.error("No hay profesionales activos para registrar el diagnóstico.");
      return;
    }
    if (!actionTeeth.length) {
      toast.error("Selecciona una pieza dental en el odontograma.");
      return;
    }

    try {
      await Promise.all(
        actionTeeth.map((toothNumber) =>
          clinicalMutations.createToothCondition.mutateAsync({
            professionalId,
            toothNumber,
            surface: selectedSurface || "ALL",
            condition: diagnosis,
            diagnosis,
            notes
          })
        )
      );
      closeOdontogramModal();
      toast.success(
        actionTeeth.length > 1
          ? `Diagnóstico agregado a ${actionTeeth.length} piezas.`
          : "Diagnóstico agregado al odontograma."
      );
    } catch {
      // El hook de mutacion ya muestra el error de API.
    }
  };

  const openProcedureModal = () => {
    if (!plan) {
      toast.error("Selecciona o crea un plan de tratamiento.");
      return;
    }
    if (!selectedTooth) {
      toast.error("Selecciona una pieza dental en el odontograma.");
      return;
    }
    setActiveTool("procedure");
    setProcedureModalOpen(true);
  };

  const openBudgetDrawer = () => {
    if (!plan) {
      toast.error("Selecciona o crea un plan de tratamiento.");
      return;
    }
    if (
      effectiveAgreement.source === "patient" &&
      effectiveAgreement.agreementId &&
      agreementsForPricing.isLoading
    ) {
      toast.error("Cargando convenio del plan. Intenta nuevamente.");
      return;
    }
    if (!effectiveAgreement.agreement) {
      toast.error("Asigna un convenio con arancel antes de crear presupuesto.");
      setAgreementModalOpen(true);
      return;
    }
    if (!agreementPriceListId) {
      toast.error("Asigna un convenio con arancel antes de crear presupuesto.");
      setAgreementModalOpen(true);
      return;
    }
    if (treatmentPriceCatalog.isLoading) {
      toast.error("Cargando arancel del convenio. Intenta nuevamente.");
      return;
    }
    if (!priceList) {
      toast.error("No se encontro el arancel del convenio.");
      return;
    }
    setBudgetDrawerAddedItems(0);
    setBudgetDrawerOpen(true);
  };

  const openRepriceModal = async () => {
    if (!plan || plan.status !== "DRAFT") return;
    const preview = await treatmentMutations.previewReprice.mutateAsync({ id: plan.id });
    setRepriceReason("");
    setRepricePreview(preview);
  };

  const applyReprice = async () => {
    if (!plan || !repricePreview || !repriceReason.trim()) return;
    await treatmentMutations.applyReprice.mutateAsync({
      id: plan.id,
      payload: { reason: repriceReason.trim() }
    });
    setRepricePreview(null);
    setRepriceReason("");
    toast.success("Precios del borrador actualizados con trazabilidad.");
  };

  const openAgreementPanel = () => {
    if (planHasAgreementLock) {
      setAgreementDetailModalOpen(true);
      return;
    }
    setAgreementModalOpen(true);
  };

  const [symbolModalOpen, setSymbolModalOpen] = useState(false);
  const [pendingSymbolItem, setPendingSymbolItem] = useState<TreatmentPriceCatalogItem | null>(null);
  const [pendingSymbolSelection, setPendingSymbolSelection] = useState<CatalogToothSelection>({
    teeth: [],
    surface: ""
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");

  const readCurrentCatalogSelection = (): CatalogToothSelection => {
    const current = useOdontogramStore.getState();
    const teeth = current.selectedTeeth.length
      ? current.selectedTeeth
      : current.selectedTooth
        ? [current.selectedTooth]
        : actionTeeth;
    return {
      teeth,
      surface: current.selectedSurface || selectedSurface
    };
  };

  const requestBudgetCatalogItem = async (item: TreatmentPriceCatalogItem) => {
    const selection = readCurrentCatalogSelection();
    if (procedureRequiresOdontogramSymbol(item.procedure)) {
      setPendingSymbolItem(item);
      setPendingSymbolSelection(selection);
      setSelectedSymbol(defaultOdontogramSymbol(item.procedure));
      setSymbolModalOpen(true);
    } else {
      await addBudgetCatalogItem(item, undefined, selection);
    }
  };

  const addBudgetCatalogItem = async (
    item: TreatmentPriceCatalogItem,
    explicitSymbol?: string,
    selection: CatalogToothSelection = readCurrentCatalogSelection()
  ) => {
    if (!plan) {
      toast.error("Selecciona o crea un plan de tratamiento.");
      return;
    }
    const targetTeeth = selection.teeth.length ? selection.teeth : [undefined];
    const targetSurface = selection.surface;

    if ((item.procedure.requiresTooth || item.procedure.requiresSurface) && !selection.teeth.length) {
      toast.error("Selecciona una pieza dental, una cara o una region para continuar.");
      return;
    }

    const sectionName = `[${item.procedure.code}] ${item.procedure.name}`;
    let sectionId: string | undefined =
      plan.sections?.find((section) => section.name === sectionName)?.id ?? autoSectionIdsByName[sectionName];

    if (!sectionId) {
      try {
        const updatedPlan = await treatmentMutations.addSection.mutateAsync({
          treatmentPlanId: plan.id,
          name: sectionName,
          sortOrder: (plan.sections?.length || 0) + 1
        });
        sectionId = updatedPlan.sections?.find((section) => section.name === sectionName)?.id;
        if (sectionId) {
          const createdSectionId = sectionId;
          setAutoSectionIdsByName((current) => ({ ...current, [sectionName]: createdSectionId }));
        }
      } catch {
        toast.error("No se pudo crear la seccion automatica. Se cargara sin seccion.");
      }
    }

    await Promise.all(
      targetTeeth.map((toothNumber) =>
        treatmentMutations.addItem.mutateAsync({
          treatmentPlanId: plan.id,
          payload: {
            procedureId: item.procedureId,
            toothNumber,
            surface: toothNumber ? (targetSurface ? targetSurface : "ALL") : undefined,
            quantity: 1,
            odontogramSymbol: explicitSymbol || undefined,
            sectionId,
            syncOdontogram: Boolean(toothNumber)
          }
        })
      )
    );
    setBudgetDrawerAddedItems((count) => count + targetTeeth.length);
    toast.success(
      targetTeeth.length > 1 ? "Prestaciones agregadas al plan." : "Prestación agregada al plan."
    );
    if (symbolModalOpen) {
      setSymbolModalOpen(false);
      setPendingSymbolItem(null);
      setPendingSymbolSelection({ teeth: [], surface: "" });
    }
  };

  const createBudgetFromDrawer = async () => {
    if (!plan) return;
    if (!plan.items.length && !budgetDrawerAddedItems) {
      toast.error("Agrega al menos una prestación antes de crear el presupuesto.");
      return;
    }
    await treatmentMutations.createBudget.mutateAsync({ treatmentPlanId: plan.id });
    setBudgetDrawerOpen(false);
    toast.success("Presupuesto creado.");
  };

  const assignPieceToItem = async (item: TreatmentPlanItem, toothNumber: string, surfaces: string[]) => {
    if (!plan) return;
    await treatmentMutations.updateItem.mutateAsync({
      treatmentPlanId: plan.id,
      itemId: item.id,
      payload: {
        toothNumber,
        surface: surfaces.length ? surfaces.join(",") : undefined,
        syncOdontogram: true
      }
    });
    selectTooth(toothNumber);
    setSelectedSurface(surfaces.length ? surfaces.join(",") : "");
    setPieceAssignmentItem(null);
    toast.success("Pieza asignada a la prestación.");
  };

  const selectTreatmentItemPiece = (item: TreatmentPlanItem) => {
    if (!item.toothNumber) return;
    selectTooth(item.toothNumber);
    setSelectedSurface(item.surface && item.surface !== "ALL" ? item.surface : "");
  };

  const markItemForFuture = async (item: TreatmentPlanItem) => {
    if (!plan) return;
    const marked = Boolean(item.plannedAt);
    await treatmentMutations.updateItem.mutateAsync({
      treatmentPlanId: plan.id,
      itemId: item.id,
      payload: { plannedAt: marked ? null : new Date().toISOString() }
    });
    toast.success(
      marked
        ? "Prestación desmarcada para futura realizacion."
        : "Prestación marcada para futura realizacion."
    );
  };

  const unrealizeItem = async (item: TreatmentPlanItem) => {
    if (!plan) return;
    await treatmentMutations.updateItemStatus.mutateAsync({
      treatmentPlanId: plan.id,
      itemId: item.id,
      status: "PLANNED",
      completionPercentage: 0,
      expectedVersion: item.version
    });
    toast.success("Prestación marcada como no realizada.");
  };

  const unlinkItemPayment = async (item: TreatmentPlanItem) => {
    const allocation = item.paymentAllocations?.[0];
    if (!allocation) {
      toast.error("Esta prestación no tiene pagos asociados.");
      return;
    }
    await paymentMutations.removeAllocation.mutateAsync(allocation.id);
  };

  const payItem = (item: TreatmentPlanItem) => {
    const pending = Math.max(numberValue(item.total) - itemPaidAmount(item), 0);
    if (pending <= 0) {
      toast.error("Esta prestación no tiene saldo pendiente.");
      return;
    }
    navigate(
      `${APP_ROUTES.patients.payments(id)}?treatmentPlanId=${encodeURIComponent(item.treatmentPlanId)}&itemId=${encodeURIComponent(item.id)}&amount=${pending}`
    );
  };

  const evolveItem = (item: TreatmentPlanItem) => {
    setEvolutionContext({
      treatmentPlanId: item.treatmentPlanId,
      treatmentPlanItemId: item.id
    });
  };

  const openPdfDocument = (document: { base64: string; mimeType: string; fileName: string }, win: Window) => {
    const binary = window.atob(document.base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType || "application/pdf" }));
    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html style="height: 100%; margin: 0;">
        <head><title>${document.fileName}</title></head>
        <body style="margin:0; overflow:hidden; height: 100vh;">
          <iframe src="${url}#view=FitH" width="100%" height="100%" style="border:none; height: 100vh; width: 100vw;"></iframe>
        </body>
      </html>
    `);
    win.document.close();
  };

  const printTreatmentDocument = async (type: TreatmentPlanPrintDocumentType) => {
    if (!plan) {
      toast.error("Selecciona un plan de tratamiento.");
      return;
    }
    const option = printOptionsByType.get(type);
    if (option && !option.enabled) {
      toast.error(option.disabled_reason ?? "Esta opcion no esta disponible.");
      return;
    }
    setPrintCenterOption(
      option ?? {
        visible: true,
        enabled: true,
        disabled_reason: null,
        permission: "budgets.print",
        document_type: type,
        label: type,
        description: "Documento de plan de tratamiento.",
        context: { budgetId: latestBudget?.id ?? null }
      }
    );
  };

  const generatePrintDocument = async (mode: "preview" | "generate") => {
    if (!plan || !printCenterOption) return;
    const win = window.open("about:blank", "_blank", "width=1200,height=900");
    if (!win) {
      toast.error("El navegador bloqueo la ventana de impresion.");
      return;
    }
    win.opener = null;
    try {
      win.document.open();
      win.document.write('<p style="font:14px system-ui;margin:24px">Generando documento...</p>');
      win.document.close();

      const payload = {
        treatmentPlanId: plan.id,
        type: printCenterOption.document_type,
        budgetId: printCenterOption.context?.budgetId ?? latestBudget?.id ?? undefined
      };
      const document =
        mode === "preview"
          ? await treatmentMutations.previewTreatmentPlanDocument.mutateAsync(payload)
          : await treatmentMutations.generateTreatmentPlanDocument.mutateAsync(payload);
      openPdfDocument(document, win);
      if (mode === "generate") setPrintCenterOption(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hubo un error al generar el documento.";
      win.document.open();
      win.document.write(`<p style="font:14px system-ui;margin:24px;color:#b91c1c">${message}</p>`);
      win.document.close();
      toast.error(message);
    }
  };

  const collectPlan = (targetPlan: TreatmentPlanDetail) => {
    if (!canCollectPayment) {
      toast.error("No tienes permisos para recaudar.");
      return;
    }
    const returnUrl = `${APP_ROUTES.patients.treatments(id)}?planId=${encodeURIComponent(targetPlan.id)}`;
    navigate(
      `${APP_ROUTES.patients.payments(id)}?treatmentPlanId=${encodeURIComponent(targetPlan.id)}&returnUrl=${encodeURIComponent(returnUrl)}`
    );
  };

  const openFinancingPlan = () => {
    if (!plan) return;
    if (!canCreateFinancing) {
      toast.error("No tienes permisos para crear financiamientos.");
      return;
    }
    if (!financeableItems.length) {
      toast.error("No existen prestaciones con saldo disponible para financiar.");
      return;
    }
    setFinancingModalOpen(true);
  };

  const openPayrollDiscount = () => {
    if (!canUsePayrollDiscount) {
      toast.error(payrollDiscountDisabledReason(patient.data?.agreement, payrollChargeTotal));
      return;
    }
    if (!plan?.agreementId) {
      toast.error("El plan no conserva un convenio asociado.");
      return;
    }
    setPayrollDiscountModalOpen(true);
  };

  const duplicatePlan = async (targetPlan: TreatmentPlanDetail) => {
    const duplicated = await treatmentMutations.duplicateTreatmentPlan.mutateAsync({
      id: targetPlan.id,
      reason: "Duplicado desde barra de acciones del plan"
    });
    if (duplicated?.id) setSelectedPlanId(duplicated.id);
    toast.success("Plan de tratamiento duplicado.");
  };

  const assignAgreement = async (agreementId: string) => {
    await updatePatient.mutateAsync({
      id,
      payload: { agreementId }
    });
    setAgreementModalOpen(false);
    toast.success("Convenio asignado al paciente.");
  };

  const changePlanBranch = async (payload: { branchId: string; professionalId: string }) => {
    if (!plan) return;
    const result = await treatmentMutations.changeBranch.mutateAsync({
      id: plan.id,
      ...payload,
      moveFutureAppointments: false
    });
    setBranchModalOpen(false);
    toast.success("Sucursal y profesional del plan actualizados.");

    if (result.futureAppointmentsCount > 0) {
      setPendingAppointmentMove({
        planId: result.id,
        branchId: payload.branchId,
        professionalId: payload.professionalId,
        futureAppointmentsCount: result.futureAppointmentsCount
      });
    }
  };

  const moveFutureAppointments = async () => {
    if (!pendingAppointmentMove) return;
    const result = await treatmentMutations.changeBranch.mutateAsync({
      id: pendingAppointmentMove.planId,
      branchId: pendingAppointmentMove.branchId,
      professionalId: pendingAppointmentMove.professionalId,
      moveFutureAppointments: true
    });
    toast.success(`${result.movedFutureAppointmentsCount} citas futuras movidas.`);
    setPendingAppointmentMove(null);
  };

  const planOdontogramPanel = plan ? (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Odontograma del plan</h2>
          <p className="text-xs text-slate-500">
            Selecciona una pieza y agrega productos desde el arancel del convenio del plan.
          </p>
        </div>
      </div>

      {odontogram.isLoading ? <LoadingState message="Cargando odontograma..." /> : null}
      {odontogram.isError ? <ErrorState message={odontogram.error.message} /> : null}
      {odontogram.data ? (
        <OdontogramView
          mode="treatment-plan"
          selectedTooth={selectedTooth}
          latestByTooth={odontogram.data.latestByTooth ?? {}}
          conditions={odontogram.data.conditions ?? []}
          records={odontogram.data.records ?? []}
          procedures={odontogram.data.procedures ?? []}
          onSelectTooth={handleSelectTooth}
          onOpenDiagnosis={() => openOdontogramModal("diagnosis")}
          onOpenPreexistence={() => openOdontogramModal("preexistence")}
          onOpenLesion={() => openOdontogramModal("lesion")}
          onOpenTreatment={openProcedureModal}
          onOpenProcedureCatalog={openBudgetDrawer}
          onOpenInformation={() => openOdontogramModal("info")}
          onApplyQuickDiagnosis={(diagnosis) => void createDiagnosisForSelectedTeeth(diagnosis)}
          showHistoryTable={false}
        />
      ) : null}
    </section>
  ) : null;

  const planItemsPanel = plan ? (
    <TreatmentItemsTable
      plan={plan}
      activePriceVersionNumber={priceList?.activeVersion?.number ?? null}
      proceduresData={planProcedures.data ?? null}
      loadingProcedures={planProcedures.isLoading}
      onAssignPiece={setPieceAssignmentItem}
      onMarkFuture={(item) => void markItemForFuture(item)}
      onUnrealize={(item) => void unrealizeItem(item)}
      onUnlinkPayment={(item) => void unlinkItemPayment(item)}
      onPay={payItem}
      onCreateSection={() => setSectionModalOpen(true)}
      onOpenProcedureCatalog={openBudgetDrawer}
      onSelectPiece={selectTreatmentItemPiece}
      onEvolveItem={evolveItem}
      canApplyTreatmentDiscount={
        hasPermission("treatment_discount.apply") ||
        hasPermission("treatment_discount.override") ||
        hasPermission("system.manage_all")
      }
      onApplyBulkDiscount={(payload) =>
        treatmentMutations.applyBulkDiscount.mutateAsync({ treatmentPlanId: plan.id, ...payload })
      }
      onDelete={(itemId) => treatmentMutations.deleteItem.mutate({ treatmentPlanId: plan.id, itemId })}
    />
  ) : null;

  const planBudgetPanel = plan ? (
    <BudgetPanel
      budget={latestBudget}
      onSend={(budgetId) => treatmentMutations.sendBudget.mutate(budgetId)}
      onAccept={(budgetId) => treatmentMutations.acceptBudget.mutate(budgetId)}
      onCreate={openBudgetDrawer}
    />
  ) : null;

  const planSignaturePanel = (
    <PatientSignaturePanel
      patientId={id}
      notes={patient.data?.notes ?? []}
      onAddComment={() => setCommentModalOpen(true)}
    />
  );

  if (patient.isLoading || plans.isLoading)
    return <LoadingState message="Cargando planes de tratamiento..." />;
  if (patient.isError) return <ErrorState message={patient.error.message} />;
  if (plans.isError) return <ErrorState message={plans.error.message} />;

  return (
    <PatientSectionPage
      patientId={id}
      title="Paciente - Tratamientos"
      description="Plan clinico, odontograma, precios y presupuesto."
      hideSubnav={!!selectedPlanId}
    >
      <div className="space-y-4">
        {selectedPlanId ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm mb-4">
              <div className="flex min-w-0 flex-wrap items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPlanId("")}
                  className="text-slate-500 hover:text-slate-800 -ml-2"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Volver a planes
                </Button>
                <div className="h-6 w-px bg-slate-200 hidden md:block" />
                <span
                  className="text-sm font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-[300px]"
                  title={plan?.name}
                >
                  {plan?.name}
                </span>
                {plan ? (
                  <Badge
                    value={PLAN_CLINICAL_STATUS_LABELS[planClinicalStatus(plan)]}
                    tone={
                      planClinicalStatus(plan) === "COMPLETED" ||
                      planClinicalStatus(plan) === "READY_TO_COMPLETE"
                        ? "success"
                        : planClinicalStatus(plan) === "NOT_STARTED"
                          ? "default"
                          : "warning"
                    }
                  />
                ) : null}
                {plan ? (
                  <Badge
                    value={displayPlanSpecialty(plan)}
                    tone={plan.kind === "ORTHODONTICS" ? "warning" : "default"}
                  />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={openCreatePlan}
                  disabled={treatmentMutations.createTreatmentPlan.isPending}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Nuevo plan
                </Button>
                <Button
                  variant="secondary"
                  disabled={!plan || treatmentMutations.createBudget.isPending}
                  onClick={openBudgetDrawer}
                >
                  <Receipt className="mr-1 h-4 w-4" />
                  Generar presupuesto
                </Button>
                {plan?.status === "DRAFT" ? (
                  <Button
                    variant="secondary"
                    disabled={treatmentMutations.previewReprice.isPending}
                    onClick={() => void openRepriceModal()}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Actualizar precios
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  disabled={completeBudgetPrintOption ? !completeBudgetPrintOption.enabled : !latestBudget}
                  onClick={() => void printTreatmentDocument("BUDGET_COMPLETE")}
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            </div>

            {selectedPlan.isLoading ? <LoadingState message="Cargando detalle del plan..." /> : null}
            {selectedPlan.isError ? <ErrorState message={selectedPlan.error.message} /> : null}

            {plan ? (
              <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                <PlanSidebar
                  plan={plan}
                  totals={totals}
                  patientAgreementName={effectiveAgreement.agreement?.name}
                  upcomingAppointments={upcomingAppointments}
                  onOpenAgreement={openAgreementPanel}
                  onOpenBranch={() => setBranchModalOpen(true)}
                  onOpenRefunds={() => setRefundsModalOpen(true)}
                />

                <main className="min-w-0 space-y-4">
                  {plan.kind === "ORTHODONTICS" ? (
                    <OrthodonticPlanWorkspace
                      patientId={id}
                      plan={plan}
                      procedures={procedures.data ?? []}
                      odontogramPanel={planOdontogramPanel}
                      savingProfile={treatmentMutations.updateOrthodonticProfile.isPending}
                      savingDiagnosis={
                        treatmentMutations.saveOrthodonticDiagnosisDraft.isPending ||
                        treatmentMutations.saveOrthodonticDiagnosisActive.isPending
                      }
                      generatingMonthlyItems={treatmentMutations.createOrthodonticMonthlyItems.isPending}
                      onSaveProfile={(payload) =>
                        treatmentMutations.updateOrthodonticProfile.mutateAsync({ id: plan.id, payload })
                      }
                      onSaveDiagnosisDraft={(payload) =>
                        treatmentMutations.saveOrthodonticDiagnosisDraft.mutateAsync({ id: plan.id, payload })
                      }
                      onSaveDiagnosisActive={(payload) =>
                        treatmentMutations.saveOrthodonticDiagnosisActive.mutateAsync({
                          id: plan.id,
                          payload
                        })
                      }
                      onGenerateMonthlyItems={(payload) =>
                        treatmentMutations.createOrthodonticMonthlyItems.mutateAsync({ id: plan.id, payload })
                      }
                      onCollect={() => collectPlan(plan)}
                      onFinance={openFinancingPlan}
                      onPayrollDiscount={openPayrollDiscount}
                      financeDisabledReason={financingDisabledReason(canCreateFinancing, financeableTotal)}
                      payrollDiscountDisabledReason={payrollDiscountDisabledReason(
                        patient.data?.agreement,
                        payrollChargeTotal
                      )}
                      collectDisabledReason={collectDisabledReason(canCollectPayment, totals.balance)}
                      onOpenRefunds={() => setRefundsModalOpen(true)}
                      onDuplicate={() => void duplicatePlan(plan)}
                      onPrintDocument={(type) => void printTreatmentDocument(type)}
                      printOptions={printOptions.data ?? []}
                      canPrintBudget={Boolean(latestBudget)}
                      canPrintDocuments={plan.items.length > 0}
                      onPause={(reason) =>
                        treatmentMutations.pauseTreatment.mutateAsync({ id: plan.id, reason })
                      }
                      onResume={() => treatmentMutations.resumeTreatment.mutateAsync(plan.id)}
                      startingTreatment={treatmentMutations.startOrthodonticTreatment.isPending}
                      canManageOrthodonticCatalogs={
                        hasPermission("orthodontic_catalogs.manage") || hasPermission("system.manage_all")
                      }
                      canManageOrthodonticDiagnosisCatalogs={
                        hasPermission("orthodontic_diagnosis.catalogs.manage") ||
                        hasPermission("system.manage_all")
                      }
                      onStart={(payload) =>
                        treatmentMutations.startOrthodonticTreatment.mutateAsync({ id: plan.id, payload })
                      }
                      onCreateCatalogOption={(fieldId, label) =>
                        treatmentMutations.createOrthodonticFieldOption.mutateAsync({ fieldId, label })
                      }
                      onUpdateCatalogOption={(optionId, payload) =>
                        treatmentMutations.updateOrthodonticFieldOption.mutateAsync({ optionId, payload })
                      }
                      onDeactivateCatalogOption={(optionId, reason) =>
                        treatmentMutations.deactivateOrthodonticFieldOption.mutateAsync({ optionId, reason })
                      }
                      onReactivateCatalogOption={(optionId) =>
                        treatmentMutations.reactivateOrthodonticFieldOption.mutateAsync(optionId)
                      }
                      onSortCatalogOptions={(fieldId, optionIds) =>
                        treatmentMutations.sortOrthodonticFieldOptions.mutateAsync({ fieldId, optionIds })
                      }
                      onCreateDiagnosisOption={(fieldId, label) =>
                        treatmentMutations.createOrthodonticDiagnosisFieldOption.mutateAsync({
                          fieldId,
                          label
                        })
                      }
                      onUpdateDiagnosisOption={(optionId, payload) =>
                        treatmentMutations.updateOrthodonticDiagnosisFieldOption.mutateAsync({
                          optionId,
                          payload
                        })
                      }
                      onDeactivateDiagnosisOption={(optionId, reason) =>
                        treatmentMutations.deactivateOrthodonticDiagnosisFieldOption.mutateAsync({
                          optionId,
                          reason
                        })
                      }
                      onReactivateDiagnosisOption={(optionId) =>
                        treatmentMutations.reactivateOrthodonticDiagnosisFieldOption.mutateAsync(optionId)
                      }
                      onSortDiagnosisOptions={(fieldId, optionIds) =>
                        treatmentMutations.sortOrthodonticDiagnosisFieldOptions.mutateAsync({
                          fieldId,
                          optionIds
                        })
                      }
                    />
                  ) : (
                    <>
                      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                          <div>
                            <h2 className="text-base font-semibold text-slate-900">Odontograma del plan</h2>
                            <p className="text-xs text-slate-500">
                              Selecciona una pieza y agrega productos desde el convenio del paciente.
                            </p>
                          </div>
                        </div>

                        {odontogram.isLoading ? <LoadingState message="Cargando odontograma..." /> : null}
                        {odontogram.isError ? <ErrorState message={odontogram.error.message} /> : null}
                        {odontogram.data ? (
                          <OdontogramView
                            mode="treatment-plan"
                            selectedTooth={selectedTooth}
                            latestByTooth={odontogram.data.latestByTooth ?? {}}
                            conditions={odontogram.data.conditions ?? []}
                            records={odontogram.data.records ?? []}
                            procedures={odontogram.data.procedures ?? []}
                            onSelectTooth={handleSelectTooth}
                            onOpenDiagnosis={() => openOdontogramModal("diagnosis")}
                            onOpenPreexistence={() => openOdontogramModal("preexistence")}
                            onOpenLesion={() => openOdontogramModal("lesion")}
                            onOpenTreatment={openProcedureModal}
                            onOpenProcedureCatalog={openBudgetDrawer}
                            onOpenInformation={() => openOdontogramModal("info")}
                            onApplyQuickDiagnosis={(diagnosis) =>
                              void createDiagnosisForSelectedTeeth(diagnosis)
                            }
                            showHistoryTable={false}
                          />
                        ) : null}
                      </section>
                    </>
                  )}
                  {planItemsPanel}
                  {planBudgetPanel}
                  {planSignaturePanel}
                </main>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8 bg-white border border-slate-200 p-4 rounded-md shadow-sm">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-normal text-slate-700">Planes de tratamiento</h2>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-sm font-medium text-sky-600 cursor-pointer flex items-center gap-1 hover:text-sky-700">
                  Tratamientos activos{" "}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <Button
                  onClick={openCreatePlan}
                  disabled={treatmentMutations.createTreatmentPlan.isPending}
                  className="bg-[#5cb85c] text-white hover:bg-[#4cae4c] h-10 rounded shadow-sm px-4 font-semibold"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nuevo plan de tratamiento
                </Button>
              </div>
            </div>

            {!planList.length ? (
              <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed border-2">
                <EmptyState
                  title="Sin planes de tratamiento"
                  description="Crea el primer plan para activar odontograma, precios y presupuesto."
                />
                <Button className="mt-4" onClick={openCreatePlan}>
                  Crear plan inicial
                </Button>
              </Card>
            ) : (
              <div className="space-y-8">
                {(() => {
                  const renderCard = (item: (typeof planList)[0]) => {
                    const numericCode = numericId(item.id);
                    const clinicalStatus = planClinicalStatus(item);
                    const clinicalProgress = planClinicalProgressPercentage(item);

                    return (
                      <div
                        key={item.id}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white transition-all duration-200 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/5 cursor-pointer shadow-sm"
                        onClick={() => setSelectedPlanId(item.id)}
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:px-6">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base font-bold text-sky-700 transition-colors group-hover:text-sky-800 sm:text-lg">
                              #{numericCode}: {item.name}
                            </span>
                            <div
                              className="rounded-md p-1 text-sky-600 transition-colors hover:bg-sky-100/70"
                              title="Editar plan"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation(); /* Add delete logic */
                            }}
                            title="Eliminar plan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Card Columns Body */}
                        <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:px-6 md:grid-cols-6 md:gap-3 items-center">
                          {/* 1. Profesional */}
                          <div className="min-w-0">
                            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Profesional
                            </div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                                <UserRound className="h-3.5 w-3.5" />
                              </div>
                              <span className="truncate leading-snug">
                                {item.professional.firstName} {item.professional.lastName}
                              </span>
                            </div>
                          </div>

                          {/* 2. Especialidad */}
                          <div className="min-w-0">
                            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Especialidad
                            </div>
                            <div className="truncate text-sm font-medium text-slate-700">
                              {displayPlanSpecialty(item)}
                            </div>
                          </div>

                          {/* 3. Última cita */}
                          <div className="min-w-0">
                            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Ultima cita
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                              <CalendarClock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {item.appointments?.[0]?.startAt
                                  ? formatDate(item.appointments[0].startAt)
                                  : "Sin sesiones"}
                              </span>
                            </div>
                          </div>

                          {/* 4. Progreso clínico */}
                          <div className="flex flex-col items-start min-w-0">
                            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Progreso clinico
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                                <svg className="h-10 w-10 -rotate-90 transform" viewBox="0 0 36 36">
                                  <path
                                    className="text-slate-100"
                                    strokeWidth="3.5"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  />
                                  <path
                                    className={clinicalProgress === 100 ? "text-emerald-500" : "text-sky-600"}
                                    strokeDasharray={`${clinicalProgress}, 100`}
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  />
                                </svg>
                                <span className="absolute text-[11px] font-bold text-slate-700">{clinicalProgress}%</span>
                              </div>
                            </div>
                          </div>

                          {/* 5. Estado clínico */}
                          <div className="min-w-0">
                            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Estado clinico
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                              </span>
                              <span className="truncate">{PLAN_CLINICAL_STATUS_LABELS[clinicalStatus]}</span>
                            </div>
                          </div>

                          {/* 6. Estado financiero */}
                          <div className="min-w-0">
                            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Estado financiero
                            </div>
                            <PlanFinancialStatus summary={item.financialSummary} />
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs font-medium text-slate-500 sm:px-6">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <span className="text-slate-500">Presupuesto:</span>
                            <span className="text-sm font-bold text-slate-900">
                              {money(numberValue(item.financialSummary?.budgetAmount))}
                            </span>
                          </div>
                          <div className="text-slate-400">
                            Creado {formatDate(item.createdAt)} · Última actividad {formatDate(item.updatedAt)}
                          </div>
                        </div>
                      </div>
                    );
                  };

                  const finalizedWithDebt = planList.filter(
                    (p) => planClinicalStatus(p) === "COMPLETED" && planHasFinancialDebt(p)
                  );
                  const inProgress = planList.filter(
                    (p) => planClinicalStatus(p) === "IN_PROGRESS" && !finalizedWithDebt.includes(p)
                  );
                  const others = planList.filter(
                    (p) => !inProgress.includes(p) && !finalizedWithDebt.includes(p)
                  );

                  return (
                    <>
                      {/* En ejecución */}
                      <div>
                        <h3 className="text-2xl font-normal text-sky-600 mb-6">En ejecución</h3>
                        {inProgress.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm font-medium">
                            El paciente no cuenta con tratamientos en ejecución
                          </div>
                        ) : (
                          <div className="space-y-4">{inProgress.map(renderCard)}</div>
                        )}
                      </div>

                      {/* Otros */}
                      <div>
                        <div className="flex items-center gap-4 mb-6">
                          <h3 className="text-2xl font-normal text-slate-500">Otros</h3>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                        {others.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm font-medium">
                            No hay otros planes registrados
                          </div>
                        ) : (
                          <div className="space-y-4">{others.map(renderCard)}</div>
                        )}
                      </div>

                      {finalizedWithDebt.length ? (
                        <div>
                          <div className="mb-6 flex items-center gap-4">
                            <h3 className="text-2xl font-normal text-red-600">
                              Presupuestos finalizados con deudas
                            </h3>
                            <div className="h-px flex-1 bg-red-200" />
                          </div>
                          <div className="space-y-4">{finalizedWithDebt.map(renderCard)}</div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      <ClinicalEvolutionModal
        patientId={id}
        branchId={plan?.branch.id ?? patient.data?.branchId ?? activeBranchId ?? undefined}
        open={Boolean(evolutionContext)}
        initialTreatmentPlanId={evolutionContext?.treatmentPlanId}
        initialTreatmentPlanItemId={evolutionContext?.treatmentPlanItemId}
        onClose={() => setEvolutionContext(null)}
      />

      <NewTreatmentPlanModal
        open={planModalOpen}
        patientBranchId={patient.data?.branchId ?? activeBranchId ?? ""}
        planCount={planList.length}
        onClose={() => setPlanModalOpen(false)}
        onSave={createPlanFromModal}
        saving={treatmentMutations.createTreatmentPlan.isPending}
      />

      <BudgetProcedureDrawer
        open={budgetDrawerOpen}
        plan={plan}
        agreementName={effectiveAgreement.agreement?.name ?? null}
        priceList={priceList}
        selectedTooth={selectedTooth}
        selectedSurface={selectedSurface}
        addedItemsCount={budgetDrawerAddedItems}
        addingItem={treatmentMutations.addItem.isPending}
        creatingBudget={treatmentMutations.createBudget.isPending}
        onClose={() => setBudgetDrawerOpen(false)}
        onAddItem={requestBudgetCatalogItem}
        onCreateBudget={createBudgetFromDrawer}
      />

      <TreatmentRepriceModal
        preview={repricePreview}
        plan={plan}
        reason={repriceReason}
        applying={treatmentMutations.applyReprice.isPending}
        onReasonChange={setRepriceReason}
        onClose={() => {
          setRepricePreview(null);
          setRepriceReason("");
        }}
        onApply={() => void applyReprice()}
      />

      <PlanProcedureModal
        open={procedureModalOpen}
        plan={plan}
        toothNumber={selectedTooth}
        surface={selectedSurface}
        onSurfaceChange={setSelectedSurface}
        procedures={procedures.data ?? []}
        priceList={priceList}
        onClose={() => setProcedureModalOpen(false)}
        onSave={async (payload) => {
          if (!plan) return;
          await treatmentMutations.addItem.mutateAsync({
            treatmentPlanId: plan.id,
            payload: { ...payload, syncOdontogram: Boolean(payload.toothNumber) }
          });
          setProcedureModalOpen(false);
        }}
      />

      <PieceAssignmentModal
        item={pieceAssignmentItem}
        saving={treatmentMutations.updateItem.isPending}
        onClose={() => setPieceAssignmentItem(null)}
        onSave={assignPieceToItem}
      />

      <SymbolModal
        open={symbolModalOpen}
        item={pendingSymbolItem}
        selectedSymbol={selectedSymbol}
        onSymbolChange={setSelectedSymbol}
        teeth={pendingSymbolSelection.teeth}
        saving={treatmentMutations.addItem.isPending}
        onClose={() => {
          setSymbolModalOpen(false);
          setPendingSymbolItem(null);
          setPendingSymbolSelection({ teeth: [], surface: "" });
        }}
        onSave={() => {
          if (pendingSymbolItem) {
            void addBudgetCatalogItem(pendingSymbolItem, selectedSymbol, pendingSymbolSelection);
          }
        }}
      />

      <PrintCenterModal
        open={Boolean(printCenterOption)}
        option={printCenterOption}
        plan={plan}
        patientName={`${patient.data?.firstName ?? ""} ${patient.data?.lastName ?? ""}`.trim()}
        logoLabel="Logo configurado en identidad de clinica/sucursal"
        saving={
          treatmentMutations.previewTreatmentPlanDocument.isPending ||
          treatmentMutations.generateTreatmentPlanDocument.isPending
        }
        onClose={() => setPrintCenterOption(null)}
        onPreview={() => void generatePrintDocument("preview")}
        onGenerate={() => void generatePrintDocument("generate")}
      />

      <SectionModal
        open={sectionModalOpen}
        nextSortOrder={(plan?.sections.length ?? 0) + 1}
        onClose={() => setSectionModalOpen(false)}
        onSave={async ({ name, sortOrder }) => {
          if (!plan) return;
          await treatmentMutations.addSection.mutateAsync({ treatmentPlanId: plan.id, name, sortOrder });
          setSectionModalOpen(false);
          toast.success("La seccion fue creada correctamente.");
        }}
      />

      <CommentModal
        open={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        onSave={async (note) => {
          await addNote.mutateAsync({ id, note, isPrivate: false });
          setCommentModalOpen(false);
        }}
      />

      <AgreementAssignmentModal
        open={agreementModalOpen}
        currentAgreementId={effectiveAgreement.agreement?.id ?? patient.data?.agreement?.id}
        currentAgreement={effectiveAgreement.agreement ?? patient.data?.agreement ?? null}
        plan={plan}
        onClose={() => setAgreementModalOpen(false)}
        onAssign={assignAgreement}
        saving={updatePatient.isPending}
      />

      <AgreementDetailModal
        open={agreementDetailModalOpen}
        agreement={effectiveAgreement.agreement ?? patient.data?.agreement ?? null}
        onClose={() => setAgreementDetailModalOpen(false)}
      />

      <FinancingModal
        open={financingModalOpen}
        plan={plan}
        items={financeableItems}
        totalAvailable={financeableTotal}
        saving={paymentMutations.createInstallmentPlan.isPending}
        onClose={() => setFinancingModalOpen(false)}
        onCreate={async (payload) => {
          if (!plan) return;
          await paymentMutations.createInstallmentPlan.mutateAsync(payload);
          setFinancingModalOpen(false);
        }}
      />

      <PayrollDiscountModal
        open={payrollDiscountModalOpen}
        plan={plan}
        items={payrollChargeItems}
        totalAvailable={payrollChargeTotal}
        saving={createPayrollDiscountPlan.isPending}
        onClose={() => setPayrollDiscountModalOpen(false)}
        onCreate={async (payload) => {
          if (!plan?.agreementId) return;
          await createPayrollDiscountPlan.mutateAsync({ agreementId: plan.agreementId, payload });
          setPayrollDiscountModalOpen(false);
        }}
      />

      <BranchChangeModal
        open={branchModalOpen}
        plan={plan}
        branches={branches.data ?? []}
        branchesLoading={branches.isLoading}
        onClose={() => setBranchModalOpen(false)}
        onConfirm={changePlanBranch}
        saving={treatmentMutations.changeBranch.isPending}
      />

      <RefundsModal
        open={refundsModalOpen}
        patientId={id}
        plan={plan}
        onClose={() => setRefundsModalOpen(false)}
      />

      <FutureAppointmentsModal
        pending={pendingAppointmentMove}
        onClose={() => setPendingAppointmentMove(null)}
        onConfirm={moveFutureAppointments}
        saving={treatmentMutations.changeBranch.isPending}
      />

      <DiagnosisModal
        open={activeModal === "diagnosis" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        surface={selectedSurface}
        onClose={closeOdontogramModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothDiagnosisPickerWindow
        open={activeModal === "preexistence" && Boolean(selectedTooth)}
        title="Agregar una preexistencia"
        tone="preexistence"
        sectionTitles={["Preexistencias"]}
        toothNumbers={actionTeeth}
        surface={selectedSurface}
        onClose={closeOdontogramModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothDiagnosisPickerWindow
        open={activeModal === "lesion" && Boolean(selectedTooth)}
        title="Agregar una lesion"
        tone="lesion"
        sectionTitles={["Lesiones"]}
        toothNumbers={actionTeeth}
        surface={selectedSurface}
        onClose={closeOdontogramModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothInformationModal
        open={activeModal === "info" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        surface={selectedSurface}
        history={toothHistory.data}
        historyLoading={toothHistory.isLoading}
        onCancelRecord={(odontogramRecordId) =>
          clinicalMutations.cancelOdontogramRecord.mutate(odontogramRecordId)
        }
        onUpdateProcedureStatus={(payload) => clinicalMutations.updateToothProcedureStatus.mutate(payload)}
        onClose={closeOdontogramModal}
      />

      <MultipleToothSelectionModal open={activeModal === "multi-help"} onClose={closeOdontogramModal} />
    </PatientSectionPage>
  );
}

function PlanSidebar({
  plan,
  totals,
  patientAgreementName,
  upcomingAppointments,
  onOpenAgreement,
  onOpenBranch,
  onOpenRefunds
}: {
  plan: TreatmentPlanDetail;
  totals: ReturnType<typeof planTotals>;
  patientAgreementName?: string | null;
  upcomingAppointments: Array<{
    id: string;
    startAt: string;
    status: string;
    professional: { firstName: string; lastName: string };
    branch?: { name: string } | null;
  }>;
  onOpenAgreement: () => void;
  onOpenBranch: () => void;
  onOpenRefunds: () => void;
}) {
  const financial = plan.financialSummary;
  const budgetAmount = numberValue(financial?.budgetAmount ?? totals.total);
  const discountAmount = numberValue(financial?.discountAmount ?? totals.discount);
  const recognizedAmount = numberValue(financial?.recognizedAmount ?? totals.completed);
  const paidAmount = numberValue(financial?.paidAmount ?? totals.paid);
  const outstandingAmount = numberValue(financial?.outstandingAmount ?? totals.balance);
  return (
    <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-[#0b8bd8] to-[#23b4c8] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-white/75">Plan de tratamiento</p>
            <h2 className="mt-1 text-xl font-bold leading-tight">{plan.name}</h2>
          </div>
          <span className="rounded bg-white/15 px-2 py-1 text-xs font-semibold">#{numericId(plan.id)}</span>
        </div>

        <div className="mt-5 rounded-lg bg-white p-4 text-slate-900 shadow-sm">
          <p className="text-center text-xs text-slate-500">Presupuesto total</p>
          <p className="mt-1 text-center text-2xl font-semibold text-[#0879d5]">{money(budgetAmount)}</p>
          <div className="mt-4 space-y-2 text-xs">
            <SummaryLine
              label="Presupuesto bruto"
              value={money(numberValue(financial?.grossBudgetAmount ?? totals.subtotal))}
            />
            <SummaryLine label="Descuento comercial" value={money(discountAmount)} />
            <SummaryLine
              label="Realizado"
              value={money(recognizedAmount)}
              hint="Valor financiero reconocido de las prestaciones evolucionadas."
            />
            <SummaryLine
              label="Abonado"
              value={money(paidAmount)}
              hint="Pagos válidos asignados a este plan."
            />
            <SummaryLine
              label="Saldo por abonar"
              value={money(outstandingAmount)}
              strong
              hint="Importe pendiente para completar el presupuesto total."
            />
          </div>
          <FinancialSituationPanel summary={financial} />
        </div>
      </div>

      <div className="space-y-4 p-5 text-sm">
        <SidebarFact
          icon={<UserRound className="h-5 w-5" />}
          label="Profesional a cargo"
          value={`${plan.professional.firstName} ${plan.professional.lastName}`}
        />
        <SidebarFact
          icon={<FolderOpen className="h-5 w-5" />}
          label="Convenio"
          value={patientAgreementName ?? "Sin convenio"}
          onClick={onOpenAgreement}
        />
        <SidebarFact
          icon={<Building2 className="h-5 w-5" />}
          label="Sucursal"
          value={plan.branch.name}
          onClick={onOpenBranch}
        />
        <SidebarFact
          icon={<Briefcase className="h-5 w-5" />}
          label="Reembolsos"
          value="Ver reembolsos"
          onClick={onOpenRefunds}
        />
      </div>

      <div className="border-t border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Citas del paciente</h3>
        <div className="mt-3 space-y-3">
          {upcomingAppointments.length ? (
            upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="text-xs text-slate-500">
                <p className="font-semibold text-slate-800">Cita #{numericId(appointment.id)}</p>
                <p>{formatDateTime(appointment.startAt)}</p>
                <p>
                  Dr(a). {appointment.professional.firstName} {appointment.professional.lastName}
                </p>
                <p>{appointment.branch?.name ?? plan.branch.name}</p>
                <p>{appointment.status}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500">No hay citas registradas para mostrar.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function SummaryLine({
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

function FinancialSituationPanel({ summary }: { summary?: TreatmentPlanFinancialSummary | null }) {
  if (!summary) return null;
  const code = summary.situation.code;
  const tone =
    code === "DEBT"
      ? "border-red-200 bg-red-50 text-red-700"
      : code === "NO_AVAILABLE_BALANCE"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : code === "CANCELLED"
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const amount = summary.situation.amount ? money(numberValue(summary.situation.amount)) : null;

  return (
    <details className={`mt-4 rounded-lg border px-3 py-2 ${tone}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold">
        <span>{summary.situation.label}</span>
        {amount ? <span>{amount}</span> : null}
      </summary>
      <div className="mt-3 space-y-1.5 border-t border-current/15 pt-3 text-[11px]">
        <SummaryLine
          label="Deuda clínica"
          value={money(numberValue(summary.debtAmount))}
          hint="Valor realizado que todavía no está cubierto por pagos."
        />
        <SummaryLine
          label="Abonos asignados"
          value={money(numberValue(summary.assignedBalance))}
          hint="Dinero anticipado vinculado al plan disponible para futuras prestaciones."
        />
        <SummaryLine label="Abono libre disponible" value={money(numberValue(summary.freeCreditAmount))} />
        <SummaryLine label="Importe devuelto" value={money(numberValue(summary.refundedAmount))} />
      </div>
    </details>
  );
}

function SidebarFact({
  icon,
  label,
  value,
  onClick
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="font-medium text-[#0b8bd8]">{value}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="flex w-full gap-3 rounded-md text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="flex gap-3">{content}</div>;
}

function NewTreatmentPlanModal({
  open,
  patientBranchId,
  planCount,
  onClose,
  onSave,
  saving
}: {
  open: boolean;
  patientBranchId: string;
  planCount: number;
  onClose: () => void;
  onSave: (payload: {
    branchId: string;
    professionalId: string;
    kind: TreatmentPlanKind;
    name: string;
    description?: string;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [branchId, setBranchId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [kind, setKind] = useState<TreatmentPlanKind | "">("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", {
    branchId: branchId || undefined,
    pageSize: 100
  });
  const selectedProfessional =
    (professionals.data ?? []).find((professional) => professional.id === professionalId) ?? null;
  const kindOptions = useMemo(
    () => [...professionalPlanKinds(selectedProfessional).keys()],
    [selectedProfessional]
  );
  const canChooseKind = kindOptions.length > 1;
  const canSave = Boolean(branchId && professionalId && kind && name.trim());

  useEffect(() => {
    if (!open) return;
    setBranchId(patientBranchId);
    setProfessionalId("");
    setKind("");
    setName(`Plan de tratamiento ${planCount + 1}`);
    setDescription("");
  }, [open, patientBranchId, planCount]);

  useEffect(() => {
    if (!open || !selectedProfessional) return;
    if (kindOptions.length === 1) {
      const nextKind = kindOptions[0];
      setKind(nextKind);
      setName((current) =>
        current.trim() && !current.startsWith("Plan de tratamiento")
          ? current
          : `${PLAN_KIND_LABELS[nextKind]} ${planCount + 1}`
      );
      return;
    }
    if (!kindOptions.includes(kind as TreatmentPlanKind)) setKind("");
  }, [kind, kindOptions, open, planCount, selectedProfessional]);

  return (
    <Modal open={open} title="Nuevo plan de tratamiento" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-700">Sucursal *</label>
            <Select
              className="mt-2"
              value={branchId}
              disabled={branches.isLoading}
              onChange={(event) => {
                setBranchId(event.target.value);
                setProfessionalId("");
                setKind("");
              }}
            >
              <option value="">Seleccionar sucursal</option>
              {(branches.data ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Medico asignado *</label>
            <Select
              className="mt-2"
              value={professionalId}
              disabled={!branchId || professionals.isLoading}
              onChange={(event) => {
                setProfessionalId(event.target.value);
                setKind("");
              }}
            >
              <option value="">Seleccionar medico</option>
              {(professionals.data ?? []).map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professionalName(professional)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedProfessional ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Especialidades del medico</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedProfessional.specialties.length ? (
                selectedProfessional.specialties.map((specialty) => (
                  <span
                    key={specialty.id}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    {specialty.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-red-600">Sin especialidad valida para planes.</span>
              )}
            </div>
          </div>
        ) : null}

        {canChooseKind ? (
          <div>
            <label className="text-xs font-semibold text-slate-700">Tipo de plan *</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {kindOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                    kind === option
                      ? "border-sky-500 bg-sky-50 text-sky-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                  }`}
                  onClick={() => {
                    setKind(option);
                    setName(`${PLAN_KIND_LABELS[option]} ${planCount + 1}`);
                  }}
                >
                  <span className="font-semibold">{PLAN_KIND_LABELS[option]}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {option === "ORTHODONTICS"
                      ? "Ficha longitudinal de ortodoncia."
                      : "Plan integral con odontograma general."}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {selectedProfessional && !kindOptions.length ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            El medico seleccionado no tiene especialidad General/Integral u Ortodoncia.
          </div>
        ) : null}

        <div className="grid gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Nombre del plan *</label>
            <Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Descripcion</label>
            <Textarea
              className="mt-2"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave || saving}
            onClick={() =>
              void onSave({
                branchId,
                professionalId,
                kind: kind as TreatmentPlanKind,
                name: name.trim(),
                description: description.trim() || undefined
              })
            }
          >
            {saving ? "Creando..." : "Crear plan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type PlanAction = {
  label: string;
  description?: string;
  onSelect?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
};

type FloatingMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function PlanActionDropdown({
  id,
  label,
  icon,
  actions,
  open,
  onOpenChange
}: {
  id: string;
  label: string;
  icon: ReactNode;
  actions: PlanAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingMenuPosition>({
    top: 0,
    left: 0,
    width: 280,
    maxHeight: 560
  });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menu = menuRef.current;
      const measuredWidth = menu?.offsetWidth || 280;
      const width = Math.min(360, Math.max(280, measuredWidth));
      const maxHeight = Math.min(viewportHeight * 0.7, 560);
      const measuredHeight = Math.min(menu?.offsetHeight || maxHeight, maxHeight);
      const gap = 8;
      const padding = 8;
      const bottomTop = rect.bottom + gap;
      const topTop = rect.top - measuredHeight - gap;
      const hasBottomSpace = bottomTop + measuredHeight <= viewportHeight - padding;
      const top = hasBottomSpace ? bottomTop : Math.max(padding, topTop);
      const left = Math.min(
        Math.max(padding, rect.right - width),
        Math.max(padding, viewportWidth - width - padding)
      );
      setPosition({ top, left, width, maxHeight });
    };

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [onOpenChange, open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={label}
        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200"
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(true);
            window.setTimeout(() => {
              const first = menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
              first?.focus();
            });
          }
        }}
      >
        {icon}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={`${id}-menu`}
              role="menu"
              aria-label={label}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight
              }}
              className="z-[1900] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-2xl outline-none"
              onKeyDown={(event) => {
                const buttons = Array.from(
                  menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []
                );
                const currentIndex = buttons.findIndex((button) => button === document.activeElement);
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  const nextIndex =
                    currentIndex < 0
                      ? 0
                      : (currentIndex + direction + buttons.length) % Math.max(buttons.length, 1);
                  buttons[nextIndex]?.focus();
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  buttons[0]?.focus();
                }
                if (event.key === "End") {
                  event.preventDefault();
                  buttons[buttons.length - 1]?.focus();
                }
              }}
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  title={action.disabled ? action.disabledReason : undefined}
                  className={`flex w-full flex-col px-3 py-2 text-left transition ${
                    action.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white`}
                  onClick={() => {
                    if (action.disabled) return;
                    action.onSelect?.();
                    onOpenChange(false);
                    buttonRef.current?.focus();
                  }}
                >
                  <span className="font-medium">{action.label}</span>
                  {action.disabledReason || action.description ? (
                    <span className="mt-0.5 text-xs text-slate-400">
                      {action.disabled ? action.disabledReason : action.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}



function adaptLegacyOrthodonticSummary(plan: TreatmentPlanDetail): OrthodonticSummary | null {
  const legacy = plan.orthodonticSummary;
  const profile = plan.orthodonticProfile;
  if (!legacy && !profile) return null;

  const startedAt = profile?.startDate ?? null;
  const status: OrthodonticSummary["status"] = !startedAt
    ? "NOT_STARTED"
    : plan.status === "COMPLETED"
      ? "COMPLETED"
      : legacy?.isPaused
        ? "PAUSED"
        : "ACTIVE";
  const latestEvolution = legacy?.latestEvolution
    ? {
        id: legacy.latestEvolution.id,
        createdAt: legacy.latestEvolution.createdAt,
        professionalName: null,
        createdByName: null,
        notes: legacy.latestEvolution.notes,
        plainText:
          clinicalPlainText(legacy.latestEvolution.notes) ||
          clinicalPlainText(legacy.latestEvolution.assessment) ||
          clinicalPlainText(legacy.latestEvolution.objective) ||
          clinicalPlainText(legacy.latestEvolution.plan),
        isPrivate: false,
        fields: [],
        hygiene: null,
        materials: []
      }
    : null;

  return {
    treatmentPlanId: plan.id,
    status,
    startedAt,
    completedAt: plan.completedAt ?? null,
    calendarProgress: status === "NOT_STARTED" ? 0 : (legacy?.calendarProgress ?? 0),
    calendarProgressLabel: status === "NOT_STARTED" ? "Sin iniciar" : "Calculado desde ficha previa",
    elapsedActiveDays: 0,
    elapsedPausedDays: 0,
    realProgress: legacy?.realProgress ?? 0,
    realProgressLabel: "Calculado desde ficha previa",
    realProgressStatus: legacy?.realControlsCount ? "ON_TRACK" : "NO_CONTROLS",
    realControlsCount: legacy?.realControlsCount ?? 0,
    estimatedControls: legacy?.estimatedControls ?? profile?.estimatedControls ?? null,
    estimatedMonths: profile?.estimatedMonths ?? null,
    isPaused: legacy?.isPaused ?? false,
    pauseStartDate: legacy?.pauseStartDate ?? null,
    currentClinicalState: {
      upperArchMaterial: null,
      upperArchSize: valueSource(profile?.lastUpperArch),
      lowerArchMaterial: null,
      lowerArchSize: valueSource(profile?.lastLowerArch),
      upperAligner: null,
      lowerAligner: null,
      elasticsType: valueSource(profile?.elastics),
      elasticsConfig: null,
      nextControl: valueSource(profile?.nextControlAt),
      alert: valueSource(profile?.alert),
      nextSessionInstructions: valueSource(profile?.indications),
      radiographicControl: valueSource(profile?.nextRadiographyAt),
      intraoralPhotos: null,
      extraoralPhotos: null
    },
    hygiene: {
      latestScore: null,
      latestRecordedAt: null,
      trend: "NO_DATA",
      points: []
    },
    latestEvolution,
    recentEvolutions: latestEvolution ? [latestEvolution] : [],
    capabilities: {
      canStart: status === "NOT_STARTED",
      canPause: status === "ACTIVE",
      canResume: status === "PAUSED",
      canComplete: status === "ACTIVE",
      canEdit: true,
      canCreateEvolution: true,
      canViewPrivate: false
    }
  };
}

function valueSource(value?: string | null): OrthodonticClinicalFieldSource | null {
  if (!value) return null;
  return { value, recordedAt: null, evolutionId: null, professionalName: null };
}

function fieldSourceValue(source?: OrthodonticClinicalFieldSource | null) {
  return source?.value?.trim() || "";
}

function orthodonticStatusLabel(status?: OrthodonticSummary["status"]) {
  if (status === "NOT_STARTED") return "Tratamiento sin iniciar";
  if (status === "PAUSED") return "Tratamiento pausado";
  if (status === "COMPLETED") return "Tratamiento completado";
  return "Tratamiento activo";
}

function orthodonticStatusDescription(summary?: OrthodonticSummary | null) {
  if (!summary || summary.status === "NOT_STARTED") return "El calendario no corre hasta usar Dar inicio.";
  if (summary.status === "PAUSED" && summary.pauseStartDate) {
    return `Pausado desde ${formatDateTime(summary.pauseStartDate)}`;
  }
  if (summary.status === "COMPLETED") return "Tratamiento finalizado.";
  return "Ficha longitudinal para controles, arcos, higiene, alertas y evolucion mas reciente.";
}

function clinicalFieldDetail(source?: OrthodonticClinicalFieldSource | null) {
  if (!source?.recordedAt) return undefined;
  const professional = source.professionalName ? ` por ${source.professionalName}` : "";
  return `${formatDateTime(source.recordedAt)}${professional}`;
}

function orthodonticCatalogSelectionsFromProfile(profile?: TreatmentPlanDetail["orthodonticProfile"] | null) {
  const selections: Record<string, string[]> = {};
  for (const value of profile?.fieldValues ?? []) {
    const code = value.field?.code;
    if (code && value.optionId) selections[code] = [value.optionId];
  }
  for (const value of profile?.optionValues ?? []) {
    const code = value.field?.code;
    if (!code || !value.optionId) continue;
    selections[code] = [...(selections[code] ?? []), value.optionId];
  }
  return selections;
}

const ORTHODONTIC_TECHNICAL_PLAN_FIELDS = [
  "technicalDescription",
  "totalAligners",
  "indicatedExtractions",
  "performedExtractions",
  "reevaluationDate",
  "interconsultations",
  "lastUpperArch",
  "lastLowerArch",
  "hygieneStatus",
  "alert",
  "indications",
  "elastics",
  "planNotes"
] as const;

function isEmptyOrthodonticProfileValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

function isOrthodonticTechnicalPlanEmpty(profile?: TreatmentPlanDetail["orthodonticProfile"] | null) {
  if (!profile) return true;
  const hasScalarValue = ORTHODONTIC_TECHNICAL_PLAN_FIELDS.some(
    (field) => !isEmptyOrthodonticProfileValue(profile[field])
  );
  const hasCatalogValue = Boolean(profile.fieldValues?.length || profile.optionValues?.length);
  return !hasScalarValue && !hasCatalogValue;
}

function diagnosisFormValuesFromResult(
  result?: OrthodonticDiagnosisResult
): Record<string, OrthodonticDiagnosisFormValue> {
  const values: Record<string, OrthodonticDiagnosisFormValue> = {};
  for (const value of result?.diagnosis?.values ?? []) {
    if (!value.fieldCode) continue;
    values[value.fieldCode] = {
      valueText: value.valueText ?? "",
      valueNumber:
        value.valueNumber !== null && value.valueNumber !== undefined ? String(value.valueNumber) : "",
      optionId: value.optionId ?? "",
      optionIds: value.optionIds ?? []
    };
  }
  return values;
}

type OrthodonticProfileFormState = {
  technicalDescription: string;
  startDate: string;
  estimatedMonths: string;
  estimatedControls: string;
  totalAligners: string;
  indicatedExtractions: string;
  performedExtractions: string;
  reevaluationDate: string;
  interconsultations: string;
  lastUpperArch: string;
  lastLowerArch: string;
  nextControlAt: string;
  nextRadiographyAt: string;
  hygieneStatus: string;
  alert: string;
  indications: string;
  elastics: string;
  planNotes: string;
  catalogSelections: Record<string, string[]>;
};

type OrthodonticDiagnosisFormValue = {
  valueText?: string;
  valueNumber?: string;
  optionId?: string;
  optionIds?: string[];
};

function OrthodonticPlanWorkspace({
  patientId,
  plan,
  procedures,
  odontogramPanel,
  savingProfile,
  savingDiagnosis,
  generatingMonthlyItems,
  onSaveProfile,
  onSaveDiagnosisDraft,
  onSaveDiagnosisActive,
  onGenerateMonthlyItems,
  onCollect,
  onFinance,
  onPayrollDiscount,
  financeDisabledReason,
  payrollDiscountDisabledReason,
  collectDisabledReason,
  onOpenRefunds,
  onDuplicate,
  onPrintDocument,
  printOptions,
  canPrintBudget,
  canPrintDocuments,
  onPause,
  onResume,
  startingTreatment,
  canManageOrthodonticCatalogs,
  canManageOrthodonticDiagnosisCatalogs,
  onStart,
  onCreateCatalogOption,
  onUpdateCatalogOption,
  onDeactivateCatalogOption,
  onReactivateCatalogOption,
  onSortCatalogOptions,
  onCreateDiagnosisOption,
  onUpdateDiagnosisOption,
  onDeactivateDiagnosisOption,
  onReactivateDiagnosisOption,
  onSortDiagnosisOptions
}: {
  patientId: string;
  plan: TreatmentPlanDetail;
  procedures: Procedure[];
  odontogramPanel: ReactNode;
  savingProfile: boolean;
  savingDiagnosis: boolean;
  generatingMonthlyItems: boolean;
  onSaveProfile: (payload: OrthodonticProfilePayload) => Promise<unknown>;
  onSaveDiagnosisDraft: (payload: {
    clinicalDate?: string | null;
    values: OrthodonticDiagnosisValuePayload[];
  }) => Promise<unknown>;
  onSaveDiagnosisActive: (payload: {
    clinicalDate?: string | null;
    values: OrthodonticDiagnosisValuePayload[];
  }) => Promise<unknown>;
  onGenerateMonthlyItems: (payload: {
    procedureId: string;
    months: number;
    unitPrice?: number;
    startDate?: string;
    sectionName?: string;
    notes?: string;
  }) => Promise<unknown>;
  onCollect: () => void;
  onFinance: () => void;
  onPayrollDiscount: () => void;
  financeDisabledReason?: string;
  payrollDiscountDisabledReason?: string;
  collectDisabledReason?: string;
  onOpenRefunds: () => void;
  onDuplicate: () => void;
  onPrintDocument: (type: TreatmentPlanPrintDocumentType) => void;
  printOptions: TreatmentPlanPrintOption[];
  canPrintBudget: boolean;
  canPrintDocuments: boolean;
  onPause: (reason?: string) => Promise<unknown>;
  onResume: () => Promise<unknown>;
  startingTreatment: boolean;
  canManageOrthodonticCatalogs: boolean;
  canManageOrthodonticDiagnosisCatalogs: boolean;
  onStart: (payload: { startDate?: string; durationMonths: number }) => Promise<unknown>;
  onCreateCatalogOption: (fieldId: string, label: string) => Promise<unknown>;
  onUpdateCatalogOption: (
    optionId: string,
    payload: { label?: string; sortOrder?: number }
  ) => Promise<unknown>;
  onDeactivateCatalogOption: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivateCatalogOption: (optionId: string) => Promise<unknown>;
  onSortCatalogOptions: (fieldId: string, optionIds: string[]) => Promise<unknown>;
  onCreateDiagnosisOption: (fieldId: string, label: string) => Promise<unknown>;
  onUpdateDiagnosisOption: (
    optionId: string,
    payload: { label?: string; sortOrder?: number }
  ) => Promise<unknown>;
  onDeactivateDiagnosisOption: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivateDiagnosisOption: (optionId: string) => Promise<unknown>;
  onSortDiagnosisOptions: (fieldId: string, optionIds: string[]) => Promise<unknown>;
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const orthodonticCatalogs = useOrthodonticOptionFields(showPlanModal);
  const diagnosisStatus = useOrthodonticDiagnosisStatus(plan.id, activeTab === "diagnosis");
  const orthodonticDiagnosis = useOrthodonticDiagnosis(
    plan.id,
    showDiagnosisModal || activeTab === "diagnosis"
  );
  const diagnosisCatalogs = useOrthodonticDiagnosisCatalog(showDiagnosisModal || activeTab === "diagnosis");
  const [diagnosisAutoOpened, setDiagnosisAutoOpened] = useState(false);
  const [technicalPlanAutoOpened, setTechnicalPlanAutoOpened] = useState(false);
  const [diagnosisValues, setDiagnosisValues] = useState<Record<string, OrthodonticDiagnosisFormValue>>({});
  const [activeDiagnosisSection, setActiveDiagnosisSection] = useState<string>("generales");
  const [editingDiagnosisField, setEditingDiagnosisField] = useState<OrthodonticDiagnosisCatalogField | null>(
    null
  );
  const [profileForm, setProfileForm] = useState<OrthodonticProfileFormState>({
    technicalDescription: "",
    startDate: "",
    estimatedMonths: "",
    estimatedControls: "",
    totalAligners: "",
    indicatedExtractions: "",
    performedExtractions: "",
    reevaluationDate: "",
    interconsultations: "",
    lastUpperArch: "",
    lastLowerArch: "",
    nextControlAt: "",
    nextRadiographyAt: "",
    hygieneStatus: "",
    alert: "",
    indications: "",
    elastics: "",
    planNotes: "",
    catalogSelections: {} as Record<string, string[]>
  });
  const [monthlyForm, setMonthlyForm] = useState({
    procedureId: "",
    months: "12",
    unitPrice: "",
    startDate: "",
    notes: ""
  });
  const rxFiles = usePatientFiles(patientId, ORTHODONTIC_RX_CATEGORY, plan.id);
  const documentMutations = useDocumentsMutations();
  const orthodonticSummary = useOrthodonticSummary(plan.id, activeTab === "summary");
  const summary = orthodonticSummary.data ?? adaptLegacyOrthodonticSummary(plan);
  const isPlanReadOnly =
    plan.status === "COMPLETED" || plan.status === "CANCELLED" || plan.status === "REJECTED";
  const technicalPlanEmpty = isOrthodonticTechnicalPlanEmpty(plan.orthodonticProfile);
  const latestEvolution = summary?.latestEvolution;
  const diagnosisHydrationKey = JSON.stringify(orthodonticDiagnosis.data?.diagnosis?.values ?? []);
  const diagnosisFirstSectionCode =
    orthodonticDiagnosis.data?.catalog?.[0]?.code ?? diagnosisCatalogs.data?.[0]?.code ?? "generales";
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [showStartModal, setShowStartModal] = useState(false);
  const [startDate, setStartDate] = useState(
    dateInputValue(plan.orthodonticProfile?.startDate) || todayInputValue()
  );
  const [startDurationMonths, setStartDurationMonths] = useState(
    String(orthodonticStartDurationValue(plan.orthodonticProfile?.estimatedMonths))
  );

  useEffect(() => {
    const profile = plan.orthodonticProfile;
    setProfileForm({
      technicalDescription: profile?.technicalDescription ?? "",
      startDate: dateInputValue(profile?.startDate),
      estimatedMonths: profile?.estimatedMonths ? String(profile.estimatedMonths) : "",
      estimatedControls: profile?.estimatedControls ? String(profile.estimatedControls) : "",
      totalAligners:
        profile?.totalAligners !== null && profile?.totalAligners !== undefined
          ? String(profile.totalAligners)
          : "",
      indicatedExtractions: profile?.indicatedExtractions ?? "",
      performedExtractions: profile?.performedExtractions ?? "",
      reevaluationDate: dateInputValue(profile?.reevaluationDate),
      interconsultations: profile?.interconsultations ?? "",
      lastUpperArch: profile?.lastUpperArch ?? "",
      lastLowerArch: profile?.lastLowerArch ?? "",
      nextControlAt: dateTimeInputValue(profile?.nextControlAt),
      nextRadiographyAt: dateTimeInputValue(profile?.nextRadiographyAt),
      hygieneStatus: profile?.hygieneStatus ?? "",
      alert: profile?.alert ?? "",
      indications: profile?.indications ?? "",
      elastics: profile?.elastics ?? "",
      planNotes: profile?.planNotes ?? "",
      catalogSelections: orthodonticCatalogSelectionsFromProfile(profile)
    });

    setMonthlyForm((current) => ({ ...current, startDate: dateInputValue(profile?.startDate) }));
    setStartDate(dateInputValue(profile?.startDate) || todayInputValue());
    setStartDurationMonths(String(orthodonticStartDurationValue(profile?.estimatedMonths)));
  }, [plan.id, plan.orthodonticProfile]);

  useEffect(() => {
    setDiagnosisValues(diagnosisFormValuesFromResult(orthodonticDiagnosis.data));
    setActiveDiagnosisSection(diagnosisFirstSectionCode);
  }, [diagnosisHydrationKey, diagnosisFirstSectionCode]);

  useEffect(() => {
    if (activeTab !== "diagnosis") {
      setDiagnosisAutoOpened(false);
      return;
    }
    if (diagnosisAutoOpened || diagnosisStatus.isLoading || diagnosisStatus.data?.status !== "EMPTY") return;
    setDiagnosisAutoOpened(true);
    setShowDiagnosisModal(true);
  }, [activeTab, diagnosisAutoOpened, diagnosisStatus.data?.status, diagnosisStatus.isLoading]);

  useEffect(() => {
    if (activeTab !== "plan") {
      setTechnicalPlanAutoOpened(false);
      return;
    }
    if (technicalPlanAutoOpened || !technicalPlanEmpty || isPlanReadOnly) return;
    setTechnicalPlanAutoOpened(true);
    setShowPlanModal(true);
  }, [activeTab, isPlanReadOnly, technicalPlanAutoOpened, technicalPlanEmpty]);

  const updateProfileField = (
    field: Exclude<keyof OrthodonticProfileFormState, "catalogSelections">,
    value: string
  ) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const updateCatalogSelection = (
    fieldCode: string,
    optionId: string,
    allowsMultiple: boolean,
    checked?: boolean
  ) => {
    setProfileForm((current) => {
      const currentValues = current.catalogSelections[fieldCode] ?? [];
      const nextValues = allowsMultiple
        ? checked
          ? [...new Set([...currentValues, optionId])]
          : currentValues.filter((id) => id !== optionId)
        : optionId
          ? [optionId]
          : [];
      return {
        ...current,
        catalogSelections: {
          ...current.catalogSelections,
          [fieldCode]: nextValues
        }
      };
    });
  };

  const saveProfile = async () => {
    await onSaveProfile({
      technicalDescription: profileForm.technicalDescription || null,
      startDate: profileForm.startDate || null,
      estimatedMonths: profileForm.estimatedMonths ? Number(profileForm.estimatedMonths) : null,
      estimatedControls: profileForm.estimatedControls ? Number(profileForm.estimatedControls) : null,
      totalAligners: profileForm.totalAligners ? Number(profileForm.totalAligners) : null,
      indicatedExtractions: profileForm.indicatedExtractions || null,
      performedExtractions: profileForm.performedExtractions || null,
      reevaluationDate: profileForm.reevaluationDate || null,
      nextRadiographyAt: profileForm.nextRadiographyAt
        ? new Date(profileForm.nextRadiographyAt).toISOString()
        : null,
      indications: profileForm.indications || null,
      interconsultations: profileForm.interconsultations || null,
      planNotes: profileForm.planNotes || null,
      catalogSelections: profileForm.catalogSelections
    });
    setShowPlanModal(false);
    toast.success("Perfil de ortodoncia guardado.");
  };

  const diagnosisSections = orthodonticDiagnosis.data?.catalog ?? diagnosisCatalogs.data ?? [];
  const currentDiagnosis = orthodonticDiagnosis.data ?? diagnosisStatus.data;
  const readOnlyDiagnosis =
    plan.status === "COMPLETED" || plan.status === "CANCELLED" || plan.status === "REJECTED";

  const updateDiagnosisValue = (fieldCode: string, nextValue: OrthodonticDiagnosisFormValue) => {
    setDiagnosisValues((current) => ({ ...current, [fieldCode]: { ...current[fieldCode], ...nextValue } }));
  };

  const buildDiagnosisPayload = () => {
    const values: OrthodonticDiagnosisValuePayload[] = [];
    for (const section of diagnosisSections) {
      for (const field of section.fields) {
        const value = diagnosisValues[field.code] ?? {};
        if (field.inputType === "checkbox") {
          const optionIds = (value.optionIds ?? []).filter(Boolean);
          if (optionIds.length) values.push({ fieldCode: field.code, optionIds });
          continue;
        }
        if (field.inputType === "select") {
          if (value.optionId) values.push({ fieldCode: field.code, optionId: value.optionId });
          continue;
        }
        if (field.inputType === "number") {
          const numberValue = Number(value.valueNumber);
          if (value.valueNumber !== undefined && value.valueNumber !== "" && !Number.isNaN(numberValue)) {
            values.push({ fieldCode: field.code, valueNumber: numberValue });
          }
          continue;
        }
        const textValue = (value.valueText ?? "").trim();
        if (textValue) values.push({ fieldCode: field.code, valueText: textValue });
      }
    }
    return { values };
  };

  const saveDiagnosisDraft = async () => {
    await onSaveDiagnosisDraft(buildDiagnosisPayload());
    setShowDiagnosisModal(false);
    toast.success("Borrador de diagnostico guardado.");
  };

  const saveDiagnosisActive = async () => {
    await onSaveDiagnosisActive(buildDiagnosisPayload());
    setShowDiagnosisModal(false);
    toast.success("Diagnostico de ortodoncia guardado.");
  };

  const generateMonthlyItems = async () => {
    if (!monthlyForm.procedureId) {
      toast.error("Selecciona una prestacion para mensualidades.");
      return;
    }
    await onGenerateMonthlyItems({
      procedureId: monthlyForm.procedureId,
      months: Number(monthlyForm.months || 1),
      unitPrice: monthlyForm.unitPrice ? Number(monthlyForm.unitPrice) : undefined,
      startDate: monthlyForm.startDate || undefined,
      sectionName: "Mensualidades",
      notes: monthlyForm.notes || undefined
    });
    toast.success("Mensualidades agregadas al plan.");
  };

  const uploadFile = async (file: File | undefined, category: string) => {
    if (!file) return;
    await documentMutations.uploadPatientBinaryFile.mutateAsync({
      patientId,
      file,
      category,
      treatmentPlanId: plan.id
    });
  };

  const tabs = [
    ["summary", "Resumen"],
    ["photos", "Plantilla Fotografica"],
    ["diagnosis", "Diagnostico"],
    ["plan", "Plan de tratamiento"],
    ["rx", "Rx y Cf"]
  ] as const;

  const handlePause = async () => {
    await onPause(pauseReason);
    setShowPauseModal(false);
    setPauseReason("");
    toast.success("Tratamiento pausado correctamente.");
  };

  const handleResume = async () => {
    await onResume();
    toast.success("Tratamiento reanudado.");
  };

  const handleStart = async () => {
    const durationMonths = numberValue(startDurationMonths);
    if (!startDate) {
      toast.error("Selecciona la fecha de inicio.");
      return;
    }
    if (!Number.isInteger(durationMonths) || durationMonths < 3 || durationMonths > 36) {
      toast.error("La duracion debe estar entre 3 y 36 meses.");
      return;
    }
    if (startDate > todayInputValue()) {
      toast.error("La fecha de inicio no puede ser futura.");
      return;
    }
    await onStart({ startDate, durationMonths });
    setShowStartModal(false);
    toast.success("Tratamiento iniciado.");
  };

  const summaryRuntime = summary as unknown as {
    calendarProgress?: unknown;
    realProgress?: unknown;
    planning?: unknown;
  } | null;
  const calendarProgressData = recordValue(summaryRuntime?.calendarProgress);
  const realProgressData = recordValue(summaryRuntime?.realProgress);
  const planningData = recordValue(summaryRuntime?.planning);
  const statusLabel = orthodonticStatusLabel(summary?.status);
  const statusDescription = orthodonticStatusDescription(summary);
  const isNotStarted = summary?.status === "NOT_STARTED";
  const canStart = summary?.capabilities.canStart ?? isNotStarted;
  const canOpenStart = canStart && !plan.isAlternative;
  const canPause = summary?.capabilities.canPause ?? false;
  const canResume = summary?.capabilities.canResume ?? false;
  const clinicalState = summary?.currentClinicalState;
  const calendarProgress = progressPercentageValue(summaryRuntime?.calendarProgress);
  const realProgress = progressPercentageValue(summaryRuntime?.realProgress);
  const controlsProgressStatus =
    typeof realProgressData?.status === "string" ? realProgressData.status : summary?.realProgressStatus;
  const isDelayed =
    controlsProgressStatus === "POR_DEBAJO_DEL_RITMO" ||
    controlsProgressStatus === "PLAZO_EXCEDIDO" ||
    controlsProgressStatus === "DELAYED" ||
    realProgress < calendarProgress - 15;
  const estimatedMonths =
    finiteNumberValue(summary?.estimatedMonths ?? planningData?.plannedMonths, NaN) ||
    numberValue(profileForm.estimatedMonths);
  const plannedControls =
    finiteNumberValue(
      summary?.estimatedControls ?? planningData?.plannedControls ?? realProgressData?.plannedControls,
      NaN
    ) ||
    numberValue(profileForm.estimatedControls) ||
    estimatedMonths;
  const elapsedMonths = finiteNumberValue(
    summary?.elapsedMonths ?? calendarProgressData?.elapsedMonths,
    estimatedMonths ? Math.max(0, Math.round((calendarProgress / 100) * estimatedMonths)) : 0
  );
  const realControlsCount = finiteNumberValue(
    summary?.realControlsCount ?? planningData?.completedControls ?? realProgressData?.completedControls
  );
  const startDurationNumber = numberValue(startDurationMonths);
  const startDurationValid =
    Number.isInteger(startDurationNumber) && startDurationNumber >= 3 && startDurationNumber <= 36;
  const startDateIsFuture = Boolean(startDate && startDate > todayInputValue());
  const startPlannedControls = startDurationValid ? startDurationNumber : 0;
  const startExpectedEndDate = startDurationValid
    ? addCalendarMonthsInput(startDate, startDurationNumber)
    : "";
  const startCanSubmit = Boolean(startDate) && startDurationValid && !startDateIsFuture && !startingTreatment;
  const calendarProgressLabel =
    summary?.calendarProgressLabel ??
    (typeof calendarProgressData?.label === "string" ? calendarProgressData.label : undefined) ??
    statusDescription;
  const controlsProgressLabel =
    (typeof realProgressData?.label === "string" ? realProgressData.label : undefined) ??
    summary?.realProgressLabel ??
    (isDelayed ? "Seguimiento por debajo del calendario" : "Seguimiento en ritmo operativo");
  const nextControlLabel =
    fieldSourceValue(clinicalState?.nextControl) ||
    (profileForm.nextControlAt ? formatDateTime(profileForm.nextControlAt) : "Sin fecha");
  const nextRxLabel =
    fieldSourceValue(clinicalState?.radiographicControl) ||
    (profileForm.nextRadiographyAt ? formatDate(profileForm.nextRadiographyAt) : "Sin fecha");
  const hygieneMaximum = summary?.hygiene.maximumScore ?? 7;
  const latestHygieneLabel =
    summary?.hygiene.latestScore !== null && summary?.hygiene.latestScore !== undefined
      ? `${summary.hygiene.latestScore}/${hygieneMaximum}`
      : "Sin registro";
  const latestEvolutionText = latestEvolution?.plainText || clinicalPlainText(latestEvolution?.notes) || "";
  const setMenuOpen = (menu: string) => (nextOpen: boolean) => setOpenActionMenu(nextOpen ? menu : null);
  const emptyPlanDocumentReason = "Agrega al menos un procedimiento al plan.";
  const printOptionByType = new Map(printOptions.map((option) => [option.document_type, option] as const));
  const printAction = (
    type: TreatmentPlanPrintDocumentType,
    fallback: { label: string; description: string; disabled: boolean; disabledReason: string }
  ): PlanAction => {
    const option = printOptionByType.get(type);
    return {
      label: option?.label ?? fallback.label,
      description: option?.description ?? fallback.description,
      onSelect: () => onPrintDocument(type),
      disabled: option ? !option.enabled : fallback.disabled,
      disabledReason: option?.disabled_reason ?? (fallback.disabled ? fallback.disabledReason : undefined)
    };
  };
  const actionMenus = {
    money: [
      {
        label: "Financiamiento",
        onSelect: onFinance,
        disabled: Boolean(financeDisabledReason),
        disabledReason: financeDisabledReason
      },
      {
        label: "Descuento por planilla",
        onSelect: onPayrollDiscount,
        disabled: Boolean(payrollDiscountDisabledReason),
        disabledReason: payrollDiscountDisabledReason
      },
      {
        label: "Recaudar este tratamiento",
        onSelect: onCollect,
        disabled: Boolean(collectDisabledReason),
        disabledReason: collectDisabledReason
      }
    ] satisfies PlanAction[],
    settings: [
      { label: "Solicitud de reembolso", onSelect: onOpenRefunds },
      { label: "Duplicar plan de tratamiento", onSelect: onDuplicate },
      {
        label: "Crear tratamiento alternativo",
        disabled: true,
        disabledReason: "Requiere modal de seleccion de procedimientos antes de llamar al endpoint."
      },
      {
        label: "Solicitar atencion con otro profesional",
        disabled: true,
        disabledReason: "Requiere seleccionar profesional/sucursal/motivo."
      },
      {
        label: "Finalizar",
        disabled: true,
        disabledReason: "Falta validacion de bloqueos clinicos y financieros antes de cerrar."
      },
      {
        label: "Eliminar",
        disabled: true,
        disabledReason: "No existe endpoint de eliminacion logica del plan.",
        danger: true
      }
    ] satisfies PlanAction[],
    printer: [
      printAction("BUDGET_COMPLETE", {
        label: "Presupuesto completo",
        description: "Muestra procedimientos, importes individuales, resumen y estado de cuenta.",
        disabled: !canPrintBudget,
        disabledReason: "Primero genera un presupuesto."
      }),
      printAction("BUDGET_TOTAL_ONLY", {
        label: "Presupuesto con total general",
        description: "Muestra procedimientos y el total final, sin precios unitarios.",
        disabled: !canPrintBudget,
        disabledReason: "Primero genera un presupuesto."
      }),
      printAction("BUDGET_NO_DETAIL", {
        label: "Presupuesto sin valores",
        description: "Muestra el detalle clinico sin informacion economica.",
        disabled: !canPrintBudget,
        disabledReason: "Primero genera un presupuesto."
      }),
      printAction("LAB_ORDER", {
        label: "Orden de laboratorio",
        description: "Imprime la orden de laboratorio vinculada.",
        disabled: true,
        disabledReason: "No hay orden de laboratorio vinculada."
      }),
      printAction("CARE_PLAN", {
        label: "Plan de atencion",
        description: "Documento clinico, no financiero.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      }),
      printAction("SECTIONS", {
        label: "Secciones",
        description: "Imprime las secciones del plan.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      }),
      printAction("ODONTOGRAM", {
        label: "Odontograma",
        description: "Imprime el odontograma y hallazgos.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      }),
      printAction("CLINICAL_HISTORY", {
        label: "Historial clinico",
        description: "Imprime el historial clinico del paciente.",
        disabled: !canPrintDocuments,
        disabledReason: emptyPlanDocumentReason
      })
    ] satisfies PlanAction[],
    send: [
      {
        label: "Email",
        disabled: true,
        disabledReason:
          "El backend actual solo marca presupuesto como enviado; falta email con PDF y CommunicationJob."
      },
      { label: "WhatsApp", disabled: true, disabledReason: "WhatsApp estara disponible proximamente." },
      {
        label: "Historial de envios",
        disabled: true,
        disabledReason: "Falta consulta de CommunicationJob por plan/documento."
      }
    ] satisfies PlanAction[]
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-end border-b border-slate-300 px-4 pt-3 bg-slate-50/50">
          <button
            type="button"
            className={`mr-2 rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab !== "odontogram"
                ? "border-slate-300 bg-white text-slate-900 z-10 -mb-[1px]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("summary")}
          >
            Ortodoncia
          </button>
          <button
            type="button"
            className={`rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "odontogram"
                ? "border-slate-300 bg-white text-slate-900 z-10 -mb-[1px]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("odontogram")}
          >
            Odontograma
          </button>

          <div className="mb-2 ml-auto flex items-center gap-1 text-slate-500">
            <PlanActionDropdown
              id="money"
              label="Acciones financieras"
              icon={<DollarSign className="h-4 w-4" />}
              actions={actionMenus.money}
              open={openActionMenu === "money"}
              onOpenChange={setMenuOpen("money")}
            />
            <PlanActionDropdown
              id="settings"
              label="Acciones del plan"
              icon={<Settings className="h-4 w-4" />}
              actions={actionMenus.settings}
              open={openActionMenu === "settings"}
              onOpenChange={setMenuOpen("settings")}
            />
            <PlanActionDropdown
              id="printer"
              label="Imprimir documentos"
              icon={<Printer className="h-4 w-4" />}
              actions={actionMenus.printer}
              open={openActionMenu === "printer"}
              onOpenChange={setMenuOpen("printer")}
            />
            <PlanActionDropdown
              id="send"
              label="Enviar documentos"
              icon={<Send className="h-4 w-4" />}
              actions={actionMenus.send}
              open={openActionMenu === "send"}
              onOpenChange={setMenuOpen("send")}
            />
          </div>
        </div>

        {activeTab !== "odontogram" && (
          <div className="border-b border-slate-200 px-4 pt-4">
            <div className="flex gap-6 overflow-x-auto">
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    activeTab === value
                      ? "border-sky-600 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => {
                    if (value === "plan") {
                      setActiveTab(value);
                      setShowPlanModal(true);
                      return;
                    }
                    setActiveTab(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "summary" ? (
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-sky-100 bg-[linear-gradient(135deg,#f4fbff_0%,#ffffff_54%,#f4fdfa_100%)] p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                    Resumen clinico de ortodoncia
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{statusLabel}</h3>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">{statusDescription}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-sky-300 bg-white"
                    onClick={() => setShowPlanModal(true)}
                  >
                    <Save className="h-4 w-4" />
                    Editar ficha
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 gap-2 border-sky-600 bg-sky-600 hover:bg-sky-700 hover:border-sky-700 text-white"
                    onClick={() => setIsEvolutionModalOpen(true)}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    Nueva evolucion
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p
                          className="text-xs font-bold uppercase text-slate-500"
                          title="Tiempo transcurrido desde el inicio frente a la duracion estimada."
                        >
                          Progreso calendario
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {isNotStarted
                            ? "Sin iniciar"
                            : estimatedMonths
                              ? `${elapsedMonths} de ${estimatedMonths} meses`
                              : "Sin duracion"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Inicio: {summary?.startedAt ? formatDate(summary.startedAt) : "Sin fecha"}
                        </p>
                      </div>
                      <ProgressDonut
                        percentage={calendarProgress}
                        size={104}
                        strokeWidth={10}
                        label={`${Math.round(calendarProgress)}%`}
                        subLabel="Calendario"
                        color="text-sky-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p
                          className="text-xs font-bold uppercase text-slate-500"
                          title="Controles realizados frente a los controles planificados. No representa automaticamente el avance biologico del tratamiento."
                        >
                          Progreso por controles
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {plannedControls
                            ? `${realControlsCount} de ${plannedControls} controles`
                            : `${realControlsCount} controles`}
                        </p>
                        <p
                          className={`mt-1 text-xs font-medium ${isDelayed ? "text-amber-700" : "text-emerald-700"}`}
                        >
                          {controlsProgressLabel}
                        </p>
                      </div>
                      <ProgressDonut
                        percentage={realProgress}
                        size={104}
                        strokeWidth={10}
                        label={`${Math.round(realProgress)}%`}
                        subLabel="Controles"
                        color={isDelayed ? "text-amber-500" : "text-emerald-500"}
                        isAlert={isDelayed}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                        summary?.status === "PAUSED"
                          ? "bg-amber-50 text-amber-700"
                          : isNotStarted
                            ? "bg-slate-100 text-slate-600"
                            : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {summary?.status === "PAUSED" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase text-slate-500">Estado operativo</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {statusLabel.replace("Tratamiento ", "")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{calendarProgressLabel}</p>
                    </div>
                    {canOpenStart ? (
                      <Button
                        size="sm"
                        className="bg-sky-600 text-white hover:bg-sky-700"
                        onClick={() => setShowStartModal(true)}
                      >
                        <Play className="h-4 w-4" />
                        Dar inicio
                      </Button>
                    ) : canResume ? (
                      <Button variant="secondary" size="sm" className="bg-white" onClick={handleResume}>
                        <Play className="h-4 w-4" />
                        Reanudar
                      </Button>
                    ) : canPause ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowPauseModal(true)}
                      >
                        <Pause className="h-4 w-4" />
                        Pausar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MetricTile
                icon={<CalendarClock className="h-4 w-4" />}
                label="Proximo control"
                value={nextControlLabel}
                detail={`Rx/Cf: ${nextRxLabel}`}
              />
              <MetricTile
                icon={<Stethoscope className="h-4 w-4" />}
                label="Higiene"
                value={latestHygieneLabel}
                detail={
                  summary?.hygiene.latestRecordedAt
                    ? `Registrada ${formatDateTime(summary.hygiene.latestRecordedAt)}`
                    : "Sin punto clinico registrado"
                }
              />
              <MetricTile
                icon={<Activity className="h-4 w-4" />}
                label="Planificacion"
                value={estimatedMonths ? `${estimatedMonths} meses` : "Sin meses"}
                detail={
                  plannedControls ? `${plannedControls} controles planificados` : "Sin controles planificados"
                }
              />
            </div>

            <Modal open={showPauseModal} onClose={() => setShowPauseModal(false)} title="Pausar Tratamiento">
              <div className="p-4 space-y-4">
                <p className="text-sm text-slate-600">
                  Al pausar el tratamiento, el porcentaje de avance del calendario se detendra hasta que lo
                  vuelvas a reanudar.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Motivo de la pausa (Opcional)
                  </label>
                  <Textarea
                    placeholder="Ej. Vacaciones, brackets despegados..."
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setShowPauseModal(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handlePause}>Pausar</Button>
                </div>
              </div>
            </Modal>

            <Modal
              open={showStartModal}
              onClose={() => setShowStartModal(false)}
              title="Dar inicio al tratamiento de ortodoncia"
            >
              <div className="space-y-5 p-4">
                <div className="rounded-md border border-sky-100 bg-sky-50/70 p-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Paciente</p>
                      <p className="font-semibold text-slate-900">
                        {plan.patient.firstName} {plan.patient.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Plan</p>
                      <p className="font-semibold text-slate-900">{plan.name || `#${plan.id.slice(-6)}`}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Profesional</p>
                      <p className="font-semibold text-slate-900">
                        Dr(a) {plan.professional.firstName} {plan.professional.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-sky-700">Sucursal</p>
                      <p className="font-semibold text-slate-900">{plan.branch.name}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Fecha de inicio</span>
                    <Input
                      className="mt-1"
                      type="date"
                      max={todayInputValue()}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                    {startDateIsFuture ? (
                      <span className="mt-1 block text-xs font-medium text-red-600">
                        La fecha de inicio no puede ser futura.
                      </span>
                    ) : null}
                  </label>

                  <label>
                    <span className="text-xs font-semibold text-slate-600">Duracion estimada</span>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      value={startDurationMonths}
                      onChange={(event) => setStartDurationMonths(event.target.value)}
                    >
                      {[3, 6, 9, 12, 18, 24, 30, 36].map((months) => (
                        <option key={months} value={months}>
                          {months} meses
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Frecuencia</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">1 control mensual</p>
                    <p className="mt-1 text-xs text-slate-500">Frecuencia sugerida: un control mensual.</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Controles planificados</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {startPlannedControls} controles
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Se calculan igual a la duracion seleccionada.
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase text-slate-500">Finalizacion estimada</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {startExpectedEndDate ? formatDate(startExpectedEndDate) : "Sin fecha"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">No crea una cita automaticamente.</p>
                  </div>
                </div>

                {realControlsCount > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Se encontraron {realControlsCount} controles realizados relacionados con este plan. Se
                    conservaran y seran incluidos en el progreso por controles.
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    className="bg-white"
                    onClick={() => {
                      setShowStartModal(false);
                      setShowPlanModal(true);
                    }}
                  >
                    Configurar plan completo
                  </Button>
                  <Button variant="ghost" onClick={() => setShowStartModal(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={!startCanSubmit} onClick={() => void handleStart()}>
                    <Play className="mr-1 h-4 w-4" />
                    {startingTreatment ? "Iniciando..." : "Dar inicio"}
                  </Button>
                </div>
              </div>
            </Modal>

            <div className="grid gap-3 md:grid-cols-2">
              <SummaryPanel title="Arcos y alertas">
                <ClinicalStateLine
                  label="Arco superior"
                  source={clinicalState?.upperArchSize ?? clinicalState?.upperArchMaterial}
                />
                <ClinicalStateLine
                  label="Arco inferior"
                  source={clinicalState?.lowerArchSize ?? clinicalState?.lowerArchMaterial}
                />
                <ClinicalStateLine
                  label="Elasticos"
                  source={clinicalState?.elasticsConfig ?? clinicalState?.elasticsType}
                />
                <ClinicalStateLine label="Alerta" source={clinicalState?.alert} />
              </SummaryPanel>
              <SummaryPanel title="Ultima evolucion">
                {latestEvolutionText ? (
                  <p className="line-clamp-6 text-sm leading-6 text-slate-700">{latestEvolutionText}</p>
                ) : (
                  <p className="text-sm text-slate-500">Sin evoluciones registradas.</p>
                )}
                {latestEvolution ? (
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    {formatDateTime(latestEvolution.createdAt)}
                  </p>
                ) : null}
                <div className="mt-3 flex items-center gap-4">
                  <Link
                    to={`${APP_ROUTES.patients.clinicalEvolutions(patientId)}?treatmentPlanId=${encodeURIComponent(plan.id)}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
                  >
                    <FileText className="h-4 w-4" />
                    Ver evoluciones
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-sm font-semibold text-sky-700 hover:text-sky-800 hover:bg-sky-50"
                    onClick={() => setIsEvolutionModalOpen(true)}
                  >
                    <MessageSquarePlus className="mr-1 h-4 w-4" />
                    Nueva
                  </Button>
                </div>
              </SummaryPanel>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_0.75fr]">
              <SummaryPanel title="Indicaciones">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {fieldSourceValue(clinicalState?.nextSessionInstructions) ||
                    profileForm.indications ||
                    "Sin indicaciones registradas."}
                </p>
              </SummaryPanel>
              <SummaryPanel title="Alerta clinica">
                <div
                  className={`flex items-start gap-3 rounded-md border p-3 ${fieldSourceValue(clinicalState?.alert) || profileForm.alert ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm leading-6">
                    {fieldSourceValue(clinicalState?.alert) || profileForm.alert || "Sin alertas activas."}
                  </p>
                </div>
              </SummaryPanel>
            </div>

            <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
              <SummaryPanel title="Curva de higiene">
                <HygieneCurve points={summary?.hygiene.points ?? []} />
              </SummaryPanel>
              <SummaryPanel title="Evoluciones recientes">
                <div className="divide-y divide-slate-100">
                  {(summary?.recentEvolutions ?? []).slice(0, 5).map((evolution) => (
                    <div key={evolution.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {evolution.professionalName ?? "Profesional no informado"}
                        </p>
                        <p className="text-xs text-slate-500">{formatDateTime(evolution.createdAt)}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                        {evolution.plainText || "Sin nota clinica."}
                      </p>
                    </div>
                  ))}
                  {summary?.recentEvolutions?.length ? null : (
                    <p className="text-sm text-slate-500">Sin evoluciones registradas.</p>
                  )}
                </div>
              </SummaryPanel>
            </div>
          </div>
        ) : null}

        {activeTab === "diagnosis" ? (
          <div className="space-y-4 p-4">
            {diagnosisStatus.isLoading ? <LoadingState message="Consultando diagnostico..." /> : null}
            {currentDiagnosis?.status === "EMPTY" ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                <h3 className="text-base font-semibold text-slate-900">El diagnostico esta vacio</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Captura la informacion clinica inicial para mostrar el resumen del diagnostico.
                </p>
                <Button className="mt-4" onClick={() => setShowDiagnosisModal(true)}>
                  Definir diagnostico
                </Button>
              </div>
            ) : null}
            {currentDiagnosis?.status === "DRAFT" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-amber-950">Borrador de diagnostico</h3>
                    <p className="text-sm text-amber-800">Hay informacion capturada pendiente de activar.</p>
                  </div>
                  <Button onClick={() => setShowDiagnosisModal(true)}>Continuar borrador</Button>
                </div>
              </div>
            ) : null}
            {currentDiagnosis?.status === "ACTIVE" ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Resumen del diagnostico</h3>
                    <p className="text-xs text-slate-500">
                      Version {currentDiagnosis.diagnosis?.versionNumber ?? 1}
                      {currentDiagnosis.diagnosis?.activatedAt
                        ? ` - ${formatDateTime(currentDiagnosis.diagnosis.activatedAt)}`
                        : ""}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setShowDiagnosisModal(true)}>
                    Ver / editar
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {currentDiagnosis.summaryItems.length ? (
                    currentDiagnosis.summaryItems.map((item) => (
                      <div
                        key={item.fieldCode}
                        className="rounded-md border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="text-xs font-semibold text-slate-500">{item.fieldName}</p>
                        <p className="mt-1 text-sm text-slate-900">{item.value}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      Diagnostico guardado sin campos marcados para resumen.
                    </p>
                  )}
                </div>
                {currentDiagnosis.sectionsWithData.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentDiagnosis.sectionsWithData.map((section) => (
                      <Badge key={section.code} value={`${section.name}: ${section.count}`} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "photos" ? (
          <PhotographicTemplatesPanel
            treatmentPlanId={plan.id}
            patientId={patientId}
            professionalId={plan.professional.id}
            branchId={plan.branch.id}
            readOnly={isPlanReadOnly}
          />
        ) : null}

        {activeTab === "plan" ? (
          <div className="space-y-4 p-4">
            {technicalPlanEmpty ? (
              <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Plan de tratamiento</h3>
                <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                  <p className="text-lg text-slate-500">El plan de tratamiento está vacío</p>
                  <Button className="mt-5" disabled={isPlanReadOnly} onClick={() => setShowPlanModal(true)}>
                    Definir Plan de Tratamiento
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Plan de tratamiento</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Plan de tratamiento definido desde el modal.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={isPlanReadOnly}
                      onClick={() => setShowPlanModal(true)}
                    >
                      Editar Plan de Tratamiento
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Generar mensualidades</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_100px_120px_150px]">
                    <Select
                      value={monthlyForm.procedureId}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, procedureId: event.target.value }))
                      }
                    >
                      <option value="">Seleccionar prestacion</option>
                      {procedures.map((procedure) => (
                        <option key={procedure.id} value={procedure.id}>
                          [{procedure.code}] {procedure.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={monthlyForm.months}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, months: event.target.value }))
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Precio"
                      value={monthlyForm.unitPrice}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, unitPrice: event.target.value }))
                      }
                    />
                    <Input
                      type="date"
                      value={monthlyForm.startDate}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, startDate: event.target.value }))
                      }
                    />
                    <Textarea
                      className="md:col-span-4"
                      rows={2}
                      placeholder="Notas para mensualidades"
                      value={monthlyForm.notes}
                      onChange={(event) =>
                        setMonthlyForm((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button disabled={generatingMonthlyItems} onClick={() => void generateMonthlyItems()}>
                      <Plus className="mr-1 h-4 w-4" />
                      Agregar mensualidades
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === "rx" ? (
          <PlanFilesPanel
            title="Rx y Cf"
            icon={<FileText className="h-4 w-4" />}
            files={rxFiles.data ?? []}
            loading={rxFiles.isLoading}
            uploading={documentMutations.uploadPatientBinaryFile.isPending}
            accept="image/*,.pdf,.dcm,.dicom"
            onUpload={(file) => uploadFile(file, ORTHODONTIC_RX_CATEGORY)}
          />
        ) : null}

        {activeTab === "odontogram" ? <div className="space-y-4 p-4">{odontogramPanel}</div> : null}
      </section>

      <OrthodonticTechnicalPlanModal
        open={showPlanModal}
        plan={plan}
        form={profileForm}
        fields={orthodonticCatalogs.data ?? []}
        loadingCatalogs={orthodonticCatalogs.isLoading}
        saving={savingProfile}
        readOnly={isPlanReadOnly}
        canManageCatalogs={canManageOrthodonticCatalogs}
        onClose={() => setShowPlanModal(false)}
        onPrintDocument={onPrintDocument}
        onFieldChange={updateProfileField}
        onSelectionChange={updateCatalogSelection}
        onSave={() => void saveProfile()}
        onCreateCatalogOption={onCreateCatalogOption}
        onUpdateCatalogOption={onUpdateCatalogOption}
        onDeactivateCatalogOption={onDeactivateCatalogOption}
        onReactivateCatalogOption={onReactivateCatalogOption}
        onSortCatalogOptions={onSortCatalogOptions}
      />

      <OrthodonticDiagnosisModal
        open={showDiagnosisModal}
        plan={plan}
        sections={diagnosisSections}
        values={diagnosisValues}
        activeSection={activeDiagnosisSection}
        loading={orthodonticDiagnosis.isLoading || diagnosisCatalogs.isLoading}
        saving={savingDiagnosis}
        readOnly={readOnlyDiagnosis}
        canManageCatalogs={canManageOrthodonticDiagnosisCatalogs}
        status={currentDiagnosis?.status ?? "EMPTY"}
        onActiveSectionChange={setActiveDiagnosisSection}
        onFieldChange={updateDiagnosisValue}
        onClose={() => setShowDiagnosisModal(false)}
        onSaveDraft={() => void saveDiagnosisDraft()}
        onSaveActive={() => void saveDiagnosisActive()}
        onEditOptions={setEditingDiagnosisField}
      />

      <OrthodonticOptionsModal
        field={editingDiagnosisField}
        canManage={canManageOrthodonticDiagnosisCatalogs}
        onClose={() => setEditingDiagnosisField(null)}
        onCreate={onCreateDiagnosisOption}
        onUpdate={onUpdateDiagnosisOption}
        onDeactivate={onDeactivateDiagnosisOption}
        onReactivate={onReactivateDiagnosisOption}
        onSort={onSortDiagnosisOptions}
      />

      <ClinicalEvolutionModal
        patientId={patientId}
        branchId={plan.branch.id}
        open={isEvolutionModalOpen}
        initialTreatmentPlanId={plan.id}
        onClose={() => setIsEvolutionModalOpen(false)}
      />
    </div>
  );
}

function OrthodonticDiagnosisModal({
  open,
  plan,
  sections,
  values,
  activeSection,
  loading,
  saving,
  readOnly,
  canManageCatalogs,
  status,
  onActiveSectionChange,
  onFieldChange,
  onClose,
  onSaveDraft,
  onSaveActive,
  onEditOptions
}: {
  open: boolean;
  plan: TreatmentPlanDetail;
  sections: OrthodonticDiagnosisCatalogSection[];
  values: Record<string, OrthodonticDiagnosisFormValue>;
  activeSection: string;
  loading: boolean;
  saving: boolean;
  readOnly: boolean;
  canManageCatalogs: boolean;
  status: string;
  onActiveSectionChange: (sectionCode: string) => void;
  onFieldChange: (fieldCode: string, value: OrthodonticDiagnosisFormValue) => void;
  onClose: () => void;
  onSaveDraft: () => void;
  onSaveActive: () => void;
  onEditOptions: (field: OrthodonticDiagnosisCatalogField) => void;
}) {
  const [openFieldMenu, setOpenFieldMenu] = useState<string | null>(null);
  if (!open) return null;
  const active = sections.find((section) => section.code === activeSection) ?? sections[0];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Diagnostico</h2>
              <p className="mt-1 text-xs text-slate-500">
                {plan.name} · {plan.professional.firstName} {plan.professional.lastName} · {plan.branch.name}{" "}
                · {status}
              </p>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={onClose}
              aria-label="Cerrar diagnostico"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50 p-3 md:border-b-0 md:border-r">
            <div className="flex gap-2 overflow-x-auto md:block md:space-y-1">
              {sections.map((section) => (
                <button
                  key={section.code}
                  type="button"
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium md:w-full ${
                    (active?.code ?? activeSection) === section.code
                      ? "bg-sky-100 text-sky-800"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                  onClick={() => onActiveSectionChange(section.code)}
                >
                  {section.name}
                </button>
              ))}
            </div>
          </aside>
          <main className="min-h-0 overflow-y-auto p-4">
            {loading ? <LoadingState message="Cargando diagnostico..." /> : null}
            {!loading && !sections.length ? (
              <EmptyState
                title="Catalogo no disponible"
                description="No hay campos de diagnostico configurados."
              />
            ) : null}
            {active ? (
              <section className="space-y-3">
                <div className="border-l-2 border-sky-500 bg-slate-100 px-3 py-2">
                  <h3 className="text-sm font-semibold text-slate-800">{active.name}</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {active.fields.map((field) => (
                    <OrthodonticDiagnosisFieldControl
                      key={field.code}
                      field={field}
                      value={values[field.code] ?? {}}
                      readOnly={readOnly}
                      canManageCatalogs={canManageCatalogs}
                      menuOpen={openFieldMenu === field.code}
                      onMenuOpen={(nextOpen) => setOpenFieldMenu(nextOpen ? field.code : null)}
                      onEditOptions={() => {
                        setOpenFieldMenu(null);
                        onEditOptions(field);
                      }}
                      onChange={(nextValue) => onFieldChange(field.code, nextValue)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </main>
        </div>
        <footer className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="secondary" disabled={readOnly || saving} onClick={onSaveDraft}>
            Guardar borrador
          </Button>
          <Button disabled={readOnly || saving} onClick={onSaveActive}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Guardando..." : "Guardar diagnostico"}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function OrthodonticDiagnosisFieldControl({
  field,
  value,
  readOnly,
  canManageCatalogs,
  menuOpen,
  onMenuOpen,
  onEditOptions,
  onChange
}: {
  field: OrthodonticDiagnosisCatalogField;
  value: OrthodonticDiagnosisFormValue;
  readOnly: boolean;
  canManageCatalogs: boolean;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  onEditOptions: () => void;
  onChange: (value: OrthodonticDiagnosisFormValue) => void;
}) {
  const selectedIds = new Set([...(value.optionIds ?? []), value.optionId].filter(Boolean));
  const visibleOptions = field.options.filter((option) => option.isActive || selectedIds.has(option.id));
  const showMenu = canManageCatalogs && (field.inputType === "select" || field.inputType === "checkbox");
  const label = (
    <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
      <span className="text-xs font-semibold text-slate-600">
        {field.name}
        {field.isHighlighted ? <span className="ml-1 text-sky-700">★</span> : null}
      </span>
      {showMenu ? (
        <div className="relative">
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={`Opciones de ${field.name}`}
            onClick={() => onMenuOpen(!menuOpen)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={onEditOptions}
              >
                Editar opciones
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (field.inputType === "textarea") {
    return (
      <label className="md:col-span-2">
        {label}
        <Textarea
          rows={4}
          value={value.valueText ?? ""}
          disabled={readOnly}
          onChange={(event) => onChange({ valueText: event.target.value })}
        />
      </label>
    );
  }
  if (field.inputType === "number") {
    return (
      <label>
        {label}
        <Input
          type="number"
          value={value.valueNumber ?? ""}
          disabled={readOnly}
          onChange={(event) => onChange({ valueNumber: event.target.value })}
        />
      </label>
    );
  }
  if (field.inputType === "select") {
    return (
      <label>
        {label}
        <Select
          value={value.optionId ?? ""}
          disabled={readOnly}
          onChange={(event) => onChange({ optionId: event.target.value })}
        >
          <option value="">Seleccione una opcion</option>
          {visibleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {!option.isActive ? " (inactiva)" : ""}
            </option>
          ))}
        </Select>
      </label>
    );
  }
  if (field.inputType === "checkbox") {
    return (
      <div>
        {label}
        <div className="space-y-1 rounded-md border border-slate-200 p-3">
          {visibleOptions.map((option) => {
            const checked = selectedIds.has(option.id);
            return (
              <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={readOnly}
                  onChange={(event) => {
                    const current = value.optionIds ?? [];
                    onChange({
                      optionIds: event.target.checked
                        ? [...new Set([...current, option.id])]
                        : current.filter((id) => id !== option.id)
                    });
                  }}
                />
                <span className={!option.isActive ? "text-slate-400 line-through" : ""}>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <label>
      {label}
      <Input
        value={value.valueText ?? ""}
        disabled={readOnly}
        onChange={(event) => onChange({ valueText: event.target.value })}
      />
    </label>
  );
}

const ORTHODONTIC_FIELD_GROUPS = {
  general: ["treatment_type", "treatment_time"],
  biomechanics: ["upper_anchor", "lower_anchor", "attachments"],
  radiography: ["radiographic_control", "periodicity"],
  appliances: [
    "brackets",
    "aligners",
    "plates",
    "upper_tubes",
    "lower_tubes",
    "upper_bands",
    "lower_bands",
    "upper_anterior_cementation",
    "upper_posterior_cementation",
    "lower_anterior_cementation",
    "lower_posterior_cementation"
  ]
} as const;

function OrthodonticTechnicalPlanModal({
  open,
  plan,
  form,
  fields,
  loadingCatalogs,
  saving,
  readOnly,
  canManageCatalogs,
  onClose,
  onPrintDocument,
  onFieldChange,
  onSelectionChange,
  onSave,
  onCreateCatalogOption,
  onUpdateCatalogOption,
  onDeactivateCatalogOption,
  onReactivateCatalogOption,
  onSortCatalogOptions
}: {
  open: boolean;
  plan: TreatmentPlanDetail;
  form: OrthodonticProfileFormState;
  fields: OrthodonticCatalogField[];
  loadingCatalogs: boolean;
  saving: boolean;
  readOnly: boolean;
  canManageCatalogs: boolean;
  onClose: () => void;
  onPrintDocument: (type: TreatmentPlanPrintDocumentType) => void;
  onFieldChange: (
    field: Exclude<keyof OrthodonticProfileFormState, "catalogSelections">,
    value: string
  ) => void;
  onSelectionChange: (
    fieldCode: string,
    optionId: string,
    allowsMultiple: boolean,
    checked?: boolean
  ) => void;
  onSave: () => void;
  onCreateCatalogOption: (fieldId: string, label: string) => Promise<unknown>;
  onUpdateCatalogOption: (
    optionId: string,
    payload: { label?: string; sortOrder?: number }
  ) => Promise<unknown>;
  onDeactivateCatalogOption: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivateCatalogOption: (optionId: string) => Promise<unknown>;
  onSortCatalogOptions: (fieldId: string, optionIds: string[]) => Promise<unknown>;
}) {
  const [editingField, setEditingField] = useState<OrthodonticCatalogField | null>(null);
  const [openFieldMenu, setOpenFieldMenu] = useState<string | null>(null);
  const fieldByCode = useMemo(() => new Map(fields.map((field) => [field.code, field])), [fields]);
  const professionalName = `${plan.professional.firstName} ${plan.professional.lastName}`.trim();
  const patientName = `${plan.patient.firstName} ${plan.patient.lastName}`.trim();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editingField) setEditingField(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingField, onClose, open]);

  if (!open) return null;

  const renderCatalog = (code: string) => {
    const field = fieldByCode.get(code);
    if (!field) return null;
    return (
      <OrthodonticCatalogControl
        key={code}
        field={field}
        value={form.catalogSelections[code] ?? []}
        readOnly={readOnly}
        canManageCatalogs={canManageCatalogs}
        menuOpen={openFieldMenu === code}
        onMenuOpen={(nextOpen) => setOpenFieldMenu(nextOpen ? code : null)}
        onEditOptions={() => {
          setOpenFieldMenu(null);
          setEditingField(field);
        }}
        onSelectionChange={(optionId, checked) =>
          onSelectionChange(code, optionId, field.allowsMultiple, checked)
        }
      />
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan de tratamiento"
        className="flex max-h-[90vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Plan de tratamiento</h2>
              <p className="mt-1 text-xs text-slate-500">
                #{numericId(plan.id)} · {patientName || "Paciente"} · Dr(a){" "}
                {professionalName || "No informado"} · {treatmentPlanStatusLabel(plan.status)}
              </p>
            </div>
            <Badge value={readOnly ? "Solo lectura" : "Editable"} tone={readOnly ? "default" : "success"} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadingCatalogs ? (
            <LoadingState message="Cargando catalogos de ortodoncia..." />
          ) : (
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Informacion general</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Plan de tratamiento</span>
                    <Textarea
                      className="mt-1"
                      rows={3}
                      disabled={readOnly}
                      value={form.technicalDescription}
                      onChange={(event) => onFieldChange("technicalDescription", event.target.value)}
                    />
                  </label>
                  {ORTHODONTIC_FIELD_GROUPS.general.map(renderCatalog)}
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Inicio tratamiento</span>
                    <Input
                      className="mt-1"
                      type="date"
                      disabled={readOnly}
                      value={form.startDate}
                      onChange={(event) => onFieldChange("startDate", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Cantidad controles</span>
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={form.estimatedControls}
                      onChange={(event) => onFieldChange("estimatedControls", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Meses estimados</span>
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={form.estimatedMonths}
                      onChange={(event) => onFieldChange("estimatedMonths", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Alineadores totales</span>
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      disabled={readOnly}
                      value={form.totalAligners}
                      onChange={(event) => onFieldChange("totalAligners", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Biomecanica</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {ORTHODONTIC_FIELD_GROUPS.biomechanics.map(renderCatalog)}
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Extracciones indicadas</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.indicatedExtractions}
                      onChange={(event) => onFieldChange("indicatedExtractions", event.target.value)}
                    />
                  </label>
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Extracciones realizadas</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.performedExtractions}
                      onChange={(event) => onFieldChange("performedExtractions", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Control radiografico</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {ORTHODONTIC_FIELD_GROUPS.radiography.map(renderCatalog)}
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Reevaluacion</span>
                    <Input
                      className="mt-1"
                      type="date"
                      disabled={readOnly}
                      value={form.reevaluationDate}
                      onChange={(event) => onFieldChange("reevaluationDate", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Proxima Rx/Cf</span>
                    <Input
                      className="mt-1"
                      type="datetime-local"
                      disabled={readOnly}
                      value={form.nextRadiographyAt}
                      onChange={(event) => onFieldChange("nextRadiographyAt", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Aparatologia</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {ORTHODONTIC_FIELD_GROUPS.appliances.map(renderCatalog)}
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Interconsultas</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.interconsultations}
                      onChange={(event) => onFieldChange("interconsultations", event.target.value)}
                    />
                  </label>
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Notas del plan</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.planNotes}
                      onChange={(event) => onFieldChange("planNotes", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Datos derivados de evoluciones</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <DerivedField label="Ultimo arco superior" value={form.lastUpperArch || "Sin evolucion"} />
                  <DerivedField label="Ultimo arco inferior" value={form.lastLowerArch || "Sin evolucion"} />
                  <DerivedField label="Higiene actual" value={form.hygieneStatus || "Sin evolucion"} />
                  <DerivedField label="Elasticos actuales" value={form.elastics || "Sin evolucion"} />
                  <DerivedField label="Ultima alerta" value={form.alert || "Sin alerta"} />
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          {readOnly ? (
            <>
              <Button variant="secondary" onClick={() => onPrintDocument("CARE_PLAN")}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              <Button disabled={saving || loadingCatalogs} onClick={onSave}>
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </>
          )}
        </footer>
      </div>

      <OrthodonticOptionsModal
        field={editingField}
        canManage={canManageCatalogs}
        onClose={() => setEditingField(null)}
        onCreate={onCreateCatalogOption}
        onUpdate={onUpdateCatalogOption}
        onDeactivate={onDeactivateCatalogOption}
        onReactivate={onReactivateCatalogOption}
        onSort={onSortCatalogOptions}
      />
    </div>,
    document.body
  );
}

function OrthodonticCatalogControl({
  field,
  value,
  readOnly,
  canManageCatalogs,
  menuOpen,
  onMenuOpen,
  onEditOptions,
  onSelectionChange
}: {
  field: OrthodonticCatalogField;
  value: string[];
  readOnly: boolean;
  canManageCatalogs: boolean;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  onEditOptions: () => void;
  onSelectionChange: (optionId: string, checked?: boolean) => void;
}) {
  const selectedIds = new Set(value);
  const visibleOptions = field.options.filter((option) => option.isActive || selectedIds.has(option.id));
  const inactiveSelected = visibleOptions.filter((option) => selectedIds.has(option.id) && !option.isActive);

  return (
    <div className={field.allowsMultiple ? "md:col-span-1" : ""}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{field.name}</span>
        {canManageCatalogs ? (
          <div className="relative">
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label={`Opciones de ${field.name}`}
              onClick={() => onMenuOpen(!menuOpen)}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={onEditOptions}
                >
                  Editar opciones
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {field.allowsMultiple ? (
        <div className="min-h-[42px] rounded-md border border-slate-300 bg-white p-2">
          <div className="grid gap-1">
            {visibleOptions.map((option) => (
              <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={selectedIds.has(option.id)}
                  onChange={(event) => onSelectionChange(option.id, event.target.checked)}
                />
                <span className={option.isActive ? "" : "text-slate-400 line-through"}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <Select
          disabled={readOnly}
          value={value[0] ?? ""}
          onChange={(event) => onSelectionChange(event.target.value)}
        >
          <option value="">Seleccionar</option>
          {visibleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {option.isActive ? "" : " (inactiva)"}
            </option>
          ))}
        </Select>
      )}
      {inactiveSelected.length ? (
        <p className="mt-1 text-xs font-medium text-amber-700">Opcion inactiva conservada en historial.</p>
      ) : null}
    </div>
  );
}

type OrthodonticEditableOptionField = OrthodonticCatalogField | OrthodonticDiagnosisCatalogField;
type OrthodonticEditableOption =
  | OrthodonticCatalogOption
  | OrthodonticDiagnosisCatalogField["options"][number];

function OrthodonticOptionsModal({
  field,
  canManage,
  onClose,
  onCreate,
  onUpdate,
  onDeactivate,
  onReactivate,
  onSort
}: {
  field: OrthodonticEditableOptionField | null;
  canManage: boolean;
  onClose: () => void;
  onCreate: (fieldId: string, label: string) => Promise<unknown>;
  onUpdate: (optionId: string, payload: { label?: string; sortOrder?: number }) => Promise<unknown>;
  onDeactivate: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivate: (optionId: string) => Promise<unknown>;
  onSort: (fieldId: string, optionIds: string[]) => Promise<unknown>;
}) {
  const [draftOptions, setDraftOptions] = useState<Array<OrthodonticEditableOption & { isNew?: boolean }>>(
    []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftOptions(field?.options.map((option) => ({ ...option })) ?? []);
  }, [field]);

  if (!field) return null;

  const addOption = () => {
    setDraftOptions((current) => [
      ...current,
      {
        id: `new-${Date.now()}`,
        code: "",
        label: "",
        sortOrder: current.length,
        isActive: true,
        version: 1,
        isNew: true
      }
    ]);
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    setDraftOptions((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((option, sortOrder) => ({ ...option, sortOrder }));
    });
  };

  const saveOptions = async () => {
    if (!canManage) return;
    const normalized = new Set<string>();
    for (const option of draftOptions) {
      const label = option.label.trim().replace(/\s+/g, " ");
      if (!label) {
        toast.error("Todas las opciones necesitan texto.");
        return;
      }
      const key = label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      if (normalized.has(key)) {
        toast.error("Hay opciones duplicadas.");
        return;
      }
      normalized.add(key);
    }
    setSaving(true);
    try {
      const originalById = new Map(field.options.map((option) => [option.id, option]));
      for (const option of draftOptions) {
        if (option.isNew) {
          await onCreate(field.id, option.label);
          continue;
        }
        const original = originalById.get(option.id);
        if (!original) continue;
        if (option.label !== original.label || option.sortOrder !== original.sortOrder) {
          await onUpdate(option.id, { label: option.label, sortOrder: option.sortOrder });
        }
        if (option.isActive !== original.isActive) {
          if (option.isActive) await onReactivate(option.id);
          else await onDeactivate(option.id);
        }
      }
      await onSort(
        field.id,
        draftOptions.filter((option) => !option.isNew).map((option) => option.id)
      );
      toast.success("Opciones actualizadas.");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar opciones"
        className="w-full max-w-[560px] rounded-lg bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-950">Editar opciones</h3>
          <p className="mt-1 text-xs text-slate-500">Campo: {field.name}</p>
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" disabled={!canManage} onClick={addOption}>
              <Plus className="h-4 w-4" />
              Nueva opcion
            </Button>
          </div>
          <div className="space-y-2">
            {draftOptions.map((option, index) => (
              <div
                key={option.id}
                className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-slate-200 p-2"
              >
                <Input
                  disabled={
                    !canManage ||
                    (!option.isNew && field.options.find((row) => row.id === option.id)?.isActive === false)
                  }
                  value={option.label}
                  className={option.isActive ? "" : "text-slate-400 line-through"}
                  onChange={(event) =>
                    setDraftOptions((current) =>
                      current.map((row) =>
                        row.id === option.id ? { ...row, label: event.target.value } : row
                      )
                    )
                  }
                />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage || index === 0}
                    onClick={() => moveOption(index, -1)}
                  >
                    <ChevronLeft className="h-4 w-4 rotate-90" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage || index === draftOptions.length - 1}
                    onClick={() => moveOption(index, 1)}
                  >
                    <ChevronRight className="h-4 w-4 rotate-90" />
                  </Button>
                  <Button
                    variant={option.isActive ? "danger" : "secondary"}
                    size="sm"
                    disabled={!canManage}
                    onClick={() =>
                      setDraftOptions((current) =>
                        current.map((row) =>
                          row.id === option.id ? { ...row, isActive: !row.isActive } : row
                        )
                      )
                    }
                  >
                    {option.isActive ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
                {!option.isActive ? (
                  <span className="text-xs font-medium text-slate-400">Inactiva</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canManage || saving} onClick={() => void saveOptions()}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function DerivedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function treatmentPlanStatusLabel(status: TreatmentPlanStatus) {
  const labels: Record<TreatmentPlanStatus, string> = {
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

function MetricTile({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-h-[92px] rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-2 text-base font-semibold leading-tight text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p> : null}
    </div>
  );
}

function SummaryPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function ClinicalStateLine({
  label,
  source
}: {
  label: string;
  source?: OrthodonticClinicalFieldSource | null;
}) {
  const value = fieldSourceValue(source);
  return (
    <div className="border-b border-dotted border-slate-200 pb-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-medium text-slate-700">{value || "-"}</span>
      </div>
      {clinicalFieldDetail(source) ? (
        <p className="mt-1 text-right text-[11px] text-slate-400">{clinicalFieldDetail(source)}</p>
      ) : null}
    </div>
  );
}

function HygieneCurve({
  points
}: {
  points: Array<{
    value: number;
    recordedAt: string;
    professionalName: string | null;
    label?: string | null;
    minimumScore?: number | null;
    maximumScore?: number | null;
  }>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [plotSize, setPlotSize] = useState({ width: 320, height: 240 });
  const [interaction, setInteraction] = useState<{ index: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      setPlotSize({
        width: Math.max(280, Math.round(rect.width)),
        height: Math.max(220, Math.round(rect.height))
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!points.length) {
    return (
      <p className="text-sm text-slate-500">
        Todavia no existen registros suficientes para mostrar la curva de higiene.
      </p>
    );
  }

  const width = plotSize.width;
  const height = plotSize.height;
  const paddingX = 28;
  const paddingTop = 24;
  const baseline = height - 28;
  const plotWidth = width - paddingX * 2;
  const values = points.map((point) => point.value).filter(Number.isFinite);
  const configuredMin = Math.min(
    ...points.map((point) => finiteNumberValue(point.minimumScore, Number.POSITIVE_INFINITY))
  );
  const configuredMax = Math.max(
    ...points.map((point) => finiteNumberValue(point.maximumScore, Number.NEGATIVE_INFINITY))
  );
  const minValue = Number.isFinite(configuredMin) ? configuredMin : Math.min(1, ...values);
  const maxValue =
    Number.isFinite(configuredMax) && configuredMax > minValue ? configuredMax : Math.max(7, ...values);
  const valueRange = Math.max(1, maxValue - minValue);
  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : points.length === 2
          ? paddingX + plotWidth * (index === 0 ? 0.25 : 0.75)
          : paddingX + (plotWidth / (points.length - 1)) * index;
    const y = paddingTop + ((maxValue - point.value) / valueRange) * (baseline - paddingTop);
    return { ...point, x, y };
  });
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const smoothPath =
    coordinates.length === 1
      ? `M ${width * 0.36} ${first.y} C ${width * 0.44} ${first.y}, ${width * 0.56} ${first.y}, ${width * 0.64} ${first.y}`
      : coordinates.reduce((path, point, index) => {
          if (index === 0) return `M ${point.x} ${point.y}`;
          const previous = coordinates[index - 1];
          const controlX = previous.x + (point.x - previous.x) * 0.5;
          return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
        }, "");
  const areaPath =
    coordinates.length === 1
      ? `${smoothPath} L ${width * 0.64} ${baseline} L ${width * 0.36} ${baseline} Z`
      : `${smoothPath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  const activePoint = interaction ? coordinates[interaction.index] : null;
  const revisionLabel =
    interaction?.index === 0 ? "Revision 0 - Primera" : `Revision ${interaction?.index ?? 0}`;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const tooltipWidth = 172;
  const tooltipHeight = 96;
  const tooltipX = interaction
    ? clamp(
        interaction.x > width - tooltipWidth - 24 ? interaction.x - tooltipWidth - 14 : interaction.x + 14,
        8,
        width - tooltipWidth - 8
      )
    : 0;
  const tooltipY = interaction
    ? clamp(
        interaction.y < tooltipHeight + 24 ? interaction.y + 16 : interaction.y - tooltipHeight - 14,
        8,
        height - tooltipHeight - 8
      )
    : 0;
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = ((event.clientX - rect.left) / rect.width) * width;
    const cursorY = ((event.clientY - rect.top) / rect.height) * height;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    coordinates.forEach((point, index) => {
      const deltaX = point.x - cursorX;
      const deltaY = point.y - cursorY;
      const distance = deltaX * deltaX + deltaY * deltaY;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setInteraction({
      index: nearestIndex,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-[240px] w-full items-center justify-center overflow-hidden rounded-md bg-white"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none text-emerald-500"
        role="img"
        onPointerEnter={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setInteraction(null)}
      >
        <title>Curva de higiene registrada</title>
        <defs>
          <linearGradient id="hygiene-curve-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.82" />
            <stop offset="72%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#hygiene-curve-fill)" />
        <path
          d={smoothPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />
        {activePoint ? (
          <>
            <line
              x1={activePoint.x}
              y1={activePoint.y}
              x2={activePoint.x}
              y2={baseline}
              stroke="#10b981"
              strokeDasharray="2 3"
              strokeWidth="1"
              opacity="0.38"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="4" fill="#059669" opacity="0.95" />
          </>
        ) : coordinates.length === 1 ? (
          <circle cx={first.x} cy={first.y} r="4" fill="#059669" opacity="0.82" />
        ) : null}
        <line
          x1={paddingX}
          y1={baseline}
          x2={width - paddingX}
          y2={baseline}
          stroke="#d1fae5"
          strokeWidth="1"
        />
        {coordinates.map((point, index) => (
          <circle
            key={`${point.recordedAt}-${point.value}-${index}`}
            cx={point.x}
            cy={point.y}
            r="10"
            fill="transparent"
          >
            <title>{`${point.value}/${maxValue} - ${formatDateTime(point.recordedAt)}${point.label ? ` - ${point.label}` : ""}`}</title>
          </circle>
        ))}
      </svg>
      {interaction && activePoint ? (
        <div
          className="pointer-events-none absolute rounded-md border border-emerald-100 bg-white/95 px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltipX, top: tooltipY, width: tooltipWidth }}
        >
          <p className="font-semibold text-slate-800">{revisionLabel}</p>
          <p className="mt-1 font-semibold text-emerald-700">
            Higiene: {activePoint.value} de {maxValue}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(activePoint.recordedAt)}</p>
          {activePoint.label ? <p className="mt-1 text-[11px] text-slate-500">{activePoint.label}</p> : null}
          {activePoint.professionalName ? (
            <p className="mt-1 truncate text-[11px] text-slate-500">{activePoint.professionalName}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PlanFilesPanel({
  title,
  icon,
  files,
  loading,
  uploading,
  accept,
  onUpload
}: {
  title: string;
  icon: ReactNode;
  files: FileAttachment[];
  loading: boolean;
  uploading: boolean;
  accept: string;
  onUpload: (file?: File) => Promise<void>;
}) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-sky-50 text-sky-700">{icon}</span>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700">
          <UploadCloud className="h-4 w-4" />
          {uploading ? "Subiendo..." : "Subir archivo"}
          <input
            type="file"
            className="hidden"
            accept={accept}
            disabled={uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              void onUpload(file).finally(() => {
                event.currentTarget.value = "";
              });
            }}
          />
        </label>
      </div>

      {loading ? <LoadingState message="Cargando archivos..." /> : null}
      {!loading && files.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:border-sky-200 hover:bg-sky-50"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-slate-100 text-slate-500">
                  {file.mimeType.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">{file.originalName}</span>
                  <span className="mt-1 block text-xs text-slate-500">{formatDateTime(file.createdAt)}</span>
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : null}
      {!loading && !files.length ? (
        <EmptyState title="Sin archivos" description="Sube archivos asociados a este plan." />
      ) : null}
    </div>
  );
}

function AgreementAssignmentModal({
  open,
  currentAgreementId,
  currentAgreement,
  plan,
  onClose,
  onAssign,
  saving
}: {
  open: boolean;
  currentAgreementId?: string | null;
  currentAgreement?: PatientAgreementOption | null;
  plan: TreatmentPlanDetail | null;
  onClose: () => void;
  onAssign: (agreementId: string) => Promise<void>;
  saving: boolean;
}) {
  const [search, setSearch] = useState("");
  const [agreementId, setAgreementId] = useState("");
  const agreements = useAgreements(search || undefined, "true");
  const agreementOptions: PatientAgreementOption[] = agreements.data ?? [];
  const selectableAgreements =
    currentAgreement && !agreementOptions.some((agreement) => agreement.id === currentAgreement.id)
      ? [currentAgreement, ...agreementOptions]
      : agreementOptions;
  const selectedAgreement = selectableAgreements.find((agreement) => agreement.id === agreementId) ?? null;

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setAgreementId(currentAgreementId ?? "");
  }, [currentAgreementId, open]);

  return (
    <Modal open={open} title="Asignar convenio" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-700">Buscar convenio</label>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_380px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar convenio..."
              />
            </div>
            <Select value={agreementId} onChange={(event) => setAgreementId(event.target.value)}>
              <option value="">Seleccionar convenio</option>
              {selectableAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name}
                  {agreement.priceList ? ` — ${agreement.priceList.name}` : " (Sin listado)"}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="rounded-lg bg-sky-50 p-5 text-center text-sm text-sky-900">
          {!plan?.items.length ? (
            <>
              <p className="font-semibold">Plan de tratamiento sin prestaciónes</p>
              <p className="mt-2">
                Agrega prestaciónes al plan de tratamiento para ver los valores con el convenio seleccionado.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">{plan.items.length} prestaciónes en este plan</p>
              <p className="mt-2">
                El convenio se asignara al paciente. Los procedimientos existentes no se recalculan
                automaticamente.
              </p>
            </>
          )}
        </div>

        {selectedAgreement ? <AgreementSummary agreement={selectedAgreement} /> : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button disabled={!agreementId || saving} onClick={() => void onAssign(agreementId)}>
            Asignar convenio
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AgreementSummary({ agreement }: { agreement: PatientAgreementOption }) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-3">
      <SummaryPill label="Convenio" value={agreement.name} />
      <SummaryPill label="Descuento" value={`${numberValue(agreement.discountPercent)}%`} />
      <SummaryPill label="Arancel" value={agreement.priceList?.name ?? "Sin lista asociada"} />
    </div>
  );
}

function AgreementDetailModal({
  open,
  agreement,
  onClose
}: {
  open: boolean;
  agreement?: PatientAgreementOption | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="Detalle del convenio" onClose={onClose} size="lg">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{agreement?.name ?? "Sin convenio"}</h3>
          <p className="mt-1 text-sm text-slate-500">Asignado al paciente</p>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
          <SummaryPill
            label="Arancel del convenio"
            value={agreement?.priceList?.name ?? "Sin arancel asociado"}
          />
          <SummaryPill label="Descuento convenio" value={`${numberValue(agreement?.discountPercent)}%`} />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Este convenio no se modifica desde este plan porque ya existen prestaciónes o presupuesto. Las
          prestaciónes existentes conservan sus valores.
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BranchChangeModal({
  open,
  plan,
  branches,
  branchesLoading,
  onClose,
  onConfirm,
  saving
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  branches: Branch[];
  branchesLoading: boolean;
  onClose: () => void;
  onConfirm: (payload: { branchId: string; professionalId: string }) => Promise<void>;
  saving: boolean;
}) {
  const [branchId, setBranchId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const professionals = useProfessionals(undefined, "true", {
    branchId: branchId || undefined,
    pageSize: 100
  });
  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;
  const professionalOptions = professionals.data ?? [];
  const selectedProfessional =
    professionalOptions.find((professional) => professional.id === professionalId) ?? null;
  const hasChanges = Boolean(
    plan && (branchId !== plan.branch.id || professionalId !== plan.professional.id)
  );

  useEffect(() => {
    if (!open || !plan) return;
    setBranchId(plan.branch.id);
    setProfessionalId(plan.professional.id);
    setConfirming(false);
  }, [open, plan?.branch.id, plan?.id, plan?.professional.id]);

  useEffect(() => {
    if (!open || !professionalOptions.length) return;
    const selectedStillVisible = professionalOptions.some(
      (professional) => professional.id === professionalId
    );
    if (!selectedStillVisible) setProfessionalId(professionalOptions[0]?.id ?? "");
  }, [open, professionalId, professionalOptions]);

  return (
    <Modal open={open} title="Cambiar sucursal" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <p>
              Selecciona la sucursal y el doctor que recibira este plan. El paciente pasara a formar parte de
              la sucursal asignada.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <label className="text-xs font-semibold text-slate-700">Sucursal *</label>
          <Select
            value={branchId}
            disabled={branchesLoading}
            onChange={(event) => {
              setBranchId(event.target.value);
              setProfessionalId("");
              setConfirming(false);
            }}
          >
            <option value="">Buscar sucursal...</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3">
          <label className="text-xs font-semibold text-slate-700">Doctor asignado *</label>
          <Select
            value={professionalId}
            disabled={!branchId || professionals.isLoading}
            onChange={(event) => {
              setProfessionalId(event.target.value);
              setConfirming(false);
            }}
          >
            <option value="">Seleccionar doctor...</option>
            {professionalOptions.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professionalName(professional)}
              </option>
            ))}
          </Select>
          {branchId && !professionals.isLoading && !professionalOptions.length ? (
            <p className="text-xs text-red-600">No hay profesionales activos en la sucursal seleccionada.</p>
          ) : null}
        </div>

        {confirming && selectedBranch && selectedProfessional ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <p className="font-semibold">Confirma el cambio</p>
            <p className="mt-1">
              El paciente y el plan se moveran a {selectedBranch.name}, asignados a{" "}
              {professionalName(selectedProfessional)}.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {!confirming ? (
            <Button
              disabled={!branchId || !professionalId || !hasChanges}
              onClick={() => setConfirming(true)}
            >
              Revisar cambio
            </Button>
          ) : (
            <Button
              disabled={!branchId || !professionalId || saving}
              onClick={() => void onConfirm({ branchId, professionalId })}
            >
              Cambiar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function RefundsModal({
  open,
  patientId,
  plan,
  onClose
}: {
  open: boolean;
  patientId: string;
  plan: TreatmentPlanDetail | null;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RefundStatus | "">("");
  const refunds = useRefunds(
    {
      patientId,
      treatmentPlanId: plan?.id,
      status: status || undefined
    },
    open && Boolean(patientId && plan?.id)
  );
  const filteredRefunds = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = refunds.data ?? [];
    if (!term) return rows;
    return rows.filter((refund) => refundMatchesSearch(refund, plan?.id ?? "", term));
  }, [plan?.id, refunds.data, search]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setStatus("");
  }, [open]);

  return (
    <Modal open={open} title="Reembolsos" onClose={onClose} size="2xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Tratamiento {plan ? numericId(plan.id) : "-"}</p>

        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por ID o prestación"
            />
          </div>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as RefundStatus | "")}
            className="md:w-[220px]"
          >
            <option value="">Todos los reembolsos</option>
            <option value="PROCESSED">Procesados</option>
            <option value="PENDING">Pendientes</option>
            <option value="REJECTED">Rechazados</option>
          </Select>
        </div>

        {refunds.isLoading ? <LoadingState message="Cargando reembolsos..." /> : null}
        {refunds.isError ? <ErrorState message={refunds.error.message} /> : null}
        {!refunds.isLoading && !refunds.isError ? (
          filteredRefunds.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Reembolso</th>
                    <th className="px-4 py-3">Prestación</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRefunds.map((refund) => (
                    <tr key={refund.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">#{refund.id.slice(-6).toUpperCase()}</p>
                        <p className="text-xs text-slate-500">{refund.reason ?? "Sin motivo capturado"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {refundProcedureSummary(refund, plan?.id ?? "")}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        #{refund.payment.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {money(numberValue(refund.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          value={REFUND_STATUS_LABELS[refund.status]}
                          tone={
                            refund.status === "PROCESSED"
                              ? "success"
                              : refund.status === "REJECTED"
                                ? "danger"
                                : "warning"
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateTime(refund.processedAt ?? refund.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No hay elementos"
              description="Paciente sin reembolsos para este tratamiento."
            />
          )
        ) : null}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FutureAppointmentsModal({
  pending,
  onClose,
  onConfirm,
  saving
}: {
  pending: { futureAppointmentsCount: number } | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <Modal open={Boolean(pending)} title="Mover citas futuras" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <CalendarClock className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-semibold">
              Este plan tiene {pending?.futureAppointmentsCount ?? 0} citas futuras.
            </p>
            <p className="mt-1">
              Puedes moverlas a la nueva sucursal y doctor, o dejarlas como estaban en la agenda.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            No mover citas
          </Button>
          <Button disabled={saving} onClick={() => void onConfirm()}>
            Mover citas futuras
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function professionalName(professional: Professional) {
  return `Dr(a) ${professional.firstName} ${professional.lastName}`;
}

function refundProcedureSummary(refund: Refund, treatmentPlanId: string) {
  const labels = refund.payment.allocations
    .filter((allocation) => allocation.treatmentPlanItem.treatmentPlanId === treatmentPlanId)
    .map((allocation) => {
      const item = allocation.treatmentPlanItem;
      const procedure = item.procedure ? `${item.procedure.code} - ${item.procedure.name}` : "Prestación";
      const tooth = item.toothNumber
        ? ` (${fdiLabel(item.toothNumber)}${item.surface ? `-${item.surface}` : ""})`
        : "";
      return `${procedure}${tooth}`;
    });

  return labels.length ? labels.join(", ") : "Pago del tratamiento";
}

function refundMatchesSearch(refund: Refund, treatmentPlanId: string, term: string) {
  const haystack = [
    refund.id,
    refund.payment.id,
    refund.reason ?? "",
    refundProcedureSummary(refund, treatmentPlanId)
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function PieceAssignmentModal({
  item,
  saving,
  onClose,
  onSave
}: {
  item: TreatmentPlanItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (item: TreatmentPlanItem, toothNumber: string, surfaces: string[]) => Promise<void>;
}) {
  const [toothNumber, setToothNumber] = useState("");
  const [surfaces, setSurfaces] = useState<string[]>([]);

  useEffect(() => {
    setToothNumber(item?.toothNumber ?? "");
    setSurfaces(surfaceValues(item?.surface));
  }, [item]);

  const toggleSurface = (surface: string) => {
    setSurfaces((current) =>
      current.includes(surface) ? current.filter((item) => item !== surface) : [...current, surface]
    );
  };

  const procedureLabel = item?.procedure ? `[${item.procedure.code}] ${item.procedure.name}` : "Prestación";

  return (
    <Modal open={Boolean(item)} title="Asignar piezas a prestación" onClose={onClose} size="lg">
      {item ? (
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-bold text-white">
              i
            </div>
            <div className="min-w-0 border-l-4 border-sky-400 pl-4">
              <p className="text-sm font-semibold text-sky-700">
                Seleccione la pieza que quiere asignar a esta prestación
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Para asignar mas de una cara, seleccione las opciones necesarias y presione Agregar piezas.
              </p>
              <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-700">{procedureLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pl-14">
            <Select
              value={toothNumber}
              onChange={(event) => setToothNumber(event.target.value)}
              className="w-48"
            >
              <option value="">Seleccione una opcion</option>
              <optgroup label="Permanentes">
                {FDI_PERMANENT_TEETH.map((tooth) => (
                  <option key={tooth} value={tooth}>
                    Pieza {fdiLabel(tooth)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Temporales">
                {FDI_TEMPORAL_TEETH.map((tooth) => (
                  <option key={tooth} value={tooth}>
                    Pieza {fdiLabel(tooth)}
                  </option>
                ))}
              </optgroup>
            </Select>

            {PIECE_SURFACES.map((surface) => {
              const active = surfaces.includes(surface.code);
              return (
                <button
                  key={surface.code}
                  type="button"
                  className={`inline-flex h-8 items-center gap-1 rounded px-2.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[#0879d5] text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                  }`}
                  onClick={() => toggleSurface(surface.code)}
                >
                  <span className="grid h-3.5 w-3.5 place-items-center rounded border border-current text-[10px]">
                    {active ? "x" : ""}
                  </span>
                  {surface.label}
                </button>
              );
            })}
          </div>

          <div className="-mx-6 -mb-6 flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              disabled={!toothNumber || saving}
              onClick={() => void onSave(item, toothNumber, surfaces)}
            >
              {saving ? "Guardando..." : "Agregar piezas"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function TreatmentItemsTable({
  plan,
  activePriceVersionNumber,
  proceduresData,
  loadingProcedures,
  onAssignPiece,
  onMarkFuture,
  onUnrealize,
  onUnlinkPayment,
  onPay,
  onCreateSection,
  onOpenProcedureCatalog,
  onSelectPiece,
  onEvolveItem,
  canApplyTreatmentDiscount,
  onApplyBulkDiscount,
  onDelete
}: {
  plan: TreatmentPlanDetail;
  activePriceVersionNumber?: number | null;
  proceduresData: TreatmentPlanProceduresResult | null;
  loadingProcedures: boolean;
  onAssignPiece: (item: TreatmentPlanItem) => void;
  onMarkFuture: (item: TreatmentPlanItem) => void;
  onUnrealize: (item: TreatmentPlanItem) => void;
  onUnlinkPayment: (item: TreatmentPlanItem) => void;
  onPay: (item: TreatmentPlanItem) => void;
  onCreateSection: () => void;
  onOpenProcedureCatalog: () => void;
  onSelectPiece: (item: TreatmentPlanItem) => void;
  onEvolveItem: (item: TreatmentPlanItem) => void;
  canApplyTreatmentDiscount: boolean;
  onApplyBulkDiscount: (payload: {
    itemIds: string[];
    discountType: "PERCENTAGE" | "AMOUNT";
    value: number;
    discountReason?: string;
  }) => Promise<unknown>;
  onDelete: (itemId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [bulkDiscountOpen, setBulkDiscountOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const proceduresCount = proceduresData?.summary.proceduresCount ?? plan.items.length;
  const sectionsCount = proceduresData?.summary.sectionsCount ?? plan.sections.length;
  const completedCount =
    proceduresData?.summary.completedCount ?? plan.items.filter((item) => item.status === "COMPLETED").length;
  const clinicalProgress =
    proceduresData?.summary.clinicalProgress?.displayPercentage ?? planClinicalProgressPercentage(plan);
  const withDebtCount =
    proceduresData?.summary.withDebtCount ??
    plan.items.filter((item) => Math.max(numberValue(item.total) - itemPaidAmount(item), 0) > 0).length;
  const procedureRows = [
    ...(proceduresData?.sections.flatMap((section) => section.procedures) ?? []),
    ...(proceduresData?.unsectionedProcedures ?? [])
  ];
  const discountLimitsByItemId = new Map(procedureRows.map((item) => [item.id, item.pricing] as const));
  const eligibleDiscountItems = canApplyTreatmentDiscount
    ? plan.items.filter(
        (item) =>
          isBulkDiscountEligible(item) &&
          Number(discountLimitsByItemId.get(item.id)?.effectiveMaximumDiscountPercent ?? 0) > 0
      )
    : [];

  useEffect(() => {
    if (!actionsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionsOpen]);

  useEffect(() => {
    setSelectedItemIds((current) => current.filter((id) => plan.items.some((item) => item.id === id)));
  }, [plan.items]);

  const toggleItem = (itemId: string) => {
    setExpandedItemId((current) => (current === itemId ? "" : itemId));
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Procedimientos del plan</h2>
            <p className="text-xs text-slate-500">
              Procedimientos asociados al odontograma, presupuesto y seguimiento clinico.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
              <span>
                {proceduresCount} {proceduresCount === 1 ? "procedimiento" : "procedimientos"}
              </span>
              <span>
                {sectionsCount} {sectionsCount === 1 ? "seccion" : "secciones"}
              </span>
              <span>{clinicalProgress}% avance clinico</span>
              <span>{completedCount} realizados</span>
              <span>{withDebtCount} con deuda</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onCreateSection}>
              <Plus className="mr-1 h-4 w-4" />
              Seccion
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenProcedureCatalog}>
              <Plus className="mr-1 h-4 w-4" />
              Procedimiento
            </Button>
            <div className="relative" ref={actionsRef}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!proceduresCount}
                title={
                  !proceduresCount ? "Agrega procedimientos para habilitar las acciones masivas." : undefined
                }
                aria-label="Acciones masivas de procedimientos"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setActionsOpen(false);
                }}
                onClick={() => setActionsOpen((current) => !current)}
              >
                Acciones
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
              {actionsOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded border border-slate-200 bg-white py-1 text-sm shadow-lg">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                    disabled={!eligibleDiscountItems.length}
                    title={
                      !canApplyTreatmentDiscount
                        ? "No tienes permiso para aplicar descuentos."
                        : !eligibleDiscountItems.length
                          ? "No hay prestaciones descontables disponibles."
                          : undefined
                    }
                    onClick={() => {
                      if (!eligibleDiscountItems.length) return;
                      setActionsOpen(false);
                      setBulkDiscountOpen(true);
                    }}
                  >
                    Establecer descuentos multiples
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {loadingProcedures ? (
            <span className="text-xs text-slate-400">Actualizando procedimientos...</span>
          ) : null}
          <div className="hidden min-w-[500px] grid-cols-[1fr_72px_84px_90px_72px_72px] gap-3 text-right text-[11px] font-bold uppercase text-slate-500 md:grid">
            <span className="text-left">Pieza</span>
            <span>Dscto</span>
            <span>Precio</span>
            <span>Pago</span>
            <span>Futuro</span>
            <span>Estado</span>
          </div>
        </div>
      </div>

      {plan.items.length ? (
        <div className="overflow-x-auto bg-slate-50/70 p-3">
          <div className="min-w-[760px] space-y-3">
            {plan.items.map((item) => {
              const expanded = expandedItemId === item.id;
              const paid = itemPaidAmount(item);
              const pending = Math.max(numberValue(item.total) - paid, 0);
              const markedForFuture = Boolean(item.plannedAt);
              const completionPercentage = itemCompletionPercentage(item);
              const procedureLabel = item.procedure
                ? `[${item.procedure.code}] ${item.procedure.name}`
                : item.procedureId;
              const toothLabel = item.toothNumber ? fdiLabel(item.toothNumber) : "";
              const surfaces = surfaceLabel(item.surface);
              const surfaceDetail = surfaces === "Pieza completa" ? "Completa" : surfaces;
              const selectAndToggle = () => {
                onSelectPiece(item);
                toggleItem(item.id);
              };

              return (
                <article
                  key={item.id}
                  className={`border bg-white shadow-sm transition ${expanded ? "border-sky-100 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="grid w-full grid-cols-[74px_minmax(180px,1fr)_80px_70px_88px_82px_44px_38px] items-center gap-3 px-4 py-3 text-left"
                    onClick={selectAndToggle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") selectAndToggle();
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${procedureLabel}`}
                        checked={selectedItemIds.includes(item.id)}
                        disabled={!canApplyTreatmentDiscount || !isBulkDiscountEligible(item)}
                        title={
                          item.allowsDiscountSnapshot === false
                            ? "Esta prestación no permite descuentos según la configuración del arancel"
                            : undefined
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelectedItemIds((current) =>
                            checked
                              ? [...new Set([...current, item.id])]
                              : current.filter((id) => id !== item.id)
                          );
                        }}
                      />
                      {completionPercentage === 100 ? (
                        <span
                          className="relative grid h-8 w-8 place-items-center rounded-full text-slate-500"
                          title="Prestación realizada"
                        >
                          <CheckCircle2 className="h-7 w-7 text-green-600" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="relative grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-sky-50 hover:text-sky-700"
                          aria-label={`Evolucionar prestacion al ${completionPercentage}%`}
                          title={`Avance ${completionPercentage}%`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onEvolveItem(item);
                          }}
                        >
                          <ProgressRing percentage={completionPercentage} active={expanded} />
                        </button>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-xs font-semibold uppercase leading-snug text-slate-900">
                        {procedureLabel}
                      </span>
                      {item.section?.name ? (
                        <span className="mt-1 block text-[11px] text-slate-500">{item.section.name}</span>
                      ) : null}
                      <span className="mt-1 block truncate text-[11px] text-slate-500">
                        {PRICE_SOURCE_LABELS[item.priceSource ?? "MANUAL"]}
                        {item.priceSnapshotName ? ` - ${item.priceSnapshotName}` : ""}
                        {item.priceListVersionNumber ? ` · v${item.priceListVersionNumber}` : ""}
                        {item.priceListVersionNumber &&
                        activePriceVersionNumber &&
                        item.priceListVersionNumber !== activePriceVersionNumber
                          ? " · precio histórico"
                          : ""}
                      </span>
                    </span>

                    <span className="flex justify-center">
                      <button
                        type="button"
                        aria-label="Asignar pieza dental"
                        className="group inline-flex h-10 min-w-14 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAssignPiece(item);
                        }}
                      >
                        <img
                          src="/logo-2.png"
                          alt=""
                          className="h-5 w-5 object-contain opacity-75 group-hover:opacity-100"
                        />
                        <span className="flex flex-col items-start leading-none">
                          <span>{toothLabel || "+"}</span>
                          {surfaceDetail ? (
                            <span className="mt-0.5 text-[9px] font-medium">{surfaceDetail}</span>
                          ) : null}
                        </span>
                      </button>
                    </span>

                    <span className="text-center text-sm font-medium text-slate-900">
                      {item.allowsDiscountSnapshot === false ? (
                        <span
                          className="inline-flex rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500"
                          title="Esta prestación no permite descuentos según la configuración del arancel"
                        >
                          No desc.
                        </span>
                      ) : (
                        `${itemDiscountPercent(item)}%`
                      )}
                    </span>
                    <span className="text-right text-sm font-semibold text-slate-900">
                      {money(numberValue(item.total))}
                    </span>
                    <span className="text-right text-xs font-medium text-slate-600">
                      {paid ? money(paid) : "-"}
                    </span>
                    <span className="flex justify-center">
                      <button
                        type="button"
                        aria-label={
                          markedForFuture ? "Desmarcar futura realizacion" : "Marcar futura realizacion"
                        }
                        title={
                          markedForFuture
                            ? "Prestación marcada para futura realizacion"
                            : "Prestación desmarcada para futura realizacion"
                        }
                        className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-green-50 ${markedForFuture ? "text-green-600" : "text-slate-300"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onMarkFuture(item);
                        }}
                      >
                        <ShoppingCart className="h-5 w-5" />
                      </button>
                    </span>
                    <span className="flex justify-end">
                      <span
                        className={`h-4 w-4 rounded-full ${itemStatusDotClass(item.status)}`}
                        title={ITEM_STATUS_LABELS[item.status]}
                      />
                    </span>
                  </div>

                  {expanded ? (
                    <div className="border-t border-sky-100 bg-sky-50 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-5 text-xs">
                        <button
                          type="button"
                          disabled={item.status === "COMPLETED"}
                          className="inline-flex items-center gap-1 font-medium text-[#0b8bd8] hover:text-[#0b8bd8]/80 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => {
                            onEvolveItem(item);
                          }}
                        >
                          <Stethoscope className="h-4 w-4" />
                          Evoluciónar / Realizar
                        </button>
                        <button
                          type="button"
                          disabled={item.status === "PLANNED"}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => onUnrealize(item)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Desrealizar
                        </button>
                        <button
                          type="button"
                          disabled={!item.paymentAllocations?.length}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => onUnlinkPayment(item)}
                        >
                          <Link2Off className="h-4 w-4" />
                          Desasociar pago
                        </button>
                        <button
                          type="button"
                          disabled={pending <= 0}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          onClick={() => onPay(item)}
                        >
                          <DollarSign className="h-4 w-4" />
                          Abonar
                        </button>
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:text-slate-300"
                          disabled={item.status === "PAID"}
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 border-l-4 border-slate-200 pl-5 text-sm md:grid-cols-[220px_1fr_1fr]">
                        <div className="flex gap-3">
                          <GripVertical className="mt-1 h-5 w-5 text-slate-300" />
                          <UserCircle className="mt-1 h-9 w-9 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">Creado por</p>
                          <p className="font-semibold text-slate-900">Sistema</p>
                          <p className="text-xs text-slate-500">Plan actual</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">Realizado por</p>
                          <p className="italic text-slate-500">
                            {item.status === "COMPLETED"
                              ? "Prestación marcada como realizada"
                              : "Esta prestación aun no ha sido realizada"}
                          </p>
                          {toothLabel ? (
                            <p className="mt-2 text-xs text-slate-600">
                              Pieza {toothLabel}
                              {surfaces ? ` · ${surfaces}` : ""}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-slate-600">
                            Origen precio: {PRICE_SOURCE_LABELS[item.priceSource ?? "MANUAL"]}
                            {item.priceSnapshotName ? ` - ${item.priceSnapshotName}` : ""}
                            {item.priceSnapshotCategory ? ` - ${item.priceSnapshotCategory}` : ""}
                            {item.priceListVersionNumber ? ` · v${item.priceListVersionNumber}` : ""}
                            {item.priceListVersionNumber &&
                            activePriceVersionNumber &&
                            item.priceListVersionNumber !== activePriceVersionNumber
                              ? " · precio histórico"
                              : ""}
                          </p>
                          <p
                            className={`mt-2 text-xs font-semibold ${
                              item.allowsDiscountSnapshot === false ? "text-slate-500" : "text-emerald-700"
                            }`}
                            title={
                              item.allowsDiscountSnapshot === false
                                ? "Esta prestación no permite descuentos según la configuración del arancel"
                                : undefined
                            }
                          >
                            {item.allowsDiscountSnapshot === false
                              ? "No permite descuento"
                              : "Permite descuento"}
                          </p>
                          {item.notes ? <p className="mt-2 text-xs text-slate-600">{item.notes}</p> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 py-10">
          <div className="mx-auto max-w-xl rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">
              Este plan todavia no tiene procedimientos.
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Agrega una seccion para organizar el tratamiento o anade directamente un procedimiento.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={onCreateSection}>
                <Plus className="mr-1 h-4 w-4" />
                Crear primera seccion
              </Button>
              <Button onClick={onOpenProcedureCatalog}>
                <Plus className="mr-1 h-4 w-4" />
                Agregar procedimiento
              </Button>
            </div>
          </div>
        </div>
      )}
      <BulkDiscountModal
        open={bulkDiscountOpen}
        plan={plan}
        selectedItemIds={selectedItemIds}
        eligibleItems={eligibleDiscountItems}
        discountLimitsByItemId={discountLimitsByItemId}
        onSelectedItemIdsChange={setSelectedItemIds}
        onClose={() => setBulkDiscountOpen(false)}
        onApply={async (payload) => {
          await onApplyBulkDiscount(payload);
          setBulkDiscountOpen(false);
          setSelectedItemIds([]);
          toast.success("Los descuentos fueron actualizados correctamente.");
        }}
      />
    </section>
  );
}

function isBulkDiscountEligible(item: TreatmentPlanItem) {
  const paid = itemPaidAmount(item);
  return (
    item.allowsDiscountSnapshot !== false &&
    !["CANCELLED", "PAID"].includes(item.status) &&
    paid < numberValue(item.total)
  );
}

function itemDiscountBase(item: TreatmentPlanItem) {
  return numberValue(item.originalPrice) || numberValue(item.quantity) * numberValue(item.unitPrice);
}

function BulkDiscountModal({
  open,
  plan,
  selectedItemIds,
  eligibleItems,
  discountLimitsByItemId,
  onSelectedItemIdsChange,
  onClose,
  onApply
}: {
  open: boolean;
  plan: TreatmentPlanDetail;
  selectedItemIds: string[];
  eligibleItems: TreatmentPlanItem[];
  discountLimitsByItemId: Map<
    string,
    {
      userMaximumDiscountPercent?: string;
      procedureMaximumDiscountPercent?: string;
      effectiveMaximumDiscountPercent?: string;
    }
  >;
  onSelectedItemIdsChange: (ids: string[]) => void;
  onClose: () => void;
  onApply: (payload: {
    itemIds: string[];
    discountType: "PERCENTAGE" | "AMOUNT";
    value: number;
    discountReason?: string;
  }) => Promise<void>;
}) {
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "AMOUNT">("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [discountReason, setDiscountReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDiscountType("PERCENTAGE");
    setValue("10");
    setDiscountReason("");
    if (!selectedItemIds.length && eligibleItems.length) {
      onSelectedItemIdsChange(eligibleItems.map((item) => item.id));
    }
  }, [eligibleItems, onSelectedItemIdsChange, open, selectedItemIds.length]);

  const selectedItems = plan.items.filter(
    (item) => selectedItemIds.includes(item.id) && isBulkDiscountEligible(item)
  );
  const numericValue = numberValue(value);
  const selectedBase = selectedItems.reduce((sum, item) => sum + itemDiscountBase(item), 0);
  const effectiveMaximum = selectedItems.length
    ? Math.min(
        ...selectedItems.map((item) =>
          Number(discountLimitsByItemId.get(item.id)?.effectiveMaximumDiscountPercent ?? 0)
        )
      )
    : 0;
  const requestedPercent =
    discountType === "PERCENTAGE" ? numericValue : selectedBase > 0 ? (numericValue / selectedBase) * 100 : 0;
  const previousTotal = selectedItems.reduce((sum, item) => sum + numberValue(item.total), 0);
  const previewDiscount =
    discountType === "PERCENTAGE"
      ? selectedItems.reduce(
          (sum, item) => sum + Number((itemDiscountBase(item) * (numericValue / 100)).toFixed(2)),
          0
        )
      : numericValue;
  const preview = {
    previousTotal,
    discount: Math.min(previewDiscount, selectedBase),
    newTotal: Math.max(selectedBase - Math.min(previewDiscount, selectedBase), 0)
  };
  const invalidValue =
    numericValue < 0 ||
    requestedPercent > effectiveMaximum ||
    (discountType === "AMOUNT" && numericValue > selectedBase) ||
    selectedItems.length === 0;

  const toggleItem = (itemId: string, checked: boolean) => {
    onSelectedItemIdsChange(
      checked ? [...new Set([...selectedItemIds, itemId])] : selectedItemIds.filter((id) => id !== itemId)
    );
  };

  const handleApply = async () => {
    if (invalidValue || saving) return;
    setSaving(true);
    try {
      await onApply({
        itemIds: selectedItems.map((item) => item.id),
        discountType,
        value: numericValue,
        discountReason: discountReason.trim() || undefined
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Aplicar descuentos a varios procedimientos" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="text-xs font-semibold text-slate-600">Tipo de descuento</span>
            <Select
              className="mt-1"
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as "PERCENTAGE" | "AMOUNT")}
            >
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="AMOUNT">Importe fijo</option>
            </Select>
          </label>
          <label className="w-40">
            <span className="text-xs font-semibold text-slate-600">Valor</span>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={
                discountType === "PERCENTAGE"
                  ? effectiveMaximum
                  : Number((selectedBase * (effectiveMaximum / 100)).toFixed(2))
              }
              step="0.01"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            type="button"
            onClick={() => onSelectedItemIdsChange(eligibleItems.map((item) => item.id))}
            disabled={!eligibleItems.length}
          >
            Seleccionar elegibles
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          {eligibleItems.map((item) => {
            const base = itemDiscountBase(item);
            const nextDiscount = Number((base * (requestedPercent / 100)).toFixed(2));
            const nextTotal = Math.max(base - Math.min(nextDiscount, base), 0);
            const limits = discountLimitsByItemId.get(item.id);
            return (
              <label
                key={item.id}
                className="grid cursor-pointer grid-cols-[28px_1fr_auto_auto] items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedItemIds.includes(item.id)}
                  onChange={(event) => toggleItem(item.id, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">
                    {item.procedure ? `[${item.procedure.code}] ${item.procedure.name}` : item.procedureId}
                  </span>
                  <span className="text-xs text-slate-500">{item.section?.name ?? "Sin seccion"}</span>
                  <span className="block text-xs font-medium text-emerald-700">
                    Máximo aplicable {limits?.effectiveMaximumDiscountPercent ?? "0.00"} %
                  </span>
                </span>
                <span className="text-right text-xs text-slate-500">
                  Antes
                  <strong className="ml-1 text-slate-900">{money(numberValue(item.total))}</strong>
                </span>
                <span className="text-right text-xs text-slate-500">
                  Nuevo
                  <strong className="ml-1 text-slate-900">{money(nextTotal)}</strong>
                </span>
              </label>
            );
          })}
          {!eligibleItems.length ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No hay procedimientos elegibles para descuento masivo.
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs text-slate-600 sm:grid-cols-3">
          <div>
            <span className="block text-slate-500">Límite usuario</span>
            <strong>
              {selectedItems[0]
                ? discountLimitsByItemId.get(selectedItems[0].id)?.userMaximumDiscountPercent
                : "0.00"}{" "}
              %
            </strong>
          </div>
          <div>
            <span className="block text-slate-500">Menor límite prestación</span>
            <strong>{effectiveMaximum.toFixed(2)} %</strong>
          </div>
          <div>
            <span className="block text-slate-500">Máximo aplicable</span>
            <strong className="text-sky-800">{effectiveMaximum.toFixed(2)} %</strong>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Motivo del descuento</span>
          <Input
            className="mt-1"
            value={discountReason}
            maxLength={240}
            onChange={(event) => setDiscountReason(event.target.value)}
            placeholder="Ej. Promoción, fidelización o ajuste comercial"
          />
        </label>

        {requestedPercent > effectiveMaximum && selectedItems.length ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Descuento solicitado {requestedPercent.toFixed(2)} %, máximo aplicable{" "}
            {effectiveMaximum.toFixed(2)} %. No se guardará ningún cambio.
          </p>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-3">
          <SummaryLine label="Subtotal anterior" value={money(preview.previousTotal)} strong />
          <SummaryLine label="Descuento" value={money(preview.discount)} strong />
          <SummaryLine label="Nuevo total" value={money(preview.newTotal)} strong />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button disabled={invalidValue || saving} onClick={() => void handleApply()}>
            {saving ? "Guardando..." : "Aplicar descuentos"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BudgetPanel({
  budget,
  onCreate,
  onSend,
  onAccept
}: {
  budget: Budget | null;
  onCreate: () => void;
  onSend: (budgetId: string) => void;
  onAccept: (budgetId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Presupuesto y firma</h2>
            <p className="text-sm text-slate-500">
              {budget
                ? `Presupuesto ${budget.status} por ${money(numberValue(budget.total))}`
                : "Aun no se ha generado presupuesto."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onCreate}>
            <Receipt className="mr-1 h-4 w-4" />
            Crear presupuesto
          </Button>
          <Button
            variant="secondary"
            disabled={!budget || !["DRAFT"].includes(budget.status)}
            onClick={() => budget && onSend(budget.id)}
          >
            <Send className="mr-1 h-4 w-4" />
            Enviar
          </Button>
          <Button
            disabled={!budget || !["DRAFT", "SENT"].includes(budget.status)}
            onClick={() => budget && onAccept(budget.id)}
          >
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Aceptar
          </Button>
        </div>
      </div>
    </section>
  );
}

function TreatmentRepriceModal({
  preview,
  plan,
  reason,
  applying,
  onReasonChange,
  onClose,
  onApply
}: {
  preview: TreatmentPlanRepricePreview | null;
  plan: TreatmentPlanDetail | null;
  reason: string;
  applying: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const totalDifference = (preview?.items ?? []).reduce((sum, item) => sum + numberValue(item.difference), 0);
  const itemById = new Map((plan?.items ?? []).map((item) => [item.id, item]));

  return (
    <Modal open={Boolean(preview)} title="Actualizar precios del borrador" onClose={onClose} size="2xl">
      {preview ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Esta acción solo cambia este plan en borrador. No modifica versiones antiguas ni otros
            tratamientos.
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[minmax(180px,1fr)_90px_90px_90px] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Prestación</span>
              <span>Actual</span>
              <span>Propuesto</span>
              <span>Diferencia</span>
            </div>
            <div className="divide-y divide-slate-200">
              {preview.items.map((row) => {
                const item = itemById.get(row.itemId);
                return (
                  <div
                    key={row.itemId}
                    className="grid grid-cols-[minmax(180px,1fr)_90px_90px_90px] gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {item?.procedure?.name ?? item?.priceSnapshotName ?? row.procedureId}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        v{row.current.versionNumber ?? "—"} → v{row.proposed?.version.number ?? "—"}
                      </p>
                      {row.error ? <p className="mt-1 text-xs text-red-600">{row.error}</p> : null}
                      {row.hasFinancialDependencies ? (
                        <p className="mt-1 text-xs text-amber-700">Tiene pagos o presupuesto no borrador.</p>
                      ) : null}
                    </div>
                    <span className="font-medium text-slate-700">
                      {money(numberValue(row.current.total))}
                    </span>
                    <span className="font-medium text-slate-900">
                      {row.proposed ? money(numberValue(row.proposed.total)) : "—"}
                    </span>
                    <span className={numberValue(row.difference) > 0 ? "text-amber-700" : "text-emerald-700"}>
                      {row.difference === null ? "—" : money(numberValue(row.difference))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Diferencia total</span>
            <span className="text-base font-semibold text-slate-900">{money(totalDifference)}</span>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Motivo obligatorio</span>
            <Textarea
              className="mt-1"
              rows={3}
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Ej. Actualización autorizada por cambio de tarifario"
            />
          </label>

          {!preview.canApply ? (
            <p className="text-sm font-medium text-red-600">
              No se puede aplicar: corrige errores o dependencias financieras antes de recalcular.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={!preview.canApply || !reason.trim() || applying} onClick={onApply}>
              {applying ? "Actualizando..." : "Confirmar actualización"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function BudgetProcedureDrawer({
  open,
  plan,
  agreementName,
  priceList,
  selectedTooth,
  selectedSurface,
  addedItemsCount,
  addingItem,
  creatingBudget,
  onClose,
  onAddItem,
  onCreateBudget
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  agreementName?: string | null;
  priceList: TreatmentPriceCatalog | null;
  selectedTooth: string;
  selectedSurface: string;
  addedItemsCount: number;
  addingItem: boolean;
  creatingBudget: boolean;
  onClose: () => void;
  onAddItem: (item: TreatmentPriceCatalogItem) => Promise<void>;
  onCreateBudget: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const catalog = useMemo(() => buildTreatmentBudgetCatalog(priceList), [priceList]);
  const selectedCategory = catalog.find((category) => category.id === categoryId) ?? null;
  const filteredCategories = catalog.filter((category) =>
    budgetCatalogCategoryMatchesSearch(category, search)
  );
  const filteredItems =
    selectedCategory?.items.filter((item) => budgetCatalogItemMatchesSearch(item, search)) ?? [];
  const flatResults = useMemo(
    () => (categoryId === "" && search.trim() ? flatSearchBudgetCatalog(catalog, search) : []),
    [catalog, search, categoryId]
  );
  const isInFlatSearchMode = categoryId === "" && search.trim() !== "" && flatResults.length > 0;
  const planItemCount = Math.max(plan?.items.length ?? 0, addedItemsCount);
  const canCreateBudget = Boolean(planItemCount);
  const selectedPieceLabel = selectedTooth
    ? `Pieza ${fdiLabel(selectedTooth)} - ${
        selectedSurface ? `Cara ${surfaceLabel(selectedSurface).toLowerCase()}` : "Pieza completa"
      }`
    : "Sin piezas seleccionadas";
  const drawerTitle = selectedCategory ? `Productos de ${selectedCategory.name}` : "Definir procedimiento";

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setCategoryId("");
  }, [open, priceList?.id]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <button
        type="button"
        aria-label="Cerrar definicion de procedimiento"
        className="absolute inset-0 bg-[#042C53]/35 backdrop-blur-[4px] transition-opacity duration-200"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-procedure-drawer-title"
        className="relative z-10 flex h-full w-full max-w-[440px] flex-col bg-white border-r border-slate-200 shadow-2xl transition-all duration-200"
      >
        <header className="flex min-h-[78px] shrink-0 items-center justify-between bg-white border-b border-slate-100 px-5 py-4 text-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            {selectedCategory ? (
              <button
                type="button"
                aria-label="Volver a categorias"
                className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100"
                onClick={() => setCategoryId("")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <Receipt className="h-5 w-5 shrink-0 text-[#185FA5]" />
            )}
            <div className="min-w-0">
              <h2 id="budget-procedure-drawer-title" className="truncate text-base font-bold text-[#0C447C]">
                {drawerTitle}
              </h2>
              <div className="mt-1 flex items-center gap-2 flex-wrap min-w-0">
                {agreementName ? (
                  <span className="bg-[#E6F1FB] text-[#0C447C] px-2 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-[150px]">
                    {agreementName}
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                    Sin convenio
                  </span>
                )}
                <span className="text-[10px] text-slate-400">·</span>
                <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                  {priceList?.name ?? "Sin arancel"}
                  {priceList?.activeVersion ? ` · v${priceList.activeVersion.number}` : ""}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="relative shrink-0 border-b border-slate-100 px-4 py-3 bg-slate-50/50">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm bg-white shadow-none focus-visible:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5]/20"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={selectedCategory ? "Buscar prestaciones..." : "Buscar por código, nombre o categoría..."}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/30">
          {selectedCategory ? (
            <div className="p-4">
              {filteredItems.length ? (
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-4 p-4 bg-white border border-slate-200/80 rounded-lg shadow-sm transition hover:border-slate-300"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">
                            {item.procedure.code}
                          </span>
                          {item.procedure.requiresTooth ? (
                            <Badge value="Requiere pieza" tone={selectedTooth ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresSurface ? (
                            <Badge value="Requiere superficie" tone={selectedSurface ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresLab ? <Badge value="Laboratorio" tone="default" /> : null}
                        </div>
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.procedure.name}
                          </p>
                          {item.procedure.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {item.procedure.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between gap-3">
                        <div className="whitespace-nowrap text-right text-base font-bold text-[#0C447C]">
                          {money(numberValue(item.price))}
                          <span className="mt-1 block text-[10px] font-medium text-slate-500">
                            v{item.version.number} · {item.currency}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-[#185FA5] text-[#185FA5] hover:bg-[#E6F1FB] px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60"
                          disabled={addingItem}
                          onClick={() => void onAddItem(item)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Cargar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-16 text-center text-sm text-slate-500 bg-white border border-slate-200/80 rounded-lg shadow-sm">
                  {selectedCategory.items.length
                    ? "No hay productos con ese filtro en esta categoría."
                    : "Esta categoría del arancel no tiene productos configurados."}
                </div>
              )}
            </div>
          ) : catalog.length ? (
            <div className="p-4 space-y-3">
              {isInFlatSearchMode ? (
                <div className="space-y-3">
                  {flatResults.map(({ item, categoryId, categoryName }) => (
                    <div
                      key={`${categoryId}-${item.id}`}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-4 p-4 bg-white border border-slate-200/80 rounded-lg shadow-sm transition hover:border-slate-300"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">
                            {item.procedure.code}
                          </span>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-[150px]">
                            {categoryName}
                          </span>
                          {item.procedure.requiresTooth ? (
                            <Badge value="Requiere pieza" tone={selectedTooth ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresSurface ? (
                            <Badge value="Requiere superficie" tone={selectedSurface ? "brand" : "warning"} />
                          ) : null}
                          {item.procedure.requiresLab ? <Badge value="Laboratorio" tone="default" /> : null}
                        </div>
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.procedure.name}
                          </p>
                          {item.procedure.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {item.procedure.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between gap-3">
                        <div className="whitespace-nowrap text-right text-base font-bold text-[#0C447C]">
                          {money(numberValue(item.price))}
                          <span className="mt-1 block text-[10px] font-medium text-slate-500">
                            v{item.version.number} · {item.currency}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-[#185FA5] text-[#185FA5] hover:bg-[#E6F1FB] px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60"
                          disabled={addingItem}
                          onClick={() => void onAddItem(item)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Cargar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {filteredCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 text-left bg-white border border-slate-200/80 rounded-lg shadow-sm hover:border-slate-300 hover:shadow-md transition-all duration-200"
                      onClick={() => setCategoryId(category.id)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{category.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {category.items.length
                            ? `${category.items.length} productos`
                            : "Sin productos configurados"}
                          {category.description ? ` · ${category.description}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                  {!filteredCategories.length ? (
                    <div className="px-6 py-16 text-center text-sm text-slate-500 bg-white border border-slate-200/80 rounded-lg shadow-sm">
                      {search.trim() ? "No se encontraron prestaciones con ese código o nombre." : "No hay categorías con ese filtro."}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="bg-white border border-slate-200/80 rounded-lg p-8 shadow-sm max-w-sm">
                <FolderOpen className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Sin categorías en el convenio</p>
                <p className="mt-1 text-xs text-slate-500">
                  Configura categorías en el catálogo asociado al convenio para navegar productos desde aquí.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                Piezas seleccionadas
              </p>
              <p className="truncate text-sm font-semibold text-slate-700">{selectedPieceLabel}</p>
              <p className="mt-0.5 text-xs text-slate-500">Prestaciones en el plan: {planItemCount}</p>
            </div>
            <Button
              className="bg-[#10B981] hover:bg-[#059669] text-white shadow-sm font-semibold text-sm border-0"
              disabled={!canCreateBudget || creatingBudget}
              onClick={() => void onCreateBudget()}
            >
              <Receipt className="mr-1.5 h-4 w-4" />
              Crear presupuesto
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
}

function PatientSignaturePanel({
  patientId,
  notes,
  onAddComment
}: {
  patientId: string;
  notes: Array<{ id: string; note: string; createdAt: string }>;
  onAddComment: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Firma del paciente</h2>
          <Link to={APP_ROUTES.patients.clinicalConsents(patientId)}>
            <Button variant="secondary" size="sm">
              <FileText className="mr-1 h-4 w-4" />
              Crear consentimiento
            </Button>
          </Link>
        </div>
        <div className="space-y-4 py-4 text-sm">
          <div>
            <p className="font-semibold text-slate-900">Evoluciónes</p>
            <p className="mt-1 text-slate-500">No hay documentos pendientes por firmar.</p>
          </div>
          <div className="border-t border-dashed border-slate-200 pt-4">
            <p className="font-semibold text-slate-900">Consentimientos</p>
            <p className="mt-1 text-slate-500">
              Consulta o crea consentimientos desde la ficha del paciente.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Comentarios para el paciente</h2>
          <Button variant="secondary" size="sm" onClick={onAddComment}>
            <MessageSquarePlus className="mr-1 h-4 w-4" />
            Agregar
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {notes.slice(0, 3).map((note) => (
            <div key={note.id} className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">{note.note}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(note.createdAt)}</p>
            </div>
          ))}
          {!notes.length ? (
            <p className="text-center text-sm text-slate-400">
              Sin comentario, agrega uno para imprimirlo en presupuestos.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FinancingModal({
  open,
  plan,
  items,
  totalAvailable,
  saving,
  onClose,
  onCreate
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  items: PayableTreatmentItem[];
  totalAvailable: number;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: {
    patientId: string;
    treatmentPlanId: string;
    totalAmount: number;
    downPayment: number;
    numberOfInstallments: number;
    frequency: InstallmentFrequency;
    startDate: string;
    itemAllocations: Array<{ treatmentPlanItemId: string; amount: number; expectedVersion?: number }>;
  }) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downPayment, setDownPayment] = useState("0");
  const [numberOfInstallments, setNumberOfInstallments] = useState("1");
  const [frequency, setFrequency] = useState<InstallmentFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    setSelectedIds(items.map((item) => item.id));
    setDownPayment("0");
    setNumberOfInstallments("1");
    setFrequency("MONTHLY");
    setStartDate(new Date().toISOString().slice(0, 10));
  }, [items, open]);

  if (!plan) return null;

  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectedTotal = roundMoney(selectedItems.reduce((sum, item) => sum + financeableAmount(item), 0));
  const downPaymentValue = roundMoney(numberValue(downPayment));
  const installmentsCount = Math.max(0, Math.trunc(numberValue(numberOfInstallments)));
  const financedAmount = roundMoney(Math.max(selectedTotal - downPaymentValue, 0));
  const installmentAmounts = installmentsCount > 0 ? splitAmount(financedAmount, installmentsCount) : [];
  const schedule = installmentAmounts.map((amount, index) => ({
    number: index + 1,
    dueDate: addInstallmentPeriod(startDate, frequency, index),
    amount
  }));
  const canCreate =
    selectedTotal > 0 &&
    downPaymentValue >= 0 &&
    downPaymentValue < selectedTotal &&
    installmentsCount > 0 &&
    Boolean(startDate) &&
    !saving;

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  };

  const submit = async () => {
    if (!canCreate) return;
    await onCreate({
      patientId: plan.patient.id,
      treatmentPlanId: plan.id,
      totalAmount: selectedTotal,
      downPayment: downPaymentValue,
      numberOfInstallments: installmentsCount,
      frequency,
      startDate,
      itemAllocations: selectedItems.map((item) => ({
        treatmentPlanItemId: item.id,
        amount: financeableAmount(item),
        expectedVersion: item.version
      }))
    });
  };

  return (
    <Modal open={open} title="Financiamiento por credito" onClose={onClose} size="2xl">
      <div className="space-y-5">
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4">
          <SummaryPill label="Paciente" value={`${plan.patient.firstName} ${plan.patient.lastName}`} />
          <SummaryPill label="Plan" value={`#${numericId(plan.id)}`} />
          <SummaryPill label="Sucursal" value={plan.branch.name} />
          <SummaryPill label="Disponible" value={money(totalAvailable)} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="px-3 py-3">Procedimiento</th>
                <th className="px-3 py-3">Pieza</th>
                <th className="px-3 py-3 text-right">Precio</th>
                <th className="px-3 py-3 text-right">Abonado</th>
                <th className="px-3 py-3 text-right">Ya financiado</th>
                <th className="px-3 py-3 text-right">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-900">{item.procedure.name}</td>
                  <td className="px-3 py-3 text-slate-600">{fdiLabel(item.toothNumber)}</td>
                  <td className="px-3 py-3 text-right">{money(item.total)}</td>
                  <td className="px-3 py-3 text-right">{money(item.paidAmount)}</td>
                  <td className="px-3 py-3 text-right">{money(item.financedAmount ?? 0)}</td>
                  <td className="px-3 py-3 text-right font-semibold">{money(financeableAmount(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={downPayment}
              onChange={(event) => setDownPayment(event.target.value)}
              placeholder="Enganche"
            />
            <Input
              type="number"
              min="1"
              step="1"
              value={numberOfInstallments}
              onChange={(event) => setNumberOfInstallments(event.target.value)}
              placeholder="Cuotas"
            />
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            <Select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as InstallmentFrequency)}
            >
              <option value="MONTHLY">Mensual</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="WEEKLY">Semanal</option>
            </Select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <SummaryLine label="Por financiar" value={money(selectedTotal)} />
            <SummaryLine label="Enganche" value={money(downPaymentValue)} />
            <SummaryLine label="Monto financiado" value={money(financedAmount)} strong />
            {!canCreate ? (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Selecciona prestaciones, usa un enganche menor al total y define al menos una cuota.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Vista previa de cuotas</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {schedule.map((installment) => (
              <div
                key={installment.number}
                className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <p className="font-semibold text-slate-900">Cuota {installment.number}</p>
                <p className="text-slate-500">{installment.dueDate}</p>
                <p className="font-semibold">{money(installment.amount)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canCreate} onClick={() => void submit()}>
            {saving ? "Creando..." : "Crear financiamiento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PayrollDiscountModal({
  open,
  plan,
  items,
  totalAvailable,
  saving,
  onClose,
  onCreate
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  items: TreatmentPlanItem[];
  totalAvailable: number;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: {
    treatmentPlanId: string;
    treatmentPlanItemIds: string[];
    installmentCount: number;
    firstDueDate: string;
    periodicity: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  }) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [installmentCount, setInstallmentCount] = useState("1");
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodicity, setPeriodicity] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("MONTHLY");

  useEffect(() => {
    if (!open) return;
    setSelectedIds(items.map((item) => item.id));
    setInstallmentCount("1");
    setFirstDueDate(new Date().toISOString().slice(0, 10));
    setPeriodicity("MONTHLY");
  }, [items, open]);

  if (!plan) return null;
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const selectedTotal = roundMoney(
    selectedItems.reduce((sum, item) => sum + numberValue(item.agreementCoverage), 0)
  );
  const count = Math.max(0, Math.trunc(numberValue(installmentCount)));
  const currency = selectedItems[0]?.priceCurrency ?? "MXN";
  const schedule = count
    ? splitAmount(selectedTotal, count).map((amount, index) => ({
        number: index + 1,
        dueDate: addInstallmentPeriod(firstDueDate, periodicity, index),
        amount
      }))
    : [];
  const canCreate =
    selectedItems.length > 0 && selectedTotal > 0 && count > 0 && Boolean(firstDueDate) && !saving;

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  };

  return (
    <Modal open={open} title="Descuento por planilla" onClose={onClose} size="2xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <SummaryPill label="Empresa / convenio" value={plan.agreement?.name ?? "Convenio del plan"} />
            <SummaryPill
              label="Paciente afiliado"
              value={`${plan.patient.firstName} ${plan.patient.lastName}`}
            />
            <SummaryPill label="Sucursal" value={plan.branch.name} />
            <SummaryPill label="Cobertura disponible" value={money(totalAvailable)} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-sky-900">
            Estas cuotas serán deuda de la empresa hacia la clínica. No se registrarán como pago ni como deuda
            particular del paciente.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="px-3 py-3">Prestación</th>
                <th className="px-3 py-3">Pieza</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Cobro a empresa</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-950">
                      {item.procedure?.name ?? item.priceSnapshotName ?? "Prestación"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.procedure?.code ?? item.priceSnapshotCode ?? item.id}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{fdiLabel(item.toothNumber)}</td>
                  <td className="px-3 py-3">
                    <Badge value={ITEM_STATUS_LABELS[item.status]} tone="default" />
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-slate-950">
                    {new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: item.priceCurrency ?? "MXN"
                    }).format(numberValue(item.agreementCoverage))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">Número de cuotas</span>
              <Input
                type="number"
                min="1"
                max="120"
                step="1"
                value={installmentCount}
                onChange={(event) => setInstallmentCount(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">Primera cuota</span>
              <Input
                type="date"
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">Periodicidad</span>
              <Select
                value={periodicity}
                onChange={(event) => setPeriodicity(event.target.value as typeof periodicity)}
              >
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="MONTHLY">Mensual</option>
              </Select>
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-300">Plan empresarial</p>
            <p className="mt-1 text-2xl font-bold">
              {new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(selectedTotal)}
            </p>
            <div className="mt-3 flex justify-between text-sm text-slate-300">
              <span>Prestaciones</span>
              <strong className="text-white">{selectedItems.length}</strong>
            </div>
            <div className="mt-1 flex justify-between text-sm text-slate-300">
              <span>Cargos a generar</span>
              <strong className="text-white">{selectedItems.length * count}</strong>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-950">Vista previa de cuotas</p>
          <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto md:grid-cols-3">
            {schedule.map((installment) => (
              <div
                key={installment.number}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">Cuota {installment.number}</p>
                  <span className="font-bold text-sky-800">
                    {new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(
                      installment.amount
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Vence {installment.dueDate}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() =>
              void onCreate({
                treatmentPlanId: plan.id,
                treatmentPlanItemIds: selectedIds,
                installmentCount: count,
                firstDueDate,
                periodicity
              })
            }
          >
            {saving ? "Generando cargos..." : "Generar cargos empresariales"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PlanProcedureModal({
  open,
  plan,
  toothNumber,
  surface,
  onSurfaceChange,
  procedures,
  priceList,
  onClose,
  onSave
}: {
  open: boolean;
  plan: TreatmentPlanDetail | null;
  toothNumber: string;
  surface: string;
  onSurfaceChange: (surface: string) => void;
  procedures: Procedure[];
  priceList: TreatmentPriceCatalog | null;
  onClose: () => void;
  onSave: (payload: {
    sectionId?: string;
    procedureId: string;
    toothNumber?: string;
    surface?: string;
    quantity: number;
    discount: number;
    notes?: string;
  }) => Promise<void>;
}) {
  const [sectionId, setSectionId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setSectionId("");
    setProcedureId("");
    setQuantity("1");
    setUnitPrice("0");
    setDiscount("0");
    setNotes("");
  }, [open, toothNumber]);

  useEffect(() => {
    if (!procedureId) return;
    setUnitPrice(String(priceForProcedure(priceList, procedureId)));
  }, [priceList, procedureId]);

  const selectedProcedure = procedures.find((procedure) => procedure.id === procedureId);
  const selectedPriceItem = priceList?.items.find((item) => item.procedureId === procedureId) ?? null;
  const userMaximumDiscount = Number(priceList?.discountCapability?.maximumDiscountPercent ?? 0);
  const procedureMaximumDiscount = selectedPriceItem?.allowsDiscount
    ? Number(selectedPriceItem.maxDiscountPercent ?? 0)
    : 0;
  const effectiveMaximumDiscount = Math.min(userMaximumDiscount, procedureMaximumDiscount);
  const baseAmount = numberValue(quantity) * numberValue(unitPrice);
  const discountAmount = Number((baseAmount * (numberValue(discount) / 100)).toFixed(2));
  const total = Math.max(baseAmount - discountAmount, 0);

  return (
    <Modal
      open={open}
      title={`Agregar procedimiento - Pieza ${fdiLabel(toothNumber)}`}
      onClose={onClose}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
          <option value="">Sin sección</option>
          {plan?.sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </Select>
        <SurfaceSelector value={surface} onChange={onSurfaceChange} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px]">
        <Select value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
          <option value="">Procedimiento</option>
          {procedures.map((procedure) => (
            <option key={procedure.id} value={procedure.id}>
              {procedure.code} - {procedure.name}
            </option>
          ))}
        </Select>
        <Input
          value={quantity}
          type="number"
          min={0.01}
          step={0.01}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Cantidad"
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Input value={unitPrice} type="number" min={0} step={0.01} readOnly placeholder="Precio" />
        <Input
          value={discount}
          type="number"
          min={0}
          max={effectiveMaximumDiscount}
          step={0.01}
          onChange={(event) => setDiscount(event.target.value)}
          disabled={effectiveMaximumDiscount <= 0}
          placeholder="Descuento %"
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p className="text-xs text-slate-500">Total</p>
          <p className="font-semibold text-slate-900">{money(total)}</p>
        </div>
      </div>

      <Textarea
        className="mt-3"
        rows={3}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Diagnóstico o notas clinicas"
      />

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p>
          Arancel:{" "}
          <span className="font-semibold text-slate-900">{priceList?.name ?? "Sin lista activa"}</span>
        </p>
        <div className="mt-2 grid gap-2 border-t border-slate-200 pt-2 sm:grid-cols-3">
          <p>
            Límite usuario: <strong>{userMaximumDiscount.toFixed(2)} %</strong>
          </p>
          <p>
            Límite prestación: <strong>{procedureMaximumDiscount.toFixed(2)} %</strong>
          </p>
          <p>
            Máximo aplicable:{" "}
            <strong className="text-sky-800">{effectiveMaximumDiscount.toFixed(2)} %</strong>
          </p>
        </div>
        {numberValue(discount) > effectiveMaximumDiscount ? (
          <p className="mt-2 text-red-600">
            Descuento solicitado {numberValue(discount).toFixed(2)} %, máximo permitido{" "}
            {effectiveMaximumDiscount.toFixed(2)} %.
          </p>
        ) : null}
        <p>
          Origen precio:{" "}
          <span className="font-semibold text-slate-900">
            {selectedPriceItem ? "Listado vigente" : "Sin precio configurado"}
          </span>
        </p>
        <p>
          Procedimiento:{" "}
          <span className="font-semibold text-slate-900">
            {selectedProcedure ? `${selectedProcedure.code} - ${selectedProcedure.name}` : "No seleccionado"}
          </span>
        </p>
        <p>
          Pieza:{" "}
          <span className="font-semibold text-slate-900">
            {fdiLabel(toothNumber)}
            {surface ? `-${surface}` : " - Pieza completa"}
          </span>
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!procedureId || !toothNumber || numberValue(discount) > effectiveMaximumDiscount}
          onClick={() =>
            void onSave({
              sectionId: sectionId || undefined,
              procedureId,
              toothNumber,
              surface: surface || "ALL",
              quantity: numberValue(quantity) || 1,
              discount: discountAmount,
              notes: notes || undefined
            })
          }
        >
          Guardar en plan y odontograma
        </Button>
      </div>
    </Modal>
  );
}

function SectionModal({
  open,
  nextSortOrder,
  onClose,
  onSave
}: {
  open: boolean;
  nextSortOrder: number;
  onClose: () => void;
  onSave: (payload: { name: string; sortOrder: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(String(nextSortOrder));

  useEffect(() => {
    if (!open) return;
    setName("");
    setSortOrder(String(nextSortOrder));
  }, [nextSortOrder, open]);

  return (
    <Modal open={open} title="Agregar sección" onClose={onClose}>
      <div className="space-y-3">
        <label>
          <span className="text-xs font-semibold text-slate-600">Nombre</span>
          <Input
            className="mt-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Fase inicial, Ortodoncia, Retencion"
          />
        </label>
        <label>
          <span className="text-xs font-semibold text-slate-600">Orden</span>
          <Input
            className="mt-1"
            type="number"
            min={0}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </label>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          El modelo actual de secciones guarda nombre y orden. Descripcion y observacion requieren cambio de
          schema.
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!name.trim()}
          onClick={() => void onSave({ name: name.trim(), sortOrder: numberValue(sortOrder) })}
        >
          Guardar sección
        </Button>
      </div>
    </Modal>
  );
}

function SymbolModal({
  open,
  item,
  selectedSymbol,
  onSymbolChange,
  teeth,
  saving,
  onClose,
  onSave
}: {
  open: boolean;
  item: TreatmentPriceCatalogItem | null;
  selectedSymbol: string;
  onSymbolChange: (val: string) => void;
  teeth: string[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal open={open} title="Información extra" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">
        Este procedimiento requiere especificar un símbolo para el odontograma.
      </p>
      {item && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Procedimiento</label>
            <p className="text-sm text-slate-900 mt-1">
              [{item.procedure.code}] {item.procedure.name}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Pieza afectada</label>
            <p className="text-sm text-slate-900 mt-1">
              {teeth.length ? teeth.map((t) => fdiLabel(t)).join(", ") : "Sin pieza asignada"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Símbolo</label>
            <Select value={selectedSymbol} onChange={(e) => onSymbolChange(e.target.value)} className="mt-2">
              <option value="">Seleccione una opcion</option>
              {ODONTOGRAM_PROCEDURE_SYMBOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={saving || !selectedSymbol} onClick={onSave}>
          {saving ? "Agregando..." : "Cargar al tratamiento"}
        </Button>
      </div>
    </Modal>
  );
}

function CommentModal({
  open,
  onClose,
  onSave
}: {
  open: boolean;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  return (
    <Modal open={open} title="Comentario para el paciente" onClose={onClose}>
      <Textarea
        rows={5}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Escribe el comentario que se usara como referencia del plan."
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!note.trim()} onClick={() => void onSave(note.trim())}>
          Guardar comentario
        </Button>
      </div>
    </Modal>
  );
}
