import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useUsersQuery } from "@/features/settings/users/hooks/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranchStore } from "@/stores/branch.store";
import { cn } from "@/lib/utils/cn";
import { useCrmTaskConfiguration, useUpdateCrmTaskConfiguration } from "../hooks/use-crm-tasks";
import type { CrmTaskConfiguration, CrmTaskDelayUnit } from "../services/crm-tasks.service";

const PRESETS = [
  { label: "Inmediato", value: 0, unit: "DAYS" as const },
  { label: "1 día", value: 1, unit: "DAYS" as const },
  { label: "1 semana", value: 1, unit: "WEEKS" as const },
  { label: "1 mes", value: 1, unit: "MONTHS" as const },
  { label: "1 año", value: 1, unit: "YEARS" as const }
];

const CARDS = [
  { type: "COBRANZA", title: "Tarea de cobranza", tone: "warning" as const, description: "Se genera al aceptar un presupuesto con saldo pendiente." },
  { type: "CAPTURA", title: "Tarea de captura", tone: "brand" as const, description: "Se genera al agregar un procedimiento a un plan en borrador." },
  { type: "CONTROL", title: "Tarea de control", tone: "success" as const, description: "Se genera al aceptar un presupuesto para programar seguimiento." },
  { type: "CITA", title: "Tarea de cita", tone: "default" as const, description: "Se genera al cancelar o marcar inasistencia cuando el paciente no tiene citas futuras." }
] as const;

export function CrmTasksConfigurationPage() {
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const { hasPermission } = usePermissions();
  const query = useCrmTaskConfiguration(activeBranchId);
  const update = useUpdateCrmTaskConfiguration(activeBranchId);
  const users = useUsersQuery(undefined, "ACTIVE", activeBranchId);
  const [items, setItems] = useState<CrmTaskConfiguration[]>([]);
  const [dirty, setDirty] = useState(false);
  const canUpdate = hasPermission("crm.tasks.configuration.update") || hasPermission("settings.update");

  useEffect(() => {
    if (query.data && !dirty) setItems(query.data.map((item) => ({ ...item })));
  }, [dirty, query.data]);

  if (!activeBranchId) return <EmptyState title="Selecciona una sucursal" description="Los plazos se configuran por sucursal." />;
  if (query.isLoading) return <LoadingState message="Cargando configuración..." />;
  if (query.isError) return <ErrorState message={query.error.message} />;

  const patchItem = (type: string, patch: Partial<CrmTaskConfiguration>) => {
    setDirty(true);
    setItems((current) => current.map((item) => (item.type === type ? { ...item, ...patch } : item)));
  };
  const isPreset = (item: CrmTaskConfiguration, preset: (typeof PRESETS)[number]) => item.delayValue === preset.value && item.delayUnit === preset.unit;
  const custom = (item: CrmTaskConfiguration) => !PRESETS.some((preset) => isPreset(item, preset));
  const valid = items.length === 4 && items.every((item) => Number.isInteger(item.delayValue) && item.delayValue >= 0 && item.delayValue <= 3650);

  const save = () => {
    if (!valid) return;
    update.mutate(
      items.map((item) => ({
        type: item.type,
        enabled: item.enabled,
        delayValue: item.delayValue,
        delayUnit: item.delayUnit,
        defaultAssignedToId: item.defaultAssignedToId || null
      })),
      { onSuccess: () => setDirty(false) }
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4"><h1 className="text-2xl font-bold tracking-tight text-slate-800">Configuración de plazos</h1><p className="mt-1 text-sm text-slate-500">Los cambios afectan eventos futuros; no reprograman tareas ya creadas.</p></div>
      <div className="grid gap-6 md:grid-cols-2">
        {CARDS.map((card) => {
          const item = items.find((value) => value.type === card.type);
          if (!item) return null;
          return (
            <Card key={card.type} className="flex flex-col justify-between border-slate-200 p-6 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between"><Badge value={card.title.toUpperCase()} tone={card.tone} /><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={item.enabled} disabled={!canUpdate} onChange={(event) => patchItem(card.type, { enabled: event.target.checked })} /> Activa</label></div>
                <p className="text-sm font-medium leading-relaxed text-slate-600">{card.description}</p>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {PRESETS.map((preset) => <button type="button" disabled={!canUpdate} key={preset.label} onClick={() => patchItem(card.type, { delayValue: preset.value, delayUnit: preset.unit })} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", isPreset(item, preset) ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{preset.label}</button>)}
                  <button type="button" disabled={!canUpdate} onClick={() => patchItem(card.type, { delayValue: 2, delayUnit: "DAYS" })} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", custom(item) ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>Otro</button>
                </div>
                {custom(item) ? <div className="grid grid-cols-2 gap-2"><Input aria-label={`Cantidad ${card.type}`} type="number" min={0} max={3650} step={1} disabled={!canUpdate} value={item.delayValue} onChange={(event) => patchItem(card.type, { delayValue: Number(event.target.value) })} /><Select aria-label={`Unidad ${card.type}`} disabled={!canUpdate} value={item.delayUnit} onChange={(event) => patchItem(card.type, { delayUnit: event.target.value as CrmTaskDelayUnit })}><option value="DAYS">Días</option><option value="WEEKS">Semanas</option><option value="MONTHS">Meses</option><option value="YEARS">Años</option></Select></div> : null}
                <Select aria-label={`Responsable ${card.type}`} disabled={!canUpdate} value={item.defaultAssignedToId ?? ""} onChange={(event) => patchItem(card.type, { defaultAssignedToId: event.target.value || null })}><option value="">Sin responsable predeterminado</option>{(users.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}</Select>
              </div>
            </Card>
          );
        })}
      </div>
      {canUpdate ? <div className="flex justify-end border-t border-slate-200 pt-4"><Button onClick={save} disabled={!dirty || !valid || update.isPending} className="min-w-[150px] bg-emerald-600 text-white hover:bg-emerald-700"><Save className="h-4 w-4" />{update.isPending ? "Guardando..." : "Guardar"}</Button></div> : <p className="text-sm text-slate-500">Tu perfil puede consultar plazos, pero no modificarlos.</p>}
    </div>
  );
}
