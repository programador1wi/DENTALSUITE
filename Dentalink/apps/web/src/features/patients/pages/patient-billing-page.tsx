import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientHeader } from "../components/patient-header";
import { PatientSecondaryNav } from "../components/patient-secondary-nav";
import { PatientSubnav } from "../components/patient-subnav";
import { usePatient } from "../hooks/use-patients";
import { usePatientPayments, useRefunds } from "@/features/payments/hooks/use-payments";
import type { PaymentStatus, RefundStatus } from "@/features/payments/services/payments.service";
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
  return (
    <DataTable
      rows={rows}
      empty={<EmptyState title="Sin pagos" description="El paciente no cuenta con pagos en el sistema." />}
      columns={[
        { key: "paidAt", title: "Fecha", render: (row) => dateTime(row.paidAt) },
        { key: "amount", title: "Monto", render: (row) => money(row.amount) },
        { key: "paymentMethod", title: "Metodo", render: (row) => row.paymentMethod.name },
        { key: "reference", title: "Referencia", render: (row) => row.reference ?? "-" },
        { key: "status", title: "Estado", render: (row) => <Badge value={paymentStatusLabels[row.status]} tone={paymentStatusTone(row.status)} /> },
        { key: "allocations", title: "Aplicaciones", render: (row) => String(row.allocations.length) }
      ]}
    />
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
        { key: "paymentId", title: "Pago", render: (row) => `#${row.payment.id.slice(-6).toUpperCase()}` },
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
