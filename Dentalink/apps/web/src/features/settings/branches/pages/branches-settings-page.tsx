import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import {
  useBranches,
  useCreateBranch,
  useDeactivateBranch,
  useUpdateBranch
} from "../hooks/use-branches";

export function BranchesSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const branches = useBranches(search || undefined, active || undefined);
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deactivateBranch = useDeactivateBranch();

  return (
    <SimpleCrudPage
      title="Sucursales"
      description="Configuracion de sucursales operativas"
      rows={branches.data}
      loading={branches.isLoading}
      error={branches.error?.message}
      search={search}
      setSearch={setSearch}
      active={active}
      setActive={setActive}
      fields={[
        { key: "code", label: "Codigo", type: "text" },
        { key: "name", label: "Nombre", type: "text" },
        { key: "phone", label: "Telefono", type: "text" },
        { key: "email", label: "Email", type: "email" },
        { key: "city", label: "Ciudad", type: "text" },
        { key: "state", label: "Estado", type: "text" },
        { key: "country", label: "Pais", type: "text" },
        { key: "timezone", label: "Timezone", type: "text" }
      ]}
      columns={[
        { key: "code", title: "Codigo" },
        { key: "name", title: "Nombre" },
        { key: "city", title: "Ciudad" },
        {
          key: "status",
          title: "Estado",
          render: (row) => <Badge value={row.status} tone={row.status === "ACTIVE" ? "success" : "warning"} />
        }
      ]}
      actions={{
        create: async (payload) => createBranch.mutateAsync(payload as never),
        update: async (id, payload) => updateBranch.mutateAsync({ id, payload: payload as never }),
        deactivate: async (id) => deactivateBranch.mutateAsync(id),
        mapToForm: (row) => ({
          code: row.code,
          name: row.name,
          phone: row.phone ?? "",
          email: row.email ?? "",
          city: row.city ?? "",
          state: row.state ?? "",
          country: "MX",
          timezone: "America/Mexico_City",
          status: row.status
        }),
        getId: (row) => row.id
      }}
    />
  );
}
