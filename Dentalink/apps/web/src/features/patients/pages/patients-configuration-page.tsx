import { useState } from "react";
import { Check, LockKeyhole, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { WarnerSuitePanel } from "@/components/layout/module-tabs";
import { cn } from "@/lib/utils/cn";
import {
  PATIENT_FIELD_CONTEXTS,
  PATIENT_FIELD_DEFINITIONS,
  type PatientFieldContext,
  type PatientFieldDefinition,
  usePatientFieldSettings
} from "../config/patient-field-settings";
import { PatientsModuleTabs } from "../components/patients-module-tabs";

type PermissionKind = "present" | "required";

export function PatientsConfigurationPage() {
  const [settings, setSettings] = usePatientFieldSettings();
  const [saved, setSaved] = useState(false);

  const togglePermission = (field: PatientFieldDefinition, context: PatientFieldContext, kind: PermissionKind) => {
    if (field.isSystemRequired) return;

    setSaved(false);
    setSettings({
      ...settings,
      [context]: {
        ...settings[context],
        [field.id]: nextPermission(settings[context][field.id], kind)
      }
    });
  };

  const saveSettings = () => {
    setSettings(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <WarnerSuitePanel>
      <PatientsModuleTabs actions={<Button type="button" onClick={saveSettings} size="sm"><Save className="h-4 w-4" /> Guardar</Button>} />
      <div className="space-y-[var(--space-3)] p-[var(--space-3)]">
        <div className="rounded-[var(--radius-md)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-brand-strong)]">
          En esta seccion puedes decidir <strong>que datos se muestran</strong> y <strong>cuales seran obligatorios</strong> al crear pacientes en los distintos flujos. Pasa el cursor sobre el icono de informacion para ver el detalle de cada campo.
        </div>

        {saved ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--status-success-bg)] bg-[var(--status-success-bg)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-sm)] font-medium text-[var(--status-success-text)]">
            Configuracion guardada y aplicada al formulario de nuevo paciente.
          </div>
        ) : null}

        <section className="min-w-0 space-y-[var(--space-2)]">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)] px-[var(--space-1)]">
            <h2 className="text-[var(--text-sm)] font-semibold text-[var(--text-brand-strong)]">Permisos por flujo</h2>
            <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">En pantallas pequenas, desplaza la tabla horizontalmente.</p>
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <table className="w-full min-w-[980px] border-collapse text-[var(--text-sm)] text-[var(--text-primary)]">
              <thead className="bg-[var(--bg-subtle)] text-[var(--text-xs)] font-medium uppercase text-[var(--text-secondary)]">
                <tr>
                  <th className="sticky left-0 z-20 min-w-[180px] border-b border-r border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-3)] py-[var(--space-3)] text-left" rowSpan={2}>
                    Dato
                  </th>
                  {PATIENT_FIELD_CONTEXTS.map((context) => (
                    <th key={context.id} className="border-b border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-3)] text-center text-[var(--text-brand)]" colSpan={2}>
                      {context.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {PATIENT_FIELD_CONTEXTS.flatMap((context) => [
                    <th key={`${context.id}-present`} className="border-b border-l border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-2)] text-center">
                      Presente
                    </th>,
                    <th key={`${context.id}-required`} className="border-b border-l border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-2)] text-center">
                      Requerido
                    </th>
                  ])}
                </tr>
              </thead>
              <tbody>
                {PATIENT_FIELD_DEFINITIONS.map((field) => (
                  <tr
                    key={field.id}
                    className="group border-b border-[var(--border-default)] transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)]"
                  >
                    <td className="sticky left-0 z-10 border-r border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-3)] py-[var(--space-3)] transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] group-hover:bg-[var(--bg-subtle)]">
                      <div className="flex w-full items-center gap-[var(--space-2)] text-left">
                        <span className="font-medium text-[var(--text-primary)]">{field.label}</span>
                        <HelpTooltip
                          label={`Informacion de ${field.label}`}
                          position="right"
                          content={
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{field.label}</p>
                              <p className="mt-1 text-[13px] leading-[1.45] text-slate-700">{field.description}</p>
                              {field.isSystemRequired ? (
                                <p className="mt-2 text-[12px] font-medium text-slate-500">Campo bloqueado del expediente.</p>
                              ) : null}
                            </div>
                          }
                        />
                        {field.isSystemRequired ? <LockKeyhole className="h-3.5 w-3.5 text-[var(--text-secondary)]" /> : null}
                      </div>
                    </td>
                    {PATIENT_FIELD_CONTEXTS.flatMap((context) => {
                      const permission = settings[context.id][field.id];
                      return (["present", "required"] as const).map((kind) => (
                        <td key={`${field.id}-${context.id}-${kind}`} className="border-l border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-2)] text-center">
                          <PermissionToggle
                            checked={permission[kind]}
                            disabled={field.isSystemRequired}
                            label={`${field.label} ${kind === "present" ? "presente" : "requerido"} en ${context.label}`}
                            onClick={() => togglePermission(field, context.id, kind)}
                          />
                        </td>
                      ));
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </WarnerSuitePanel>
  );
}

function nextPermission(current: { present: boolean; required: boolean }, kind: PermissionKind) {
  if (kind === "required") {
    return current.required ? { ...current, required: false } : { present: true, required: true };
  }

  return current.present ? { present: false, required: false } : { ...current, present: true };
}

function PermissionToggle({
  checked,
  disabled,
  label,
  onClick
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-full)] border-2 transition-[background-color,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-80",
        checked
          ? "border-[var(--action-primary)] bg-[var(--action-primary)] text-[var(--text-inverse)]"
          : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-transparent"
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
