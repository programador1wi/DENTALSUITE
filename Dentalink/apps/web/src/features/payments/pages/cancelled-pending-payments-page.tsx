import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useBranchStore } from "@/stores/branch.store";
import { usePaymentLinks, usePayments } from "../hooks/use-payments";

export function CancelledPendingPaymentsPage() {
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const voidedPayments = usePayments({ status: "VOIDED", branchId: activeBranchId || undefined });
  const paymentLinks = usePaymentLinks();
  if (voidedPayments.isLoading || paymentLinks.isLoading) return <LoadingState message="Cargando pagos anulados y pendientes..." />;
  if (voidedPayments.isError) return <ErrorState message={voidedPayments.error.message} />;
  if (paymentLinks.isError) return <ErrorState message={paymentLinks.error.message} />;

  const pendingLinks = (paymentLinks.data ?? []).filter((link) => ["CREATED", "EXPIRED", "CANCELLED"].includes(link.status));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagos anulados y pendientes"
        description="Anulaciones internas y cobros TPV que aun no terminan en un pago recibido."
      />
      <DataTable
        rows={voidedPayments.data ?? []}
        empty={<EmptyState title="Sin pagos anulados" description="No hay pagos anulados registrados." />}
        columns={[
          { key: "patient", title: "Paciente", render: (row) => `${row.patient.firstName} ${row.patient.lastName}` },
          { key: "amount", title: "Monto", render: (row) => `${row.amount} ${row.currency}` },
          { key: "paymentMethod", title: "Metodo", render: (row) => row.paymentMethod.name },
          { key: "voidedAt", title: "Anulado", render: (row) => row.voidedAt ? new Date(row.voidedAt).toLocaleString() : "-" },
          { key: "voidReason", title: "Motivo", render: (row) => row.voidReason ?? "-" }
        ]}
      />
      <DataTable
        rows={pendingLinks}
        empty={<EmptyState title="Sin cobros pendientes" description="No hay links TPV creados, vencidos o cancelados." />}
        columns={[
          { key: "patient", title: "Paciente", render: (row) => `${row.patient.firstName} ${row.patient.lastName}` },
          { key: "amount", title: "Monto", render: (row) => `$${Number(row.amount).toFixed(2)}` },
          { key: "status", title: "Estado", render: (row) => <Badge value={row.status} tone={row.status === "CREATED" ? "warning" : "danger"} /> },
          { key: "createdAt", title: "Creado", render: (row) => new Date(row.createdAt).toLocaleString() },
          { key: "expiresAt", title: "Vence", render: (row) => row.expiresAt ? new Date(row.expiresAt).toLocaleString() : "-" }
        ]}
      />
    </div>
  );
}
