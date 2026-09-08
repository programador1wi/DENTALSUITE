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
import { ClinicalEvolutionModal } from "@/features/clinical/components/clinical-evolution-modal";

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
import { FinancingModal } from "@/features/treatments/components/financing-modal";
import { PayrollDiscountModal } from "@/features/treatments/components/payroll-discount-modal";
import { RefundsModal } from "@/features/treatments/components/refunds-modal";
import {
  BulkDiscountModal,
  isBulkDiscountEligible,
  itemDiscountBase,
  itemPaidAmount
} from "@/features/treatments/components/bulk-discount-modal";
import { TreatmentRepriceModal } from "@/features/treatments/components/treatment-reprice-modal";
import { BudgetPanel } from "@/features/treatments/components/budget-panel";
import {
  AgreementAssignmentModal,
  AgreementDetailModal,
  resolveEffectiveTreatmentAgreement,
  type PatientAgreementOption
} from "@/features/treatments/components/treatment-agreements-modals";
import { BranchChangeModal } from "@/features/treatments/components/branch-change-modal";
import { FutureAppointmentsModal } from "@/features/treatments/components/future-appointments-modal";
import { PieceAssignmentModal } from "@/features/treatments/components/piece-assignment-modal";
import { BudgetProcedureDrawer } from "@/features/treatments/components/budget-procedure-drawer";
import {
  PlanProcedureModal,
  SectionModal,
  SymbolModal,
  CommentModal
} from "@/features/treatments/components/plan-procedure-modals";
import { OrthodonticPlanWorkspace } from "@/features/treatments/components/orthodontic-plan-workspace";
import {
  NewTreatmentPlanModal,
  PLAN_KIND_LABELS
} from "@/features/treatments/components/new-treatment-plan-modal";
import { TreatmentPlanCardsList } from "@/features/treatments/components/treatment-plan-cards-list";
import { PlanSidebar } from "@/features/treatments/components/plan-sidebar";
import {
  TreatmentItemsTable,
  PRICE_SOURCE_LABELS,
  ITEM_STATUS_LABELS,
  planClinicalProgressPercentage
} from "@/features/treatments/components/treatment-items-table";
import { PatientSignaturePanel } from "@/features/treatments/components/patient-signature-panel";
import {
  FDI_PERMANENT_TEETH,
  FDI_TEMPORAL_TEETH,
  PIECE_SURFACES,
  PLAN_CLINICAL_STATUS_LABELS,
  addInstallmentPeriod,
  collectDisabledReason,
  dateInputValue,
  displayPlanSpecialty,
  fdiLabel,
  financeableAmount,
  financingDisabledReason,
  finiteNumberValue,
  formatDate,
  formatDateTime,
  isKnownSymbolProcedure,
  money,
  normalizeCatalogText,
  numberValue,
  numericId,
  payrollDiscountDisabledReason,
  planClinicalStatus,
  planHasFinancialDebt,
  planTotals,
  procedureRequiresOdontogramSymbol,
  progressPercentageValue,
  roundMoney,
  splitAmount,
  surfaceLabel,
  surfaceValues,
  todayInputValue,
  treatmentPlanStatusLabel
} from "@/features/treatments/components/treatment-modal-helpers";
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
  useTreatmentPlanProcedures,
  useTreatmentPlanPriceCatalog,
  useTreatmentMutations,
  useTreatmentPlan,
  useTreatmentPlanPrintOptions,
  useTreatmentPlans
} from "@/features/treatments/hooks/use-treatments";
import type {
  Budget,
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


function defaultOdontogramSymbol(procedure: TreatmentPriceCatalogItem["procedure"]): DiagnosisMark {
  return getDiagnosisMark(procedure.defaultOdontogramSymbol) ?? "other";
}

type CatalogToothSelection = {
  teeth: string[];
  surface: string;
};




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
  const canCreateFinancing = hasPermission("installments.create") || hasPermission("organization.manage_all");
  const canCollectPayment = hasPermission("payments.create") || hasPermission("organization.manage_all");
  const canUsePayrollDiscount =
    (hasPermission("agreements.payments.create") ||
      hasPermission("settings.update") ||
      hasPermission("organization.manage_all")) &&
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
      payload: {
        agreementId,
        expectedVersion: patient.data?.version
      }
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
        hasPermission("organization.manage_all")
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
                        hasPermission("orthodontic_catalogs.manage") || hasPermission("organization.manage_all")
                      }
                      canManageOrthodonticDiagnosisCatalogs={
                        hasPermission("orthodontic_diagnosis.catalogs.manage") ||
                        hasPermission("organization.manage_all")
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
          <TreatmentPlanCardsList
            planList={planList}
            onSelectPlan={setSelectedPlanId}
            onOpenCreatePlan={openCreatePlan}
            creatingPlan={treatmentMutations.createTreatmentPlan.isPending}
          />
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
