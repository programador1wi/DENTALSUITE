import { useMemo, useState } from "react";
import { Check, Info, Save, Search } from "lucide-react";
import { getPermissionMetadata, type PermissionPresentationTier } from "@dentalwarner/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PermissionListItem } from "@/features/settings/permissions/services/permissions.service";
import { cn } from "@/lib/utils/cn";

type PermissionChecklistProps = {
  allPermissions: PermissionListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  readonly?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  canSave?: boolean;
  roles?: Array<{ id: string; name: string; permissions: Array<{ id: string }> }>;
  onCopyFromRole?: (roleId: string) => void;
};

type PresentedPermission = PermissionListItem & {
  label: string;
  businessGroup: string;
  presentationTier: PermissionPresentationTier;
  delegable: boolean;
};

const GROUP_ORDER = [
  "Gestión económica",
  "Tratamientos",
  "Reportes de gestión",
  "Administración",
  "Pacientes",
  "Agenda",
  "Cajas",
  "CRM"
];

function normalizePermission(permission: PermissionListItem): PresentedPermission {
  const metadata = getPermissionMetadata(permission);
  return {
    ...permission,
    label: permission.label ?? metadata.label,
    businessGroup: permission.businessGroup ?? metadata.businessGroup,
    presentationTier: permission.presentationTier ?? metadata.presentationTier,
    delegable: permission.delegable ?? true
  };
}

function PermissionItemRow({
  checked,
  onToggle,
  permission,
  readonly
}: {
  checked: boolean;
  onToggle: () => void;
  permission: PresentedPermission;
  readonly: boolean;
}) {
  const disabled = readonly || !permission.delegable;
  const description = permission.description || "Facultad operativa del perfil.";
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      onClick={disabled ? undefined : onToggle}
      className={cn(
        "group flex items-center gap-3 py-2 px-3 rounded-md transition-colors select-none",
        !disabled && "cursor-pointer hover:bg-slate-50",
        disabled && "cursor-default opacity-60"
      )}
    >
      {/* Dentalink style circular check indicator */}
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-150",
          checked
            ? "bg-[#16a34a] text-white shadow-xs"
            : "border-2 border-slate-300 bg-white group-hover:border-slate-400"
        )}
      >
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </div>

      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        readOnly
        aria-label={permission.label}
      />

      <span className="text-[13.5px] font-normal text-slate-700 leading-tight">
        {permission.label}
      </span>

      {/* Info tooltip trigger */}
      <div
        className="relative ml-1 inline-flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white cursor-help">
          i
        </span>

        {showTooltip && (
          <div className="absolute left-6 top-1/2 z-50 -translate-y-1/2 w-64 rounded-md bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-xl">
            {description}
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
          </div>
        )}
      </div>
    </div>
  );
}

export function PermissionChecklist({
  allPermissions,
  canSave = false,
  isSaving = false,
  onChange,
  onCopyFromRole,
  onSave,
  readonly = false,
  roles = [],
  selectedIds
}: PermissionChecklistProps) {
  const [search, setSearch] = useState("");

  const permissions = useMemo(() => allPermissions.map(normalizePermission), [allPermissions]);

  const visiblePermissions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    return permissions.filter((permission) => {
      if (permission.presentationTier === "INTERNAL") return false;
      if (!normalizedSearch) return true;
      return [permission.label, permission.description, permission.key, permission.businessGroup]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("es").includes(normalizedSearch));
    });
  }, [permissions, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, PresentedPermission[]>();
    for (const permission of visiblePermissions) {
      const group = permission.businessGroup;
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(permission);
    }
    return [...map.entries()].sort(([left], [right]) => GROUP_ORDER.indexOf(left) - GROUP_ORDER.indexOf(right));
  }, [visiblePermissions]);

  const delegableVisibleIds = useMemo(
    () => visiblePermissions.filter((p) => p.delegable).map((p) => p.id),
    [visiblePermissions]
  );

  const allVisibleSelected =
    delegableVisibleIds.length > 0 && delegableVisibleIds.every((id) => selectedIds.includes(id));

  const handleToggle = (id: string) => {
    if (readonly) return;
    onChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
  };

  const handleSelectAll = (selectAll: boolean) => {
    if (readonly) return;
    onChange(selectAll ? [...new Set([...selectedIds, ...delegableVisibleIds])] : selectedIds.filter((id) => !delegableVisibleIds.includes(id)));
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      {/* Top Dentalink Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            disabled={readonly}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="font-medium">Marcar todos los permisos</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar permisos..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Copy from role selector */}
          {roles.length > 0 && onCopyFromRole && !readonly && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onCopyFromRole(e.target.value);
              }}
              className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 shadow-2xs hover:bg-slate-50 focus:border-emerald-500 focus:outline-hidden"
              aria-label="Definir permisos en base a un perfil"
            >
              <option value="">Definir permisos en base a un perfil</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.permissions.length})
                </option>
              ))}
            </select>
          )}

          {/* Dentalink Green Save Button */}
          {onSave && !readonly && (
            <Button
              type="button"
              size="sm"
              disabled={!canSave || isSaving}
              onClick={onSave}
              className="h-8 bg-[#22c55e] hover:bg-[#16a34a] text-white font-medium gap-1.5 shadow-2xs text-xs px-3"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Guardando..." : "Guardar permisos"}
            </Button>
          )}
        </div>
      </div>

      {/* Permission Categories and Lists */}
      <div className="space-y-6">
        {grouped.length > 0 ? (
          grouped.map(([groupName, groupPermissions]) => (
            <div key={groupName} className="space-y-1.5">
              {/* Dentalink Category Header Bar */}
              <div className="rounded-sm bg-[#f1f5f9] px-4 py-2 text-center text-xs font-semibold text-slate-700 tracking-wide uppercase">
                {groupName}
              </div>

              {/* Permission Items List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 px-2">
                {groupPermissions.map((permission) => (
                  <PermissionItemRow
                    key={permission.id}
                    permission={permission}
                    checked={selectedIds.includes(permission.id)}
                    readonly={readonly}
                    onToggle={() => handleToggle(permission.id)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-sm text-slate-400">
            No se encontraron facultades con el criterio de búsqueda especificado.
          </div>
        )}
      </div>
    </div>
  );
}
