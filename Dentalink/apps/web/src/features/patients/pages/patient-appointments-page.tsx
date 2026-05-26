import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { PatientSectionPage } from "../components/patient-section-page";

export function PatientAppointmentsPage() {
  const { id = "" } = useParams();

  return (
    <PatientSectionPage patientId={id} title="Paciente - Citas" description="Vista de citas del paciente.">
      <Card>
        <EmptyState
          title="Sin citas en esta fase"
          description="El timeline de citas y agenda completa se conecta en la fase de agenda y citas."
        />
      </Card>
    </PatientSectionPage>
  );
}
