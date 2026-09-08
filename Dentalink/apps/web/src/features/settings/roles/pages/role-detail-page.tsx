import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";
import { ArrowLeft, AlertTriangle, Lock, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { UsersModuleNav } from "@/features/settings/users/components/users-module-nav";
import { usePermissionsQuery } from "@/features/settings/permissions/hooks/use-permissions";
import { cn } from "@/lib/utils/cn";
import { PermissionChecklist } from "../components/permission-checklist";
import { useRoleDetailQuery, useRolesQuery, useUpdateRole } from "../hooks/use-roles";

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

function isSuperAdminRole(role: { code?: string | null; name: string }) {
  return (
    role.code === "super_admin" ||
    role.code === "super_administrador" ||
    role.name === "SUPER_ADMIN" ||
    role.name === "Super Administrador"
  );
}

export function RoleDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const role = useRoleDetailQuery(id);
  const roles = useRolesQuery(undefined, "true");
  const allPermissions = usePermissionsQuery(undefined, undefined, "true");
  const updateRole = useUpdateRole();
  const { can } = usePermissions();
  const canManageAll = can("organization.manage_all");
  const canUpdateRole = canManageAll || can("roles.update");

  const [loadedRoleId, setLoadedRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleActive, setRoleActive] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const availablePermissionIds = useMemo(
    () => new Set(allPermissions.data?.map((permission) => permission.id) ?? []),
    [allPermissions.data]
  );

  useEffect(() => {
    if (!role.data || loadedRoleId === role.data.id) return;

    setLoadedRoleId(role.data.id);
    setRoleName(role.data.name);
    setRoleDescription(role.data.description ?? "");
    setRoleActive(role.data.isActive);
    const rawIds = role.data.permissions.map((permission) => permission.id);
    const validIds = availablePermissionIds.size > 0
      ? rawIds.filter((id) => availablePermissionIds.has(id))
      : rawIds;
    setSelectedIds(validIds);
  }, [loadedRoleId, role.data, availablePermissionIds]);

  const originalIds = useMemo(() => {
    if (!role.data) return [];
    const rawIds = role.data.permissions.map((permission) => permission.id);
    return availablePermissionIds.size > 0
      ? rawIds.filter((id) => availablePermissionIds.has(id))
      : rawIds;
  }, [role.data, availablePermissionIds]);
  const isSystemRole = role.data?.isSystem ?? false;
  const isSuperAdmin = role.data ? isSuperAdminRole(role.data) : false;
  const isReadonly = isSuperAdmin || !canUpdateRole;
  const permissionChanges = role.data ? !arraysEqual(selectedIds, originalIds) : false;
  const metadataChanges = role.data
    ? roleName.trim() !== role.data.name ||
      roleDescription.trim() !== (role.data.description ?? "") ||
      roleActive !== role.data.isActive
    : false;
  const hasChanges = !isReadonly && (permissionChanges || metadataChanges);
  const isLoading = role.isLoading || allPermissions.isLoading;
  const isError = role.isError || allPermissions.isError;
  const errorMessage = role.error?.message ?? allPermissions.error?.message ?? "Error al cargar datos.";
  const canSave = hasChanges && roleName.trim().length > 0 && !updateRole.isPending;
  const delegablePermissionIds = new Set(
    allPermissions.data?.filter((permission) => permission.delegable !== false).map((permission) => permission.id) ?? []
  );
  const copyableRoles =
    roles.data?.filter(
      (sourceRole) =>
        sourceRole.id !== id &&
        sourceRole.permissions.length > 0 &&
        sourceRole.permissions.every((permission) => delegablePermissionIds.has(permission.id))
    ) ?? [];

  const handleSave = async () => {
    if (!id || !canSave) return;

    const validPayloadIds = availablePermissionIds.size > 0
      ? selectedIds.filter((permissionId) => availablePermissionIds.has(permissionId))
      : selectedIds;

    await updateRole.mutateAsync({
      id,
      payload: {
        name: roleName.trim(),
        description: roleDescription.trim(),
        isActive: roleActive,
        permissionIds: validPayloadIds
      }
    });
    toast.success("Cambios actualizados correctamente");
  };

  const copyPermissionsFromRole = (roleId: string) => {
    const sourceRole = roles.data?.find((currentRole) => currentRole.id === roleId);
    if (!sourceRole) return;

    setSelectedIds(
      sourceRole.permissions
        .map((permission) => permission.id)
        .filter((permissionId) => delegablePermissionIds.has(permissionId))
    );
  };

  return (
    <div className="space-y-4">
      <UsersModuleNav>
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.settings.userProfiles)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-[#0784d8]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Perfiles
        </button>

        {role.data ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <Shield className="h-6 w-6" />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-slate-900">{role.data.name}</h1>
                    <Badge
                      value={role.data.isActive ? "ACTIVO" : "INACTIVO"}
                      tone={role.data.isActive ? "success" : "warning"}
                    />
                    {isSystemRole ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        <Lock className="h-3 w-3" />
                        Sistema
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-xs text-slate-400">
                    Código: <span className="text-slate-600">{role.data.code || "Sin código"}</span>
                  </p>
                  <p className="max-w-2xl text-sm text-slate-500">
                    Los usuarios heredan permisos desde este perfil. No se administran permisos individuales por usuario.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {isReadonly ? (
                  <p className="flex items-center gap-1.5 text-sm text-amber-600">
                    <Lock className="h-4 w-4" />
                    {isSuperAdmin ? "Super Administrador de solo lectura" : "Sin permiso de edición"}
                  </p>
                ) : (
                  <>
                    {updateRole.isError ? (
                      <span className="max-w-[280px] text-xs text-red-600">{updateRole.error.message}</span>
                    ) : null}
                    <Button type="button" variant="primary" disabled={!canSave} onClick={() => void handleSave()}>
                      <Save className="h-4 w-4" />
                      {updateRole.isPending ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 lg:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1.1fr)_180px]">
              <label className="grid gap-1 text-sm text-slate-700">
                Nombre del perfil
                <Input
                  value={roleName}
                  disabled={isReadonly}
                  onChange={(event) => setRoleName(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                Descripción
                <Textarea
                  className="min-h-10"
                  value={roleDescription}
                  disabled={isReadonly}
                  onChange={(event) => setRoleDescription(event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                Estado
                <Select
                  value={roleActive ? "true" : "false"}
                  disabled={isReadonly}
                  onChange={(event) => setRoleActive(event.target.value === "true")}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </Select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">
                  {availablePermissionIds.size > 0
                    ? selectedIds.filter((id) => availablePermissionIds.has(id)).length
                    : selectedIds.length}
                </p>
                <p className="text-xs text-slate-500">Permisos activos</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700">{allPermissions.data?.length ?? "-"}</p>
                <p className="text-xs text-slate-500">Total disponibles</p>
              </div>
              {hasChanges ? (
                <>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Cambios sin guardar
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {isLoading ? <LoadingState message="Cargando permisos del perfil..." /> : null}
        {isError ? <ErrorState message={errorMessage} /> : null}

        {role.data && allPermissions.data ? (
          <div className={cn("space-y-2 transition-all", hasChanges && "pb-24")}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">Permisos por módulo</h2>
              {!isReadonly && !isLoading ? (
                <p className="text-xs text-slate-400">
                  Activa o desactiva permisos en el perfil; los cambios aplican a usuarios con este rol.
                </p>
              ) : null}
            </div>

            <PermissionChecklist
              allPermissions={allPermissions.data}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              readonly={isReadonly}
              roles={copyableRoles}
              onCopyFromRole={copyPermissionsFromRole}
              onSave={() => void handleSave()}
              isSaving={updateRole.isPending}
              canSave={canSave}
            />
          </div>
        ) : null}

        {hasChanges ? (
          <div className="sticky bottom-4 z-40 mt-6 flex items-center justify-between rounded-xl border border-amber-200/90 bg-amber-50/95 backdrop-blur-md px-5 py-3 shadow-lg shadow-amber-900/10">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm font-medium text-amber-950">Tienes cambios sin guardar en este perfil.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRoleName(role.data?.name ?? "");
                  setRoleDescription(role.data?.description ?? "");
                  setRoleActive(role.data?.isActive ?? true);
                  setSelectedIds(originalIds);
                }}
              >
                Descartar
              </Button>
              <Button type="button" variant="primary" size="sm" disabled={!canSave} onClick={() => void handleSave()}>
                <Save className="h-3.5 w-3.5" />
                {updateRole.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        ) : null}
      </UsersModuleNav>
    </div>
  );
}
