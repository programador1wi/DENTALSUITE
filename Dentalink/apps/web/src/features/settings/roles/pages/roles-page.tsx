import { useState } from "react";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { UsersModuleNav } from "@/features/settings/users/components/users-module-nav";
import { useDeactivateRole, useRolesQuery } from "../hooks/use-roles";
import type { RoleListItem } from "../services/roles.service";

export function RolesPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [removing, setRemoving] = useState<RoleListItem | null>(null);
  const roles = useRolesQuery(search || undefined, active || undefined);
  const deactivateRole = useDeactivateRole();

  const removeRole = async () => {
    if (!removing) return;

    await deactivateRole.mutateAsync(removing.id);
    setRemoving(null);
  };

  return (
    <div className="space-y-4">
      <UsersModuleNav>
        <div className="space-y-4">
          <PageHeader title="Perfiles" description="Control de perfiles y permisos de usuarios" />

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3">
            <Input
              placeholder="Buscar por nombre o codigo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={active} onChange={(event) => setActive(event.target.value)}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </div>

          {roles.isLoading ? <LoadingState message="Cargando perfiles..." /> : null}
          {roles.isError ? <ErrorState message={roles.error.message} /> : null}
          {deactivateRole.isError ? <ErrorState message={deactivateRole.error.message} /> : null}

          {roles.data ? (
            <DataTable
              rows={roles.data}
              empty={<EmptyState title="Sin perfiles" description="No hay perfiles para los filtros seleccionados." />}
              columns={[
                { key: "name", title: "Nombre" },
                { key: "code", title: "Codigo" },
                { key: "permissions", title: "Permisos", render: (row) => String(row.permissions.length) },
                {
                  key: "isActive",
                  title: "Estado",
                  render: (row) => (
                    <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
                  )
                },
                {
                  key: "id",
                  title: "Acciones",
                  render: (row) => (
                    <Button
                      type="button"
                      variant="danger"
                      title={
                        row.isSystem
                          ? "Los perfiles del sistema no se pueden eliminar."
                          : row.isActive
                            ? "Eliminar perfil"
                            : "El perfil ya esta inactivo."
                      }
                      disabled={row.isSystem || !row.isActive || deactivateRole.isPending}
                      onClick={() => setRemoving(row)}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Eliminar
                    </Button>
                  )
                }
              ]}
            />
          ) : null}
        </div>
      </UsersModuleNav>

      <Modal open={Boolean(removing)} title="Eliminar perfil" onClose={() => setRemoving(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {removing
              ? `El perfil ${removing.name} quedara inactivo y dejara de poder asignarse a usuarios nuevos.`
              : null}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" disabled={deactivateRole.isPending} onClick={() => void removeRole()}>
              {deactivateRole.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
