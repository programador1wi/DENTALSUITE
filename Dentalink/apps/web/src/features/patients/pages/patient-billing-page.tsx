import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChevronDown, Download, FileText, ListChecks, Pencil, Printer, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { Modal } from "@/components/ui/modal";
import { PatientHeader } from "../components/patient-header";
import { PatientSecondaryNav } from "../components/patient-secondary-nav";
import { PatientSubnav } from "../components/patient-subnav";
import { Select } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { usePatient } from "../hooks/use-patients";
import { usePatientPayments, usePaymentsMutations, useRefunds } from "@/features/payments/hooks/use-payments";
import { downloadPaymentReceiptPdf, type Payment, type PaymentStatus, type RefundStatus } from "@/features/payments/services/payments.service";
import { useFinancialInstitutions } from "@/features/settings/financial-institutions/hooks/use-financial-institutions";
import { usePaymentMethods } from "@/features/settings/payment-methods/hooks/use-payment-methods";
import { useBudgets } from "@/features/treatments/hooks/use-treatments";

type BillingTab = "payments" | "documents" | "coverage" | "refunds" | "deleted" | "balance";

const paymentStatusLabels: Record<PaymentStatus, string> = {
  RECEIVED: "Recibido",
  PARTIALLY_ALLOCATED: "Parcialmente aplicado",
  ALLOCATED: "Aplicado",
  REFUNDED: "Devuelto",
  VOIDED: "Anulado"
};

const refundStatusLabels: Record<RefundStatus, string> = {
  PENDING: "Pendiente",
  PROCESSED: "Procesado",
  REJECTED: "Rechazado"
};

function billingTabs(patientId: string) {
  return [
    { to: `/patients/${patientId}/billing`, label: "Pagos" },
    { to: `/patients/${patientId}/billing/documents`, label: "Documentos emitidos" },
    { to: `/patients/${patientId}/billing/coverage`, label: "Coberturas" },
    { to: `/patients/${patientId}/billing/refunds`, label: "Devoluciones" },
    { to: `/patients/${patientId}/billing/deleted`, label: "Pagos eliminados" },
    { to: `/patients/${patientId}/billing/balance`, label: "Balance" }
  ];
}

function normalizeBillingTab(value?: string): BillingTab {
  if (value === "documents" || value === "coverage" || value === "refunds" || value === "deleted" || value === "balance") return value;
  return "payments";
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(value ?? 0) || 0);
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-MX");
}

function dateOnly(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-MX");
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function userName(user?: { firstName?: string | null; lastName?: string | null } | null) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "-";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paymentStatusTone(status: PaymentStatus) {
  if (status === "ALLOCATED") return "success";
  if (status === "REFUNDED" || status === "VOIDED") return "danger";
  return "warning";
}

function refundStatusTone(status: RefundStatus) {
  if (status === "PROCESSED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export function PatientBillingPage() {
  const { id = "", billingTab } = useParams();
  const activeTab = normalizeBillingTab(billingTab);
  const patient = usePatient(id);
  const payments = usePatientPayments(id);
  const refunds = useRefunds({ patientId: id }, activeTab === "refunds");
  const budgets = useBudgets({ patientId: id }, activeTab === "documents");

  if (patient.isLoading || payments.isLoading) return <LoadingState message="Cargando facturacion del paciente..." />;
  if (patient.isError) return <ErrorState message={patient.error.message} />;
  if (payments.isError) return <ErrorState message={payments.error.message} />;
  if (!patient.data || !payments.data) return <EmptyState title="Sin datos" description="No se pudo cargar el estado financiero del paciente." />;

  const patientPayments = payments.data.payments;
  const activePayments = patientPayments.filter((payment) => payment.status !== "VOIDED");
  const deletedPayments = patientPayments.filter((payment) => payment.status === "VOIDED");
  const balance = payments.data.balance;

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />
      <PatientSecondaryNav tabs={billingTabs(id)} label="Facturacion y pagos" />

      {activeTab === "payments" ? <PaymentsReceivedTab rows={activePayments} /> : null}
      {activeTab === "documents" ? <IssuedDocumentsTab budgets={budgets} links={payments.data.links} /> : null}
      {activeTab === "coverage" ? <CoverageTab agreement={patient.data.agreement ?? null} /> : null}
      {activeTab === "refunds" ? <RefundsTab refunds={refunds} /> : null}
      {activeTab === "deleted" ? <DeletedPaymentsTab rows={deletedPayments} /> : null}
      {activeTab === "balance" ? <BalanceTab balance={balance} installments={payments.data.installments} links={payments.data.links} /> : null}
    </div>
  );
}

function PaymentsReceivedTab({ rows }: { rows: NonNullable<ReturnType<typeof usePatientPayments>["data"]>["payments"] }) {
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [breakdownPayment, setBreakdownPayment] = useState<Payment | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const mutations = usePaymentsMutations();
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission("payments.update") || hasPermission("system.manage_all");
  const canVoid = hasPermission("payments.refund") || hasPermission("system.manage_all");

  const handlePrint = (payment: Payment) => {
    window.open(`/payments/${payment.paymentNumber}/receipt?print=1`, "_blank", "width=980,height=900");
  };

  const handleDownload = async (payment: Payment) => {
    const result = await downloadPaymentReceiptPdf(payment.paymentNumber);
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleVoid = async () => {
    if (!voidingPayment || !voidReason.trim()) return;
    await mutations.voidPayment.mutateAsync({ paymentId: voidingPayment.id, reason: voidReason.trim() });
    setVoidingPayment(null);
    setVoidReason("");
  };

  return (
    <>
      <DataTable
        rows={rows}
        empty={<EmptyState title="Sin pagos" description="El paciente no cuenta con pagos en el sistema." />}
        tableClassName="text-[var(--text-sm)]"
        columns={[
          {
            key: "paymentNumber",
            title: "# Pago",
            render: (row) => (
              <div>
                <p className="font-[var(--weight-bold)] text-[var(--text-primary)]">{row.paymentNumber}</p>
                {row.reference ? <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">Referencia: {row.reference}</p> : null}
              </div>
            )
          },
          {
            key: "treatmentRefs",
            title: "# Trat.",
            render: (row) => {
              const refs = row.treatmentRefs ?? row.treatments ?? [];
              return refs.length ? refs.map((treatment) => treatment.number).join(", ") : "-";
            }
          },
          {
            key: "paymentMethod",
            title: "Medio de pago",
            render: (row) => (
              <div>
                <p className="font-[var(--weight-medium)] text-[var(--text-primary)]">
                  {row.paymentMethods && row.paymentMethods.length > 1 ? `Pago mixto · ${row.paymentMethods.length} medios` : row.paymentMethods?.[0]?.name ?? row.paymentMethod.name}
                </p>
                {row.paymentMethods && row.paymentMethods.length > 1 ? (
                  <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                    {row.paymentMethods.map((method) => method.name).join(" + ")}
                  </p>
                ) : null}
                <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">
                  Recibido por {userName(row.receivedBy)}, en sucursal {row.branch.name}
                </p>
              </div>
            ),
            wrap: true
          },
          { key: "ticketId", title: "ID ticket", render: (row) => row.ticketId ?? "-" },
          { key: "paidAt", title: "Recepcion", render: (row) => dateTime(row.paidAt) },
          { key: "dueDate", title: "Vencimiento", render: (row) => (row.dueDate ? dateOnly(row.dueDate) : "-") },
          {
            key: "amount",
            title: "Monto",
            render: (row) => (
              <div className="text-right">
                <p className="font-[var(--weight-bold)] text-[var(--text-primary)]">{money(row.amount)}</p>
                <button type="button" className="text-[var(--text-xs)] text-[var(--text-brand)] hover:underline" onClick={() => setBreakdownPayment(row)}>
                  Ver desglose
                </button>
              </div>
            )
          },
          { key: "status", title: "Estado", render: (row) => <Badge value={paymentStatusLabels[row.status]} tone={paymentStatusTone(row.status)} /> },
          {
            key: "receipt",
            title: "Acciones",
            render: (row) => (
              <div className="relative flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => setActionsFor(actionsFor === row.id ? null : row.id)}>
                  Acciones <ChevronDown className="h-4 w-4" />
                </Button>
                {actionsFor === row.id ? (
                  <div className="absolute right-0 top-9 z-20 w-64 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-1)] shadow-[var(--shadow-modal)]">
                    <ActionMenuButton icon={<FileText className="h-4 w-4" />} onClick={() => { setActionsFor(null); window.open(`/payments/${row.paymentNumber}/receipt`, "_blank", "width=980,height=900"); }}>
                      Ver comprobante
                    </ActionMenuButton>
                    <ActionMenuButton icon={<ListChecks className="h-4 w-4" />} onClick={() => { setBreakdownPayment(row); setActionsFor(null); }}>
                      Ver desglose
                    </ActionMenuButton>
                    <ActionMenuButton icon={<Printer className="h-4 w-4" />} onClick={() => { setActionsFor(null); handlePrint(row); }}>
                      Imprimir comprobante
                    </ActionMenuButton>
                    <ActionMenuButton icon={<Download className="h-4 w-4" />} onClick={() => { setActionsFor(null); void handleDownload(row); }}>
                      Descargar PDF
                    </ActionMenuButton>
                    <ActionMenuButton disabled={!canUpdate || row.status === "VOIDED" || row.status === "REFUNDED"} icon={<Pencil className="h-4 w-4" />} onClick={() => { setEditingPayment(row); setActionsFor(null); }}>
                      Modificar datos
                    </ActionMenuButton>
                    <ActionMenuButton danger disabled={!canVoid || row.status === "VOIDED" || row.status === "REFUNDED"} icon={<Trash2 className="h-4 w-4" />} onClick={() => { setVoidingPayment(row); setActionsFor(null); }}>
                      Anular pago
                    </ActionMenuButton>
                  </div>
                ) : null}
              </div>
            )
          }
        ]}
      />

      <PaymentBreakdownModal payment={breakdownPayment} onClose={() => setBreakdownPayment(null)} />
      <EditPaymentModal payment={editingPayment} onClose={() => setEditingPayment(null)} />
      <Modal open={Boolean(voidingPayment)} title={`Anular pago #${voidingPayment?.paymentNumber ?? ""}`} onClose={() => setVoidingPayment(null)}>
        <div className="space-y-3">
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">La anulacion revierte aplicaciones y registra contramovimiento de caja. El pago queda auditado.</p>
          <Input placeholder="Motivo obligatorio" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
          <div className="flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={() => setVoidingPayment(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" disabled={!voidReason.trim() || mutations.voidPayment.isPending} onClick={() => void handleVoid()}>
              Anular pago
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ActionMenuButton({
  children,
  danger,
  disabled,
  icon,
  onClick
}: {
  children: string;
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[var(--text-sm)] transition-colors hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50 ${
        danger ? "text-[var(--text-danger)]" : "text-[var(--text-primary)]"
      }`}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function PaymentBreakdownModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  if (!payment) return null;

  return (
    <Modal open={Boolean(payment)} title={`Desglose de pago #${payment.paymentNumber}`} onClose={onClose} size="xl">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[var(--text-sm)]">
          <thead>
            <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-xs)] font-[var(--weight-bold)] text-[var(--text-secondary)]">
              <th className="px-[var(--space-3)] py-[var(--space-2)]"># Trat.</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)]">Detalle</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)] text-right">Precio</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)] text-right">Pagado</th>
              <th className="px-[var(--space-3)] py-[var(--space-2)] text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {payment.breakdown.length ? (
              payment.breakdown.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border-default)]">
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-brand)]">{row.treatmentNumber}</td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)]">
                    <p className="font-[var(--weight-medium)] text-[var(--text-primary)]">{row.detail}</p>
                    <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{row.treatmentName}</p>
                  </td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">{money(row.baseAmount)}</td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">{money(row.paidAmount)}</td>
                  <td className="px-[var(--space-3)] py-[var(--space-2)] text-right">{money(row.remainingAmount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-[var(--space-3)] py-[var(--space-4)] text-[var(--text-secondary)]" colSpan={5}>
                  Pago recibido sin aplicaciones a tratamientos o cuotas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-[var(--space-4)] grid gap-[var(--space-3)] md:grid-cols-3">
        <BillingMetric label="Monto pago" value={money(payment.amount)} />
        <BillingMetric label="Aplicado" value={money(payment.allocatedAmount)} tone="success" />
        <BillingMetric label="Sin aplicar" value={money(payment.unallocatedAmount)} tone="danger" />
      </div>
    </Modal>
  );
}

function EditPaymentModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const paymentMethods = usePaymentMethods(undefined, "true");
  const financialInstitutions = useFinancialInstitutions(undefined, "true");
  const mutations = usePaymentsMutations();
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [financialInstitutionId, setFinancialInstitutionId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState("");

  useEffect(() => {
    if (!payment) return;
    setPaymentMethodId(payment.paymentMethod.id);
    setFinancialInstitutionId(payment.financialInstitution?.id ?? "");
    setReference(payment.reference ?? "");
    setNotes(payment.notes ?? "");
    setPaidAt(toDateTimeLocal(payment.paidAt));
  }, [payment]);

  if (!payment) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await mutations.updatePayment.mutateAsync({
      paymentId: payment.id,
      payload: {
        paymentMethodId,
        financialInstitutionId,
        reference,
        notes,
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined
      }
    });
    onClose();
  };

  return (
    <Modal open={Boolean(payment)} title={`Modificar pago #${payment.paymentNumber}`} onClose={onClose} size="lg">
      <form className="grid gap-[var(--space-3)]" onSubmit={(event) => void handleSubmit(event)}>
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
        <Input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
        <Input placeholder="Referencia" value={reference} onChange={(event) => setReference(event.target.value)} />
        <Input placeholder="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="flex justify-end gap-[var(--space-2)]">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!paymentMethodId || mutations.updatePayment.isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function IssuedDocumentsTab({
  budgets,
  links
}: {
  budgets: ReturnType<typeof useBudgets>;
  links: NonNullable<ReturnType<typeof usePatientPayments>["data"]>["links"];
}) {
  if (budgets.isLoading) return <LoadingState message="Cargando documentos emitidos..." />;
  if (budgets.isError) return <ErrorState message={budgets.error.message} />;

  const rows = [
    ...(budgets.data ?? []).map((budget) => ({
      id: budget.id,
      type: "Presupuesto",
      status: budget.status,
      amount: budget.total,
      detail: budget.treatmentPlanId
    })),
    ...links.map((link) => ({
      id: link.id,
      type: "Link de pago",
      status: link.status,
      amount: link.amount,
      detail: link.url
    }))
  ];

  return (
    <DataTable
      rows={rows}
      empty={<EmptyState title="Sin documentos emitidos" description="No hay presupuestos ni links de pago emitidos para este paciente." />}
      columns={[
        { key: "type", title: "Documento", render: (row) => row.type },
        { key: "id", title: "Folio", render: (row) => `#${row.id.slice(-6).toUpperCase()}` },
        { key: "status", title: "Estado", render: (row) => row.status },
        { key: "amount", title: "Monto", render: (row) => money(row.amount) },
        { key: "detail", title: "Detalle", render: (row) => row.detail }
      ]}
    />
  );
}

function CoverageTab({
  agreement
}: {
  agreement: {
    id: string;
    name: string;
    discountPercent: string;
    priceList?: { id: string; name: string; isDefault: boolean } | null;
  } | null;
}) {
  if (!agreement) return <EmptyState title="Sin coberturas" description="El paciente no tiene convenio o cobertura asociada." />;

  return (
    <Card className="grid gap-4 md:grid-cols-3">
      <BillingMetric label="Convenio" value={agreement.name} />
      <BillingMetric label="Descuento" value={`${Number(agreement.discountPercent || 0).toFixed(0)}%`} />
      <BillingMetric label="Arancel" value={agreement.priceList?.name ?? "Sin arancel asociado"} />
    </Card>
  );
}

function RefundsTab({ refunds }: { refunds: ReturnType<typeof useRefunds> }) {
  if (refunds.isLoading) return <LoadingState message="Cargando devoluciones..." />;
  if (refunds.isError) return <ErrorState message={refunds.error.message} />;

  return (
    <DataTable
      rows={refunds.data ?? []}
      empty={<EmptyState title="Sin devoluciones" description="No hay devoluciones registradas para este paciente." />}
      columns={[
        { key: "createdAt", title: "Fecha", render: (row) => dateTime(row.processedAt ?? row.createdAt) },
        { key: "paymentId", title: "Pago", render: (row) => `#${row.payment.paymentNumber ?? "-"}` },
        { key: "amount", title: "Monto", render: (row) => money(row.amount) },
        { key: "reason", title: "Motivo", render: (row) => row.reason ?? "-" },
        { key: "status", title: "Estado", render: (row) => <Badge value={refundStatusLabels[row.status]} tone={refundStatusTone(row.status)} /> }
      ]}
    />
  );
}

function DeletedPaymentsTab({ rows }: { rows: NonNullable<ReturnType<typeof usePatientPayments>["data"]>["payments"] }) {
  return (
    <DataTable
      rows={rows}
      empty={<EmptyState title="Sin pagos eliminados" description="No hay pagos anulados para este paciente." />}
      columns={[
        { key: "paidAt", title: "Fecha", render: (row) => dateTime(row.voidedAt ?? row.paidAt) },
        { key: "amount", title: "Monto", render: (row) => money(row.amount) },
        { key: "paymentMethod", title: "Metodo", render: (row) => row.paymentMethod.name },
        { key: "voidReason", title: "Motivo", render: (row) => row.voidReason ?? "-" },
        { key: "status", title: "Estado", render: (row) => <Badge value={paymentStatusLabels[row.status]} tone="danger" /> }
      ]}
    />
  );
}

function BalanceTab({
  balance,
  installments,
  links
}: {
  balance: NonNullable<ReturnType<typeof usePatientPayments>["data"]>["balance"];
  installments: NonNullable<ReturnType<typeof usePatientPayments>["data"]>["installments"];
  links: NonNullable<ReturnType<typeof usePatientPayments>["data"]>["links"];
}) {
  return (
    <div className="space-y-4">
      <Card className="grid gap-3 md:grid-cols-6">
        <BillingMetric label="Planificado" value={money(balance.plannedAmount)} />
        <BillingMetric label="Pagado aplicado" value={money(balance.allocatedPaidAmount)} />
        <BillingMetric label="Pagado total" value={money(balance.totalPaidAmount)} />
        <BillingMetric label="Saldo pendiente" value={money(balance.outstandingAmount)} tone="danger" />
        <BillingMetric label="Credito sin aplicar" value={money(balance.unallocatedCredit)} tone="success" />
        <BillingMetric label="Cuotas vencidas" value={String(balance.overdueInstallments)} tone={balance.overdueInstallments ? "danger" : "default"} />
      </Card>

      <DataTable
        rows={installments}
        empty={<EmptyState title="Sin cuotas" description="El paciente no tiene cuotas de financiamiento registradas." />}
        columns={[
          { key: "number", title: "Cuota", render: (row) => String(row.number) },
          { key: "dueDate", title: "Vencimiento", render: (row) => dateTime(row.dueDate) },
          { key: "amount", title: "Monto", render: (row) => money(row.amount) },
          { key: "paidAmount", title: "Pagado", render: (row) => money(row.paidAmount) },
          { key: "status", title: "Estado", render: (row) => row.status }
        ]}
      />

      <DataTable
        rows={links}
        empty={<EmptyState title="Sin links de pago" description="No hay links de pago para este paciente." />}
        columns={[
          { key: "amount", title: "Monto", render: (row) => money(row.amount) },
          { key: "status", title: "Estado", render: (row) => row.status },
          { key: "expiresAt", title: "Vence", render: (row) => dateTime(row.expiresAt) },
          { key: "paidAt", title: "Pagado", render: (row) => dateTime(row.paidAt) },
          { key: "url", title: "Link", render: (row) => row.url }
        ]}
      />
    </div>
  );
}

function BillingMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : tone === "danger" ? "text-rose-700" : "text-slate-900";
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`font-medium ${toneClass}`}>{value}</p>
    </div>
  );
}
