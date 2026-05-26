import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import {
  useCreateFinancialInstitution,
  useDeactivateFinancialInstitution,
  useFinancialInstitutions,
  useUpdateFinancialInstitution
} from "../hooks/use-financial-institutions";

export function FinancialInstitutionsSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const institutions = useFinancialInstitutions(search || undefined, active || undefined);
  const createInstitution = useCreateFinancialInstitution();
  const updateInstitution = useUpdateFinancialInstitution();
  const deactivateInstitution = useDeactivateFinancialInstitution();

  return (
    <SimpleCrudPage
      title="Bancos y entidades financieras"
      description="Catalogo usado al registrar transferencias, depositos y cheques."
      helpText="Configura las entidades financieras que tu clinica utiliza en la recaudacion de pagos."
      rows={institutions.data}
      loading={institutions.isLoading}
      error={institutions.error?.message}
      search={search}
      setSearch={setSearch}
      active={active}
      setActive={setActive}
      fields={[{ key: "name", label: "Nombre", type: "text", required: true }]}
      columns={[
        { key: "name", title: "Nombre" },
        {
          key: "isActive",
          title: "Estado",
          render: (row) => <Badge value={row.isActive ? "HABILITADO" : "DESHABILITADO"} tone={row.isActive ? "success" : "warning"} />
        }
      ]}
      actions={{
        create: async (payload) => createInstitution.mutateAsync(payload as never),
        update: async (id, payload) => updateInstitution.mutateAsync({ id, payload: payload as never }),
        deactivate: async (id) => deactivateInstitution.mutateAsync(id),
        mapToForm: (row) => ({ name: row.name }),
        getId: (row) => row.id
      }}
    />
  );
}
