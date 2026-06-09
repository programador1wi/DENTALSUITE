import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { getPermissionDescription, getPermissionLabel } from "@/features/settings/permissions/permission-labels";
import type { PermissionListItem } from "@/features/settings/permissions/services/permissions.service";
import { cn } from "@/lib/utils/cn";

type PermissionChecklistProps = {
  allPermissions: PermissionListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  readonly?: boolean;
};

const MODULE_LABELS: Record<string, string> = {
  accounts_receivable: "Cuentas por cobrar",
  agenda: "Agenda",
  appointments: "Citas",
  branches: "Sucursales",
  budgets: "Presupuestos",
  cash_register: "Caja",
  chairs: "Sillones",
  clinical: "Clinica",
  clinical_documents: "Documentos clinicos",
  collections: "Cobranzas",
  consent_templates: "Consentimientos",
  consents: "Consentimientos",
  files: "Archivos",
  installments: "Cuotas",
  inventory: "Inventario",
  lab_orders: "Ordenes de laboratorio",
  lab_providers: "Laboratorios",
  labs: "Laboratorios",
  payment_methods: "Metodos de pago",
  payments: "Pagos / Cobranzas",
  permissions: "Permisos",
  price_lists: "Listas de precio",
  procedure_categories: "Categorias de procedimientos",
  procedures: "Procedimientos",
  professionals: "Profesionales",
  reports: "Reportes",
  roles: "Perfiles",
  schedules: "Horarios",
  settings: "Configuracion",
  specialties: "Especialidades",
  suppliers: "Proveedores",
  system: "Sistema",
  treatment_plans: "Planes de tratamiento",
  users: "Usuarios"
};

function getModuleLabel(module: string) {
  return MODULE_LABELS[module] ?? module.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function PermissionRow({
  checked,
  onToggle,
  permission,
  readonly
}: {
  checked: boolean;
  onToggle: () => void;
  permission: PermissionListItem;
  readonly: boolean;
}) {
  const label = getPermissionLabel(permission);
  const description = getPermissionDescription(permission);

  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors",
        !readonly && "hover:bg-slate-50",
        readonly && "cursor-default"
      )}
    >
      <span
        onClick={readonly ? undefined : onToggle}
        className={cn(
          "relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white group-hover:border-slate-400"
        )}
        aria-hidden="true"
      >
        {checked ? (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>

      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={readonly}
        onChange={readonly ? undefined : onToggle}
        aria-label={label}
      />

      <span className="flex-1 text-sm leading-snug text-slate-700">{label}</span>

      {description ? <HelpTooltip content={description} position="left" /> : null}
    </label>
  );
}

function ModuleSection({
  module,
  onToggle,
  onToggleAll,
  permissions,
  readonly,
  selectedIds
}: {
  module: string;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  permissions: PermissionListItem[];
  readonly: boolean;
  selectedIds: string[];
}) {
  const [open, setOpen] = useState(true);
  const moduleIds = permissions.map((permission) => permission.id);
  const activeCount = permissions.filter((permission) => selectedIds.includes(permission.id)).length;
  const allSelected = activeCount === permissions.length;
  const someSelected = activeCount > 0 && !allSelected;
  const label = getModuleLabel(module);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div
        className={cn(
          "flex select-none items-center gap-3 px-4 py-3",
          !readonly && "cursor-pointer hover:bg-slate-50",
          readonly && "cursor-default"
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            activeCount > 0 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
          )}
        >
          <ShieldCheck className="h-4 w-4" />
        </span>

        <span className="flex-1 text-sm font-semibold text-slate-800">{label}</span>

        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            activeCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
          )}
        >
          {activeCount}/{permissions.length}
        </span>

        {!readonly ? (
          <HelpTooltip content={allSelected ? "Desmarcar todos los permisos del modulo." : "Marcar todos los permisos del modulo."} position="left">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleAll(moduleIds, !allSelected);
              }}
              className={cn(
                "relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-all",
                allSelected
                  ? "border-emerald-500 bg-emerald-500"
                  : someSelected
                    ? "border-emerald-400 bg-emerald-100"
                    : "border-slate-300 bg-white hover:border-slate-400"
              )}
              aria-label={`${allSelected ? "Desmarcar" : "Marcar"} todos los permisos de ${label}`}
            >
              {allSelected ? (
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {someSelected && !allSelected ? <span className="block h-[2px] w-2.5 rounded bg-emerald-600" /> : null}
            </button>
          </HelpTooltip>
        ) : null}

        <span className="text-slate-400 transition-transform duration-200">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </div>

      {open ? (
        <div className="space-y-0.5 border-t border-slate-100 px-3 py-2">
          {permissions.map((permission) => (
            <PermissionRow
              key={permission.id}
              permission={permission}
              checked={selectedIds.includes(permission.id)}
              readonly={readonly}
              onToggle={() => onToggle(permission.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PermissionChecklist({ allPermissions, onChange, readonly = false, selectedIds }: PermissionChecklistProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, PermissionListItem[]>();
    for (const permission of allPermissions) {
      if (!map.has(permission.module)) map.set(permission.module, []);
      map.get(permission.module)!.push(permission);
    }
    return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [allPermissions]);

  const handleToggle = (id: string) => {
    if (readonly) return;
    const next = selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id];
    onChange(next);
  };

  const handleToggleAll = (ids: string[], selectAll: boolean) => {
    if (readonly) return;
    const next = selectAll ? [...new Set([...selectedIds, ...ids])] : selectedIds.filter((id) => !ids.includes(id));
    onChange(next);
  };

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
        <ShieldCheck className="h-8 w-8" />
        <p className="text-sm">No hay permisos disponibles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(([module, permissions]) => (
        <ModuleSection
          key={module}
          module={module}
          permissions={permissions}
          selectedIds={selectedIds}
          readonly={readonly}
          onToggle={handleToggle}
          onToggleAll={handleToggleAll}
        />
      ))}
    </div>
  );
}
