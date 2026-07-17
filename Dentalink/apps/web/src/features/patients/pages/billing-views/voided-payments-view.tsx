import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePatientVoidedPayments } from "@/features/payments/hooks/use-payments";
import { dateTime, money, paymentStatusLabels } from "./shared-helpers";

export function VoidedPaymentsView() {
  const { id = "" } = useParams();
  const payments = usePatientVoidedPayments(id);

  if (payments.isLoading) return <LoadingState message="Cargando pagos anulados..." />;
  if (payments.isError) return <ErrorState message={payments.error.message} />;

  const rows = payments.data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Pagos eliminados</h2>
        <p className="text-sm text-slate-500">Pagos anulados por reverso, sin borrado fisico.</p>
      </div>
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <VoidMetric label="Pagos anulados" value={String(rows.length)} />
        <VoidMetric label="Monto revertido" value={money(total)} />
        <VoidMetric label="Reactivacion" value="No permitida" />
      </Card>
      <DataTable
        rows={rows}
        empty={<EmptyState title="No existen pagos anulados." description="El paciente no tiene pagos anulados." />}
        columns={[
          { key: "paymentNumber", title: "# Pago", render: (row) => row.paymentNumber },
          { key: "voidedAt", title: "Anulado", render: (row) => dateTime(row.voidedAt ?? row.paidAt) },
          { key: "amount", title: "Monto", render: (row) => money(row.amount) },
          { key: "paymentMethod", title: "Metodo", render: (row) => row.paymentMethods?.map((method) => method.name).join(" + ") || row.paymentMethod.name },
          { key: "voidReason", title: "Motivo", render: (row) => row.voidReason ?? "-" },
          { key: "status", title: "Estado", render: (row) => <Badge value={paymentStatusLabels[row.status]} tone="danger" /> }
        ]}
      />
    </div>
  );
}

function VoidMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
