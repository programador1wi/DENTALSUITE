import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";
import { usePermissions } from "@/hooks/use-permissions";

const tabs = [
  { key: "profile", label: "Datos personales", permission: "patients.read" },
  { key: "clinical/history", label: "Ficha clinica", permission: "clinical.read" },
  { key: "treatments", label: "Planes de tratamiento", permission: "treatment_plans.read" },
  { key: "billing", label: "Facturacion y pagos", permission: "payments.read" },
  { key: "payments", label: "Recibir pago", permission: "payments.create" }
] as const;

export function PatientSubnav({ patientId }: { patientId: string }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();

  return (
    <nav className="overflow-x-auto border border-slate-200 bg-white shadow-sm" aria-label="Secciones del paciente">
      <div className="inline-flex min-w-full items-stretch">
        {tabs.filter((tab) => hasPermission(tab.permission)).map((tab) => {
          const href = `/patients/${patientId}/${tab.key}`;
          const active =
            location.pathname === href ||
            (tab.key === "profile" && location.pathname === `/patients/${patientId}`) ||
            (tab.key === "profile" && location.pathname.startsWith(`/patients/${patientId}/profile`)) ||
            (tab.key === "clinical/history" && location.pathname.startsWith(`/patients/${patientId}/clinical`)) ||
            (tab.key === "treatments" && location.pathname.startsWith(`/patients/${patientId}/treatments`)) ||
            (tab.key === "billing" && location.pathname.startsWith(`/patients/${patientId}/billing`));

          return (
            <Link
              key={tab.key}
              to={href}
              className={cn(
                "whitespace-nowrap border-r border-slate-200 px-4 py-3 text-sm font-medium transition",
                active
                  ? "bg-white text-[#0879d5] shadow-[inset_0_-3px_0_#0879d5]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
