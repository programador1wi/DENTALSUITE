import type { ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSecondaryNav } from "@/features/patients/components/patient-secondary-nav";
import { PatientSubnav } from "@/features/patients/components/patient-subnav";
import { PatientHeader } from "@/features/patients/components/patient-header";
import { useClinicalSummary } from "../hooks/use-clinical";

function clinicalTabs(patientId: string) {
  return [
    { to: `/patients/${patientId}/clinical/history`, label: "Historial" },
    { to: `/patients/${patientId}/clinical/evolutions`, label: "Evoluciones" },
    { to: `/patients/${patientId}/clinical/medical-history`, label: "Antecedentes medicos" },
    { to: `/patients/${patientId}/clinical/odontogram`, label: "Odontograma" },
    { to: `/patients/${patientId}/clinical/periodontogram`, label: "Periodontograma" },
    { to: `/patients/${patientId}/clinical/files`, label: "Rx y Documentos", permission: "files.read" },
    { to: `/patients/${patientId}/clinical/documents`, label: "Documentos clinicos" },
    { to: `/patients/${patientId}/clinical/consents`, label: "Consentimientos", permission: "consents.read" },
    { to: `/patients/${patientId}/clinical/prescriptions`, label: "Recetas" }
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

  if (summary.isLoading) return <LoadingState message="Cargando expediente clinico..." />;
  if (summary.isError) return <ErrorState message={summary.error.message} />;

  return (
    <div className="space-y-4">
      <PatientHeader patientId={patientId} />
      <PatientSubnav patientId={patientId} />
      <PatientSecondaryNav label="Ficha clinica" tabs={clinicalTabs(patientId)} />

      {children}
    </div>
  );
}
