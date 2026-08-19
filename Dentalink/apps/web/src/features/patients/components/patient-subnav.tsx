import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils/cn";
import { usePermissions } from "@/hooks/use-permissions";
import { APP_ROUTES } from "@/lib/routes";
import { usePatient } from "../hooks/use-patients";
import { getPatientRouteId } from "@/lib/utils/patient-id";

const tabs = [
  { key: "profile", route: (id: string) => APP_ROUTES.patients.profile(id), label: "Datos personales", permission: "patients.read" },
  { key: "clinical", route: (id: string) => APP_ROUTES.patients.clinicalHistory(id), label: "Ficha clinica", permission: "clinical.read" },
  { key: "treatments", route: (id: string) => APP_ROUTES.patients.treatments(id), label: "Planes de tratamiento", permission: "treatment_plans.read" },
  { key: "billing", route: (id: string) => APP_ROUTES.patients.billingPayments(id), label: "Facturacion y pagos", permission: "payments.read" },
  { key: "payments", route: (id: string) => APP_ROUTES.patients.payments(id), label: "Recibir pago", permission: "payments.create" }
] as const;

export function PatientSubnav({ patientId }: { patientId: string }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const { data: patient } = usePatient(patientId);

  const canonicalId = getPatientRouteId(patient) || patientId;
  const cuid = patient?.id || patientId;

  const matchesSection = (section: string) =>
    location.pathname.startsWith(`/pacientes/${canonicalId}/${section}`) ||
    location.pathname.startsWith(`/pacientes/${cuid}/${section}`) ||
    location.pathname.startsWith(`/pacientes/${patientId}/${section}`) ||
    location.pathname.startsWith(`/patients/${canonicalId}/${section}`) ||
    location.pathname.startsWith(`/patients/${cuid}/${section}`) ||
    location.pathname.startsWith(`/patients/${patientId}/${section}`);

  return (
    <nav className="overflow-x-auto border border-slate-200 bg-white shadow-sm" aria-label="Secciones del paciente">
      <div className="inline-flex min-w-full items-stretch">
        {tabs.filter((tab) => hasPermission(tab.permission)).map((tab) => {
          const href = tab.route(canonicalId);
          const active =
            location.pathname === href ||
            (tab.key === "profile" &&
              (location.pathname === `/pacientes/${canonicalId}` ||
                location.pathname === `/pacientes/${cuid}` ||
                location.pathname === `/pacientes/${patientId}` ||
                matchesSection("perfil") ||
                matchesSection("profile"))) ||
            (tab.key === "clinical" && (matchesSection("clinica") || matchesSection("clinical"))) ||
            (tab.key === "treatments" && (matchesSection("tratamientos") || matchesSection("treatments"))) ||
            (tab.key === "billing" && (matchesSection("facturacion") || matchesSection("billing"))) ||
            (tab.key === "payments" && (matchesSection("pagos") || matchesSection("payments")));

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
