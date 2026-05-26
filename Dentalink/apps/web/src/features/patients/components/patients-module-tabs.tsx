import { ModuleTabs, type ModuleTab } from "@/components/layout/module-tabs";

export const patientsTabs: ModuleTab[] = [
  { to: "/patients", label: "Habilitados" },
  { to: "/patients/configuration", label: "Configuracion" },
  { to: "/patients/analysis", label: "Analisis" },
  { to: "/patients/orthodontia", label: "Pacientes de Ortodoncia", icon: "#" }
];

export function PatientsModuleTabs({ actions }: { actions?: React.ReactNode }) {
  return <ModuleTabs tabs={patientsTabs} actions={actions} />;
}
