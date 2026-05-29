import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { cn } from "@/lib/utils/cn";
import type { PermissionListItem } from "@/features/settings/permissions/services/permissions.service";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type PermissionChecklistProps = {
  allPermissions: PermissionListItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  readonly?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  agenda: "Agenda",
  appointments: "Citas",
  patients: "Pacientes",
  clinical: "Clínica",
  payments: "Pagos / Cobranzas",
  cash_register: "Caja",
  collections: "Cobranzas",
  accounts_receivable: "Cuentas por cobrar",
  installments: "Cuotas",
  reports: "Reportes",
  users: "Usuarios",
  roles: "Perfiles",
  settings: "Configuración",
  branches: "Sucursales",
  professionals: "Profesionales",
  specialties: "Especialidades",
  schedules: "Horarios",
  chairs: "Sillones",
  payment_methods: "Métodos de pago",
  procedures: "Procedimientos",
  price_lists: "Listas de precio",
  consent_templates: "Consentimientos",
  clinical_documents: "Documentos clínicos",
  lab_providers: "Proveedores de lab.",
  lab_orders: "Pedidos de lab.",
  inventory: "Inventario",
  budgets: "Presupuestos",
  treatment_plans: "Planes de tratamiento",
  files: "Archivos",
  consents: "Consentimientos",
  system: "Sistema"
};

function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Subcomponente: fila de permiso individual ────────────────────────────────

function PermissionRow({
  permission,
  checked,
  readonly,
  onToggle
}: {
  permission: PermissionListItem;
  checked: boolean;
  readonly: boolean;
  onToggle: () => void;
}) {
  const label = permission.name ?? permission.key ?? permission.code ?? permission.action;
  const description = permission.description;

  return (
    <label
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors",
        !readonly && "hover:bg-slate-50",
        readonly && "cursor-default"
      )}
    >
      {/* Checkbox visual circular */}
      <span
        onClick={readonly ? undefined : onToggle}
        className={cn(
          "relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          checked
            ? "border-emerald-500 bg-emerald-500"
            : "border-slate-300 bg-white group-hover:border-slate-400"
        )}
        aria-hidden="true"
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      {/* Input real oculto para accesibilidad */}
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={readonly}
        onChange={readonly ? undefined : onToggle}
        aria-label={label}
      />

      {/* Texto del permiso */}
      <span className="flex-1 text-sm text-slate-700 leading-snug">{label}</span>

      {/* Tooltip de descripción */}
      {description ? (
        <HelpTooltip content={description} position="left" />
      ) : null}
    </label>
  );
}

// ─── Subcomponente: sección por módulo ────────────────────────────────────────

function ModuleSection({
  module,
  permissions,
  selectedIds,
  readonly,
  onToggle,
  onToggleAll
}: {
  module: string;
  permissions: PermissionListItem[];
  selectedIds: string[];
  readonly: boolean;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const moduleIds = permissions.map((p) => p.id);
  const activeCount = permissions.filter((p) => selectedIds.includes(p.id)).length;
  const allSelected = activeCount === permissions.length;
  const someSelected = activeCount > 0 && !allSelected;
  const label = getModuleLabel(module);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Cabecera del módulo */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 select-none",
          !readonly && "cursor-pointer hover:bg-slate-50",
          readonly && "cursor-default"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Indicador color */}
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            activeCount > 0
              ? "bg-emerald-100 text-emerald-600"
              : "bg-slate-100 text-slate-400"
          )}
        >
          <ShieldCheck className="h-4 w-4" />
        </span>

        {/* Nombre del módulo */}
        <span className="flex-1 text-sm font-semibold text-slate-800">{label}</span>

        {/* Badge conteo */}
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            activeCount > 0
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          )}
        >
          {activeCount}/{permissions.length}
        </span>

        {/* Checkbox "seleccionar todos" */}
        {!readonly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
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
            title={allSelected ? "Desmarcar todos" : "Marcar todos"}
            aria-label={`${allSelected ? "Desmarcar" : "Marcar"} todos los permisos de ${label}`}
          >
            {allSelected && (
              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {someSelected && !allSelected && (
              <span className="block h-[2px] w-2.5 rounded bg-emerald-600" />
            )}
          </button>
        )}

        {/* Chevron */}
        <span className="text-slate-400 transition-transform duration-200">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </div>

      {/* Lista de permisos */}
      {open && (
        <div className="border-t border-slate-100 px-3 py-2 space-y-0.5">
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
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PermissionChecklist({
  allPermissions,
  selectedIds,
  onChange,
  readonly = false
}: PermissionChecklistProps) {
  // Agrupar por módulo, ordenados alfabéticamente
  const grouped = useMemo(() => {
    const map = new Map<string, PermissionListItem[]>();
    for (const permission of allPermissions) {
      const key = permission.module;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(permission);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions]);

  const handleToggle = (id: string) => {
    if (readonly) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((s) => s !== id)
      : [...selectedIds, id];
    onChange(next);
  };

  const handleToggleAll = (ids: string[], selectAll: boolean) => {
    if (readonly) return;
    const next = selectAll
      ? [...new Set([...selectedIds, ...ids])]
      : selectedIds.filter((id) => !ids.includes(id));
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
