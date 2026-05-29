import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Lock, Save, Shield } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UsersModuleNav } from "@/features/settings/users/components/users-module-nav";
import { usePermissionsQuery } from "@/features/settings/permissions/hooks/use-permissions";
import { useRoleDetailQuery, useUpdateRolePermissions } from "../hooks/use-roles";
import { PermissionChecklist } from "../components/permission-checklist";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function RoleDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const role = useRoleDetailQuery(id);
  const allPermissions = usePermissionsQuery(undefined, undefined, "true");
  const updatePermissions = useUpdateRolePermissions();

  // IDs seleccionados (estado local, se inicializa desde el rol)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Inicializar la selección cuando llega el rol del servidor
  useEffect(() => {
    if (role.data && !initialized) {
      setSelectedIds(role.data.permissions.map((p) => p.id));
      setInitialized(true);
    }
  }, [role.data, initialized]);

  // Detectar si hay cambios sin guardar
  const originalIds = role.data?.permissions.map((p) => p.id) ?? [];
  const hasChanges = initialized && !arraysEqual(selectedIds, originalIds);

  const isReadonly = role.data?.isSystem ?? false;

  const handleSave = async () => {
    if (!id || !hasChanges) return;
    await updatePermissions.mutateAsync({ id, permissionIds: selectedIds });
  };

  // ─── Loading / Error ─────────────────────────────────────────────────────

  const isLoading = role.isLoading || allPermissions.isLoading;
  const isError = role.isError || allPermissions.isError;
  const errorMessage = role.error?.message ?? allPermissions.error?.message ?? "Error al cargar datos.";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <UsersModuleNav>
        {/* ── Botón volver ─────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => navigate("/settings/users/profiles")}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0784d8] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Perfiles
        </button>

        {/* ── Header del perfil ─────────────────────────────────────────── */}
        {role.data && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Info izquierda */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <Shield className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-slate-900">
                      {role.data.name}
                    </h1>
                    <Badge
                      value={role.data.isActive ? "ACTIVO" : "INACTIVO"}
                      tone={role.data.isActive ? "success" : "warning"}
                    />
                    {role.data.isSystem && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                        <Lock className="h-3 w-3" />
                        Sistema
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Código: <span className="text-slate-600">{role.data.code}</span>
                  </p>
                  {role.data.description && (
                    <p className="text-sm text-slate-500">{role.data.description}</p>
                  )}
                </div>
              </div>

              {/* Acciones derecha */}
              <div className="flex shrink-0 items-center gap-3">
                {isReadonly ? (
                  <p className="flex items-center gap-1.5 text-sm text-amber-600">
                    <Lock className="h-4 w-4" />
                    Perfil de solo lectura
                  </p>
                ) : (
                  <>
                    {updatePermissions.isError && (
                      <span className="text-xs text-red-600">
                        {updatePermissions.error.message}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!hasChanges || updatePermissions.isPending}
                      onClick={() => void handleSave()}
                    >
                      <Save className="h-4 w-4" />
                      {updatePermissions.isPending ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Resumen rápido */}
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{selectedIds.length}</p>
                <p className="text-xs text-slate-500">Permisos activos</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700">
                  {allPermissions.data?.length ?? "—"}
                </p>
                <p className="text-xs text-slate-500">Total disponibles</p>
              </div>
              {hasChanges && (
                <>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Cambios sin guardar
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Estados de carga / error ──────────────────────────────────── */}
        {isLoading && <LoadingState message="Cargando permisos del perfil..." />}
        {isError && <ErrorState message={errorMessage} />}

        {/* ── Checklist de permisos ─────────────────────────────────────── */}
        {role.data && allPermissions.data && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Permisos por módulo
              </h2>
              {!isReadonly && !isLoading && (
                <p className="text-xs text-slate-400">
                  Haz clic en un permiso o en el checkbox del módulo para activar/desactivar
                </p>
              )}
            </div>

            <PermissionChecklist
              allPermissions={allPermissions.data}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              readonly={isReadonly}
            />
          </div>
        )}

        {/* ── Barra de guardar flotante (cuando hay cambios) ────────────── */}
        {hasChanges && !isReadonly && (
          <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 shadow-lg">
            <p className="text-sm font-medium text-amber-800">
              Tienes cambios sin guardar en los permisos de este perfil.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedIds(originalIds);
                }}
              >
                Descartar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={updatePermissions.isPending}
                onClick={() => void handleSave()}
              >
                <Save className="h-3.5 w-3.5" />
                {updatePermissions.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        )}
      </UsersModuleNav>
    </div>
  );
}
