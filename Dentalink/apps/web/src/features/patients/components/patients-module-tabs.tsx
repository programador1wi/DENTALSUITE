import { ModuleTabs, type ModuleTab } from "@/components/layout/module-tabs";
import { ChartNoAxesColumnIncreasing, Settings, UsersRound } from "lucide-react";
import { APP_ROUTES } from "@/lib/routes";

export const patientsTabs: ModuleTab[] = [
  { to: APP_ROUTES.patients.root, label: "Habilitados" },
  { to: APP_ROUTES.patients.configuration, label: "Configuracion" },
  { to: APP_ROUTES.patients.analysis, label: "Analisis" },
  { to: APP_ROUTES.patients.orthodontia, label: "Pacientes de Ortodoncia", icon: "#" }
];

const dentalinkPatientsTabs: ModuleTab[] = patientsTabs.map((tab) => ({
  ...tab,
  icon:
    tab.to === APP_ROUTES.patients.root ? (
      <UsersRound className="h-3.5 w-3.5" />
    ) : tab.to === APP_ROUTES.patients.configuration ? (
      <Settings className="h-3.5 w-3.5" />
    ) : tab.to === APP_ROUTES.patients.analysis ? (
      <ChartNoAxesColumnIncreasing className="h-3.5 w-3.5" />
    ) : (
      tab.icon
    )
}));

export function PatientsModuleTabs({
  actions,
  variant = "default"
}: {
  actions?: React.ReactNode;
  variant?: "default" | "dentalink";
}) {
  return (
    <ModuleTabs
      tabs={variant === "dentalink" ? dentalinkPatientsTabs : patientsTabs}
      actions={actions}
      variant={variant}
    />
  );
}
