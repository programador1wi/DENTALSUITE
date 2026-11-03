import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

const ITEMS = [
  {
    to: "/reports/performance",
    title: "Panel de desempeno",
    description: "Indicadores ejecutivos de agenda, ventas, cobranza, operacion y produccion."
  },
  {
    to: "/reports/excel",
    title: "Reportes Excel",
    description: "Catalogo, solicitud, filtros, generacion, descarga e historial de reportes."
  },
  {
    to: "/reports/charts",
    title: "Reportes graficos",
    description: "Catalogo grafico bajo demanda con filtros, grafica y tabla detallada."
  }
];

export function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Reportes" description="Modulo reorganizado en desempeno, Excel y reportes graficos." />
      <div className="grid gap-3 md:grid-cols-3">
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to} data-allow-multiline>
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
