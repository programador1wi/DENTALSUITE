import type { PatientStatus } from "../services/patients.service";

const statusMap: Record<PatientStatus, string> = {
  NEW: "Nuevo",
  ACTIVE: "Activo",
  IN_TREATMENT: "En tratamiento",
  INACTIVE: "Inactivo",
  DEBTOR: "Moroso",
  COMPLETED: "Finalizado"
};

export function getPatientStatusLabel(status: PatientStatus) {
  return statusMap[status] ?? status;
}

export function getPatientStatusTone(status: PatientStatus): "default" | "success" | "warning" | "danger" {
  if (status === "ACTIVE" || status === "IN_TREATMENT" || status === "COMPLETED") return "success";
  if (status === "NEW") return "default";
  if (status === "DEBTOR") return "warning";
  return "danger";
}
