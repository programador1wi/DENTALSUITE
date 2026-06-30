import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileText,
  FolderOpen,
  GripVertical,
  Link2Off,
  MessageSquarePlus,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Send,
  ShoppingCart,
  Stethoscope,
  Trash2,
  UserCircle,
  UserRound,
  X
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
import { OdontogramView } from "@/features/clinical/components/odontogram-view";
import { SurfaceSelector } from "@/features/clinical/components/surface-selector";
import { MultipleToothSelectionModal, ToothInformationModal } from "@/features/clinical/components/tooth-action-modals";
import { ToothDiagnosisModal as DiagnosisModal, ToothDiagnosisPickerWindow } from "@/features/clinical/components/tooth-diagnosis-modal";
import { useClinicalAppointmentHistory, useClinicalMutations, useOdontogram, useToothHistory } from "@/features/clinical/hooks/use-clinical";
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
import { useBudgets, useTreatmentMutations, useTreatmentPlan, useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import type {
  Budget,
  TreatmentPlanDetail,
  TreatmentPlanItem,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus
} from "@/features/treatments/services/treatments.service";

function numericId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 1000000).toString().padStart(6, "0");
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

const FDI_TEMPORAL_TEETH = ["55", "54", "53", "52", "51", "61", "62", "63", "64", "65", "85", "84", "83", "82", "81", "71", "72", "73", "74", "75"];

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

function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

function fdiLabel(value?: string | null) {
  if (!value) return "-";
  return value.length >= 2 ? `${value[0]}.${value[1]}` : value;
}

function surfaceValues(value?: string | null) {
  if (!value || value === "ALL") return [];
  if (value.includes(",")) return value.split(",").map((part) => part.trim()).filter(Boolean);
  return [value];
}

function surfaceLabel(value?: string | null) {
  const values = surfaceValues(value);
  if (!values.length) return "";
  return values
    .map((surface) => PIECE_SURFACES.find((item) => item.code === surface)?.label ?? surface)
    .join(", ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function itemPaidAmount(item: TreatmentPlanItem) {
  return (item.paymentAllocations ?? []).reduce((sum, allocation) => sum + numberValue(allocation.amount), 0);
}

function planTotals(plan?: TreatmentPlanDetail | null) {
  const items = plan?.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + numberValue(item.quantity) * numberValue(item.unitPrice), 0);
  const discount = items.reduce((sum, item) => sum + numberValue(item.discount), 0);
  const total = items.reduce((sum, item) => sum + numberValue(item.total), 0);
  const paid = items.reduce((sum, item) => sum + itemPaidAmount(item), 0);
  const completed = items.filter((item) => item.status === "COMPLETED").reduce((sum, item) => sum + numberValue(item.total), 0);
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
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [agreementDetailModalOpen, setAgreementDetailModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
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
  const selectTooth = useOdontogramStore((state) => state.selectTooth);
  const setSelectedSurface = useOdontogramStore((state) => state.setSelectedSurface);
  const setActiveTool = useOdontogramStore((state) => state.setActiveTool);
  const openOdontogramModal = useOdontogramStore((state) => state.openModal);
  const closeOdontogramModal = useOdontogramStore((state) => state.closeModal);
  const resetWorkspace = useOdontogramStore((state) => state.resetWorkspace);
  const toothHistory = useToothHistory(id, selectedTooth);

  const planList = plans.data ?? [];
  const plan = selectedPlan.data ?? null;
  const totals = useMemo(() => planTotals(plan), [plan]);
  const priceList = agreementPriceList.data ?? null;
  const upcomingAppointments = (appointments.data ?? []).slice(0, 3);
  const latestBudget = (plan?.budgets?.[0] ?? budgets.data?.[0] ?? null) as Budget | null;
  const planHasAgreementLock = Boolean(patient.data?.agreement && plan && (plan.items.length || plan.budgets.length || latestBudget));
  const professionalOptions = (professionals.data ?? []).map((professional) => ({
    id: professional.id,
    label: `${professional.firstName} ${professional.lastName}`
  }));
  const actionTeeth = selectedTeeth.length ? selectedTeeth : selectedTooth ? [selectedTooth] : [];

  useEffect(() => {
    resetWorkspace();
  }, [id, resetWorkspace]);

  // No auto-selection on load, user must select a plan card manually.

  const createPlan = async () => {
    const patientRow = patient.data;
    const professional = professionals.data?.[0];
    if (!patientRow || !professional) {
      toast.error("Necesitas un paciente y al menos un profesional activo.");
      return;
    }

    const created = await treatmentMutations.createTreatmentPlan.mutateAsync({
      branchId: patientRow.branchId,
      patientId: id,
      professionalId: professional.id,
      name: `Plan de tratamiento ${planList.length + 1}`,
      description: "Plan clinico creado desde odontograma",
      status: "DRAFT"
    });
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
      toast.success(actionTeeth.length > 1 ? `Diagnóstico agregado a ${actionTeeth.length} piezas.` : "Diagnóstico agregado al odontograma.");
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

  const addBudgetCatalogItem = async (item: PriceListItem) => {
    if (!plan) {
      toast.error("Selecciona o crea un plan de tratamiento.");
      return;
    }
    if (item.procedure.requiresTooth && !selectedTooth) {
      toast.error("Selecciona una pieza dental para esta prestación.");
      return;
    }
    if (item.procedure.requiresSurface && !selectedSurface) {
      toast.error("Selecciona una superficie para esta prestación.");
      return;
    }

    await treatmentMutations.addItem.mutateAsync({
      treatmentPlanId: plan.id,
      payload: {
        procedureId: item.procedureId,
        toothNumber: item.procedure.requiresTooth ? selectedTooth : undefined,
        surface: item.procedure.requiresSurface ? selectedSurface : undefined,
        quantity: 1,
        unitPrice: numberValue(item.price),
        discount: 0,
        syncOdontogram: Boolean(item.procedure.requiresTooth && selectedTooth)
      }
    });
    setBudgetDrawerAddedItems((count) => count + 1);
    toast.success("Prestación agregada al plan.");
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
    setPieceAssignmentItem(null);
    toast.success("Pieza asignada a la prestación.");
  };

  const markItemForFuture = async (item: TreatmentPlanItem) => {
    if (!plan) return;
    const marked = Boolean(item.plannedAt);
    await treatmentMutations.updateItem.mutateAsync({
      treatmentPlanId: plan.id,
      itemId: item.id,
      payload: { plannedAt: marked ? null : new Date().toISOString() }
    });
    toast.success(marked ? "Prestación desmarcada para futura realizacion." : "Prestación marcada para futura realizacion.");
  };

  const unrealizeItem = async (item: TreatmentPlanItem) => {
    if (!plan) return;
    await treatmentMutations.updateItemStatus.mutateAsync({ treatmentPlanId: plan.id, itemId: item.id, status: "PLANNED" });
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
    navigate(`/patients/${id}/payments?treatmentPlanId=${encodeURIComponent(item.treatmentPlanId)}&itemId=${encodeURIComponent(item.id)}&amount=${pending}`);
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
    win.document.write(`<pre style="font:14px/1.5 system-ui;white-space:pre-wrap">${printable.printableText ?? ""}</pre>`);
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

  if (patient.isLoading || plans.isLoading) return <LoadingState message="Cargando planes de tratamiento..." />;
  if (patient.isError) return <ErrorState message={patient.error.message} />;
  if (plans.isError) return <ErrorState message={plans.error.message} />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - Tratamientos" description="Plan clinico, odontograma, precios y presupuesto." hideSubnav={!!selectedPlanId}>
      <div className="space-y-4">
        {selectedPlanId ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm mb-4">
              <div className="flex min-w-0 flex-wrap items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlanId("")} className="text-slate-500 hover:text-slate-800 -ml-2">
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Volver a planes
                </Button>
                <div className="h-6 w-px bg-slate-200 hidden md:block" />
                <span className="text-sm font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-[300px]" title={plan?.name}>{plan?.name}</span>
                {plan ? <Badge value={PLAN_STATUS_LABELS[plan.status]} tone={plan.status === "COMPLETED" || plan.status === "ACCEPTED" ? "success" : plan.status === "DRAFT" ? "default" : "warning"} /> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void createPlan()} disabled={treatmentMutations.createTreatmentPlan.isPending}>
                  <Plus className="mr-1 h-4 w-4" />
                  Nuevo plan
                </Button>
                <Button variant="secondary" disabled={!plan || treatmentMutations.createBudget.isPending} onClick={openBudgetDrawer}>
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
                    <Button onClick={openProcedureModal}>
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
                    onSelectTooth={selectTooth}
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

              <TreatmentItemsTable
                plan={plan}
                onAssignPiece={setPieceAssignmentItem}
                onMarkFuture={(item) => void markItemForFuture(item)}
                onUnrealize={(item) => void unrealizeItem(item)}
                onUnlinkPayment={(item) => void unlinkItemPayment(item)}
                onPay={payItem}
                onDelete={(itemId) => treatmentMutations.deleteItem.mutate({ treatmentPlanId: plan.id, itemId })}
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
                  Tratamientos activos <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                <Button onClick={() => void createPlan()} disabled={treatmentMutations.createTreatmentPlan.isPending} className="bg-[#5cb85c] text-white hover:bg-[#4cae4c] h-10 rounded shadow-sm px-4 font-semibold">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nuevo plan de tratamiento
                </Button>
              </div>
            </div>

            {!planList.length ? (
              <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed border-2">
                <EmptyState title="Sin planes de tratamiento" description="Crea el primer plan para activar odontograma, precios y presupuesto." />
                <Button className="mt-4" onClick={() => void createPlan()}>
                  Crear plan inicial
                </Button>
              </Card>
            ) : (
              <div className="space-y-8">
                {(() => {
                  const renderCard = (item: typeof planList[0]) => {
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
                              <div className="text-sky-600 p-1 hover:bg-sky-50 rounded-md transition-colors" title="Editar plan">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8" onClick={(e) => { e.stopPropagation(); /* Add delete logic */ }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-2">
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Profesional</div>
                              <div className="flex items-start text-sm text-slate-700">
                                <UserRound className="w-4 h-4 mr-1.5 mt-0.5 text-slate-500 shrink-0" />
                                <span className="leading-tight font-medium">{item.professional.firstName} {item.professional.lastName}</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Especialidad</div>
                              <div className="text-sm text-slate-700 font-medium">General</div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Ultima cita</div>
                              <div className="text-sm text-slate-700 font-medium">Sin sesiones</div>
                            </div>
                            <div className="flex flex-col items-center md:items-start">
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">(Progreso)</div>
                              <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-slate-300 text-xs font-semibold text-slate-500">
                                0%
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Estado Financiero</div>
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

                  const inProgress = planList.filter(p => p.status === "IN_PROGRESS");
                  const others = planList.filter(p => p.status !== "IN_PROGRESS");

                  return (
                    <>
                      {/* En ejecución */}
                      <div>
                        <h3 className="text-2xl font-normal text-sky-600 mb-6">En ejecución</h3>
                        {inProgress.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm font-medium">El paciente no cuenta con tratamientos en ejecución</div>
                        ) : (
                          <div className="space-y-4">
                            {inProgress.map(renderCard)}
                          </div>
                        )}
                      </div>

                      {/* Otros */}
                      <div>
                        <div className="flex items-center gap-4 mb-6">
                          <h3 className="text-2xl font-normal text-slate-500">Otros</h3>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                        {others.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm font-medium">No hay otros planes registrados</div>
                        ) : (
                          <div className="space-y-4">
                            {others.map(renderCard)}
                          </div>
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
        onAddItem={addBudgetCatalogItem}
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
        onClose={closeOdontogramModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothDiagnosisPickerWindow
        open={activeModal === "preexistence" && Boolean(selectedTooth)}
        title="Agregar una preexistencia"
        tone="preexistence"
        sectionTitles={["Preexistencias"]}
        toothNumbers={actionTeeth}
        onClose={closeOdontogramModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothDiagnosisPickerWindow
        open={activeModal === "lesion" && Boolean(selectedTooth)}
        title="Agregar una lesion"
        tone="lesion"
        sectionTitles={["Lesiones"]}
        toothNumbers={actionTeeth}
        onClose={closeOdontogramModal}
        onAddDiagnosis={(diagnosis, notes) => void createDiagnosisForSelectedTeeth(diagnosis, notes)}
      />

      <ToothInformationModal
        open={activeModal === "info" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        history={toothHistory.data}
        historyLoading={toothHistory.isLoading}
        onCancelRecord={(odontogramRecordId) => clinicalMutations.cancelOdontogramRecord.mutate(odontogramRecordId)}
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
  upcomingAppointments: Array<{ id: string; startAt: string; status: string; professional: { firstName: string; lastName: string }; branch?: { name: string } | null }>;
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
        <SidebarFact icon={<UserRound className="h-5 w-5" />} label="Profesional a cargo" value={`${plan.professional.firstName} ${plan.professional.lastName}`} />
        <SidebarFact icon={<FolderOpen className="h-5 w-5" />} label="Convenio" value={patientAgreementName ?? "Sin convenio"} onClick={onOpenAgreement} />
        <SidebarFact icon={<Building2 className="h-5 w-5" />} label="Sucursal" value={plan.branch.name} onClick={onOpenBranch} />
        <SidebarFact icon={<Briefcase className="h-5 w-5" />} label="Reembolsos" value="Ver reembolsos" onClick={onOpenRefunds} />
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

function SidebarFact({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick?: () => void }) {
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
      <button type="button" className="flex w-full gap-3 rounded-md text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-200" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className="flex gap-3">
      {content}
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
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar convenio..." />
            </div>
            <Select value={agreementId} onChange={(event) => setAgreementId(event.target.value)}>
              <option value="">Seleccionar convenio</option>
              {selectableAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="rounded-lg bg-sky-50 p-5 text-center text-sm text-sky-900">
          {!plan?.items.length ? (
            <>
              <p className="font-semibold">Plan de tratamiento sin prestaciónes</p>
              <p className="mt-2">Agrega prestaciónes al plan de tratamiento para ver los valores con el convenio seleccionado.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{plan.items.length} prestaciónes en este plan</p>
              <p className="mt-2">El convenio se asignara al paciente. Los procedimientos existentes no se recalculan automaticamente.</p>
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

function AgreementDetailModal({ open, agreement, onClose }: { open: boolean; agreement?: PatientAgreementOption | null; onClose: () => void }) {
  return (
    <Modal open={open} title="Detalle del convenio" onClose={onClose} size="lg">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{agreement?.name ?? "Sin convenio"}</h3>
          <p className="mt-1 text-sm text-slate-500">Asignado al paciente</p>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
          <SummaryPill label="Arancel del convenio" value={agreement?.priceList?.name ?? "Sin arancel asociado"} />
          <SummaryPill label="Descuento convenio" value={`${numberValue(agreement?.discountPercent)}%`} />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Este convenio no se modifica desde este plan porque ya existen prestaciónes o presupuesto. Las prestaciónes existentes conservan sus valores.
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
  const selectedProfessional = professionalOptions.find((professional) => professional.id === professionalId) ?? null;
  const hasChanges = Boolean(plan && (branchId !== plan.branch.id || professionalId !== plan.professional.id));

  useEffect(() => {
    if (!open || !plan) return;
    setBranchId(plan.branch.id);
    setProfessionalId(plan.professional.id);
    setConfirming(false);
  }, [open, plan?.branch.id, plan?.id, plan?.professional.id]);

  useEffect(() => {
    if (!open || !professionalOptions.length) return;
    const selectedStillVisible = professionalOptions.some((professional) => professional.id === professionalId);
    if (!selectedStillVisible) setProfessionalId(professionalOptions[0]?.id ?? "");
  }, [open, professionalId, professionalOptions]);

  return (
    <Modal open={open} title="Cambiar sucursal" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <p>
              Selecciona la sucursal y el doctor que recibira este plan. El paciente pasara a formar parte de la sucursal asignada.
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
          <Select value={professionalId} disabled={!branchId || professionals.isLoading} onChange={(event) => {
            setProfessionalId(event.target.value);
            setConfirming(false);
          }}>
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
              El paciente y el plan se moveran a {selectedBranch.name}, asignados a {professionalName(selectedProfessional)}.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {!confirming ? (
            <Button disabled={!branchId || !professionalId || !hasChanges} onClick={() => setConfirming(true)}>
              Revisar cambio
            </Button>
          ) : (
            <Button disabled={!branchId || !professionalId || saving} onClick={() => void onConfirm({ branchId, professionalId })}>
              Cambiar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function RefundsModal({ open, patientId, plan, onClose }: { open: boolean; patientId: string; plan: TreatmentPlanDetail | null; onClose: () => void }) {
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
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por ID o prestación" />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value as RefundStatus | "")} className="md:w-[220px]">
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
                      <td className="px-4 py-3 text-slate-700">{refundProcedureSummary(refund, plan?.id ?? "")}</td>
                      <td className="px-4 py-3 text-slate-700">#{refund.payment.id.slice(-6).toUpperCase()}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{money(numberValue(refund.amount))}</td>
                      <td className="px-4 py-3">
                        <Badge value={REFUND_STATUS_LABELS[refund.status]} tone={refund.status === "PROCESSED" ? "success" : refund.status === "REJECTED" ? "danger" : "warning"} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(refund.processedAt ?? refund.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No hay elementos" description="Paciente sin reembolsos para este tratamiento." />
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
            <p className="font-semibold">Este plan tiene {pending?.futureAppointmentsCount ?? 0} citas futuras.</p>
            <p className="mt-1">Puedes moverlas a la nueva sucursal y doctor, o dejarlas como estaban en la agenda.</p>
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
      const tooth = item.toothNumber ? ` (${fdiLabel(item.toothNumber)}${item.surface ? `-${item.surface}` : ""})` : "";
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
  ].join(" ").toLowerCase();
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
    setSurfaces((current) => (current.includes(surface) ? current.filter((item) => item !== surface) : [...current, surface]));
  };

  const procedureLabel = item?.procedure ? `[${item.procedure.code}] ${item.procedure.name}` : "Prestación";

  return (
    <Modal open={Boolean(item)} title="Asignar piezas a prestación" onClose={onClose} size="lg">
      {item ? (
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-lg font-bold text-white">i</div>
            <div className="min-w-0 border-l-4 border-sky-400 pl-4">
              <p className="text-sm font-semibold text-sky-700">Seleccione la pieza que quiere asignar a esta prestación</p>
              <p className="mt-1 text-xs text-slate-500">
                Para asignar mas de una cara, seleccione las opciones necesarias y presione Agregar piezas.
              </p>
              <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-700">{procedureLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pl-14">
            <Select value={toothNumber} onChange={(event) => setToothNumber(event.target.value)} className="w-48">
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
                    active ? "bg-[#0879d5] text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                  }`}
                  onClick={() => toggleSurface(surface.code)}
                >
                  <span className="grid h-3.5 w-3.5 place-items-center rounded border border-current text-[10px]">{active ? "x" : ""}</span>
                  {surface.label}
                </button>
              );
            })}
          </div>

          <div className="-mx-6 -mb-6 flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button disabled={!toothNumber || saving} onClick={() => void onSave(item, toothNumber, surfaces)}>
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
  onDelete
}: {
  plan: TreatmentPlanDetail;
  onAssignPiece: (item: TreatmentPlanItem) => void;
  onMarkFuture: (item: TreatmentPlanItem) => void;
  onUnrealize: (item: TreatmentPlanItem) => void;
  onUnlinkPayment: (item: TreatmentPlanItem) => void;
  onPay: (item: TreatmentPlanItem) => void;
  onDelete: (itemId: string) => void;
}) {
  const [expandedItemId, setExpandedItemId] = useState("");

  const toggleItem = (itemId: string) => {
    setExpandedItemId((current) => (current === itemId ? "" : itemId));
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Procedimientos del plan</h2>
          <p className="text-xs text-slate-500">{plan.items.length} procedimientos asociados al odontograma y presupuesto.</p>
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

      {plan.items.length ? (
        <div className="overflow-x-auto bg-slate-50/70 p-3">
          <div className="min-w-[760px] space-y-3">
            {plan.items.map((item) => {
              const expanded = expandedItemId === item.id;
              const paid = itemPaidAmount(item);
              const pending = Math.max(numberValue(item.total) - paid, 0);
              const markedForFuture = Boolean(item.plannedAt);
              const procedureLabel = item.procedure ? `[${item.procedure.code}] ${item.procedure.name}` : item.procedureId;
              const toothLabel = item.toothNumber ? fdiLabel(item.toothNumber) : "";
              const surfaces = surfaceLabel(item.surface);

              return (
                <article key={item.id} className={`border bg-white shadow-sm transition ${expanded ? "border-sky-100 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="grid w-full grid-cols-[42px_minmax(180px,1fr)_80px_70px_88px_82px_44px_38px] items-center gap-3 px-4 py-3 text-left"
                    onClick={() => toggleItem(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") toggleItem(item.id);
                    }}
                  >
                    <span
                      className={`h-6 w-6 rounded-full border-4 ${expanded ? "border-sky-500 bg-white" : "border-slate-300 bg-white"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-xs font-semibold uppercase leading-snug text-slate-900">{procedureLabel}</span>
                      {item.section?.name ? <span className="mt-1 block text-[11px] text-slate-500">{item.section.name}</span> : null}
                    </span>

                    <span className="flex justify-center">
                      <button
                        type="button"
                        aria-label="Asignar pieza dental"
                        className="group inline-flex h-10 min-w-12 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAssignPiece(item);
                        }}
                      >
                        <img src="/logo-2.png" alt="" className="h-5 w-5 object-contain opacity-75 group-hover:opacity-100" />
                        <span>{toothLabel || "+"}</span>
                      </button>
                    </span>

                    <span className="text-center text-sm font-medium text-slate-900">{itemDiscountPercent(item)}%</span>
                    <span className="text-right text-sm font-semibold text-slate-900">{money(numberValue(item.total))}</span>
                    <span className="text-right text-xs font-medium text-slate-600">
                      {paid ? money(paid) : "-"}
                    </span>
                    <span className="flex justify-center">
                      <button
                        type="button"
                        aria-label={markedForFuture ? "Desmarcar futura realizacion" : "Marcar futura realizacion"}
                        title={markedForFuture ? "Prestación marcada para futura realizacion" : "Prestación desmarcada para futura realizacion"}
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
                      <span className={`h-4 w-4 rounded-full ${itemStatusDotClass(item.status)}`} title={ITEM_STATUS_LABELS[item.status]} />
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
                            window.location.href = `/patients/${window.location.pathname.split('/')[2]}/clinical/evolutions?treatmentPlanItemId=${item.id}`;
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
                            {item.status === "COMPLETED" ? "Prestación marcada como realizada" : "Esta prestación aun no ha sido realizada"}
                          </p>
                          {toothLabel ? <p className="mt-2 text-xs text-slate-600">Pieza {toothLabel}{surfaces ? ` · ${surfaces}` : ""}</p> : null}
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
          Selecciona una pieza y agrega un procedimiento para construir el plan.
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
            <p className="text-sm text-slate-500">{budget ? `Presupuesto ${budget.status} por ${money(numberValue(budget.total))}` : "Aun no se ha generado presupuesto."}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onCreate}>
            <Receipt className="mr-1 h-4 w-4" />
            Crear presupuesto
          </Button>
          <Button variant="secondary" disabled={!budget || !["DRAFT"].includes(budget.status)} onClick={() => budget && onSend(budget.id)}>
            <Send className="mr-1 h-4 w-4" />
            Enviar
          </Button>
          <Button disabled={!budget || !["DRAFT", "SENT"].includes(budget.status)} onClick={() => budget && onAccept(budget.id)}>
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
  const filteredCategories = catalog.filter((category) => budgetCatalogCategoryMatchesSearch(category, search));
  const filteredItems = selectedCategory?.items.filter((item) => budgetCatalogItemMatchesSearch(item, search)) ?? [];
  const planItemCount = Math.max(plan?.items.length ?? 0, addedItemsCount);
  const canCreateBudget = Boolean(planItemCount);
  const selectedPieceLabel = selectedTooth ? `${fdiLabel(selectedTooth)}${selectedSurface ? `-${selectedSurface}` : ""}` : "Sin piezas seleccionadas";
  const drawerTitle = selectedCategory ? `Productos de ${selectedCategory.name}` : "Definir procedimiento";

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setCategoryId("");
  }, [open, priceList?.id]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <button type="button" aria-label="Cerrar definicion de procedimiento" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-procedure-drawer-title"
        className="relative z-10 flex h-full w-full max-w-[780px] flex-col bg-white shadow-2xl"
      >
        <header className="flex h-[70px] shrink-0 items-center justify-between bg-red-600 px-5 text-white">
          <div className="flex min-w-0 items-center gap-3">
            {selectedCategory ? (
              <button type="button" aria-label="Volver a categorias" className="rounded p-1.5 transition hover:bg-white/10" onClick={() => setCategoryId("")}>
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
          <button type="button" aria-label="Cerrar" className="rounded p-2 text-white/85 transition hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="relative shrink-0 border-b border-slate-200">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-14 rounded-none border-0 pl-12 text-sm shadow-none focus:border-transparent focus:ring-0"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={selectedCategory ? "Buscar prestaciónes..." : "Buscar categorias, prestaciónes, plantillas"}
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
                          <span className="text-xs font-semibold uppercase text-slate-400">{item.procedure.code}</span>
                          {item.procedure.requiresTooth ? <Badge value="Requiere pieza" tone={selectedTooth ? "brand" : "warning"} /> : null}
                          {item.procedure.requiresSurface ? <Badge value="Requiere superficie" tone={selectedSurface ? "brand" : "warning"} /> : null}
                          {item.procedure.requiresLab ? <Badge value="Laboratorio" tone="default" /> : null}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{item.procedure.name}</p>
                        {item.procedure.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.procedure.description}</p> : null}
                      </div>
                      <div className="whitespace-nowrap text-right text-sm font-semibold text-slate-900">{money(numberValue(item.price))}</div>
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
                      {category.items.length ? `${category.items.length} productos` : "Sin productos configurados"}
                      {category.description ? ` - ${category.description}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </button>
              ))}
              {!filteredCategories.length ? <div className="px-6 py-16 text-center text-sm text-slate-500">No hay categorias con ese filtro.</div> : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <FolderOpen className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Sin categorias en el convenio</p>
                <p className="mt-1 text-xs text-slate-500">Configura categorias en el catalogo asociado al convenio para navegar productos desde aqui.</p>
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
            <p className="mt-1 text-slate-500">Consulta o crea consentimientos desde la ficha del paciente.</p>
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
          {!notes.length ? <p className="text-center text-sm text-slate-400">Sin comentario, agrega uno para imprimirlo en presupuestos.</p> : null}
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
    unitPrice: number;
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
  const total = Math.max(numberValue(quantity) * numberValue(unitPrice) - numberValue(discount), 0);

  return (
    <Modal open={open} title={`Agregar procedimiento - Pieza ${fdiLabel(toothNumber)}`} onClose={onClose} size="lg">
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
        <Input value={quantity} type="number" min={0.01} step={0.01} onChange={(event) => setQuantity(event.target.value)} placeholder="Cantidad" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Input value={unitPrice} type="number" min={0} step={0.01} onChange={(event) => setUnitPrice(event.target.value)} placeholder="Precio" />
        <Input value={discount} type="number" min={0} step={0.01} onChange={(event) => setDiscount(event.target.value)} placeholder="Descuento" />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p className="text-xs text-slate-500">Total</p>
          <p className="font-semibold text-slate-900">{money(total)}</p>
        </div>
      </div>

      <Textarea className="mt-3" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Diagnóstico o notas clinicas" />

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p>
          Arancel: <span className="font-semibold text-slate-900">{priceList?.name ?? "Sin lista activa"}</span>
        </p>
        <p>
          Procedimiento: <span className="font-semibold text-slate-900">{selectedProcedure ? `${selectedProcedure.code} - ${selectedProcedure.name}` : "No seleccionado"}</span>
        </p>
        <p>
          Pieza: <span className="font-semibold text-slate-900">{fdiLabel(toothNumber)}{surface ? `-${surface}` : ""}</span>
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
              unitPrice: numberValue(unitPrice),
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

function SectionModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  return (
    <Modal open={open} title="Agregar sección" onClose={onClose}>
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Fase diagnostica, Endodoncia, Protesis" />
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

function CommentModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  return (
    <Modal open={open} title="Comentario para el paciente" onClose={onClose}>
      <Textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escribe el comentario que se usara como referencia del plan." />
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
