import { Outlet, useParams } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PatientHeader } from "../components/patient-header";
import { PatientSecondaryNav } from "../components/patient-secondary-nav";
import { PatientSubnav } from "../components/patient-subnav";
import { usePatient } from "../hooks/use-patients";

function billingTabs(patientId: string) {
  return [
    { to: `/patients/${patientId}/billing/payments`, label: "Pagos" },
    { to: `/patients/${patientId}/billing/documents`, label: "Documentos emitidos" },
    {
      to: `/patients/${patientId}/billing/coverages/reimbursements`,
      label: "Coberturas",
      activeMatch: `/patients/${patientId}/billing/coverages`,
      children: [
        { to: `/patients/${patientId}/billing/coverages/reimbursements`, label: "Solicitudes de reembolso" },
        { to: `/patients/${patientId}/billing/coverages/online-benefits`, label: "Bonificaciones en linea" }
      ]
    },
    { to: `/patients/${patientId}/billing/refunds`, label: "Devoluciones" },
    { to: `/patients/${patientId}/billing/voided-payments`, label: "Pagos eliminados" },
    { to: `/patients/${patientId}/billing/balance`, label: "Balance" }
  ];
}

export function PatientBillingLayout() {
  const { id = "" } = useParams();
  const patient = usePatient(id);

  if (patient.isLoading) return <LoadingState message="Cargando facturacion del paciente..." />;
  if (patient.isError) return <ErrorState message={patient.error?.message ?? "Error"} />;
  if (!patient.data) return <EmptyState title="Sin datos" description="No se pudo cargar el estado financiero del paciente." />;

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />
      <PatientSecondaryNav tabs={billingTabs(id)} label="Facturacion y pagos" />
      <Outlet context={{ patient: patient.data }} />
    </div>
  );
}
