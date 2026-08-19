import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";
import { Eye, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { usePermissionsQuery } from "@/features/settings/permissions/hooks/use-permissions";
import { UsersModuleNav } from "@/features/settings/users/components/users-module-nav";
import { PermissionChecklist } from "../components/permission-checklist";
import { useCreateRole, useDeactivateRole, useRolesQuery } from "../hooks/use-roles";
import type { RoleListItem } from "../services/roles.service";

const emptyRoleForm = {
  description: "",
  name: "",
  permissionIds: [] as string[]
};

function isSuperAdminRole(role: Pick<RoleListItem, "code" | "name">) {
  return (
    role.code === "super_admin" ||
    role.code === "super_administrador" ||
    role.name === "SUPER_ADMIN" ||
    role.name === "Super Administrador"
  );
}

export function RolesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [removing, setRemoving] = useState<RoleListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const roles = useRolesQuery(search || undefined, active || undefined);
  const allPermissions = usePermissionsQuery(undefined, undefined, "true");
  const createRole = useCreateRole();
  const deactivateRole = useDeactivateRole();
  const { can } = usePermissions();
  const canManageAll = can("system.manage_all");
  const canCreateRole = canManageAll || can("roles.create");
  const canDeactivateRole = canManageAll || can("roles.deactivate");
  const delegablePermissionIds = new Set(
    allPermissions.data?.filter((permission) => permission.delegable !== false).map((permission) => permission.id) ?? []
  );
  const copyableRoles =
    roles.data?.filter(
      (role) =>
        role.isActive &&
        role.permissions.length > 0 &&
        role.permissions.every((permission) => delegablePermissionIds.has(permission.id))
    ) ?? [];

  const removeRole = async () => {
    if (!removing) return;

    await deactivateRole.mutateAsync(removing.id);
    setRemoving(null);
  };

  const openCreate = () => {
    setRoleForm(emptyRoleForm);
    setCreating(true);
  };

  const closeCreate = () => {
    setCreating(false);
    setRoleForm(emptyRoleForm);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = roleForm.name.trim();
    if (!name) return;

    const created = await createRole.mutateAsync({
      name,
      description: roleForm.description.trim() || undefined,
      permissionIds: roleForm.permissionIds
    });
    closeCreate();
    navigate(APP_ROUTES.settings.roleDetail(created.id));
  };

  const copyPermissionsFromRole = (roleId: string) => {
    const sourceRole = roles.data?.find((role) => role.id === roleId);
    if (!sourceRole) return;

    setRoleForm((current) => ({
      ...current,
      permissionIds: sourceRole.permissions
        .map((permission) => permission.id)
        .filter((permissionId) => delegablePermissionIds.has(permissionId))
    }));
  };

  return (
    <div className="space-y-4">
      <UsersModuleNav
        actions={
          canCreateRole ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo perfil
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          <PageHeader title="Perfiles" description="Control de perfiles y permisos de usuarios" />

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3">
            <EntitySearchBox
              placeholder="Buscar por nombre o código"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? roles.data ?? [] : []}
              onSelect={(role) => {
                setSearch(role.name);
                navigate(APP_ROUTES.settings.roleDetail(role.id));
              }}
              getItemKey={(role) => role.id}
              emptyMessage="Sin perfiles encontrados"
              renderItem={(role) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{role.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{role.code || "Sin código"}</p>
                </div>
              )}
            />
            <Select value={active} onChange={(event) => setActive(event.target.value)}>
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </div>

          {roles.isLoading ? <LoadingState message="Cargando perfiles..." /> : null}
          {roles.isError ? <ErrorState message={roles.error.message} /> : null}
          {allPermissions.isError ? <ErrorState message={allPermissions.error.message} /> : null}
          {deactivateRole.isError ? <ErrorState message={deactivateRole.error.message} /> : null}
          {createRole.isError ? <ErrorState message={createRole.error.message} /> : null}

          {roles.data ? (
            <DataTable
              rows={roles.data}
              empty={<EmptyState title="Sin perfiles" description="No hay perfiles para los filtros seleccionados." />}
              columns={[
                {
                  key: "name",
                  title: "Nombre",
                  render: (row) => (
                    <Link
                      to={`/settings/roles/${row.id}`}
                      className="font-medium text-sky-600 hover:text-sky-800 hover:underline transition-colors"
                    >
                      {row.name}
                    </Link>
                  )
                },
                {
                  key: "code",
                  title: "Código",
                  render: (row) => (
                    <span className="font-mono text-xs text-slate-600">{row.code || "Sin código"}</span>
                  )
                },
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
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/settings/roles/${row.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver permisos
                      </Link>
                      <HelpTooltip
                        content={
                          isSuperAdminRole(row)
                            ? "El perfil super admin no se puede eliminar."
                            : row.isActive
                              ? canDeactivateRole
                                ? "Eliminar perfil"
                                : "No tienes permiso para eliminar perfiles."
                              : "El perfil ya esta inactivo."
                        }
                        position="top"
                      >
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={isSuperAdminRole(row) || !row.isActive || !canDeactivateRole || deactivateRole.isPending}
                          onClick={() => setRemoving(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </HelpTooltip>
                    </div>
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

      <Modal open={creating} title="Nuevo perfil" size="2xl" onClose={closeCreate}>
        <form className="space-y-5" onSubmit={submitCreate}>
          <div className="grid gap-3 md:grid-cols-[minmax(220px,0.9fr)_minmax(280px,1.1fr)]">
            <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="space-y-3">
                <label className="grid gap-1 text-sm text-slate-700">
                  Nombre del perfil
                  <Input
                    required
                    value={roleForm.name}
                    placeholder="Ej. Recepcion caja"
                    onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Descripcion
                  <Textarea
                    value={roleForm.description}
                    placeholder="Responsabilidad operativa del perfil"
                    onChange={(event) =>
                      setRoleForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <div className="rounded-md border border-sky-100 bg-white p-3 text-xs leading-relaxed text-slate-500">
                  El codigo interno se genera automaticamente desde el nombre. Los permisos no se asignan por usuario;
                  se heredan siempre desde este perfil.
                </div>
              </div>
            </section>

            <section className="min-h-[420px] rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Permisos del perfil</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Selecciona los modulos y acciones que heredaran los usuarios con este perfil.
                  </p>
                </div>
                <Badge value={`${roleForm.permissionIds.length} activos`} tone="success" />
              </div>

              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <Select
                  value=""
                  disabled={!copyableRoles.length}
                  onChange={(event) => copyPermissionsFromRole(event.target.value)}
                  aria-label="Copiar permisos de otro perfil"
                >
                  <option value="">Copiar permisos de otro perfil</option>
                  {copyableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} ({role.permissions.length})
                    </option>
                  ))}
                </Select>
              </div>

              {allPermissions.isLoading ? <LoadingState message="Cargando permisos..." /> : null}
              {allPermissions.data ? (
                <div className="max-h-[56vh] overflow-y-auto pr-1">
                  <PermissionChecklist
                    allPermissions={allPermissions.data}
                    selectedIds={roleForm.permissionIds}
                    onChange={(permissionIds) => setRoleForm((current) => ({ ...current, permissionIds }))}
                  />
                </div>
              ) : null}
            </section>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeCreate}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!roleForm.name.trim() || createRole.isPending}>
              {createRole.isPending ? "Creando..." : "Crear perfil"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
