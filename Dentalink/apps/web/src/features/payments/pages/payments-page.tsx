import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useActiveBranchFilter } from "@/features/settings/branches/hooks/use-active-branch-filter";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import { PatientSearchBox, getPatientSearchLabel } from "@/features/patients/components/patient-search-box";
import { usePayments, usePaymentsMutations } from "../hooks/use-payments";
import type { Payment, PaymentStatus } from "../services/payments.service";

const STATUS_OPTIONS: Array<{ label: string; value: PaymentStatus }> = [
  { label: "Recibido", value: "RECEIVED" },
  { label: "Parcialmente aplicado", value: "PARTIALLY_ALLOCATED" },
  { label: "Aplicado", value: "ALLOCATED" },
  { label: "Devuelto", value: "REFUNDED" },
  { label: "Anulado", value: "VOIDED" }
];

function paymentPatientName(payment: Payment) {
  return `${payment.patient.firstName} ${payment.patient.lastName}`.trim() || "Paciente sin nombre";
}

function paymentSearchLabel(payment: Payment) {
  return payment.reference || paymentPatientName(payment);
}

function paymentMatchesTerm(payment: Payment, term: string) {
  const query = term.trim().toLowerCase();
  if (!query) return true;
  return [
    payment.id,
    payment.reference ?? "",
    payment.notes ?? "",
    paymentPatientName(payment),
    payment.branch.name,
    payment.paymentMethod.name
  ].some((value) => value.toLowerCase().includes(query));
}

export function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const { activeBranchId, branchId, setBranchId } = useActiveBranchFilter();

  const [newBranchId, setNewBranchId] = useState("");
  const [newPatientId, setNewPatientId] = useState("");
  const [newPatientSearch, setNewPatientSearch] = useState("");
  const [newPaymentMethodId, setNewPaymentMethodId] = useState("");
  const [newFinancialInstitutionId, setNewFinancialInstitutionId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newReference, setNewReference] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [refundPaymentId, setRefundPaymentId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState("");
  const [refundFinancialInstitutionId, setRefundFinancialInstitutionId] = useState("");
  const [refundReference, setRefundReference] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const paymentMethods = usePaymentMethods(undefined, "true");
  const financialInstitutions = useFinancialInstitutions(undefined, "true");
  const payments = usePayments({
    search: search || undefined,
    status: status || undefined,
    branchId: branchId || undefined
  });
  const mutations = usePaymentsMutations();
  const refundPaymentSuggestions = useMemo(
    () => (payments.data ?? []).filter((payment) => paymentMatchesTerm(payment, refundPaymentId)),
    [payments.data, refundPaymentId]
  );
  const refundableMethods = useMemo(
    () => (paymentMethods.data ?? []).filter((method) => method.allowsRefund),
    [paymentMethods.data]
  );
  const selectedRefundMethod = refundableMethods.find((method) => method.id === refundPaymentMethodId);

  const canCreate = Boolean(
    newBranchId && newPatientId.trim() && newPaymentMethodId && Number(newAmount) > 0
  );
  const canRefund = Boolean(
    refundPaymentId.trim() &&
    Number(refundAmount) > 0 &&
    refundPaymentMethodId &&
    (!selectedRefundMethod?.requiresReference || refundReference.trim()) &&
    (!selectedRefundMethod?.requiresFinancialInstitution || refundFinancialInstitutionId)
  );

  const statusTone = useMemo(
    () =>
      ({
        RECEIVED: "warning",
        PARTIALLY_ALLOCATED: "warning",
        ALLOCATED: "success",
        REFUNDED: "danger",
        VOIDED: "danger"
      }) as const,
    []
  );

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    mutations.createPayment.mutate({
      branchId: newBranchId,
      patientId: newPatientId.trim(),
      paymentMethodId: newPaymentMethodId,
      financialInstitutionId: newFinancialInstitutionId || undefined,
      amount: Number(newAmount),
      reference: newReference || undefined,
      notes: newNotes || undefined
    });
  };

  useEffect(() => {
    if (activeBranchId && newBranchId !== activeBranchId) {
      setNewBranchId(activeBranchId);
    }
  }, [activeBranchId, newBranchId]);

  useEffect(() => {
    if (!refundPaymentMethodId && refundableMethods[0]) setRefundPaymentMethodId(refundableMethods[0].id);
  }, [refundPaymentMethodId, refundableMethods]);

  const handleRefund = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRefund) return;
    mutations.createRefund.mutate({
      paymentId: refundPaymentId.trim(),
      amount: Number(refundAmount),
      reason: refundReason || undefined,
      paymentMethodId: refundPaymentMethodId,
      financialInstitutionId: refundFinancialInstitutionId || undefined,
      reference: refundReference || undefined
    });
  };

  if (payments.isLoading) return <LoadingState message="Cargando pagos..." />;
  if (payments.isError) return <ErrorState message={payments.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagos"
        description="Registro de pagos, abonos y devoluciones."
        helpText="Registro maestro de transacciones financieras. Permite recibir pagos y abonos generales de pacientes, registrar devoluciones de dinero y consultar el listado histórico de movimientos con sus respectivas sucursales y estados."
      />

      {/* Registrar Pago */}
      <Card>
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-800">Registrar Pago / Abono de Paciente</h3>
          <HelpTooltip content="Crea un abono general a la cuenta del paciente. Posteriormente este abono se puede aplicar a prestaciones de sus tratamientos." />
        </div>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={handleCreate}>
          <div className="flex items-center gap-1.5 w-full">
            <Select
              value={newBranchId}
              onChange={(event) => {
                setNewBranchId(event.target.value);
                setBranchId(event.target.value);
              }}
              className="flex-1"
            >
              <option value="">Sucursal activa</option>
              {branches.data?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <HelpTooltip content="Sucursal física donde se recibe y procesa el cobro." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <PatientSearchBox
              placeholder="Buscar paciente"
              value={newPatientSearch}
              onValueChange={(value) => {
                setNewPatientSearch(value);
                setNewPatientId("");
              }}
              onSelect={(patient) => {
                setNewPatientSearch(getPatientSearchLabel(patient));
                setNewPatientId(patient.id);
              }}
              onSubmit={(value) => setNewPatientId(value.trim())}
              className="flex-1"
            />
            <HelpTooltip content="ID del paciente que realiza el pago." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Select
              value={newPaymentMethodId}
              onChange={(event) => setNewPaymentMethodId(event.target.value)}
              className="flex-1"
            >
              <option value="">Metodo de pago</option>
              {paymentMethods.data?.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </Select>
            <HelpTooltip content="Medio de pago utilizado por el paciente (efectivo, tarjeta bancaria, transferencia)." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Select
              value={newFinancialInstitutionId}
              onChange={(event) => setNewFinancialInstitutionId(event.target.value)}
              className="flex-1"
            >
              <option value="">Banco / entidad</option>
              {financialInstitutions.data?.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </Select>
            <HelpTooltip content="Entidad financiera asociada a transferencias, depositos o cheques cuando aplica." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input
              placeholder="Monto"
              type="number"
              min="0"
              step="0.01"
              value={newAmount}
              onChange={(event) => setNewAmount(event.target.value)}
              className="flex-1"
            />
            <HelpTooltip content="Monto de dinero recibido del paciente en la transacción." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input
              placeholder="Referencia"
              value={newReference}
              onChange={(event) => setNewReference(event.target.value)}
              className="flex-1"
            />
            <HelpTooltip content="Código de autorización de tarjeta, número de transferencia bancaria o número de cheque para conciliaciones." />
          </div>

          <Button type="submit" disabled={!canCreate || mutations.createPayment.isPending}>
            Registrar pago
          </Button>

          <div className="md:col-span-6 flex items-center gap-1.5 w-full">
            <Input
              placeholder="Notas"
              value={newNotes}
              onChange={(event) => setNewNotes(event.target.value)}
              className="flex-1"
            />
            <HelpTooltip content="Observaciones internas o comentarios adicionales referentes a este pago." />
          </div>
        </form>
      </Card>

      {/* Registrar Devolución */}
      <Card>
        <div className="mb-2 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-800">Registrar Devolución de Fondos (Reembolso)</h3>
          <HelpTooltip content="Devuelve dinero previamente cobrado a un paciente por un tratamiento no realizado o por saldo a favor." />
        </div>
        <form className="grid gap-3 md:grid-cols-6" onSubmit={handleRefund}>
          <div className="flex items-center gap-1.5 w-full">
            <EntitySearchBox
              placeholder="paymentId para devolucion"
              value={refundPaymentId}
              onValueChange={setRefundPaymentId}
              items={refundPaymentId.trim() ? refundPaymentSuggestions : []}
              onSelect={(payment) => setRefundPaymentId(payment.id)}
              getItemKey={(payment) => payment.id}
              emptyMessage="Sin pagos encontrados"
              renderItem={(payment) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {paymentPatientName(payment)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {payment.reference || payment.id} · {payment.amount} {payment.currency}
                  </p>
                </div>
              )}
              className="flex-1"
            />
            <HelpTooltip content="ID del pago original recibido sobre el cual se aplicará el reembolso." />
          </div>

          <Select
            value={refundPaymentMethodId}
            onChange={(event) => setRefundPaymentMethodId(event.target.value)}
          >
            <option value="">Medio de devolución</option>
            {refundableMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </Select>

          <Select
            value={refundFinancialInstitutionId}
            onChange={(event) => setRefundFinancialInstitutionId(event.target.value)}
          >
            <option value="">Banco / entidad</option>
            {financialInstitutions.data?.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </Select>

          <Input
            placeholder="Referencia de devolución"
            value={refundReference}
            onChange={(event) => setRefundReference(event.target.value)}
          />

          <div className="flex items-center gap-1.5 w-full">
            <Input
              placeholder="Monto a devolver"
              type="number"
              min="0"
              step="0.01"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              className="flex-1"
            />
            <HelpTooltip content="Monto parcial o total que se reembolsará al paciente." />
          </div>

          <div className="flex items-center gap-1.5 w-full">
            <Input
              placeholder="Motivo"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              className="flex-1"
            />
            <HelpTooltip content="Justificación clínica o administrativa de la devolución de fondos." />
          </div>

          <Button type="submit" variant="secondary" disabled={!canRefund || mutations.createRefund.isPending}>
            Registrar devolucion
          </Button>
        </form>
      </Card>

      {/* Filtros */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="flex items-center gap-1.5 w-full">
          <EntitySearchBox
            placeholder="Buscar por paciente o referencia"
            value={search}
            onValueChange={setSearch}
            items={search.trim() ? (payments.data ?? []) : []}
            onSelect={(payment) => setSearch(paymentSearchLabel(payment))}
            getItemKey={(payment) => payment.id}
            emptyMessage="Sin pagos encontrados"
            renderItem={(payment) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{paymentPatientName(payment)}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {payment.reference || payment.id} · {payment.branch.name}
                </p>
              </div>
            )}
            className="flex-1"
          />
          <HelpTooltip content="Busca transacciones ingresando el nombre del paciente o el código de referencia del pago." />
        </div>

        <div className="flex items-center gap-1.5 w-full">
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="flex-1">
            <option value="">Sucursal activa</option>
            {branches.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <HelpTooltip content="Filtra las transacciones recibidas por sucursal física." />
        </div>

        <div className="flex items-center gap-1.5 w-full">
          <Select
            value={status}
            onChange={(event) => setStatus((event.target.value as PaymentStatus) || "")}
            className="flex-1"
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <HelpTooltip content="Filtra transacciones por su estado de conciliación: RECEIVED (Recibido sin aplicar), PARTIALLY_ALLOCATED (Abonado parcialmente a prestaciones), ALLOCATED (Totalmente aplicado a prestaciones clínicas) o REFUNDED (Devuelto)." />
        </div>
      </div>

      <DataTable
        rows={payments.data ?? []}
        stickyFirstColumn={true}
        stickyLastColumn={true}
        responsiveCards={true}
        empty={<EmptyState title="Sin pagos" description="No existen pagos para los filtros actuales." />}
        columns={[
          {
            key: "patient",
            title: "Paciente",
            render: (row) => `${row.patient.firstName} ${row.patient.lastName}`
          },
          { key: "branch", title: "Sucursal", render: (row) => row.branch.name },
          { key: "amount", title: "Monto", render: (row) => `${row.amount} ${row.currency}` },
          { key: "paymentMethod", title: "Metodo", render: (row) => row.paymentMethod.name },
          {
            key: "status",
            title: "Estado",
            render: (row) => <Badge value={row.status} tone={statusTone[row.status]} />
          },
          { key: "paidAt", title: "Fecha", render: (row) => new Date(row.paidAt).toLocaleString() },
          {
            key: "allocations",
            title: (
              <span className="flex items-center gap-1.5">
                Aplicaciones
                <HelpTooltip content="Número de prestaciones clínicas específicas a las cuales se ha distribuido e imputado este pago." />
              </span>
            ),
            render: (row) => String(row.allocations.length)
          },
          {
            key: "financialInstitution",
            title: "Entidad",
            render: (row) => row.financialInstitution?.name ?? "-"
          },
          {
            key: "id",
            title: "Acciones",
            render: (row) => (
              <Button
                variant="danger"
                disabled={row.status === "VOIDED" || mutations.voidPayment.isPending}
                onClick={() => {
                  const reason = window.prompt("Motivo de anulacion del pago");
                  if (reason?.trim())
                    mutations.voidPayment.mutate({ paymentId: row.id, reason: reason.trim() });
                }}
              >
                Anular
              </Button>
            )
          }
        ]}
      />
    </div>
  );
}
