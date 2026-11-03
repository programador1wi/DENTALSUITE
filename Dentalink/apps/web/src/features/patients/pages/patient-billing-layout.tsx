import { Outlet, useParams } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { PatientHeader } from "../components/patient-header";
import { PatientSecondaryNav } from "../components/patient-secondary-nav";
import { PatientSubnav } from "../components/patient-subnav";
import { usePatient } from "../hooks/use-patients";
import { APP_ROUTES } from "@/lib/routes";
import { getPatientRouteId } from "@/lib/utils/patient-id";

function billingTabs(patientId: string) {
  return [
    { to: APP_ROUTES.patients.billingPayments(patientId), label: "Pagos" },
    { to: APP_ROUTES.patients.billingDocuments(patientId), label: "Documentos emitidos" },
    {
      to: APP_ROUTES.patients.billingReimbursements(patientId),
      label: "Coberturas",
      activeMatch: APP_ROUTES.patients.billingCoverages(patientId),
      children: [
        { to: APP_ROUTES.patients.billingReimbursements(patientId), label: "Solicitudes de reembolso" },
        { to: APP_ROUTES.patients.billingOnlineBenefits(patientId), label: "Bonificaciones en linea" }
      ]
    },
    { to: APP_ROUTES.patients.billingRefunds(patientId), label: "Devoluciones" },
    { to: APP_ROUTES.patients.billingVoided(patientId), label: "Pagos eliminados" },
    { to: APP_ROUTES.patients.billingBalance(patientId), label: "Balance" }
  ];
}

export function PatientBillingLayout() {
  const { id = "" } = useParams();
  const patient = usePatient(id);

  if (patient.isLoading) return <LoadingState message="Cargando facturacion del paciente..." />;
  if (patient.isError) return <ErrorState message={patient.error?.message ?? "Error"} />;
  if (!patient.data) return <EmptyState title="Sin datos" description="No se pudo cargar el estado financiero del paciente." />;

  const canonicalId = getPatientRouteId(patient.data) || id;

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />
      <PatientSecondaryNav tabs={billingTabs(canonicalId)} label="Facturacion y pagos" />
      <Outlet context={{ patient: patient.data }} />
    </div>
  );
}
