import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const ITEMS = [
  { to: "/reports/appointments", title: "Reportes de agenda", description: "Citas, cancelaciones, no asistencias y ocupación." },
  { to: "/reports/patients", title: "Reportes de pacientes", description: "Nuevos, activos, sin cita futura y fuentes." },
  { to: "/reports/treatments", title: "Reportes de tratamientos", description: "Creación, aceptación y avance de planes." },
  { to: "/reports/financial", title: "Reportes financieros", description: "Ingresos, morosidad, saldos y producción." },
  { to: "/reports/professionals", title: "Reportes por profesional", description: "Carga operativa y productividad clínica." }
];

export function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Reportes" description="Panel central de reportes operativos, financieros y clínicos." />
      <div className="grid gap-3 md:grid-cols-2">
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="h-full">
              <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
