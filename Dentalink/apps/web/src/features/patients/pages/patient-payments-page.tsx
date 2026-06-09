import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, CreditCard, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientHeader } from "../components/patient-header";
import { PatientSubnav } from "../components/patient-subnav";
import { Select } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useCurrentCashRegister,
  usePatientPayments,
  usePaymentsMutations
} from "@/features/payments/hooks/use-payments";
import type { Installment, PayableTreatmentItem, PayableTreatmentPlan } from "@/features/payments/services/payments.service";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { usePatient } from "../hooks/use-patients";

type PaymentSelection =
  | {
      kind: "plan";
      id: string;
      label: string;
      amount: number;
      items: PayableTreatmentItem[];
    }
  | {
      kind: "item";
      id: string;
      label: string;
      amount: number;
      items: PayableTreatmentItem[];
    }
  | {
      kind: "installment";
      id: string;
      label: string;
      amount: number;
      installment: Installment;
    };

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
  const [selection, setSelection] = useState<PaymentSelection | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [financialInstitutionId, setFinancialInstitutionId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [autoOpenRequested, setAutoOpenRequested] = useState(false);

  const branchId = patient.data?.branchId ?? "";
  const canOpenCashRegister = hasPermission("cash_register.open") || hasPermission("system.manage_all");
  const hasOpenRegister = Boolean(currentRegister.data);

  useEffect(() => {
    if (paymentMethodId || !paymentMethods.data?.length) return;
    setPaymentMethodId(paymentMethods.data[0].id);
  }, [paymentMethodId, paymentMethods.data]);

  useEffect(() => {
    if (!branchId || currentRegister.isLoading || currentRegister.data || !canOpenCashRegister || autoOpenRequested) return;
    if (mutations.openCashRegister.isPending) return;
    setAutoOpenRequested(true);
    mutations.openCashRegister.mutate({ branchId, openingAmount: 0 });
  }, [autoOpenRequested, branchId, canOpenCashRegister, currentRegister.data, currentRegister.isLoading, mutations.openCashRegister]);

  useEffect(() => {
    if (!payments.data || selection) return;
    const itemId = searchParams.get("itemId");
    const suggestedAmount = searchParams.get("amount");
    if (!itemId) return;
    const item = payments.data.payableItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const nextSelection: PaymentSelection = {
      kind: "item",
      id: item.id,
      label: `${item.treatmentPlanName} - ${item.procedure.name}`,
      amount: Number(suggestedAmount || item.outstandingAmount),
      items: [item]
    };
    setSelection(nextSelection);
    setAmount(String(nextSelection.amount));
  }, [payments.data, searchParams, selection]);

  const pendingInstallments = useMemo(
    () => (payments.data?.installments ?? []).filter((installment) => !["PAID", "CANCELLED"].includes(installment.status)),
    [payments.data?.installments]
  );

  const selectPlan = (plan: PayableTreatmentPlan) => {
    const nextSelection: PaymentSelection = {
      kind: "plan",
      id: plan.id,
      label: plan.name,
      amount: plan.outstandingAmount,
      items: plan.items
    };
    setSelection(nextSelection);
    setAmount(String(plan.outstandingAmount));
  };

  const selectInstallment = (installment: Installment) => {
    const remaining = Math.max(Number(installment.amount) - Number(installment.paidAmount), 0);
    const nextSelection: PaymentSelection = {
      kind: "installment",
      id: installment.id,
      label: `Cuota ${installment.number} - ${installment.installmentPlan?.treatmentPlan?.name ?? "Financiamiento"}`,
      amount: remaining,
      installment
    };
    setSelection(nextSelection);
    setAmount(String(remaining));
  };

  const canSubmit = Boolean(
    branchId &&
      id &&
      selection &&
      paymentMethodId &&
      Number(amount) > 0 &&
      hasOpenRegister &&
      !mutations.createPayment.isPending &&
      !mutations.payInstallment.isPending
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !selection || !patient.data) return;

    if (selection.kind === "installment") {
      await mutations.payInstallment.mutateAsync({
        installmentId: selection.id,
        branchId: patient.data.branchId,
        paymentMethodId,
        amount: Number(amount),
        reference: reference || undefined,
        notes: notes || undefined
      });
    } else {
      await mutations.createPayment.mutateAsync({
        branchId: patient.data.branchId,
        patientId: id,
        paymentMethodId,
        financialInstitutionId: financialInstitutionId || undefined,
        amount: Number(amount),
        reference: reference || undefined,
        notes: notes || undefined,
        allocations: buildAllocations(selection.items, Number(amount))
      });
    }

    setSelection(null);
    setAmount("");
    setReference("");
    setNotes("");
    setFinancialInstitutionId("");
    setSearchParams({});
  };

  if (payments.isLoading || patient.isLoading) return <LoadingState message="Cargando pagos del paciente..." />;
  if (payments.isError) return <ErrorState message={payments.error.message} />;
  if (patient.isError) return <ErrorState message={patient.error.message} />;
  if (!payments.data || !patient.data) return <EmptyState title="Sin datos" description="No se pudo cargar el estado financiero del paciente." />;

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />

      <Card className="py-5">
        <h1 className="text-2xl font-light text-slate-900">Ingresar un pago</h1>
      </Card>

      <Card className="space-y-7">
        {!hasOpenRegister ? (
          <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <p className="font-semibold">Atencion</p>
            {canOpenCashRegister ? (
              <p>
                Usted no contaba con una caja abierta, lo que es necesario para realizar recaudaciones.
                {mutations.openCashRegister.isPending
                  ? " Se esta abriendo una caja para usted con abono inicial 0."
                  : " Como cuenta con los permisos necesarios, se abrira una caja para usted automaticamente con abono inicial 0."}
              </p>
            ) : (
              <p>No tiene una caja abierta. Solicite a un usuario autorizado abrir una caja antes de registrar pagos.</p>
            )}
          </div>
        ) : (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Caja abierta en {currentRegister.data?.branch.name}. Los pagos se registraran en esta caja.
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Planes de tratamiento</h2>
          <p className="mt-2 text-xs text-slate-600">Selecciona el plan de tratamiento a pagar o a la cual generar el link de pago.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-900">
                  <th className="w-12 px-3 py-3"></th>
                  <th className="px-3 py-3">Presupuestos</th>
                  <th className="px-3 py-3">Total presupuesto</th>
                  <th className="px-3 py-3">Realizado</th>
                  <th className="px-3 py-3">Pagado</th>
                  <th className="px-3 py-3">Saldo por abonar</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.payablePlans.map((plan) => (
                  <tr key={plan.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        checked={selection?.kind === "plan" && selection.id === plan.id}
                        onChange={() => selectPlan(plan)}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <button type="button" className="text-left text-brand-700 hover:underline" onClick={() => selectPlan(plan)}>
                        Tratamiento #{shortId(plan.id)}: {plan.name}
                      </button>
                      <p className="font-semibold text-slate-900">Sin citas</p>
                      <p className="text-xs text-slate-600">
                        Dr. {plan.professional.firstName} {plan.professional.lastName}
                      </p>
                    </td>
                    <td className="px-3 py-4">${formatMoney(plan.totalBudget)}</td>
                    <td className="px-3 py-4">${formatMoney(plan.realizedAmount)}</td>
                    <td className="px-3 py-4">${formatMoney(plan.paidAmount)}</td>
                    <td className="px-3 py-4">${formatMoney(plan.outstandingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!payments.data.payablePlans.length ? (
            <div className="py-8">
              <EmptyState title="Sin tratamientos por cobrar" description="No hay planes con saldo pendiente." />
            </div>
          ) : (
            <div className="mt-6 flex justify-end">
              <Button type="button" disabled={selection?.kind !== "plan"} onClick={() => selection && setAmount(String(selection.amount))}>
                Pagar tratamiento(s)
              </Button>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">Por cuotas de financiamiento</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-900">
                  <th className="w-12 px-3 py-3"></th>
                  <th className="px-3 py-3">Cuotas de credito</th>
                  <th className="px-3 py-3">Monto</th>
                  <th className="px-3 py-3">Pagado</th>
                  <th className="px-3 py-3">Saldo por abonar</th>
                </tr>
              </thead>
              <tbody>
                {pendingInstallments.map((installment) => {
                  const remaining = Math.max(Number(installment.amount) - Number(installment.paidAmount), 0);
                  return (
                    <tr key={installment.id} className="border-b border-slate-100">
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selection?.kind === "installment" && selection.id === installment.id}
                          onChange={() => selectInstallment(installment)}
                        />
                      </td>
                      <td className="px-3 py-4">
                        Cuota {installment.number} - {installment.installmentPlan?.treatmentPlan?.name ?? "Financiamiento"}
                      </td>
                      <td className="px-3 py-4">${formatMoney(installment.amount)}</td>
                      <td className="px-3 py-4">${formatMoney(installment.paidAmount)}</td>
                      <td className="px-3 py-4">${formatMoney(remaining)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="button" disabled={selection?.kind !== "installment"} onClick={() => selection && setAmount(String(selection.amount))}>
              Pagar cuotas »
            </Button>
          </div>
        </section>
      </Card>

      {selection ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recibir pago de este paciente</h2>
              <p className="text-xs text-slate-500">{selection.label}</p>
            </div>
            <Badge value={`Saldo seleccionado $${formatMoney(selection.amount)}`} tone="warning" />
          </div>
          {!hasOpenRegister ? (
            <div className="mb-4 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>El formulario se habilitara cuando exista una caja abierta para este usuario.</span>
            </div>
          ) : null}
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]" onSubmit={handleSubmit}>
            <Select value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
              <option value="">Metodo de pago</option>
              {paymentMethods.data?.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
            <Select value={financialInstitutionId} onChange={(event) => setFinancialInstitutionId(event.target.value)}>
              <option value="">Banco / entidad</option>
              {financialInstitutions.data?.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Monto" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <Input placeholder="Referencia" value={reference} onChange={(event) => setReference(event.target.value)} />
            <Button type="submit" disabled={!canSubmit}>
              {mutations.createPayment.isPending || mutations.payInstallment.isPending ? "Registrando..." : "Registrar pago"}
            </Button>
            <Input className="md:col-span-5" placeholder="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </form>
        </Card>
      ) : null}

      <Card className="grid gap-3 md:grid-cols-6">
        <FinancialMetric icon={<WalletCards className="h-4 w-4" />} label="Planificado" value={payments.data.balance.plannedAmount} />
        <FinancialMetric label="Pagado aplicado" value={payments.data.balance.allocatedPaidAmount} />
        <FinancialMetric label="Pagado total" value={payments.data.balance.totalPaidAmount} />
        <FinancialMetric label="Saldo pendiente" value={payments.data.balance.outstandingAmount} tone="danger" />
        <FinancialMetric label="Credito sin aplicar" value={payments.data.balance.unallocatedCredit} tone="success" />
        <FinancialMetric icon={<CreditCard className="h-4 w-4" />} label="Cuotas vencidas" value={payments.data.balance.overdueInstallments} raw />
      </Card>

      <Card>
        {!payments.data.payments.length ? (
          <EmptyState title="Sin pagos" description="El paciente no tiene pagos registrados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-900">
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Monto</th>
                  <th className="px-3 py-3">Metodo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Aplicaciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">{new Date(payment.paidAt).toLocaleString("es-MX")}</td>
                    <td className="px-3 py-3">${formatMoney(payment.amount)} {payment.currency}</td>
                    <td className="px-3 py-3">{payment.paymentMethod.name}</td>
                    <td className="px-3 py-3"><Badge value={payment.status} tone={payment.status === "VOIDED" || payment.status === "REFUNDED" ? "danger" : "success"} /></td>
                    <td className="px-3 py-3">{payment.allocations.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function buildAllocations(items: PayableTreatmentItem[], amount: number) {
  let remaining = amount;
  const allocations: Array<{ treatmentPlanItemId: string; amount: number }> = [];

  for (const item of items) {
    if (remaining <= 0) break;
    const allocationAmount = Math.min(item.outstandingAmount, remaining);
    if (allocationAmount > 0) {
      allocations.push({ treatmentPlanItemId: item.id, amount: roundMoney(allocationAmount) });
      remaining = roundMoney(remaining - allocationAmount);
    }
  }

  return allocations;
}

function FinancialMetric({
  icon,
  label,
  value,
  raw,
  tone
}: {
  icon?: ReactNode;
  label: string;
  value: number;
  raw?: boolean;
  tone?: "danger" | "success";
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs uppercase text-slate-500">
        {icon}
        {label}
      </p>
      <p className={tone === "danger" ? "font-semibold text-rose-700" : tone === "success" ? "font-semibold text-emerald-700" : "font-semibold text-slate-900"}>
        {raw ? value : formatMoney(value)}
      </p>
    </div>
  );
}

function formatMoney(value: number | string) {
  return Number(value || 0).toFixed(2);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function shortId(id: string) {
  return id.length > 6 ? id.slice(-6) : id;
}
