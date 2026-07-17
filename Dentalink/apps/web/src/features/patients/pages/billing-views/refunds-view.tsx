import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useRefunds } from "@/features/payments/hooks/use-payments";
import { dateTime, money, refundStatusLabels, refundStatusTone } from "./shared-helpers";

export function RefundsView() {
  const { id = "" } = useParams();
  const refunds = useRefunds({ patientId: id }, true);

  if (refunds.isLoading) return <LoadingState message="Cargando devoluciones..." />;
  if (refunds.isError) return <ErrorState message={refunds.error.message} />;

  const rows = refunds.data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const processed = rows.filter((row) => row.status === "PROCESSED").reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Devoluciones</h2>
        <p className="text-sm text-slate-500">Salidas de dinero vinculadas al pago original.</p>
      </div>
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <RefundMetric label="Devoluciones" value={String(rows.length)} />
        <RefundMetric label="Total solicitado" value={money(total)} />
        <RefundMetric label="Procesado" value={money(processed)} />
      </Card>
      <DataTable
        rows={rows}
        empty={<EmptyState title="No se han registrado devoluciones." description="El paciente no tiene devoluciones registradas." />}
        columns={[
          { key: "createdAt", title: "Fecha", render: (row) => dateTime(row.processedAt ?? row.createdAt) },
          { key: "paymentId", title: "Pago original", render: (row) => `#${row.payment.paymentNumber ?? "-"}` },
          { key: "amount", title: "Monto", render: (row) => money(row.amount) },
          { key: "reason", title: "Motivo", render: (row) => row.reason ?? "-" },
          { key: "processedBy", title: "Procesado por", render: (row) => userLabel(row.processedBy) },
          { key: "status", title: "Estado", render: (row) => <Badge value={refundStatusLabels[row.status]} tone={refundStatusTone(row.status)} /> }
        ]}
      />
    </div>
  );
}

function RefundMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function userLabel(user?: { firstName?: string | null; lastName?: string | null } | null) {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "-";
}
