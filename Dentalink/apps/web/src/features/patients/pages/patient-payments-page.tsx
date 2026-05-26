import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSectionPage } from "../components/patient-section-page";
import { usePatientPayments } from "@/features/payments/hooks/use-payments";

export function PatientPaymentsPage() {
  const { id = "" } = useParams();
  const payments = usePatientPayments(id);

  if (payments.isLoading) return <LoadingState message="Cargando pagos del paciente..." />;
  if (payments.isError) return <ErrorState message={payments.error.message} />;
  if (!payments.data) return <EmptyState title="Sin datos" description="No se pudo cargar el estado financiero del paciente." />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - Pagos" description="Estado financiero del paciente.">
      <Card className="grid gap-3 md:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-slate-500">Planificado</p>
          <p className="font-medium text-slate-900">{payments.data.balance.plannedAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Pagado aplicado</p>
          <p className="font-medium text-slate-900">{payments.data.balance.allocatedPaidAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Saldo pendiente</p>
          <p className="font-medium text-rose-700">{payments.data.balance.outstandingAmount.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Cuotas vencidas</p>
          <p className="font-medium text-amber-700">{payments.data.balance.overdueInstallments}</p>
        </div>
      </Card>

      <DataTable
        rows={payments.data.payments}
        empty={<EmptyState title="Sin pagos" description="El paciente no tiene pagos registrados." />}
        columns={[
          { key: "paidAt", title: "Fecha", render: (row) => new Date(row.paidAt).toLocaleString() },
          { key: "amount", title: "Monto", render: (row) => `${row.amount} ${row.currency}` },
          { key: "paymentMethod", title: "Metodo", render: (row) => row.paymentMethod.name },
          { key: "status", title: "Estado", render: (row) => <Badge value={row.status} tone={row.status === "REFUNDED" ? "danger" : "success"} /> },
          { key: "allocations", title: "Aplicaciones", render: (row) => String(row.allocations.length) }
        ]}
      />
    </PatientSectionPage>
  );
}
