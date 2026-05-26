import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useOrganizationSettings } from "@/features/settings/organization/hooks/use-organization";

const modules = [
  ["Agenda", "/agenda"],
  ["Pacientes", "/patients"],
  ["Cajas", "/cash-register/open"],
  ["Cobranza", "/accounts-receivable"],
  ["Laboratorios", "/labs"],
  ["Reportes", "/reports"]
] as const;

export function PlansServicesSettingsPage() {
  const organization = useOrganizationSettings();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Planes y servicios"
        description="Estado del servicio local y accesos a modulos habilitados."
        helpText="Esta vista concentra el estado de la organizacion y los servicios funcionales disponibles en esta instalacion."
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-sm text-slate-500">Organizacion</p>
            <p className="text-lg font-semibold text-slate-900">{organization.data?.organizationName ?? "Cargando..."}</p>
          </div>
          {organization.data?.status ? <Badge value={organization.data.status} tone="success" /> : null}
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(([label, to]) => (
          <Card key={to}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{label}</p>
                <p className="text-sm text-slate-500">Servicio operativo</p>
              </div>
              <Link to={to}>
                <Button variant="secondary">Abrir</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
