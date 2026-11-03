import type { ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSecondaryNav } from "@/features/patients/components/patient-secondary-nav";
import { PatientSubnav } from "@/features/patients/components/patient-subnav";
import { PatientHeader } from "@/features/patients/components/patient-header";
import { useClinicalSummary } from "../hooks/use-clinical";
import { usePatient } from "@/features/patients/hooks/use-patients";
import { APP_ROUTES } from "@/lib/routes";
import { getPatientRouteId } from "@/lib/utils/patient-id";

function clinicalTabs(patientId: string) {
  return [
    { to: APP_ROUTES.patients.clinicalHistory(patientId), label: "Historial" },
    { to: APP_ROUTES.patients.clinicalEvolutions(patientId), label: "Evoluciones" },
    { to: APP_ROUTES.patients.clinicalMedicalHistory(patientId), label: "Antecedentes medicos" },
    { to: APP_ROUTES.patients.clinicalOdontogram(patientId), label: "Odontograma" },
    { to: APP_ROUTES.patients.clinicalPeriodontogram(patientId), label: "Periodontograma" },
    { to: APP_ROUTES.patients.clinicalFiles(patientId), label: "Rx y Documentos", permission: "files.read" },
    { to: APP_ROUTES.patients.clinicalDocuments(patientId), label: "Documentos clinicos" },
    { to: APP_ROUTES.patients.clinicalConsents(patientId), label: "Consentimientos", permission: "consents.read" },
    { to: APP_ROUTES.patients.clinicalPrescriptions(patientId), label: "Recetas" }
  ];
}

export function ClinicalShell({
  patientId,
  children
}: {
  patientId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const summary = useClinicalSummary(patientId);
  const patient = usePatient(patientId);

  if (summary.isLoading) return <LoadingState message="Cargando expediente clinico..." />;
  if (summary.isError) return <ErrorState message={summary.error.message} />;

  const canonicalId = getPatientRouteId(patient.data) || patientId;

  return (
    <div className="space-y-4">
      <PatientHeader patientId={patientId} />
      <PatientSubnav patientId={patientId} />
      <PatientSecondaryNav label="Ficha clinica" tabs={clinicalTabs(canonicalId)} />

      {children}
    </div>
  );
}
