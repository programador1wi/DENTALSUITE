import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderOpen,
  MessageSquarePlus,
  Plus,
  Printer,
  Receipt,
  Send,
  Stethoscope,
  Trash2,
  UserRound,
  WalletCards
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
import { ToothInformationModal } from "@/features/clinical/components/tooth-action-modals";
import { ToothDiagnosisModal as DiagnosisModal } from "@/features/clinical/components/tooth-diagnosis-modal";
import { useClinicalAppointmentHistory, useClinicalMutations, useOdontogram, useToothHistory } from "@/features/clinical/hooks/use-clinical";
import { usePatientPayments } from "@/features/payments/hooks/use-payments";
import { usePriceLists } from "@/features/settings/price-lists/hooks/use-price-lists";
import type { PriceList } from "@/features/settings/price-lists/services/price-lists.service";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import type { Procedure } from "@/features/settings/procedures/services/procedures.service";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useOdontogramStore } from "@/stores/odontogram.store";
import { useAddPatientNote, usePatient } from "../hooks/use-patients";
import { PatientSectionPage } from "../components/patient-section-page";
import { useBudgets, useTreatmentMutations, useTreatmentPlan, useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import type {
  Budget,
  TreatmentPlan,
  TreatmentPlanDetail,
  TreatmentPlanItem,
  TreatmentPlanItemStatus,
  TreatmentPlanStatus
} from "@/features/treatments/services/treatments.service";

const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  DRAFT: "Borrador",
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

const ITEM_STATUS_OPTIONS: TreatmentPlanItemStatus[] = ["PLANNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "PAID", "CANCELLED"];

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

function itemStatusTone(status: TreatmentPlanItemStatus) {
  if (status === "COMPLETED" || status === "PAID") return "success";
  if (status === "CANCELLED") return "danger";
  return "warning";
}

function activePriceListForPatient(priceLists: PriceList[] | undefined, patientAgreementPriceListId?: string | null) {
  return (
    priceLists?.find((list) => list.id === patientAgreementPriceListId) ??
    priceLists?.find((list) => list.isDefault) ??
    priceLists?.[0] ??
    null
  );
}

function priceForProcedure(priceList: PriceList | null, procedureId: string) {
  return numberValue(priceList?.items.find((item) => item.procedureId === procedureId)?.price);
}

export function PatientTreatmentsPage() {
  const { id = "" } = useParams();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);

  const patient = usePatient(id);
  const plans = useTreatmentPlans({ patientId: id });
  const selectedPlan = useTreatmentPlan(selectedPlanId);
  const budgets = useBudgets({ patientId: id, treatmentPlanId: selectedPlanId || undefined });
  const odontogram = useOdontogram(id);
  const appointments = useClinicalAppointmentHistory(id);
  const payments = usePatientPayments(id);
  const professionals = useProfessionals(undefined, "true");
  const procedures = useProcedures(undefined, "true");
  const priceLists = usePriceLists(undefined, "true", patient.data?.branchId);
  const clinicalMutations = useClinicalMutations(id);
  const treatmentMutations = useTreatmentMutations();
  const addNote = useAddPatientNote();

  const selectedTooth = useOdontogramStore((state) => state.selectedTooth);
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
  const activePriceList = activePriceListForPatient(priceLists.data, patient.data?.agreement?.priceList?.id);
  const upcomingAppointments = (appointments.data ?? []).slice(0, 3);
  const latestBudget = (plan?.budgets?.[0] ?? budgets.data?.[0] ?? null) as Budget | null;
  const professionalOptions = (professionals.data ?? []).map((professional) => ({
    id: professional.id,
    label: `${professional.firstName} ${professional.lastName}`
  }));

  useEffect(() => {
    resetWorkspace();
  }, [id, resetWorkspace]);

  useEffect(() => {
    if (!selectedPlanId && planList.length) setSelectedPlanId(planList[0].id);
  }, [planList, selectedPlanId]);

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

  if (patient.isLoading || plans.isLoading) return <LoadingState message="Cargando planes de tratamiento..." />;
  if (patient.isError) return <ErrorState message={patient.error.message} />;
  if (plans.isError) return <ErrorState message={plans.error.message} />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - Tratamientos" description="Plan clinico, odontograma, precios y presupuesto.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Plan de tratamiento</span>
            {planList.length ? (
              <Select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)} className="w-[280px]">
                {planList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {PLAN_STATUS_LABELS[item.status]}
                  </option>
                ))}
              </Select>
            ) : null}
            {plan ? <Badge value={PLAN_STATUS_LABELS[plan.status]} tone={plan.status === "COMPLETED" || plan.status === "ACCEPTED" ? "success" : "warning"} /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void createPlan()} disabled={treatmentMutations.createTreatmentPlan.isPending}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo plan
            </Button>
            <Button
              variant="secondary"
              disabled={!plan || !plan.items.length || treatmentMutations.createBudget.isPending}
              onClick={() => plan && treatmentMutations.createBudget.mutate({ treatmentPlanId: plan.id })}
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

        {!planList.length ? (
          <Card className="text-center">
            <EmptyState title="Sin planes de tratamiento" description="Crea el primer plan para activar odontograma, precios y presupuesto." />
            <Button className="mt-3" onClick={() => void createPlan()}>
              Crear plan inicial
            </Button>
          </Card>
        ) : null}

        {selectedPlan.isLoading ? <LoadingState message="Cargando detalle del plan..." /> : null}
        {selectedPlan.isError ? <ErrorState message={selectedPlan.error.message} /> : null}

        {plan ? (
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <PlanSidebar
              plan={plan}
              totals={totals}
              patientAgreementName={patient.data?.agreement?.name}
              activePriceList={activePriceList}
              upcomingAppointments={upcomingAppointments}
              globalPaid={payments.data?.balance.allocatedPaidAmount ?? 0}
            />

            <main className="min-w-0 space-y-4">
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Odontograma del plan</h2>
                    <p className="text-xs text-slate-500">
                      Selecciona una pieza, agrega procedimiento y el sistema asigna precio desde {activePriceList?.name ?? "lista de precios"}.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setSectionModalOpen(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Seccion
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
                    selectedTooth={selectedTooth}
                    latestByTooth={odontogram.data.latestByTooth ?? {}}
                    conditions={odontogram.data.conditions ?? []}
                    records={odontogram.data.records ?? []}
                    procedures={odontogram.data.procedures ?? []}
                    onSelectTooth={selectTooth}
                    onOpenDiagnosis={() => openOdontogramModal("diagnosis")}
                    onOpenTreatment={openProcedureModal}
                    onOpenInformation={() => openOdontogramModal("info")}
                    showHistoryTable={false}
                  />
                ) : null}
              </section>

              <TreatmentItemsTable
                plan={plan}
                onStatusChange={(itemId, status) => treatmentMutations.updateItemStatus.mutate({ treatmentPlanId: plan.id, itemId, status })}
                onDelete={(itemId) => treatmentMutations.deleteItem.mutate({ treatmentPlanId: plan.id, itemId })}
              />

              <BudgetPanel
                budget={latestBudget}
                onSend={(budgetId) => treatmentMutations.sendBudget.mutate(budgetId)}
                onAccept={(budgetId) => treatmentMutations.acceptBudget.mutate(budgetId)}
                onCreate={() => treatmentMutations.createBudget.mutate({ treatmentPlanId: plan.id })}
              />

              <PatientSignaturePanel
                patientId={id}
                notes={patient.data?.notes ?? []}
                onAddComment={() => setCommentModalOpen(true)}
              />
            </main>
          </div>
        ) : null}
      </div>

      <PlanProcedureModal
        open={procedureModalOpen}
        plan={plan}
        toothNumber={selectedTooth}
        surface={selectedSurface}
        onSurfaceChange={setSelectedSurface}
        procedures={procedures.data ?? []}
        priceList={activePriceList}
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

      <DiagnosisModal
        open={activeModal === "diagnosis" && Boolean(selectedTooth)}
        toothNumber={selectedTooth}
        onClose={closeOdontogramModal}
        onAddDiagnosis={(diagnosis, notes) => {
          const professionalId = professionalOptions[0]?.id ?? plan?.professional.id;
          if (!professionalId) {
            toast.error("No hay profesionales activos para registrar el diagnostico.");
            return;
          }

          clinicalMutations.createToothCondition.mutate(
            {
              professionalId,
              toothNumber: selectedTooth,
              surface: selectedSurface || undefined,
              condition: diagnosis,
              diagnosis,
              notes
            },
            { onSuccess: closeOdontogramModal }
          );
        }}
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
    </PatientSectionPage>
  );
}

function PlanSidebar({
  plan,
  totals,
  patientAgreementName,
  activePriceList,
  upcomingAppointments,
  globalPaid
}: {
  plan: TreatmentPlanDetail;
  totals: ReturnType<typeof planTotals>;
  patientAgreementName?: string | null;
  activePriceList: PriceList | null;
  upcomingAppointments: Array<{ id: string; startAt: string; status: string; professional: { firstName: string; lastName: string }; branch?: { name: string } | null }>;
  globalPaid: number;
}) {
  return (
    <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-[#0b8bd8] to-[#23b4c8] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-white/75">Plan de tratamiento</p>
            <h2 className="mt-1 text-xl font-bold leading-tight">{plan.name}</h2>
          </div>
          <span className="rounded bg-white/15 px-2 py-1 text-xs font-semibold">#{plan.id.slice(-6).toUpperCase()}</span>
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
        <SidebarFact icon={<FolderOpen className="h-5 w-5" />} label="Convenio" value={patientAgreementName ?? "Sin convenio"} />
        <SidebarFact icon={<BadgeDollarSign className="h-5 w-5" />} label="Arancel activo" value={activePriceList?.name ?? "Sin lista activa"} />
        <SidebarFact icon={<Building2 className="h-5 w-5" />} label="Sucursal" value={plan.branch.name} />
      </div>

      <div className="border-t border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Citas del paciente</h3>
        <div className="mt-3 space-y-3">
          {upcomingAppointments.length ? (
            upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="text-xs text-slate-500">
                <p className="font-semibold text-slate-800">Cita #{appointment.id.slice(-6).toUpperCase()}</p>
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

function SidebarFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="font-medium text-[#0b8bd8]">{value}</p>
      </div>
    </div>
  );
}

function TreatmentItemsTable({
  plan,
  onStatusChange,
  onDelete
}: {
  plan: TreatmentPlanDetail;
  onStatusChange: (itemId: string, status: TreatmentPlanItemStatus) => void;
  onDelete: (itemId: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Procedimientos del plan</h2>
          <p className="text-xs text-slate-500">{plan.items.length} procedimientos asociados al odontograma y presupuesto.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Procedimiento</th>
              <th className="px-4 py-3">Pieza</th>
              <th className="px-4 py-3">Dscto</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {plan.items.length ? (
              plan.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 align-middle hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{item.procedure ? `${item.procedure.code} - ${item.procedure.name}` : item.procedureId}</p>
                    <p className="text-xs text-slate-500">{item.section?.name ?? "Sin seccion"}</p>
                    {item.notes ? <p className="mt-1 text-xs text-slate-400">{item.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex min-w-12 justify-center rounded border border-slate-200 px-2 py-1 font-semibold text-slate-700">
                      {fdiLabel(item.toothNumber)}
                      {item.surface && item.surface !== "ALL" ? `-${item.surface}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">{money(numberValue(item.discount))}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{money(numberValue(item.total))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <WalletCards className={itemPaidAmount(item) >= numberValue(item.total) ? "h-5 w-5 text-green-600" : "h-5 w-5 text-slate-300"} />
                      <span>{money(itemPaidAmount(item))}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge value={ITEM_STATUS_LABELS[item.status]} tone={itemStatusTone(item.status)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Select value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value as TreatmentPlanItemStatus)} className="w-36">
                        {ITEM_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {ITEM_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)} disabled={item.status === "PAID"}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Selecciona una pieza y agrega un procedimiento para construir el plan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
          <Link to={`/patients/${patientId}/consents`}>
            <Button variant="secondary" size="sm">
              <FileText className="mr-1 h-4 w-4" />
              Crear consentimiento
            </Button>
          </Link>
        </div>
        <div className="space-y-4 py-4 text-sm">
          <div>
            <p className="font-semibold text-slate-900">Evoluciones</p>
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
          <option value="">Sin seccion</option>
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

      <Textarea className="mt-3" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Diagnostico o notas clinicas" />

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
    <Modal open={open} title="Agregar seccion" onClose={onClose}>
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Fase diagnostica, Endodoncia, Protesis" />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!name.trim()} onClick={() => void onSave(name.trim())}>
          Guardar seccion
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
