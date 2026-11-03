import { useMemo, useState } from "react";
import { Check, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DeveloperApiScope } from "../services/api-keys.service";

type ScopeOption = {
  value: DeveloperApiScope;
  label: string;
  description: string;
};

type DeveloperApiScopeChecklistProps = {
  options: ScopeOption[];
  value: DeveloperApiScope[];
  onChange: (value: DeveloperApiScope[]) => void;
  invalid?: boolean;
};

const GROUP_ORDER = ["Pacientes", "Agenda", "Presupuestos y precios"] as const;

function getScopeGroup(scope: DeveloperApiScope): (typeof GROUP_ORDER)[number] {
  if (scope.startsWith("patients:")) return "Pacientes";
  if (scope.startsWith("appointments:")) return "Agenda";
  return "Presupuestos y precios";
}

function ScopeRow({
  checked,
  onToggle,
  option
}: {
  checked: boolean;
  onToggle: () => void;
  option: ScopeOption;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const descriptionId = `scope-description-${option.value.replace(":", "-")}`;
  const tooltipId = `scope-tooltip-${option.value.replace(":", "-")}`;

  return (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 transition-colors",
        "hover:bg-[var(--bg-subtle)] focus-within:bg-[var(--bg-subtle)]"
      )}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-describedby={descriptionId}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--action-primary)]",
            checked
              ? "bg-[var(--color-base-emerald-600)] text-white"
              : "border-2 border-[var(--border-strong)] bg-[var(--bg-surface)] group-hover:border-[var(--color-base-slate-500)]"
          )}
        >
          {checked ? <Check className="h-3 w-3 stroke-[3]" /> : null}
        </span>
        <span className="min-w-0 text-[13.5px] leading-tight text-[var(--text-primary)]">
          {option.label}
        </span>
      </label>
      <span id={descriptionId} className="sr-only">
        {option.description} Identificador {option.value}.
      </span>

      <div
        className="relative shrink-0"
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
      >
        <button
          type="button"
          aria-label={`Información sobre ${option.label}`}
          aria-expanded={showDetails}
          aria-describedby={showDetails ? tooltipId : undefined}
          onClick={() => setShowDetails((current) => !current)}
          onFocus={() => setShowDetails(true)}
          onBlur={() => setShowDetails(false)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--color-base-slate-700)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action-primary)]"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>

        {showDetails ? (
          <div
            id={tooltipId}
            role="tooltip"
            className="absolute right-0 top-7 z-20 w-64 rounded-[var(--radius-md)] bg-[var(--color-base-slate-700)] px-3 py-2 text-xs leading-relaxed text-white shadow-[var(--shadow-modal)]"
          >
            <span className="block">{option.description}</span>
            <span className="mt-1 block font-mono text-[11px] text-[var(--color-base-blue-100)]">
              {option.value}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DeveloperApiScopeChecklist({
  invalid = false,
  onChange,
  options,
  value
}: DeveloperApiScopeChecklistProps) {
  const groupedOptions = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        options: options.filter((option) => getScopeGroup(option.value) === group)
      })).filter(({ options: groupOptions }) => groupOptions.length > 0),
    [options]
  );

  const handleToggle = (scope: DeveloperApiScope) => {
    onChange(value.includes(scope) ? value.filter((selected) => selected !== scope) : [...value, scope]);
  };

  return (
    <div
      className={cn(
        "mt-4 rounded-[var(--radius-lg)] border bg-[var(--bg-surface)] p-4",
        invalid ? "border-[var(--text-danger)]" : "border-[var(--border-default)]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">Permisos externos disponibles</p>
        <span
          className="rounded-[var(--radius-full)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]"
          aria-live="polite"
        >
          {value.length} de {options.length} seleccionados
        </span>
      </div>

      <div className="mt-4 space-y-5">
        {groupedOptions.map(({ group, options: groupOptions }) => (
          <section
            key={group}
            aria-labelledby={`scope-group-${group.toLocaleLowerCase("es").replaceAll(" ", "-")}`}
          >
            <h3
              id={`scope-group-${group.toLocaleLowerCase("es").replaceAll(" ", "-")}`}
              className="rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]"
            >
              {group}
            </h3>
            <div className="mt-1 grid grid-cols-1 gap-x-6 px-1 md:grid-cols-2">
              {groupOptions.map((option) => (
                <ScopeRow
                  key={option.value}
                  option={option}
                  checked={value.includes(option.value)}
                  onToggle={() => handleToggle(option.value)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
