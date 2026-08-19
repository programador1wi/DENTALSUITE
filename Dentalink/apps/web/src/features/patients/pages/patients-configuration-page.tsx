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
  const [settings, setSettings, configState] = usePatientFieldSettings();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const togglePermission = (
    field: PatientFieldDefinition,
    context: PatientFieldContext,
    kind: PermissionKind
  ) => {
    if (field.isSystemRequired || field.lockedContexts?.includes(context)) return;

    setSaved(false);
    setSettings({
      ...settings,
      [context]: {
        ...settings[context],
        [field.id]: nextPermission(settings[context][field.id], kind)
      }
    });
  };

  const saveSettings = async () => {
    setSaveError(null);
    try {
      await configState.saveSettings();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      setSaved(false);
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la configuracion.");
    }
  };

  return (
    <WarnerSuitePanel>
      <PatientsModuleTabs />
      <div className="space-y-2 p-2.5">
        <div className="rounded-[2px] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] px-3 py-2 text-xs leading-5 text-[var(--text-brand-strong)]">
          En esta seccion puedes decidir <strong>que datos se muestran</strong> y{" "}
          <strong>cuales seran obligatorios</strong> al crear pacientes en los distintos flujos. Pasa el
          cursor sobre el icono de informacion para ver el detalle de cada campo.
        </div>

        {saved ? (
          <div
            role="status"
            className="rounded-[2px] border border-[var(--status-success-bg)] bg-[var(--status-success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--status-success-text)]"
          >
            Configuracion guardada y aplicada a todos los flujos.
          </div>
        ) : null}

        {saveError || configState.error ? (
          <div
            role="alert"
            className="rounded-[2px] border border-[var(--status-danger-bg)] bg-[var(--status-danger-bg)] px-3 py-1.5 text-xs font-medium text-[var(--status-danger-text)]"
          >
            {saveError ??
              (configState.error instanceof Error
                ? configState.error.message
                : "No se pudo cargar la configuracion.")}
          </div>
        ) : null}

        <section className="min-w-0">
          <p className="mb-2 text-xs text-[var(--text-secondary)] xl:hidden">Desliza horizontalmente dentro de la matriz para revisar todos los flujos.</p>
          <div className="overflow-x-auto rounded-[2px] border border-[var(--border-default)] bg-[var(--bg-surface)]" data-responsive-overflow="contained" tabIndex={0} aria-label="Matriz de configuración de datos del paciente">
            <table className="w-full min-w-[900px] border-collapse text-xs text-[var(--text-primary)]">
              <thead className="bg-white text-[11px] font-semibold text-slate-700">
                <tr>
                  <th
                    className="sticky left-0 z-20 w-[108px] min-w-[108px] border-b border-r border-[var(--border-default)] bg-white px-2 py-2 text-left align-bottom"
                    rowSpan={2}
                  >
                    Dato
                  </th>
                  {PATIENT_FIELD_CONTEXTS.map((context) => (
                    <th
                      key={context.id}
                      className="border-b border-l border-[var(--border-default)] px-2 py-2 text-center normal-case leading-4"
                      colSpan={2}
                    >
                      {context.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {PATIENT_FIELD_CONTEXTS.flatMap((context) => [
                    <th
                      key={`${context.id}-present`}
                      className="border-b border-l border-[var(--border-default)] px-1.5 py-1.5 text-center uppercase"
                    >
                      Presente
                    </th>,
                    <th
                      key={`${context.id}-required`}
                      className="border-b border-l border-[var(--border-default)] px-1.5 py-1.5 text-center uppercase"
                    >
                      Requerido
                    </th>
                  ])}
                </tr>
              </thead>
              <tbody>
                {PATIENT_FIELD_DEFINITIONS.map((field) => (
                  <tr
                    key={field.id}
                    className="group border-b border-[var(--border-default)] transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] last:border-b-0 hover:bg-[var(--bg-subtle)]"
                  >
                    <td className="sticky left-0 z-10 border-r border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1.5 transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] group-hover:bg-[var(--bg-subtle)]">
                      <div className="flex min-h-5 w-full items-center gap-1.5 text-left leading-4">
                        <span className="font-normal text-[var(--text-primary)]">{field.label}</span>
                        <HelpTooltip
                          label={`Informacion de ${field.label}`}
                          position="right"
                          content={
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                                {field.label}
                              </p>
                              <p className="mt-1 text-[13px] leading-[1.45] text-slate-700">
                                {field.description}
                              </p>
                              {field.isSystemRequired ? (
                                <p className="mt-2 text-[12px] font-medium text-slate-500">
                                  Campo bloqueado del expediente.
                                </p>
                              ) : null}
                            </div>
                          }
                        />
                        {field.isSystemRequired ? (
                          <LockKeyhole className="h-3 w-3 shrink-0 text-[var(--text-secondary)]" />
                        ) : null}
                      </div>
                    </td>
                    {PATIENT_FIELD_CONTEXTS.flatMap((context) => {
                      const permission = settings[context.id][field.id];
                      return (["present", "required"] as const).map((kind) => (
                        <td
                          key={`${field.id}-${context.id}-${kind}`}
                          className="border-l border-[var(--border-default)] px-1.5 py-1.5 text-center"
                        >
                          <PermissionToggle
                            checked={permission[kind]}
                            disabled={
                              field.isSystemRequired ||
                              field.lockedContexts?.includes(context.id) ||
                              configState.isLoading ||
                              configState.isSaving
                            }
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

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            onClick={saveSettings}
            size="sm"
            disabled={configState.isLoading || configState.isSaving}
            className="h-7 rounded-[3px] px-2.5 text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            {configState.isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
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
        "inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-full)] border-2 transition-[background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] disabled:cursor-not-allowed disabled:opacity-80",
        checked
          ? "border-[var(--action-primary)] bg-[var(--action-primary)] text-[var(--text-inverse)]"
          : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-transparent"
      )}
    >
      <Check className="h-3 w-3" />
    </button>
  );
}
