import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
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
import type { Refund, RefundStatus } from "@/features/payments/services/payments.service";
import { useAgreements } from "@/features/settings/admin-workflows/hooks/use-admin-workflows";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import { usePriceList } from "@/features/settings/price-lists/hooks/use-price-lists";
import type { PriceList, PriceListItem } from "@/features/settings/price-lists/services/price-lists.service";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import type { Procedure } from "@/features/settings/procedures/services/procedures.service";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import { useBranchStore } from "@/stores/branch.store";
import { useOdontogramStore } from "@/stores/odontogram.store";
import { useAddPatientNote, usePatient, useUpdatePatient } from "../hooks/use-patients";
import { PatientSectionPage } from "../components/patient-section-page";
import {
  budgetCatalogCategoryMatchesSearch,
  budgetCatalogItemMatchesSearch,
  buildTreatmentBudgetCatalog
} from "../utils/treatment-budget-catalog";
import {
  useBudgets,
  useTreatmentMutations,
  useTreatmentPlan,
  useTreatmentPlans
} from "@/features/treatments/hooks/use-treatments";
import { ClinicalEvolutionModal } from "../../clinical/components/clinical-evolution-modal";
import type {
  Budget,
  OrthodonticProfilePayload,
  TreatmentPlanDetail,
  TreatmentPlanItem,
  TreatmentPlanItemStatus,
  TreatmentPlanKind,
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

const ORTHODONTIC_PHOTO_CATEGORY = "ORTHODONTIC_PHOTO";
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

const ORTHODONTIC_DIAGNOSIS_GROUPS = [
  {
    title: "Generales y caracteristicas faciales",
    fields: [
      ["chiefComplaint", "Motivo de consulta"],
      ["habits", "Malos habitos"],
      ["handRx", "Rx Mano"],
      ["williamsAsymmetry", "Asimetria de Williams"],
      ["mandibularDeviation", "Desviacion mandibular"],
      ["gingivalExposure", "Exposicion gingival"],
      ["lipSeal", "Cierre labial"],
      ["sagittalFacialClass", "Clase facial sagital"],
      ["lowerThird", "Tercio inferior"],
      ["lipsAndChin", "Labio superior, inferior y menton"]
    ]
  },
  {
    title: "Analisis oclusal y dentario",
    fields: [
      ["dentitionStage", "Etapa de denticion"],
      ["midlines", "Linea media"],
      ["sagittal", "Sagital"],
      ["overjet", "Overjet"],
      ["speeCurve", "Curva de Spee"],
      ["overbite", "Overbite"],
      ["occlusalPlane", "Plano oclusal"],
      ["transverse", "Transversal"]
    ]
  },
  {
    title: "Dentoalveolar y montaje articulador",
    fields: [
      ["dentalDiscrepancy", "Discrepancia dental superior/inferior"],
      ["posteriorDiscrepancy", "Discrepancia posterior"],
      ["boltonIndex", "Indice de Bolton"],
      ["supernumeraryAgenesis", "Supernumerarios / agenesia"],
      ["absentRetained", "Ausentes / retenidos"],
      ["secondThirdMolars", "Segundos y terceros molares"],
      ["traumaFacetsCaries", "Trauma, facetas, caries, otros"],
      ["panoramicRadiograph", "Radiografia panoramica"],
      ["articulatorMounting", "Montaje articulador"]
    ]
  },
  {
    title: "Periodontal, ATM y muscular",
    fields: [
      ["hygiene", "Higiene"],
      ["periodontalBiotype", "Biotipo periodontal"],
      ["recessionsHyperplasia", "Recesiones e hiperplasia gingival"],
      ["frenums", "Frenillos"],
      ["mandibularManipulation", "Manipulacion mandibular"],
      ["atmRightLeft", "ATM derecha/izquierda"],
      ["musclePalpation", "Palpacion muscular"],
      ["openingPattern", "Patron de apertura"]
    ]
  },
  {
    title: "Via aerea, cefalometria y clase esqueletal",
    fields: [
      ["airway", "Via aerea"],
      ["ricketts", "Ricketts"],
      ["jarabak", "Jarabak"],
      ["incisorInclination", "Inclinacion incisiva"],
      ["skeletalClass", "Clase esqueletal"],
      ["verticalFactors", "Vertical"],
      ["transverseFactors", "Transversal"],
      ["otherDeterminants", "Otros factores determinantes"]
    ]
  },
  {
    title: "Notas clinicas",
    fields: [["freeNotes", "Notas libres"]]
  }
] as const;

function numberValue(value?: string | number | null) {
  return Number(value ?? 0) || 0;
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(value);
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

function isKnownSymbolProcedure(procedure: PriceListItem["procedure"]) {
  const text = normalizeCatalogText(`${procedure.code} ${procedure.name}`);
  return text.includes("LIMPIEZA") && text.includes("BLANQUEAMIENTO");
}

function procedureRequiresOdontogramSymbol(procedure: PriceListItem["procedure"]) {
  return procedure.requiresOdontogramSymbol || isKnownSymbolProcedure(procedure);
}

function defaultOdontogramSymbol(procedure: PriceListItem["procedure"]): DiagnosisMark {
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

function itemDiscountPercent(item: TreatmentPlanItem) {
  const base = numberValue(item.quantity) * numberValue(item.unitPrice);
  if (!base) return 0;
  return Math.round((numberValue(item.discount) / base) * 100);
}

function priceForProcedure(priceList: PriceList | null, procedureId: string) {
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
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [refundsModalOpen, setRefundsModalOpen] = useState(false);
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
  const [budgetDrawerAddedItems, setBudgetDrawerAddedItems] = useState(0);
  const [pieceAssignmentItem, setPieceAssignmentItem] = useState<TreatmentPlanItem | null>(null);
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
  const professionalBranchId = patient.data?.branchId ?? activeBranchId;
  const professionals = useProfessionals(undefined, "true", {
    branchId: professionalBranchId || undefined,
    pageSize: 100
  });
  const procedures = useProcedures(undefined, "true");
  const agreementPriceListId = patient.data?.agreement?.priceList?.id ?? "";
  const agreementPriceList = usePriceList(agreementPriceListId);
  const clinicalMutations = useClinicalMutations(id);
  const treatmentMutations = useTreatmentMutations();
  const paymentMutations = usePaymentsMutations();
  const addNote = useAddPatientNote();
  const updatePatient = useUpdatePatient();

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
    console.log("handleSelectTooth called with:", tooth, options);
    storeSelectTooth(tooth, options);
    console.log("plan is:", plan ? "active" : "null");
    if (plan) {
      console.log("Calling openBudgetDrawer...");
      openBudgetDrawer();
    }
  };
  const toothHistory = useToothHistory(id, selectedTooth, selectedSurface || undefined);

  const planList = plans.data ?? [];
  const plan = selectedPlan.data ?? null;
  const totals = useMemo(() => planTotals(plan), [plan]);
  const priceList = agreementPriceList.data ?? null;
  const upcomingAppointments = (appointments.data ?? []).slice(0, 3);
  const latestBudget = (plan?.budgets?.[0] ?? budgets.data?.[0] ?? null) as Budget | null;
  const planHasAgreementLock = Boolean(
    patient.data?.agreement && plan && (plan.items.length || plan.budgets.length || latestBudget)
  );
  const professionalOptions = (professionals.data ?? []).map((professional) => ({
    id: professional.id,
    label: `${professional.firstName} ${professional.lastName}`
  }));
  const actionTeeth = selectedTeeth.length ? selectedTeeth : selectedTooth ? [selectedTooth] : [];

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
            surface: selectedSurface || undefined,
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
    console.log("openBudgetDrawer called. plan:", plan, "priceList:", priceList);
    if (!plan) {
      toast.error("Selecciona o crea un plan de tratamiento.");
      return;
    }
    if (!patient.data?.agreement?.priceList?.id) {
      toast.error("Asigna un convenio con arancel antes de crear presupuesto.");
      setAgreementModalOpen(true);
      return;
    }
    if (agreementPriceList.isLoading) {
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

  const openAgreementPanel = () => {
    if (planHasAgreementLock) {
      setAgreementDetailModalOpen(true);
      return;
    }
    setAgreementModalOpen(true);
  };

  const [symbolModalOpen, setSymbolModalOpen] = useState(false);
  const [pendingSymbolItem, setPendingSymbolItem] = useState<PriceListItem | null>(null);
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

  const requestBudgetCatalogItem = async (item: PriceListItem) => {
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
    item: PriceListItem,
    explicitSymbol?: string,
    selection: CatalogToothSelection = readCurrentCatalogSelection()
  ) => {
    if (!plan) {
      toast.error("Selecciona o crea un plan de tratamiento.");
      return;
    }
    const targetTeeth = selection.teeth.length ? selection.teeth : [undefined];
    const targetSurface = selection.surface;

    if (selection.teeth.length && item.procedure.requiresSurface && !targetSurface) {
      toast.error("Selecciona una superficie para esta prestación.");
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
      } catch (e) {
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
    toast.success(targetTeeth.length > 1 ? "Prestaciones agregadas al plan." : "Prestación agregada al plan.");
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
      status: "PLANNED"
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
      `/patients/${id}/payments?treatmentPlanId=${encodeURIComponent(item.treatmentPlanId)}&itemId=${encodeURIComponent(item.id)}&amount=${pending}`
    );
  };

  const printBudget = async () => {
    if (!latestBudget) {
      toast.error("Primero genera un presupuesto.");
      return;
    }
    const printable = await treatmentMutations.printBudget.mutateAsync(latestBudget.id);
    const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
    if (!win) {
      toast.error("El navegador bloqueo la ventana de impresion.");
      return;
    }
    win.document.write(
      `<pre style="font:14px/1.5 system-ui;white-space:pre-wrap">${printable.printableText ?? ""}</pre>`
    );
    win.document.close();
    win.print();
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
            Selecciona una pieza y agrega productos desde el convenio del paciente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSectionModalOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Seccion
          </Button>
          <Button onClick={openBudgetDrawer}>
            <Stethoscope className="mr-1 h-4 w-4" />
            Procedimiento
          </Button>
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
      onAssignPiece={setPieceAssignmentItem}
      onMarkFuture={(item) => void markItemForFuture(item)}
      onUnrealize={(item) => void unrealizeItem(item)}
      onUnlinkPayment={(item) => void unlinkItemPayment(item)}
      onPay={payItem}
      onCreateSection={() => setSectionModalOpen(true)}
      onOpenProcedureCatalog={openBudgetDrawer}
      onSelectPiece={selectTreatmentItemPiece}
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
                    value={PLAN_STATUS_LABELS[plan.status]}
                    tone={
                      plan.status === "COMPLETED" || plan.status === "ACCEPTED"
                        ? "success"
                        : plan.status === "DRAFT"
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
                <Button variant="secondary" disabled={!latestBudget} onClick={() => void printBudget()}>
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
                  patientAgreementName={patient.data?.agreement?.name}
                  upcomingAppointments={upcomingAppointments}
                  globalPaid={payments.data?.balance.allocatedPaidAmount ?? 0}
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
                      itemsPanel={planItemsPanel}
                      budgetPanel={planBudgetPanel}
                      signaturePanel={planSignaturePanel}
                      savingProfile={treatmentMutations.updateOrthodonticProfile.isPending}
                      savingDiagnosis={treatmentMutations.updateOrthodonticDiagnosis.isPending}
                      generatingMonthlyItems={treatmentMutations.createOrthodonticMonthlyItems.isPending}
                      onSaveProfile={(payload) =>
                        treatmentMutations.updateOrthodonticProfile.mutateAsync({ id: plan.id, payload })
                      }
                      onSaveDiagnosis={(diagnosis) =>
                        treatmentMutations.updateOrthodonticDiagnosis.mutateAsync({ id: plan.id, diagnosis })
                      }
                      onGenerateMonthlyItems={(payload) =>
                        treatmentMutations.createOrthodonticMonthlyItems.mutateAsync({ id: plan.id, payload })
                      }
                      onPause={(reason) =>
                        treatmentMutations.pauseTreatment.mutateAsync({ id: plan.id, reason })
                      }
                      onResume={() => treatmentMutations.resumeTreatment.mutateAsync(plan.id)}
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
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => setSectionModalOpen(true)}>
                              <Plus className="mr-1 h-4 w-4" />
                              Sección
                            </Button>
                            <Button onClick={openBudgetDrawer}>
                              <Stethoscope className="mr-1 h-4 w-4" />
                              Procedimiento
                            </Button>
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

                      <TreatmentItemsTable
                        plan={plan}
                        onAssignPiece={setPieceAssignmentItem}
                        onMarkFuture={(item) => void markItemForFuture(item)}
                        onUnrealize={(item) => void unrealizeItem(item)}
                        onUnlinkPayment={(item) => void unlinkItemPayment(item)}
                        onPay={payItem}
                        onCreateSection={() => setSectionModalOpen(true)}
                        onOpenProcedureCatalog={openBudgetDrawer}
                        onSelectPiece={selectTreatmentItemPiece}
                        onDelete={(itemId) =>
                          treatmentMutations.deleteItem.mutate({ treatmentPlanId: plan.id, itemId })
                        }
                      />

                      <BudgetPanel
                        budget={latestBudget}
                        onSend={(budgetId) => treatmentMutations.sendBudget.mutate(budgetId)}
                        onAccept={(budgetId) => treatmentMutations.acceptBudget.mutate(budgetId)}
                        onCreate={openBudgetDrawer}
                      />

                      <PatientSignaturePanel
                        patientId={id}
                        notes={patient.data?.notes ?? []}
                        onAddComment={() => setCommentModalOpen(true)}
                      />
                    </>
                  )}
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

                    return (
                      <div
                        key={item.id}
                        className="group flex flex-col overflow-hidden transition-all hover:border-sky-300 hover:shadow-md hover:bg-slate-50/80 border border-slate-200 rounded-lg cursor-pointer bg-white"
                        onClick={() => setSelectedPlanId(item.id)}
                      >
                        <div className="p-4 sm:p-5 pointer-events-none">
                          <div className="flex justify-between items-start mb-6 pointer-events-auto">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-sky-600">
                                #{numericCode}: {item.name}
                              </span>
                              <div
                                className="text-sky-600 p-1 hover:bg-sky-50 rounded-md transition-colors"
                                title="Editar plan"
                              >
                                <svg
                                  className="w-4 h-4"
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
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation(); /* Add delete logic */
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-2">
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                                Profesional
                              </div>
                              <div className="flex items-start text-sm text-slate-700">
                                <UserRound className="w-4 h-4 mr-1.5 mt-0.5 text-slate-500 shrink-0" />
                                <span className="leading-tight font-medium">
                                  {item.professional.firstName} {item.professional.lastName}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                                Especialidad
                              </div>
                              <div className="text-sm text-slate-700 font-medium">
                                {displayPlanSpecialty(item)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                                Ultima cita
                              </div>
                              <div className="text-sm text-slate-700 font-medium">Sin sesiones</div>
                            </div>
                            <div className="flex flex-col items-center md:items-start">
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                                (Progreso)
                              </div>
                              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-slate-300 text-xs font-semibold text-slate-500">
                                0%
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                                Estado Financiero
                              </div>
                              <div className="flex items-center text-sm font-bold text-green-700">
                                <UserRound className="w-4 h-4 mr-1 shrink-0" />
                                {PLAN_STATUS_LABELS[item.status]}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-medium text-slate-500">
                            Presupuesto vacío
                          </div>
                        </div>
                      </div>
                    );
                  };

                  const inProgress = planList.filter((p) => p.status === "IN_PROGRESS");
                  const others = planList.filter((p) => p.status !== "IN_PROGRESS");

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
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

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

      <SectionModal
        open={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        onSave={async (name) => {
          if (!plan) return;
          await treatmentMutations.addSection.mutateAsync({ treatmentPlanId: plan.id, name });
          setSectionModalOpen(false);
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
        currentAgreementId={patient.data?.agreement?.id}
        currentAgreement={patient.data?.agreement ?? null}
        plan={plan}
        onClose={() => setAgreementModalOpen(false)}
        onAssign={assignAgreement}
        saving={updatePatient.isPending}
      />

      <AgreementDetailModal
        open={agreementDetailModalOpen}
        agreement={patient.data?.agreement ?? null}
        onClose={() => setAgreementDetailModalOpen(false)}
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
  globalPaid,
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
  globalPaid: number;
  onOpenAgreement: () => void;
  onOpenBranch: () => void;
  onOpenRefunds: () => void;
}) {
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
          <p className="mt-1 text-center text-2xl font-semibold text-[#0879d5]">{money(totals.total)}</p>
          <div className="mt-4 space-y-2 text-xs">
            <SummaryLine label="Subtotal" value={money(totals.subtotal)} />
            <SummaryLine label="Descuento" value={money(totals.discount)} />
            <SummaryLine label="Realizado" value={money(totals.completed)} />
            <SummaryLine label="Abonado al plan" value={money(totals.paid)} />
            <SummaryLine label="Abonos del paciente" value={money(globalPaid)} />
            <SummaryLine label="Saldo por abonar" value={money(totals.balance)} strong />
          </div>
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

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dotted border-slate-200 pb-1">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-bold text-slate-950" : "font-medium text-slate-700"}>{value}</span>
    </div>
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

function OrthodonticPlanWorkspace({
  patientId,
  plan,
  procedures,
  odontogramPanel,
  itemsPanel,
  budgetPanel,
  signaturePanel,
  savingProfile,
  savingDiagnosis,
  generatingMonthlyItems,
  onSaveProfile,
  onSaveDiagnosis,
  onGenerateMonthlyItems,
  onPause,
  onResume
}: {
  patientId: string;
  plan: TreatmentPlanDetail;
  procedures: Procedure[];
  odontogramPanel: ReactNode;
  itemsPanel: ReactNode;
  budgetPanel: ReactNode;
  signaturePanel: ReactNode;
  savingProfile: boolean;
  savingDiagnosis: boolean;
  generatingMonthlyItems: boolean;
  onSaveProfile: (payload: OrthodonticProfilePayload) => Promise<unknown>;
  onSaveDiagnosis: (diagnosis: Record<string, unknown>) => Promise<unknown>;
  onGenerateMonthlyItems: (payload: {
    procedureId: string;
    months: number;
    unitPrice?: number;
    startDate?: string;
    sectionName?: string;
    notes?: string;
  }) => Promise<unknown>;
  onPause: (reason?: string) => Promise<unknown>;
  onResume: () => Promise<unknown>;
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    startDate: "",
    estimatedMonths: "",
    estimatedControls: "",
    lastUpperArch: "",
    lastLowerArch: "",
    nextControlAt: "",
    nextRadiographyAt: "",
    hygieneStatus: "",
    alert: "",
    indications: "",
    elastics: "",
    planNotes: ""
  });
  const [diagnosisForm, setDiagnosisForm] = useState<Record<string, string>>({});
  const [monthlyForm, setMonthlyForm] = useState({
    procedureId: "",
    months: "12",
    unitPrice: "",
    startDate: "",
    notes: ""
  });
  const photoFiles = usePatientFiles(patientId, ORTHODONTIC_PHOTO_CATEGORY, plan.id);
  const rxFiles = usePatientFiles(patientId, ORTHODONTIC_RX_CATEGORY, plan.id);
  const documentMutations = useDocumentsMutations();
  const summary = plan.orthodonticSummary;
  const latestEvolution = summary?.latestEvolution;
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  useEffect(() => {
    const profile = plan.orthodonticProfile;
    setProfileForm({
      startDate: dateInputValue(profile?.startDate),
      estimatedMonths: profile?.estimatedMonths ? String(profile.estimatedMonths) : "",
      estimatedControls: profile?.estimatedControls ? String(profile.estimatedControls) : "",
      lastUpperArch: profile?.lastUpperArch ?? "",
      lastLowerArch: profile?.lastLowerArch ?? "",
      nextControlAt: dateTimeInputValue(profile?.nextControlAt),
      nextRadiographyAt: dateTimeInputValue(profile?.nextRadiographyAt),
      hygieneStatus: profile?.hygieneStatus ?? "",
      alert: profile?.alert ?? "",
      indications: profile?.indications ?? "",
      elastics: profile?.elastics ?? "",
      planNotes: profile?.planNotes ?? ""
    });

    const diagnosis = (profile?.diagnosis ?? {}) as Record<string, unknown>;
    const nextDiagnosis: Record<string, string> = {};
    for (const group of ORTHODONTIC_DIAGNOSIS_GROUPS) {
      for (const [key] of group.fields) nextDiagnosis[key] = String(diagnosis[key] ?? "");
    }
    setDiagnosisForm(nextDiagnosis);
    setMonthlyForm((current) => ({ ...current, startDate: dateInputValue(profile?.startDate) }));
  }, [plan.id, plan.orthodonticProfile]);

  const updateProfileField = (field: keyof typeof profileForm, value: string) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async () => {
    await onSaveProfile({
      startDate: profileForm.startDate || null,
      estimatedMonths: profileForm.estimatedMonths ? Number(profileForm.estimatedMonths) : null,
      estimatedControls: profileForm.estimatedControls ? Number(profileForm.estimatedControls) : null,
      lastUpperArch: profileForm.lastUpperArch || null,
      lastLowerArch: profileForm.lastLowerArch || null,
      nextControlAt: profileForm.nextControlAt ? new Date(profileForm.nextControlAt).toISOString() : null,
      nextRadiographyAt: profileForm.nextRadiographyAt
        ? new Date(profileForm.nextRadiographyAt).toISOString()
        : null,
      hygieneStatus: profileForm.hygieneStatus || null,
      alert: profileForm.alert || null,
      indications: profileForm.indications || null,
      elastics: profileForm.elastics || null,
      planNotes: profileForm.planNotes || null
    });
    toast.success("Perfil de ortodoncia guardado.");
  };

  const saveDiagnosis = async () => {
    await onSaveDiagnosis(diagnosisForm);
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

  // Determine if there's a delay for the real progress
  // Calendar vs Real
  const calendarProgress = summary?.calendarProgress ?? 0;
  const realProgress = summary?.realProgress ?? 0;
  const isDelayed = realProgress < calendarProgress - 15;
  const estimatedMonths = numberValue(profileForm.estimatedMonths);
  const plannedControls =
    summary?.estimatedControls || numberValue(profileForm.estimatedControls) || estimatedMonths;
  const elapsedMonths = estimatedMonths
    ? Math.min(estimatedMonths, Math.max(0, Math.round((calendarProgress / 100) * estimatedMonths)))
    : 0;
  const realControlsCount = summary?.realControlsCount ?? 0;
  const nextControlLabel = profileForm.nextControlAt
    ? formatDateTime(profileForm.nextControlAt)
    : "Sin fecha";
  const nextRxLabel = profileForm.nextRadiographyAt ? formatDate(profileForm.nextRadiographyAt) : "Sin fecha";
  const latestEvolutionText =
    clinicalPlainText(latestEvolution?.notes) ||
    clinicalPlainText(latestEvolution?.assessment) ||
    clinicalPlainText(latestEvolution?.objective) ||
    clinicalPlainText(latestEvolution?.plan) ||
    "";

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

          <div className="mb-2 ml-auto flex items-center gap-4 text-slate-500">
            <button className="flex items-center hover:text-slate-800">
              <DollarSign className="h-4 w-4" />
              <ChevronDown className="ml-1 h-3 w-3" />
            </button>
            <button className="flex items-center hover:text-slate-800">
              <Settings className="h-4 w-4" />
              <ChevronDown className="ml-1 h-3 w-3" />
            </button>
            <button className="flex items-center hover:text-slate-800">
              <Printer className="h-4 w-4" />
              <ChevronDown className="ml-1 h-3 w-3" />
            </button>
            <button className="flex items-center hover:text-slate-800">
              <Send className="h-4 w-4" />
              <ChevronDown className="ml-1 h-3 w-3" />
            </button>
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
                  onClick={() => setActiveTab(value)}
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
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">
                    {summary?.isPaused ? "Tratamiento pausado" : "Tratamiento activo"}
                  </h3>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">
                    {summary?.isPaused && summary.pauseStartDate
                      ? `Pausado desde ${formatDateTime(summary.pauseStartDate)}`
                      : "Ficha longitudinal para controles, arcos, higiene, alertas y evolucion mas reciente."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-sky-300 bg-white"
                    onClick={() => setActiveTab("plan")}
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
                        <p className="text-xs font-bold uppercase text-slate-500">Progreso calendario</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {estimatedMonths ? `${elapsedMonths} de ${estimatedMonths} meses` : "Sin duracion"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Inicio: {formatDate(profileForm.startDate)}
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
                        <p className="text-xs font-bold uppercase text-slate-500">Progreso real</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {plannedControls
                            ? `${realControlsCount} de ${plannedControls} controles`
                            : `${realControlsCount} controles`}
                        </p>
                        <p
                          className={`mt-1 text-xs font-medium ${isDelayed ? "text-amber-700" : "text-emerald-700"}`}
                        >
                          {isDelayed ? "Requiere revision" : "Evolucion al dia"}
                        </p>
                      </div>
                      <ProgressDonut
                        percentage={realProgress}
                        size={104}
                        strokeWidth={10}
                        label={`${Math.round(realProgress)}%`}
                        subLabel="Real"
                        color={isDelayed ? "text-amber-500" : "text-emerald-500"}
                        isAlert={isDelayed}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${summary?.isPaused ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}
                    >
                      {summary?.isPaused ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase text-slate-500">Estado operativo</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {summary?.isPaused ? "Pausado" : "Activo"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {summary?.isPaused && summary.pauseStartDate
                          ? formatDateTime(summary.pauseStartDate)
                          : "Calendario corriendo"}
                      </p>
                    </div>
                    {summary?.isPaused ? (
                      <Button variant="secondary" size="sm" className="bg-white" onClick={handleResume}>
                        <Play className="h-4 w-4" />
                        Reanudar
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowPauseModal(true)}
                      >
                        <Pause className="h-4 w-4" />
                        Pausar
                      </Button>
                    )}
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
                value={profileForm.hygieneStatus || "Sin registro"}
                detail="Dato clinico del ultimo control"
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

            <div className="grid gap-3 md:grid-cols-2">
              <SummaryPanel title="Arcos y alertas">
                <SummaryLine label="Ultimo arco superior" value={profileForm.lastUpperArch || "-"} />
                <SummaryLine label="Ultimo arco inferior" value={profileForm.lastLowerArch || "-"} />
                <SummaryLine label="Elasticos" value={profileForm.elastics || "-"} />
                <SummaryLine label="Alerta" value={profileForm.alert || "-"} />
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
                    to={`/patients/${patientId}/clinical/evolutions?treatmentPlanId=${encodeURIComponent(plan.id)}`}
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
                  {profileForm.indications || "Sin indicaciones registradas."}
                </p>
              </SummaryPanel>
              <SummaryPanel title="Alerta clinica">
                <div
                  className={`flex items-start gap-3 rounded-md border p-3 ${profileForm.alert ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm leading-6">{profileForm.alert || "Sin alertas activas."}</p>
                </div>
              </SummaryPanel>
            </div>
          </div>
        ) : null}

        {activeTab === "diagnosis" ? (
          <div className="space-y-4 p-4">
            {ORTHODONTIC_DIAGNOSIS_GROUPS.map((group) => (
              <div key={group.title} className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {group.fields.map(([key, label]) => (
                    <label key={key} className={key === "freeNotes" ? "md:col-span-2" : ""}>
                      <span className="text-xs font-semibold text-slate-600">{label}</span>
                      <Textarea
                        className="mt-1"
                        rows={key === "freeNotes" ? 4 : 2}
                        value={diagnosisForm[key] ?? ""}
                        onChange={(event) =>
                          setDiagnosisForm((current) => ({ ...current, [key]: event.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button disabled={savingDiagnosis} onClick={() => void saveDiagnosis()}>
                <Save className="mr-1 h-4 w-4" />
                Guardar diagnostico
              </Button>
            </div>
          </div>
        ) : null}

        {activeTab === "photos" ? (
          <PlanFilesPanel
            title="Plantilla fotografica"
            icon={<Camera className="h-4 w-4" />}
            files={photoFiles.data ?? []}
            loading={photoFiles.isLoading}
            uploading={documentMutations.uploadPatientBinaryFile.isPending}
            accept="image/*"
            onUpload={(file) => uploadFile(file, ORTHODONTIC_PHOTO_CATEGORY)}
          />
        ) : null}

        {activeTab === "plan" ? (
          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label>
                <span className="text-xs font-semibold text-slate-600">Fecha inicio</span>
                <Input
                  className="mt-1"
                  type="date"
                  value={profileForm.startDate}
                  onChange={(event) => updateProfileField("startDate", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Meses estimados</span>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={profileForm.estimatedMonths}
                  onChange={(event) => updateProfileField("estimatedMonths", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Controles estimados</span>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={profileForm.estimatedControls}
                  onChange={(event) => updateProfileField("estimatedControls", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Proximo control</span>
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={profileForm.nextControlAt}
                  onChange={(event) => updateProfileField("nextControlAt", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Proxima Rx/Cf</span>
                <Input
                  className="mt-1"
                  type="datetime-local"
                  value={profileForm.nextRadiographyAt}
                  onChange={(event) => updateProfileField("nextRadiographyAt", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Ultimo arco superior</span>
                <Input
                  className="mt-1"
                  value={profileForm.lastUpperArch}
                  onChange={(event) => updateProfileField("lastUpperArch", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Ultimo arco inferior</span>
                <Input
                  className="mt-1"
                  value={profileForm.lastLowerArch}
                  onChange={(event) => updateProfileField("lastLowerArch", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Higiene</span>
                <Input
                  className="mt-1"
                  value={profileForm.hygieneStatus}
                  onChange={(event) => updateProfileField("hygieneStatus", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Elasticos</span>
                <Input
                  className="mt-1"
                  value={profileForm.elastics}
                  onChange={(event) => updateProfileField("elastics", event.target.value)}
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-slate-600">Alerta</span>
                <Input
                  className="mt-1"
                  value={profileForm.alert}
                  onChange={(event) => updateProfileField("alert", event.target.value)}
                />
              </label>
              <label className="md:col-span-4">
                <span className="text-xs font-semibold text-slate-600">Indicaciones</span>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={profileForm.indications}
                  onChange={(event) => updateProfileField("indications", event.target.value)}
                />
              </label>
              <label className="md:col-span-4">
                <span className="text-xs font-semibold text-slate-600">Notas del plan</span>
                <Textarea
                  className="mt-1"
                  rows={3}
                  value={profileForm.planNotes}
                  onChange={(event) => updateProfileField("planNotes", event.target.value)}
                />
              </label>
            </div>
            <div className="flex justify-end">
              <Button disabled={savingProfile} onClick={() => void saveProfile()}>
                <Save className="mr-1 h-4 w-4" />
                Guardar plan
              </Button>
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

            {itemsPanel}
            {budgetPanel}
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

        {activeTab === "odontogram" ? (
          <div className="space-y-4 p-4">
            {odontogramPanel}
            {itemsPanel}
            {budgetPanel}
            {signaturePanel}
          </div>
        ) : null}
      </section>
      
      <ClinicalEvolutionModal
        patientId={patientId}
        branchId={plan.branch.id}
        open={isEvolutionModalOpen}
        onClose={() => setIsEvolutionModalOpen(false)}
      />
    </div>
  );
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

type PatientAgreementOption = {
  id: string;
  name: string;
  discountPercent?: string | number | null;
  priceList?: { id: string; name: string; isDefault?: boolean | null } | null;
};

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
                  {agreement.name}{agreement.priceList ? ` — ${agreement.priceList.name}` : " (Sin listado)"}
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
  onAssignPiece,
  onMarkFuture,
  onUnrealize,
  onUnlinkPayment,
  onPay,
  onCreateSection,
  onOpenProcedureCatalog,
  onSelectPiece,
  onDelete
}: {
  plan: TreatmentPlanDetail;
  onAssignPiece: (item: TreatmentPlanItem) => void;
  onMarkFuture: (item: TreatmentPlanItem) => void;
  onUnrealize: (item: TreatmentPlanItem) => void;
  onUnlinkPayment: (item: TreatmentPlanItem) => void;
  onPay: (item: TreatmentPlanItem) => void;
  onCreateSection: () => void;
  onOpenProcedureCatalog: () => void;
  onSelectPiece: (item: TreatmentPlanItem) => void;
  onDelete: (itemId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);

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
              {plan.items.length} procedimientos asociados al odontograma y presupuesto.
            </p>
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
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setActionsOpen((current) => !current)}>
                Acciones
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
              {actionsOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded border border-slate-200 bg-white py-1 text-sm shadow-lg">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                    onClick={() => setActionsOpen(false)}
                  >
                    Establecer descuentos multiples
                  </button>
                </div>
              ) : null}
            </div>
          </div>
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
                    className="grid w-full grid-cols-[42px_minmax(180px,1fr)_80px_70px_88px_82px_44px_38px] items-center gap-3 px-4 py-3 text-left"
                    onClick={selectAndToggle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") selectAndToggle();
                    }}
                  >
                    <span
                      className={`h-6 w-6 rounded-full border-4 ${expanded ? "border-sky-500 bg-white" : "border-slate-300 bg-white"}`}
                      aria-hidden="true"
                    />
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
                          {surfaceDetail ? <span className="mt-0.5 text-[9px] font-medium">{surfaceDetail}</span> : null}
                        </span>
                      </button>
                    </span>

                    <span className="text-center text-sm font-medium text-slate-900">
                      {itemDiscountPercent(item)}%
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
                            window.location.href = `/patients/${window.location.pathname.split("/")[2]}/clinical/evolutions?treatmentPlanItemId=${item.id}`;
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
        <div className="px-4 py-10 text-center text-slate-500">
          Agrega procedimientos desde el catalogo o crea secciones para construir el plan.
        </div>
      )}
    </section>
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

function BudgetProcedureDrawer({
  open,
  plan,
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
  priceList: PriceList | null;
  selectedTooth: string;
  selectedSurface: string;
  addedItemsCount: number;
  addingItem: boolean;
  creatingBudget: boolean;
  onClose: () => void;
  onAddItem: (item: PriceListItem) => Promise<void>;
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
  const planItemCount = Math.max(plan?.items.length ?? 0, addedItemsCount);
  const canCreateBudget = Boolean(planItemCount);
  const selectedPieceLabel = selectedTooth
    ? `Pieza ${fdiLabel(selectedTooth)}${selectedSurface ? ` - Cara ${surfaceLabel(selectedSurface).toLowerCase()}` : ""}`
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
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-procedure-drawer-title"
        className="relative z-10 flex h-full w-full max-w-[780px] flex-col bg-white shadow-2xl"
      >
        <header className="flex h-[70px] shrink-0 items-center justify-between bg-red-600 px-5 text-white">
          <div className="flex min-w-0 items-center gap-3">
            {selectedCategory ? (
              <button
                type="button"
                aria-label="Volver a categorias"
                className="rounded p-1.5 transition hover:bg-white/10"
                onClick={() => setCategoryId("")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <Receipt className="h-5 w-5 shrink-0" />
            )}
            <div className="min-w-0">
              <h2 id="budget-procedure-drawer-title" className="truncate text-base font-semibold">
                {drawerTitle}
              </h2>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            className="rounded p-2 text-white/85 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="relative shrink-0 border-b border-slate-200">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-14 rounded-none border-0 pl-12 text-sm shadow-none focus:border-transparent focus:ring-0"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              selectedCategory ? "Buscar prestaciónes..." : "Buscar categorias, prestaciónes, plantillas"
            }
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedCategory ? (
            <div>
              {filteredItems.length ? (
                <div className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase text-slate-400">
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
                        <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                          {item.procedure.name}
                        </p>
                        {item.procedure.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {item.procedure.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="whitespace-nowrap text-right text-sm font-semibold text-slate-900">
                        {money(numberValue(item.price))}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center rounded bg-green-600 px-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-60"
                        disabled={addingItem}
                        onClick={() => void onAddItem(item)}
                      >
                        <Plus className="h-4 w-4" />
                        Cargar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  {selectedCategory.items.length
                    ? "No hay productos con ese filtro en esta categoria."
                    : "Esta categoria del arancel no tiene productos configurados."}
                </div>
              )}
            </div>
          ) : catalog.length ? (
            <div className="divide-y divide-slate-100">
              {filteredCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-50"
                  onClick={() => setCategoryId(category.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{category.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {category.items.length
                        ? `${category.items.length} productos`
                        : "Sin productos configurados"}
                      {category.description ? ` - ${category.description}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </button>
              ))}
              {!filteredCategories.length ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  No hay categorias con ese filtro.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <FolderOpen className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Sin categorias en el convenio</p>
                <p className="mt-1 text-xs text-slate-500">
                  Configura categorias en el catalogo asociado al convenio para navegar productos desde aqui.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Piezas seleccionadas</p>
              <p className="truncate text-base font-medium text-slate-800">{selectedPieceLabel}</p>
              <p className="mt-1 text-xs text-slate-500">Prestaciónes en el plan: {planItemCount}</p>
            </div>
            <Button disabled={!canCreateBudget || creatingBudget} onClick={() => void onCreateBudget()}>
              <Receipt className="mr-1 h-4 w-4" />
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
          <Link to={`/patients/${patientId}/clinical/consents`}>
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
  priceList: PriceList | null;
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
  const total = Math.max(numberValue(quantity) * numberValue(unitPrice) - numberValue(discount), 0);

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
          step={0.01}
          onChange={(event) => setDiscount(event.target.value)}
          placeholder="Descuento"
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
            {surface ? `-${surface}` : ""}
          </span>
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!procedureId || !toothNumber}
          onClick={() =>
            void onSave({
              sectionId: sectionId || undefined,
              procedureId,
              toothNumber,
              surface: surface || undefined,
              quantity: numberValue(quantity) || 1,
              discount: numberValue(discount),
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
  onClose,
  onSave
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  return (
    <Modal open={open} title="Agregar sección" onClose={onClose}>
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ej. Fase diagnostica, Endodoncia, Protesis"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!name.trim()} onClick={() => void onSave(name.trim())}>
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
  item: PriceListItem | null;
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
            <Select
              value={selectedSymbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              className="mt-2"
            >
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
