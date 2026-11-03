import type { ReactNode } from "react";
import { PatientHeader } from "./patient-header";
import { PatientSubnav } from "./patient-subnav";

export function PatientSectionPage({
  patientId,
  hideSubnav,
  children
}: {
  patientId: string;
  title: string;
  description: string;
  hideSubnav?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PatientHeader patientId={patientId} />
      {!hideSubnav && <PatientSubnav patientId={patientId} />}
      {children}
    </div>
  );
}

