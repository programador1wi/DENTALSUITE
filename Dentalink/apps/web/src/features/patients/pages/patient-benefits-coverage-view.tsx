import { EmptyState } from "@/components/feedback/empty-state";
import { PatientFamilyPolicies } from "../components/patient-family-policies";
import { usePatientIdentity } from "../hooks/use-patient-identity";
import type { PatientDetail } from "../services/patients.service";

const BENEFIT_COVERAGE_ENABLED =
  import.meta.env.VITE_PATIENT_BENEFITS_COVERAGES !== "false";

export function PatientBenefitsCoverageView({
  patientId,
  patient,
}: {
  patientId: string;
  patient: PatientDetail;
}) {
  const identity = usePatientIdentity(patientId);
  const familyGroup = identity.data?.memberships.find(
    (membership) => membership.familyGroup.status === "ACTIVE",
  )?.familyGroup;

  if (!BENEFIT_COVERAGE_ENABLED) {
    return (
      <EmptyState
        title="Beneficios y coberturas deshabilitado"
        description="La funcionalidad está protegida por configuración y no está activa en este entorno."
      />
    );
  }

  return (
    <PatientFamilyPolicies
      patientId={patientId}
      patientName={`${patient.firstName} ${patient.lastName}`.trim()}
      familyGroup={familyGroup}
      compactHeader
    />
  );
}
