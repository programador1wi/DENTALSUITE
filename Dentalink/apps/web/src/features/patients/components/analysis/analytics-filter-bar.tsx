import { RotateCcw, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Branch } from "@/features/settings/branches/services/branches.service";

export type PatientAnalyticsFilterValue = {
  from: string;
  to: string;
  branchSelection: string;
  granularity: "auto" | "day" | "month" | "year";
};

export function AnalyticsFilterBar({
  value,
  branches,
  canViewAllBranches,
  refreshing,
  onChange,
  onApply,
  onClear,
  onRefresh
}: {
  value: PatientAnalyticsFilterValue;
  branches: Branch[];
  canViewAllBranches: boolean;
  refreshing: boolean;
  onChange: (value: PatientAnalyticsFilterValue) => void;
  onApply: () => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  const invalidRange = !value.from || !value.to || value.from > value.to;

  return (
    <section
      aria-label="Filtros del analisis"
      className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)]"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(145px,0.8fr)_minmax(145px,0.8fr)_minmax(220px,1.4fr)_minmax(150px,0.8fr)_auto] lg:items-end">
        <label className="space-y-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
          Fecha inicial
          <Input
            type="date"
            value={value.from}
            max={value.to}
            onChange={(event) => onChange({ ...value, from: event.target.value })}
          />
        </label>
        <label className="space-y-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
          Fecha final
          <Input
            type="date"
            value={value.to}
            min={value.from}
            onChange={(event) => onChange({ ...value, to: event.target.value })}
          />
        </label>
        <label className="space-y-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
          Alcance de sucursal
          <Select
            value={value.branchSelection}
            onChange={(event) => onChange({ ...value, branchSelection: event.target.value })}
          >
            {canViewAllBranches && branches.length > 1 ? (
              <option value="all">Todas las sucursales autorizadas</option>
            ) : null}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
          Granularidad
          <Select
            value={value.granularity}
            onChange={(event) =>
              onChange({
                ...value,
                granularity: event.target.value as PatientAnalyticsFilterValue["granularity"]
              })
            }
          >
            <option value="auto">Automatica</option>
            <option value="day">Diaria</option>
            <option value="month">Mensual</option>
            <option value="year">Anual</option>
          </Select>
        </label>
        <Button type="button" disabled={invalidRange} onClick={onApply} className="h-10">
          <Search className="h-4 w-4" />
          Filtrar
        </Button>
      </div>

      {invalidRange ? (
        <p className="mt-2 text-[12px] font-medium text-[var(--status-danger)]">
          Selecciona ambas fechas y asegúrate de que la fecha inicial no sea posterior a la final.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
          Fechas y sucursales permanecen en URL para compartir el mismo corte.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onClear}>
            <RotateCcw className="h-4 w-4" />
            Limpiar
          </Button>
          <Button type="button" variant="secondary" disabled={refreshing} onClick={onRefresh}>
            <RotateCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>
    </section>
  );
}
