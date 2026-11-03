import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  Printer,
  ReceiptText,
  WalletCards
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { Select } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { APP_ROUTES } from "@/lib/routes";
import {
  useCurrentCashRegister,
  usePatientPayments,
  usePaymentsMutations
} from "@/features/payments/hooks/use-payments";
import type {
  Payment,
  PayableTreatmentItem,
  PayableTreatmentPlan
} from "@/features/payments/services/payments.service";
import { downloadPaymentReceiptPdf } from "@/features/payments/services/payments.service";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import {
  useAvailableCashDiscounts,
  useCashDiscountPreview
} from "@/features/settings/payment-methods/hooks/use-cash-discounts";
import type {
  AvailableCashDiscount,
  CashDiscountPreview
} from "@/features/settings/payment-methods/services/cash-discounts.service";
import { usePatient } from "../hooks/use-patients";
import { PatientHeader } from "../components/patient-header";
import { PatientSubnav } from "../components/patient-subnav";

type FlowStep = "plans" | "items" | "methods" | "result";
type PaymentMode = "items" | "free";

type SettlementDraft = {
  amount: string;
  dueAt: string;
  reference: string;
  financialInstitutionId: string;
};

type SplitDraft = {
  paymentMethodId: string;
  financialInstitutionId: string;
  amount: string;
  reference: string;
  scheduledSettlements: SettlementDraft[];
};

const payableStatuses = new Set(["PLANNED", "ACCEPTED", "COMPLETED"]);

export function PatientPaymentsPage() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const patient = usePatient(id);
  const payments = usePatientPayments(id);
  const paymentMethods = usePaymentMethods(undefined, "true");
  const financialInstitutions = useFinancialInstitutions(undefined, "true");
  const currentRegister = useCurrentCashRegister(patient.data?.branchId);
  const mutations = usePaymentsMutations();
  const { hasPermission } = usePermissions();
  const [step, setStep] = useState<FlowStep>("plans");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [mode, setMode] = useState<PaymentMode>("items");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [freeAmount, setFreeAmount] = useState("");
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [resultPayment, setResultPayment] = useState<Payment | null>(null);
  const [showFinancialSummary, setShowFinancialSummary] = useState(false);
  const [selectedCashDiscountId, setSelectedCashDiscountId] = useState("");

  const canCreatePayment = hasPermission("payments.create") || hasPermission("organization.manage_all");
  const canOpenCashRegister = hasPermission("cash_register.open") || hasPermission("organization.manage_all");
  const canApplyCashDiscount =
    hasPermission("organization.manage_all") ||
    (hasPermission("payments.cash_discounts.apply") && hasPermission("treatment_discount.apply"));
  const hasOpenRegister = Boolean(currentRegister.data);

  const selectedPlan = useMemo(
    () => payments.data?.payablePlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [payments.data?.payablePlans, selectedPlanId]
  );
  const validItems = useMemo(() => selectedPlan?.items.filter(isSelectableItem) ?? [], [selectedPlan]);
  const selectedItems = useMemo(
    () => validItems.filter((item) => selectedItemIds.includes(item.id)),
    [selectedItemIds, validItems]
  );
  const selectedItemsTotal = useMemo(
    () => roundMoney(selectedItems.reduce((sum, item) => sum + item.outstandingAmount, 0)),
    [selectedItems]
  );
  const availableCashDiscounts = useAvailableCashDiscounts(
    id,
    patient.data?.branchId,
    canApplyCashDiscount && mode === "items"
  );
  const cashDiscountPreview = useCashDiscountPreview();
  const activeCashDiscountPreview =
    selectedCashDiscountId && cashDiscountPreview.data?.rule.id === selectedCashDiscountId
      ? cashDiscountPreview.data
      : null;
  const freeAmountValue = roundMoney(Number(freeAmount || 0));
  const totalToPay =
    mode === "items"
      ? roundMoney(Number(activeCashDiscountPreview?.finalAmount ?? selectedItemsTotal))
      : freeAmountValue;
  const splitTotal = roundMoney(splits.reduce((sum, split) => sum + Number(split.amount || 0), 0));
  const splitDiff = roundMoney(splitTotal - totalToPay);
  const splitMatches = Math.abs(splitDiff) < 0.01;
  const firstMethodId = paymentMethods.data?.[0]?.id ?? "";

  useEffect(() => {
    if (!payments.data || selectedPlanId) return;
    const itemId = searchParams.get("itemId");
    if (!itemId) return;
    const plan = payments.data.payablePlans.find((candidate) =>
      candidate.items.some((item) => item.id === itemId)
    );
    if (!plan) return;
    setSelectedPlanId(plan.id);
    setSelectedItemIds([itemId]);
    setStep("items");
  }, [payments.data, searchParams, selectedPlanId]);

  useEffect(() => {
    if (step !== "methods") return;
    if (!firstMethodId || totalToPay <= 0) return;
    setSplits((current) => {
      if (current.length) return current;
      return [
        {
          paymentMethodId: firstMethodId,
          financialInstitutionId: "",
          amount: totalToPay.toFixed(2),
          reference: "",
          scheduledSettlements: []
        }
      ];
    });
  }, [firstMethodId, step, totalToPay]);

  if (payments.isLoading || patient.isLoading)
    return <LoadingState message="Cargando pagos del paciente..." />;
  if (payments.isError) return <ErrorState message={payments.error.message} />;
  if (patient.isError) return <ErrorState message={patient.error.message} />;
  if (!payments.data || !patient.data)
    return (
      <EmptyState title="Sin datos" description="No se pudo cargar el estado financiero del paciente." />
    );

  const pendingInstallments = payments.data.installments.filter(
    (installment) => !["PAID", "CANCELLED"].includes(installment.status)
  );
  const canContinueStep1 =
    canCreatePayment &&
    totalToPay > 0 &&
    (mode === "free" || selectedItems.length > 0) &&
    (!selectedCashDiscountId || Boolean(activeCashDiscountPreview)) &&
    !cashDiscountPreview.isPending;
  const canSubmit =
    canContinueStep1 &&
    (!selectedCashDiscountId || Boolean(activeCashDiscountPreview)) &&
    hasOpenRegister &&
    splits.length > 0 &&
    splitMatches &&
    splits.every((split) => split.paymentMethodId && Number(split.amount) > 0) &&
    splits.every((split) => {
      const method = paymentMethods.data?.find((candidate) => candidate.id === split.paymentMethodId);
      if (!method) return false;
      if (method.requiresReference && !split.reference.trim()) return false;
      if (method.requiresFinancialInstitution && !split.financialInstitutionId) return false;
      if (!split.scheduledSettlements.length) return true;
      return (
        method.acceptsMultipleSettlements &&
        split.scheduledSettlements.length >= 2 &&
        split.scheduledSettlements.every(
          (settlement) => Number(settlement.amount) > 0 && Boolean(settlement.dueAt)
        ) &&
        Math.abs(
          roundMoney(
            split.scheduledSettlements.reduce((sum, settlement) => sum + Number(settlement.amount || 0), 0) -
              Number(split.amount || 0)
          )
        ) < 0.01
      );
    }) &&
    !mutations.createPayment.isPending;

  const selectPlan = (plan: PayableTreatmentPlan) => {
    setSelectedPlanId(plan.id);
    setMode("items");
    setSelectedItemIds(plan.items.filter(isSelectableItem).map((item) => item.id));
    setFreeAmount("");
    setSplits([]);
    setNotes("");
    setSelectedCashDiscountId("");
    cashDiscountPreview.reset();
  };

  const toggleItem = (item: PayableTreatmentItem) => {
    if (!isSelectableItem(item)) return;
    setSelectedCashDiscountId("");
    cashDiscountPreview.reset();
    setSelectedItemIds((current) =>
      current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
    );
  };

  const selectCashDiscount = async (cashDiscountRuleId: string) => {
    setSelectedCashDiscountId(cashDiscountRuleId);
    cashDiscountPreview.reset();
    if (!cashDiscountRuleId || !selectedPlan || mode !== "items" || !selectedItems.length) return;
    try {
      await cashDiscountPreview.mutateAsync({
        patientId: id,
        payload: {
          branchId: patient.data.branchId,
          treatmentPlanId: selectedPlan.id,
          cashDiscountRuleId,
          items: selectedItems.map((item) => ({
            treatmentPlanItemId: item.id,
            outstandingAmount: item.outstandingAmount,
            expectedVersion: item.version
          }))
        }
      });
    } catch {
      // El backend entrega la causa exacta y conserva la selección para que el usuario pueda corregirla.
    }
  };

  const goToMethods = () => {
    setSplits(
      firstMethodId
        ? [
            {
              paymentMethodId: firstMethodId,
              financialInstitutionId: "",
              amount: totalToPay.toFixed(2),
              reference: "",
              scheduledSettlements: []
            }
          ]
        : []
    );
    setStep("methods");
  };

  const addSplit = () => {
    const remaining = Math.max(roundMoney(totalToPay - splitTotal), 0);
    setSplits((current) => [
      ...current,
      {
        paymentMethodId: firstMethodId,
        financialInstitutionId: "",
        amount: remaining > 0 ? remaining.toFixed(2) : "",
        reference: "",
        scheduledSettlements: []
      }
    ]);
  };

  const updateSplit = (index: number, field: keyof SplitDraft, value: string) => {
    setSplits((current) =>
      current.map((split, splitIndex) => (splitIndex === index ? { ...split, [field]: value } : split))
    );
  };

  const enableScheduledSettlements = (index: number) => {
    setSplits((current) =>
      current.map((split, splitIndex) => {
        if (splitIndex !== index) return split;
        if (split.scheduledSettlements.length) return { ...split, scheduledSettlements: [] };
        const half = roundMoney(Number(split.amount || 0) / 2);
        return {
          ...split,
          scheduledSettlements: [
            {
              amount: half.toFixed(2),
              dueAt: "",
              reference: "",
              financialInstitutionId: split.financialInstitutionId
            },
            {
              amount: roundMoney(Number(split.amount || 0) - half).toFixed(2),
              dueAt: "",
              reference: "",
              financialInstitutionId: split.financialInstitutionId
            }
          ]
        };
      })
    );
  };

  const addScheduledSettlement = (splitIndex: number) => {
    setSplits((current) =>
      current.map((split, index) =>
        index === splitIndex
          ? {
              ...split,
              scheduledSettlements: [
                ...split.scheduledSettlements,
                { amount: "", dueAt: "", reference: "", financialInstitutionId: split.financialInstitutionId }
              ]
            }
          : split
      )
    );
  };

  const updateScheduledSettlement = (
    splitIndex: number,
    settlementIndex: number,
    field: keyof SettlementDraft,
    value: string
  ) => {
    setSplits((current) =>
      current.map((split, index) =>
        index === splitIndex
          ? {
              ...split,
              scheduledSettlements: split.scheduledSettlements.map((settlement, targetIndex) =>
                targetIndex === settlementIndex ? { ...settlement, [field]: value } : settlement
              )
            }
          : split
      )
    );
  };

  const removeScheduledSettlement = (splitIndex: number, settlementIndex: number) => {
    setSplits((current) =>
      current.map((split, index) =>
        index === splitIndex
          ? {
              ...split,
              scheduledSettlements: split.scheduledSettlements.filter(
                (_, targetIndex) => targetIndex !== settlementIndex
              )
            }
          : split
      )
    );
  };

  const removeSplit = (index: number) => {
    setSplits((current) => current.filter((_, splitIndex) => splitIndex !== index));
  };

  const registerPayment = async () => {
    if (!selectedPlan || !canSubmit) return;
    const payment = await mutations.createPayment.mutateAsync({
      branchId: patient.data.branchId,
      patientId: id,
      amount: totalToPay,
      paymentMethodId: splits[0].paymentMethodId,
      notes: buildNotes(mode, selectedPlan, notes),
      allocations:
        mode === "items"
          ? selectedItems.map((item) => ({
              treatmentPlanItemId: item.id,
              amount: item.outstandingAmount,
              expectedVersion: item.version
            }))
          : undefined,
      splits: splits.map((split) => ({
        paymentMethodId: split.paymentMethodId,
        amount: Number(split.amount),
        financialInstitutionId: split.financialInstitutionId || undefined,
        reference: split.reference || undefined,
        scheduledSettlements: split.scheduledSettlements.length
          ? split.scheduledSettlements.map((settlement, index) => ({
              sequence: index + 1,
              amount: Number(settlement.amount),
              dueAt: settlement.dueAt,
              reference: settlement.reference || undefined,
              financialInstitutionId: settlement.financialInstitutionId || undefined
            }))
          : undefined
      })),
      idempotencyKey: crypto.randomUUID(),
      cashDiscountRuleId: activeCashDiscountPreview?.rule.id,
      cashDiscountTreatmentPlanId: activeCashDiscountPreview ? selectedPlan.id : undefined
    });
    setResultPayment(payment);
    setStep("result");
    setSearchParams({});
  };

  const printReceipt = () => {
    if (!resultPayment) return;
    window.open(
      `/payments/${encodeURIComponent(resultPayment.paymentNumber)}/receipt`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />

      <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border-muted)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[var(--text-secondary)]">
                Recibir pago
              </p>
              <h1 className="mt-1 text-[26px] font-semibold text-[var(--text-primary)]">
                Cobro de tratamiento
              </h1>
            </div>
            <StepIndicator step={step} />
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_360px]">
          <CashRegisterPanel
            hasOpenRegister={hasOpenRegister}
            canOpenCashRegister={canOpenCashRegister}
            register={currentRegister.data}
          />
          <div className="rounded-[var(--radius-md)] border border-[var(--border-muted)] bg-[var(--bg-subtle)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Paciente</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">
              {patient.data.firstName} {patient.data.lastName}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Sucursal base: {patient.data.branch?.name ?? "Sin sucursal"}
            </p>
          </div>
        </div>
      </section>

      {step === "plans" ? (
        <>
          <TreatmentPlansStep
            plans={payments.data.payablePlans}
            selectedPlanId={selectedPlanId}
            canCreatePayment={canCreatePayment}
            onSelect={selectPlan}
            onContinue={() => selectedPlan && setStep("items")}
          />
          {pendingInstallments.length ? <InstallmentsSummary installments={pendingInstallments} /> : null}
          <FinancialSummary
            open={showFinancialSummary}
            onToggle={() => setShowFinancialSummary((current) => !current)}
            balance={payments.data.balance}
          />
        </>
      ) : null}

      {step === "items" && selectedPlan ? (
        <StepOne
          plan={selectedPlan}
          mode={mode}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setSplits([]);
            setSelectedCashDiscountId("");
            cashDiscountPreview.reset();
          }}
          selectedItemIds={selectedItemIds}
          selectedItems={selectedItems}
          freeAmount={freeAmount}
          onFreeAmountChange={setFreeAmount}
          totalToPay={totalToPay}
          onToggleItem={toggleItem}
          onSelectAll={() => {
            setSelectedItemIds(validItems.map((item) => item.id));
            setSelectedCashDiscountId("");
            cashDiscountPreview.reset();
          }}
          onClearAll={() => {
            setSelectedItemIds([]);
            setSelectedCashDiscountId("");
            cashDiscountPreview.reset();
          }}
          cashDiscounts={availableCashDiscounts.data ?? []}
          selectedCashDiscountId={selectedCashDiscountId}
          cashDiscountPreview={activeCashDiscountPreview}
          cashDiscountLoading={availableCashDiscounts.isLoading || cashDiscountPreview.isPending}
          cashDiscountError={
            cashDiscountPreview.error ? errorMessageFromUnknown(cashDiscountPreview.error) : ""
          }
          canApplyCashDiscount={canApplyCashDiscount}
          onSelectCashDiscount={(ruleId) => void selectCashDiscount(ruleId)}
          onBack={() => setStep("plans")}
          onContinue={goToMethods}
          canContinue={canContinueStep1}
        />
      ) : null}

      {step === "methods" && selectedPlan ? (
        <StepTwo
          plan={selectedPlan}
          mode={mode}
          selectedItems={selectedItems}
          totalToPay={totalToPay}
          cashDiscountPreview={activeCashDiscountPreview}
          splits={splits}
          splitTotal={splitTotal}
          splitDiff={splitDiff}
          splitMatches={splitMatches}
          paymentMethods={paymentMethods.data ?? []}
          financialInstitutions={financialInstitutions.data ?? []}
          notes={notes}
          isSubmitting={mutations.createPayment.isPending}
          canSubmit={canSubmit}
          onNotesChange={setNotes}
          onAddSplit={addSplit}
          onUpdateSplit={updateSplit}
          onToggleScheduledSettlements={enableScheduledSettlements}
          onAddScheduledSettlement={addScheduledSettlement}
          onUpdateScheduledSettlement={updateScheduledSettlement}
          onRemoveScheduledSettlement={removeScheduledSettlement}
          onRemoveSplit={removeSplit}
          onBack={() => setStep("items")}
          onSubmit={registerPayment}
        />
      ) : null}

      {step === "result" && resultPayment ? (
        <PaymentResult
          payment={resultPayment}
          selectedPlan={selectedPlan}
          onPrint={printReceipt}
          onNewPayment={() => {
            setStep("plans");
            setSelectedPlanId("");
            setSelectedItemIds([]);
            setFreeAmount("");
            setSplits([]);
            setNotes("");
            setResultPayment(null);
            setSelectedCashDiscountId("");
            cashDiscountPreview.reset();
          }}
        />
      ) : null}
    </div>
  );
}

function TreatmentPlansStep({
  plans,
  selectedPlanId,
  canCreatePayment,
  onSelect,
  onContinue
}: {
  plans: PayableTreatmentPlan[];
  selectedPlanId: string;
  canCreatePayment: boolean;
  onSelect: (plan: PayableTreatmentPlan) => void;
  onContinue: () => void;
}) {
  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Planes de tratamiento</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Selecciona un plan con saldo para iniciar el cobro.
          </p>
        </div>
        <Button type="button" disabled={!canCreatePayment || !selectedPlanId} onClick={onContinue}>
          Pagar tratamiento(s)
        </Button>
      </div>

      {!plans.length ? (
        <EmptyState
          title="Sin tratamientos por cobrar"
          description="No hay planes activos con saldo pendiente."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-muted)] text-left text-xs font-semibold uppercase text-[var(--text-secondary)]">
                <th className="w-12 px-3 py-3"></th>
                <th className="px-3 py-3">Plan de tratamiento</th>
                <th className="px-3 py-3 text-right">Costo total</th>
                <th className="px-3 py-3 text-right">Realizado</th>
                <th className="px-3 py-3 text-right">Pagado</th>
                <th className="px-3 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-[var(--border-muted)] align-top last:border-0">
                  <td className="px-3 py-4">
                    <input
                      type="radio"
                      aria-label={`Seleccionar ${plan.name}`}
                      checked={selectedPlanId === plan.id}
                      disabled={!canCreatePayment}
                      onChange={() => onSelect(plan)}
                    />
                  </td>
                  <td className="px-3 py-4">
                    <button
                      type="button"
                      className="text-left font-semibold text-[var(--text-brand)] hover:underline disabled:text-[var(--text-secondary)]"
                      disabled={!canCreatePayment}
                      onClick={() => onSelect(plan)}
                    >
                      Tratamiento #{plan.number ?? shortId(plan.id)}: {plan.name}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge value={statusLabel(plan.status)} tone="default" />
                      <Badge
                        value={`${plan.items.length} prestaciones pendientes`}
                        tone={plan.items.length ? "warning" : "success"}
                      />
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Dr. {plan.professional.firstName} {plan.professional.lastName} ·{" "}
                      {plan.branch?.name ?? "Sin sucursal"} · Creado {dateOnly(plan.createdAt)}
                    </p>
                  </td>
                  <td className="px-3 py-4 text-right">{money(plan.totalBudget)}</td>
                  <td className="px-3 py-4 text-right">{money(plan.realizedAmount)}</td>
                  <td className="px-3 py-4 text-right">{money(plan.paidAmount)}</td>
                  <td className="px-3 py-4 text-right font-semibold text-[var(--text-danger)]">
                    {money(plan.outstandingAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StepOne({
  plan,
  mode,
  onModeChange,
  selectedItemIds,
  selectedItems,
  freeAmount,
  onFreeAmountChange,
  totalToPay,
  cashDiscounts,
  selectedCashDiscountId,
  cashDiscountPreview,
  cashDiscountLoading,
  cashDiscountError,
  canApplyCashDiscount,
  onSelectCashDiscount,
  onToggleItem,
  onSelectAll,
  onClearAll,
  onBack,
  onContinue,
  canContinue
}: {
  plan: PayableTreatmentPlan;
  mode: PaymentMode;
  onModeChange: (mode: PaymentMode) => void;
  selectedItemIds: string[];
  selectedItems: PayableTreatmentItem[];
  freeAmount: string;
  onFreeAmountChange: (value: string) => void;
  totalToPay: number;
  cashDiscounts: AvailableCashDiscount[];
  selectedCashDiscountId: string;
  cashDiscountPreview: CashDiscountPreview | null;
  cashDiscountLoading: boolean;
  cashDiscountError: string;
  canApplyCashDiscount: boolean;
  onSelectCashDiscount: (ruleId: string) => void;
  onToggleItem: (item: PayableTreatmentItem) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const previousPaid = roundMoney(selectedItems.reduce((sum, item) => sum + item.paidAmount, 0));
  const selectedValue = roundMoney(selectedItems.reduce((sum, item) => sum + item.total, 0));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="space-y-5">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" /> Volver a selección de plan
        </button>
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Paso 1</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
            Selecciona prestaciones a pagar
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {plan.name} · Dr. {plan.professional.firstName} {plan.professional.lastName} ·{" "}
            {plan.branch?.name ?? "Sin sucursal"}
          </p>
        </div>

        <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-brand)] p-1">
          <button
            type="button"
            className={
              mode === "items"
                ? "rounded-[var(--radius-sm)] bg-[var(--action-primary)] px-4 py-2 text-sm font-semibold text-white"
                : "px-4 py-2 text-sm font-semibold text-[var(--text-brand)]"
            }
            onClick={() => onModeChange("items")}
          >
            Pago particular
          </button>
          <button
            type="button"
            className={
              mode === "free"
                ? "rounded-[var(--radius-sm)] bg-[var(--action-primary)] px-4 py-2 text-sm font-semibold text-white"
                : "px-4 py-2 text-sm font-semibold text-[var(--text-brand)]"
            }
            onClick={() => onModeChange("free")}
          >
            Abono libre
          </button>
        </div>

        {mode === "items" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onSelectAll}>
                Seleccionar cobrables
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
                Desmarcar
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-muted)] text-left text-xs font-semibold uppercase text-[var(--text-secondary)]">
                    <th className="w-12 px-3 py-3"></th>
                    <th className="px-3 py-3">Prestación</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3 text-right">Valor</th>
                    <th className="px-3 py-3 text-right">Descuento</th>
                    <th className="px-3 py-3 text-right">Abonado</th>
                    <th className="px-3 py-3 text-right">Por pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.items.map((item) => {
                    const selectable = isSelectableItem(item);
                    return (
                      <tr key={item.id} className="border-b border-[var(--border-muted)] last:border-0">
                        <td className="px-3 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${item.procedure.name}`}
                            checked={selectedItemIds.includes(item.id)}
                            disabled={!selectable}
                            onChange={() => onToggleItem(item)}
                          />
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-semibold text-[var(--text-primary)]">{item.procedure.name}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {[
                              item.toothNumber ? `Pieza ${item.toothNumber}` : null,
                              item.surface ? `Cara ${item.surface}` : null,
                              item.section?.name ?? null
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Sin pieza o zona"}
                          </p>
                        </td>
                        <td className="px-3 py-4">
                          <Badge value={statusLabel(item.status)} tone={itemStatusTone(item)} />
                        </td>
                        <td className="px-3 py-4 text-right">{money(item.total)}</td>
                        <td className="px-3 py-4 text-right">{money(item.discount)}</td>
                        <td className="px-3 py-4 text-right">{money(item.paidAmount)}</td>
                        <td className="px-3 py-4 text-right font-semibold">
                          {money(item.outstandingAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border-brand)] bg-blue-50/50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Descuento por caja</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Promoción opcional para liquidar por completo las prestaciones seleccionadas. No aplica a
                    abonos parciales.
                  </p>
                </div>
                <label className="min-w-[280px] text-sm">
                  <span className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                    Promoción disponible
                  </span>
                  <Select
                    className="mt-1"
                    value={selectedCashDiscountId}
                    disabled={!canApplyCashDiscount || !selectedItems.length || cashDiscountLoading}
                    onChange={(event) => onSelectCashDiscount(event.target.value)}
                  >
                    <option value="">Sin descuento por caja</option>
                    {cashDiscounts.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.name} · {formatPercent(rule.discountPercent)}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              {!canApplyCashDiscount ? (
                <p className="mt-3 text-xs text-[var(--text-secondary)]">
                  Tu usuario no tiene permiso para aplicar descuentos por caja.
                </p>
              ) : null}
              {canApplyCashDiscount && !cashDiscountLoading && !cashDiscounts.length ? (
                <p className="mt-3 text-xs text-[var(--text-secondary)]">
                  No hay promociones vigentes para tu usuario y sucursal.
                </p>
              ) : null}
              {cashDiscountLoading && selectedCashDiscountId ? (
                <p className="mt-3 text-xs font-semibold text-[var(--text-brand)]">
                  Validando límites y vigencia...
                </p>
              ) : null}
              {cashDiscountError ? (
                <div className="mt-3 rounded-[var(--radius-sm)] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {cashDiscountError}
                </div>
              ) : null}
              {cashDiscountPreview ? <CashDiscountPreviewTable preview={cashDiscountPreview} /> : null}
            </div>
          </div>
        ) : (
          <div className="max-w-md rounded-[var(--radius-md)] border border-[var(--border-muted)] bg-[var(--bg-subtle)] p-4">
            <label className="text-sm font-semibold text-[var(--text-primary)]">Ingresar abono libre</label>
            <Input
              className="mt-2"
              type="number"
              min="0"
              step="0.01"
              value={freeAmount}
              onChange={(event) => onFreeAmountChange(event.target.value)}
              placeholder="0.00"
            />
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Este importe se registrará como crédito sin aplicar del paciente hasta asignarlo a prestaciones.
            </p>
          </div>
        )}
      </Card>

      <Card className="h-fit space-y-4 lg:sticky lg:top-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Resumen</h3>
        <SummaryLine label="Valor prestaciones" value={money(mode === "items" ? selectedValue : 0)} />
        <SummaryLine label="Abonado previamente" value={`-${money(mode === "items" ? previousPaid : 0)}`} />
        <SummaryLine label="Bonificaciones" value={money(0)} />
        <SummaryLine
          label="Descuentos"
          value={money(mode === "items" ? selectedItems.reduce((sum, item) => sum + item.discount, 0) : 0)}
        />
        {cashDiscountPreview ? (
          <SummaryLine
            label={`Descuento por caja · ${cashDiscountPreview.rule.name}`}
            value={`-${money(cashDiscountPreview.discountAmount)}`}
          />
        ) : null}
        <SummaryLine label="Abono libre" value={money(mode === "free" ? totalToPay : 0)} />
        <div className="border-t border-[var(--border-muted)] pt-3">
          <SummaryLine strong label="Total a pagar" value={money(totalToPay)} />
        </div>
        <Button type="button" className="w-full" disabled={!canContinue} onClick={onContinue}>
          Continuar
        </Button>
      </Card>
    </div>
  );
}

function CashDiscountPreviewTable({ preview }: { preview: CashDiscountPreview }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-blue-200 text-left font-semibold uppercase text-[var(--text-secondary)]">
            <th className="py-2 pr-3">Prestación</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2 text-right">Máximo real</th>
            <th className="px-3 py-2 text-right">Descuento</th>
            <th className="py-2 pl-3 text-right">A pagar</th>
          </tr>
        </thead>
        <tbody>
          {preview.items.map((item) => (
            <tr key={item.treatmentPlanItemId} className="border-b border-blue-100 last:border-0">
              <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{item.procedureName}</td>
              <td className="px-3 py-2 text-right">{money(item.originalBalance)}</td>
              <td className="px-3 py-2 text-right">{formatPercent(item.effectiveMaximum)}</td>
              <td className="px-3 py-2 text-right text-emerald-700">-{money(item.discountAmount)}</td>
              <td className="py-2 pl-3 text-right font-semibold">{money(item.finalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepTwo({
  plan,
  mode,
  selectedItems,
  totalToPay,
  cashDiscountPreview,
  splits,
  splitTotal,
  splitDiff,
  splitMatches,
  paymentMethods,
  financialInstitutions,
  notes,
  isSubmitting,
  canSubmit,
  onNotesChange,
  onAddSplit,
  onUpdateSplit,
  onToggleScheduledSettlements,
  onAddScheduledSettlement,
  onUpdateScheduledSettlement,
  onRemoveScheduledSettlement,
  onRemoveSplit,
  onBack,
  onSubmit
}: {
  plan: PayableTreatmentPlan;
  mode: PaymentMode;
  selectedItems: PayableTreatmentItem[];
  totalToPay: number;
  cashDiscountPreview: CashDiscountPreview | null;
  splits: SplitDraft[];
  splitTotal: number;
  splitDiff: number;
  splitMatches: boolean;
  paymentMethods: Array<{
    id: string;
    name: string;
    type: string;
    acceptsMultipleSettlements: boolean;
    requiresReference: boolean;
    requiresFinancialInstitution: boolean;
  }>;
  financialInstitutions: Array<{ id: string; name: string }>;
  notes: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  onNotesChange: (value: string) => void;
  onAddSplit: () => void;
  onUpdateSplit: (index: number, field: keyof SplitDraft, value: string) => void;
  onToggleScheduledSettlements: (index: number) => void;
  onAddScheduledSettlement: (splitIndex: number) => void;
  onUpdateScheduledSettlement: (
    splitIndex: number,
    settlementIndex: number,
    field: keyof SettlementDraft,
    value: string
  ) => void;
  onRemoveScheduledSettlement: (splitIndex: number, settlementIndex: number) => void;
  onRemoveSplit: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="space-y-5">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" /> Volver a prestaciones
        </button>
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Paso 2</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
            Selecciona medio de pago e ingresa el pago
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {plan.name} · Total {money(totalToPay)}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Medios de pago</h3>
            <Button type="button" variant="secondary" size="sm" onClick={onAddSplit}>
              Agregar medio
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {splits.map((split, index) => (
              <div
                key={index}
                className="rounded-[var(--radius-md)] border border-[var(--border-muted)] bg-[var(--bg-subtle)] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                    Medio #{index + 1}
                  </p>
                  {splits.length > 1 ? (
                    <button
                      type="button"
                      className="text-sm text-[var(--text-danger)] hover:underline"
                      onClick={() => onRemoveSplit(index)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm">
                    <span className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                      Medio de pago
                    </span>
                    <Select
                      className="mt-1"
                      value={split.paymentMethodId}
                      onChange={(event) => onUpdateSplit(index, "paymentMethodId", event.target.value)}
                    >
                      <option value="">Selecciona</option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                      Monto
                    </span>
                    <Input
                      className="mt-1"
                      type="number"
                      min="0"
                      step="0.01"
                      value={split.amount}
                      onChange={(event) => onUpdateSplit(index, "amount", event.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                      Banco / entidad
                    </span>
                    <Select
                      className="mt-1"
                      value={split.financialInstitutionId}
                      onChange={(event) => onUpdateSplit(index, "financialInstitutionId", event.target.value)}
                    >
                      <option value="">No aplica</option>
                      {financialInstitutions.map((institution) => (
                        <option key={institution.id} value={institution.id}>
                          {institution.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-sm">
                    <span className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                      Referencia
                    </span>
                    <Input
                      className="mt-1"
                      value={split.reference}
                      onChange={(event) => onUpdateSplit(index, "reference", event.target.value)}
                      placeholder="Autorización, transferencia o cheque"
                    />
                  </label>
                  {paymentMethods.find((method) => method.id === split.paymentMethodId)
                    ?.acceptsMultipleSettlements ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--border-brand-light)] bg-[var(--bg-surface)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            Recepción diferida
                          </p>
                          <p className="mt-1 text-xs leading-4 text-[var(--text-secondary)]">
                            Programa fechas en que clínica recibirá este mismo medio. No crea cuotas del
                            paciente.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onToggleScheduledSettlements(index)}
                        >
                          {split.scheduledSettlements.length ? "Quitar" : "Programar"}
                        </Button>
                      </div>

                      {split.scheduledSettlements.length ? (
                        <div className="mt-3 space-y-3">
                          {split.scheduledSettlements.map((settlement, settlementIndex) => (
                            <div
                              key={settlementIndex}
                              className="grid gap-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-3 sm:grid-cols-2"
                            >
                              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                                Vencimiento #{settlementIndex + 1}
                                <Input
                                  className="mt-1"
                                  type="date"
                                  value={settlement.dueAt}
                                  onChange={(event) =>
                                    onUpdateScheduledSettlement(
                                      index,
                                      settlementIndex,
                                      "dueAt",
                                      event.target.value
                                    )
                                  }
                                />
                              </label>
                              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                                Importe
                                <Input
                                  className="mt-1"
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={settlement.amount}
                                  onChange={(event) =>
                                    onUpdateScheduledSettlement(
                                      index,
                                      settlementIndex,
                                      "amount",
                                      event.target.value
                                    )
                                  }
                                />
                              </label>
                              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                                Referencia
                                <Input
                                  className="mt-1"
                                  value={settlement.reference}
                                  onChange={(event) =>
                                    onUpdateScheduledSettlement(
                                      index,
                                      settlementIndex,
                                      "reference",
                                      event.target.value
                                    )
                                  }
                                />
                              </label>
                              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                                Institución
                                <Select
                                  className="mt-1"
                                  value={settlement.financialInstitutionId}
                                  onChange={(event) =>
                                    onUpdateScheduledSettlement(
                                      index,
                                      settlementIndex,
                                      "financialInstitutionId",
                                      event.target.value
                                    )
                                  }
                                >
                                  <option value="">Usar institución general</option>
                                  {financialInstitutions.map((institution) => (
                                    <option key={institution.id} value={institution.id}>
                                      {institution.name}
                                    </option>
                                  ))}
                                </Select>
                              </label>
                              {split.scheduledSettlements.length > 2 ? (
                                <button
                                  type="button"
                                  className="text-left text-xs font-semibold text-[var(--text-danger)]"
                                  onClick={() => onRemoveScheduledSettlement(index, settlementIndex)}
                                >
                                  Eliminar vencimiento
                                </button>
                              ) : null}
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => onAddScheduledSettlement(index)}
                          >
                            Agregar vencimiento
                          </Button>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Suma programada:{" "}
                            {money(
                              split.scheduledSettlements.reduce(
                                (sum, row) => sum + Number(row.amount || 0),
                                0
                              )
                            )}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Notas</span>
          <Input
            className="mt-1"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Opcional"
          />
        </label>
      </Card>

      <Card className="h-fit space-y-4 lg:sticky lg:top-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Confirmación</h3>
        <SummaryLine label="Modalidad" value={mode === "items" ? "Pago particular" : "Abono libre"} />
        <SummaryLine
          label="Prestaciones"
          value={mode === "items" ? String(selectedItems.length) : "Crédito sin aplicar"}
        />
        {cashDiscountPreview ? (
          <>
            <SummaryLine
              label="Subtotal antes de promoción"
              value={money(cashDiscountPreview.originalAmount)}
            />
            <SummaryLine
              label={`Descuento por caja · ${cashDiscountPreview.rule.name}`}
              value={`-${money(cashDiscountPreview.discountAmount)}`}
            />
          </>
        ) : null}
        <SummaryLine label="Total a pagar" value={money(totalToPay)} />
        <SummaryLine label="Total ingresado" value={money(splitTotal)} />
        <div
          className={
            splitMatches
              ? "rounded-[var(--radius-md)] bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
              : splitDiff > 0
                ? "rounded-[var(--radius-md)] bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
                : "rounded-[var(--radius-md)] bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700"
          }
        >
          {splitMatches
            ? "Los medios de pago coinciden con el total."
            : splitDiff > 0
              ? `El monto excede el total por ${money(Math.abs(splitDiff))}.`
              : `Faltan ${money(Math.abs(splitDiff))} por asignar.`}
        </div>
        <Button type="button" className="w-full" disabled={!canSubmit} onClick={onSubmit}>
          {isSubmitting ? "Registrando pago..." : "Registrar pago"}
        </Button>
      </Card>
    </div>
  );
}

function PaymentResult({
  payment,
  selectedPlan,
  onPrint,
  onNewPayment
}: {
  payment: Payment;
  selectedPlan: PayableTreatmentPlan | null;
  onPrint: () => void;
  onNewPayment: () => void;
}) {
  const methods = payment.paymentMethods?.length
    ? payment.paymentMethods
    : payment.splits?.length
      ? payment.splits.map((split) => ({
          name: split.paymentMethod.name,
          amount: Number(split.amount),
          reference: split.reference ?? null
        }))
      : [
          {
            name: payment.paymentMethod.name,
            amount: Number(payment.amount),
            reference: payment.reference ?? null
          }
        ];
  const downloadReceipt = async () => {
    const result = await downloadPaymentReceiptPdf(payment.paymentNumber);
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-600" />
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Pago registrado correctamente
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Folio #{payment.paymentNumber} · {dateTime(payment.paidAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onPrint}>
            <Printer className="h-4 w-4" /> Ver comprobante
          </Button>
          <Button type="button" variant="secondary" onClick={() => void downloadReceipt()}>
            <Download className="h-4 w-4" /> Descargar PDF
          </Button>
          <Link to={APP_ROUTES.patients.billing(payment.patientId)}>
            <Button type="button" variant="secondary">
              <ReceiptText className="h-4 w-4" /> Facturación y pagos
            </Button>
          </Link>
          <Button type="button" onClick={onNewPayment}>
            Registrar otro pago
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ResultBox label="Paciente" value={`${payment.patient.firstName} ${payment.patient.lastName}`} />
        <ResultBox
          label="Plan de tratamiento"
          value={
            selectedPlan
              ? `#${selectedPlan.number ?? shortId(selectedPlan.id)} · ${selectedPlan.name}`
              : payment.treatmentRefs?.[0]
                ? `#${payment.treatmentRefs[0].number} · ${payment.treatmentRefs[0].name}`
                : "Abono libre"
          }
        />
        <ResultBox label="Total recibido" value={`${money(payment.amount)} ${payment.currency}`} />
        {payment.cashDiscountApplication ? (
          <ResultBox
            label="Descuento por caja"
            value={`${payment.cashDiscountApplication.ruleNameSnapshot} · -${money(payment.cashDiscountApplication.discountAmount)}`}
          />
        ) : null}
        <ResultBox label="Sucursal" value={payment.branch.name} />
        <ResultBox label="Caja" value={payment.cashRegister?.displayName ?? "-"} />
        <ResultBox
          label="Recibido por"
          value={`${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`.trim()}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-[var(--radius-md)] border border-[var(--border-muted)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Medios de pago</p>
          <div className="mt-3 space-y-2">
            {methods.map((method, index) => (
              <div key={`${method.name}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{method.name}</p>
                  {method.reference ? (
                    <p className="text-xs text-[var(--text-secondary)]">Referencia: {method.reference}</p>
                  ) : null}
                </div>
                <span className="font-semibold">{money(method.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border-muted)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Aplicacion del pago</p>
          <div className="mt-3 space-y-2">
            {payment.breakdown.length ? (
              payment.breakdown.map((row) => (
                <div
                  key={row.id}
                  className="border-b border-[var(--border-muted)] pb-2 text-sm last:border-0"
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-[var(--text-primary)]">{row.detail}</span>
                    <span>{money(row.paidAmount)}</span>
                  </div>
                  {Number(row.discountAmount ?? 0) > 0 ? (
                    <p className="text-xs font-semibold text-emerald-700">
                      Descuento por caja: -{money(row.discountAmount)}
                    </p>
                  ) : null}
                  <p className="text-xs text-[var(--text-secondary)]">
                    Plan #{row.treatmentNumber} · Saldo restante {money(row.remainingAmount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                Pago recibido sin aplicaciones a prestaciones.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-4">
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <SummaryLine
            label="Saldo anterior"
            value={money(Number(payment.amount) + Number(payment.remainingPlanBalance ?? 0))}
          />
          <SummaryLine label="Pago aplicado" value={money(payment.allocatedAmount)} />
          <SummaryLine label="Saldo actual" value={money(payment.remainingPlanBalance ?? 0)} strong />
        </div>
      </div>
    </Card>
  );
}

function CashRegisterPanel({
  hasOpenRegister,
  canOpenCashRegister,
  register
}: {
  hasOpenRegister: boolean;
  canOpenCashRegister: boolean;
  register?: {
    id: string;
    openedAt: string;
    branch: { name: string };
    openedBy: { firstName: string; lastName: string };
  } | null;
}) {
  if (!hasOpenRegister) {
    return (
      <Alert
        variant="warning"
        size="sm"
        title="No tienes una caja abierta para registrar este pago"
        action={
          canOpenCashRegister ? (
            <Link
              className="text-xs font-semibold text-amber-900 underline hover:text-amber-950"
              to={APP_ROUTES.cashRegister.open}
            >
              Ir a apertura de caja
            </Link>
          ) : undefined
        }
      >
        Abre una caja antes de continuar con el cobro.
      </Alert>
    );
  }
  return (
    <Alert variant="success" size="sm" title="Caja abierta">
      <p className="mt-0.5">
        {register?.branch.name ?? "Sucursal"} ·{" "}
        {register?.openedBy
          ? `${register.openedBy.firstName} ${register.openedBy.lastName}`
          : "Usuario actual"}{" "}
        · {dateTime(register?.openedAt)}
      </p>
    </Alert>
  );
}

function FinancialSummary({
  open,
  onToggle,
  balance
}: {
  open: boolean;
  onToggle: () => void;
  balance: {
    plannedAmount: number;
    allocatedPaidAmount: number;
    totalPaidAmount: number;
    outstandingAmount: number;
    unallocatedCredit: number;
    overdueInstallments: number;
  };
}) {
  return (
    <Card className="space-y-4">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={onToggle}>
        <span className="font-semibold text-[var(--text-primary)]">Resumen financiero secundario</span>
        <ChevronDown className={open ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
      </button>
      {open ? (
        <div className="grid gap-3 md:grid-cols-6">
          <Metric
            icon={<WalletCards className="h-4 w-4" />}
            label="Planificado"
            value={money(balance.plannedAmount)}
          />
          <Metric label="Pagado aplicado" value={money(balance.allocatedPaidAmount)} />
          <Metric label="Pagado total" value={money(balance.totalPaidAmount)} />
          <Metric label="Saldo pendiente" value={money(balance.outstandingAmount)} tone="danger" />
          <Metric label="Crédito sin aplicar" value={money(balance.unallocatedCredit)} tone="success" />
          <Metric
            icon={<CreditCard className="h-4 w-4" />}
            label="Cuotas vencidas"
            value={String(balance.overdueInstallments)}
          />
        </div>
      ) : null}
    </Card>
  );
}

function InstallmentsSummary({
  installments
}: {
  installments: Array<{
    id: string;
    number: number;
    dueDate: string;
    amount: string;
    paidAmount: string;
    status: string;
    installmentPlan?: { treatmentPlan?: { name: string } };
  }>;
}) {
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cuotas de financiamiento</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-muted)] text-left text-xs font-semibold uppercase text-[var(--text-secondary)]">
              <th className="px-3 py-3">Cuota</th>
              <th className="px-3 py-3">Vencimiento</th>
              <th className="px-3 py-3 text-right">Monto</th>
              <th className="px-3 py-3 text-right">Pagado</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((installment) => (
              <tr key={installment.id} className="border-b border-[var(--border-muted)] last:border-0">
                <td className="px-3 py-3">
                  Cuota {installment.number} ·{" "}
                  {installment.installmentPlan?.treatmentPlan?.name ?? "Financiamiento"}
                </td>
                <td className="px-3 py-3">{dateOnly(installment.dueDate)}</td>
                <td className="px-3 py-3 text-right">{money(installment.amount)}</td>
                <td className="px-3 py-3 text-right">{money(installment.paidAmount)}</td>
                <td className="px-3 py-3">
                  <Badge value={statusLabel(installment.status)} tone="warning" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StepIndicator({ step }: { step: FlowStep }) {
  const steps: Array<{ key: FlowStep; label: string }> = [
    { key: "plans", label: "Plan" },
    { key: "items", label: "Prestaciones" },
    { key: "methods", label: "Medios" },
    { key: "result", label: "Resultado" }
  ];
  const activeIndex = steps.findIndex((item) => item.key === step);
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((item, index) => (
        <span
          key={item.key}
          className={
            index <= activeIndex
              ? "rounded-full bg-[var(--action-primary)] px-3 py-1 text-xs font-semibold text-white"
              : "rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
          }
        >
          {index + 1}. {item.label}
        </span>
      ))}
    </div>
  );
}

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "flex items-center justify-between text-base font-semibold text-[var(--text-primary)]"
          : "flex items-center justify-between text-sm text-[var(--text-secondary)]"
      }
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs uppercase text-[var(--text-secondary)]">
        {icon}
        {label}
      </p>
      <p
        className={
          tone === "danger"
            ? "font-semibold text-[var(--text-danger)]"
            : tone === "success"
              ? "font-semibold text-emerald-700"
              : "font-semibold text-[var(--text-primary)]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function ResultBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-muted)] bg-[var(--bg-subtle)] p-4">
      <p className="text-xs font-semibold uppercase text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function isSelectableItem(item: PayableTreatmentItem) {
  return payableStatuses.has(item.status) && item.outstandingAmount > 0;
}

function itemStatusTone(item: PayableTreatmentItem) {
  if (item.status === "PAID" || item.outstandingAmount <= 0) return "success";
  if (item.status === "CANCELLED") return "danger";
  if (item.paidAmount > 0) return "warning";
  return "default";
}

function buildNotes(mode: PaymentMode, plan: PayableTreatmentPlan, notes: string) {
  const prefix =
    mode === "free"
      ? `Abono libre clasificado como crédito sin aplicar. Plan de referencia: ${plan.name}.`
      : `Pago aplicado a prestaciones del plan ${plan.name}.`;
  return notes.trim() ? `${prefix} ${notes.trim()}` : prefix;
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2
  }).format(Number(value ?? 0) || 0);
}

function formatPercent(value: number | string) {
  return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(Number(value) || 0)}%`;
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error) return error.message;
  return "No fue posible validar el descuento por caja.";
}

function dateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX");
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-MX");
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function shortId(id: string) {
  return id.length > 6 ? id.slice(-6) : id;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    ACCEPTED: "Aceptado",
    ACTIVE: "Activo",
    PLANNED: "Pendiente",
    COMPLETED: "Realizada",
    PAID: "Pagada",
    CANCELLED: "Anulada",
    PARTIAL: "Parcial",
    PENDING: "Pendiente",
    OVERDUE: "Vencida"
  };
  return labels[status] ?? status;
}
