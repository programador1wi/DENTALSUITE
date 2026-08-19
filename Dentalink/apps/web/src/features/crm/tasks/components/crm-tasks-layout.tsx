import { Outlet } from "react-router-dom";
import { ModuleTabs, type ModuleTab } from "@/components/layout/module-tabs";

export const crmTasksTabs: ModuleTab[] = [
  { to: "/crm/tasks", label: "Tareas" },
  { to: "/crm/tasks/statistics", label: "Estadísticas" },
  { to: "/crm/tasks/configuration", label: "Configuración" }
];

export function CrmTasksLayout() {
  return (
    <div className="space-y-6">
      <ModuleTabs tabs={crmTasksTabs} />
      <Outlet />
    </div>
  );
}
