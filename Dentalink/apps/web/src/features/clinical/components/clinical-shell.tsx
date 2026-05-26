import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSubnav } from "@/features/patients/components/patient-subnav";
import { PatientHeader } from "@/features/patients/components/patient-header";
import { cn } from "@/lib/utils/cn";
import { useClinicalSummary } from "../hooks/use-clinical";

const tabs = [
  { to: "history", label: "Historial" },
  { to: "evolutions", label: "Evoluciones" },
  { to: "medical-history", label: "Antecedentes medicos" },
  { to: "odontogram", label: "Odontograma" },
  { to: "periodontogram", label: "Periodontograma" },
  { to: "documents", label: "Rx y Documentos" },
  { to: "prescriptions", label: "Recetas" }
];

export function ClinicalShell({
  patientId,
  children
}: {
  patientId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const location = useLocation();
  const summary = useClinicalSummary(patientId);

  if (summary.isLoading) return <LoadingState message="Cargando expediente clinico..." />;
  if (summary.isError) return <ErrorState message={summary.error.message} />;

  return (
    <div className="space-y-4">
      <PatientHeader patientId={patientId} />
      <PatientSubnav patientId={patientId} />
      
      <nav className="overflow-x-auto border border-slate-200 bg-white shadow-sm" aria-label="Ficha clinica">
        <div className="inline-flex min-w-full items-stretch">
          {tabs.map((tab) => {
            const href = `/patients/${patientId}/clinical/${tab.to}`;
            const active = location.pathname === href;
            return (
              <Link
                key={tab.to}
                to={href}
                className={cn(
                  "whitespace-nowrap border-r border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide transition",
                  active
                    ? "bg-white text-[#08736f] shadow-[inset_0_-3px_0_#08736f]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
