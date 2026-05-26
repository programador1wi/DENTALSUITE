import type { ReactNode } from "react";
import { PatientHeader } from "./patient-header";
import { PatientSubnav } from "./patient-subnav";

export function PatientSectionPage({
  patientId,
  children
}: {
  patientId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PatientHeader patientId={patientId} />
      <PatientSubnav patientId={patientId} />
      {children}
    </div>
  );
}

