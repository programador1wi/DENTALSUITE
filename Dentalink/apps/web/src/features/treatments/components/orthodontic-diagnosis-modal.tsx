import { useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import type {
  OrthodonticDiagnosisCatalogField,
  OrthodonticDiagnosisCatalogSection,
  TreatmentPlanDetail
} from "@/features/treatments/services/treatments.service";

export type OrthodonticDiagnosisFormValue = {
  valueText?: string;
  valueNumber?: string;
  optionId?: string;
  optionIds?: string[];
};

export function OrthodonticDiagnosisModal({
  open,
  plan,
  sections,
  values,
  activeSection,
  loading,
  saving,
  readOnly,
  canManageCatalogs,
  status,
  onActiveSectionChange,
  onFieldChange,
  onClose,
  onSaveDraft,
  onSaveActive,
  onEditOptions
}: {
  open: boolean;
  plan: TreatmentPlanDetail;
  sections: OrthodonticDiagnosisCatalogSection[];
  values: Record<string, OrthodonticDiagnosisFormValue>;
  activeSection: string;
  loading: boolean;
  saving: boolean;
  readOnly: boolean;
  canManageCatalogs: boolean;
  status: string;
  onActiveSectionChange: (sectionCode: string) => void;
  onFieldChange: (fieldCode: string, value: OrthodonticDiagnosisFormValue) => void;
  onClose: () => void;
  onSaveDraft: () => void;
  onSaveActive: () => void;
  onEditOptions: (field: OrthodonticDiagnosisCatalogField) => void;
}) {
  const [openFieldMenu, setOpenFieldMenu] = useState<string | null>(null);
  if (!open) return null;
  const active = sections.find((section) => section.code === activeSection) ?? sections[0];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Diagnostico</h2>
              <p className="mt-1 text-xs text-slate-500">
                {plan.name} · {plan.professional.firstName} {plan.professional.lastName} · {plan.branch.name}{" "}
                · {status}
              </p>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={onClose}
              aria-label="Cerrar diagnostico"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50 p-3 md:border-b-0 md:border-r">
            <div className="flex gap-2 overflow-x-auto md:block md:space-y-1">
              {sections.map((section) => (
                <button
                  key={section.code}
                  type="button"
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium md:w-full ${
                    (active?.code ?? activeSection) === section.code
                      ? "bg-sky-100 text-sky-800"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                  onClick={() => onActiveSectionChange(section.code)}
                >
                  {section.name}
                </button>
              ))}
            </div>
          </aside>
          <main className="min-h-0 overflow-y-auto p-4">
            {loading ? <LoadingState message="Cargando diagnostico..." /> : null}
            {!loading && !sections.length ? (
              <EmptyState
                title="Catalogo no disponible"
                description="No hay campos de diagnostico configurados."
              />
            ) : null}
            {active ? (
              <section className="space-y-3">
                <div className="border-l-2 border-sky-500 bg-slate-100 px-3 py-2">
                  <h3 className="text-sm font-semibold text-slate-800">{active.name}</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {active.fields.map((field) => (
                    <OrthodonticDiagnosisFieldControl
                      key={field.code}
                      field={field}
                      value={values[field.code] ?? {}}
                      readOnly={readOnly}
                      canManageCatalogs={canManageCatalogs}
                      menuOpen={openFieldMenu === field.code}
                      onMenuOpen={(nextOpen) => setOpenFieldMenu(nextOpen ? field.code : null)}
                      onEditOptions={() => {
                        setOpenFieldMenu(null);
                        onEditOptions(field);
                      }}
                      onChange={(nextValue) => onFieldChange(field.code, nextValue)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </main>
        </div>
        <footer className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="secondary" disabled={readOnly || saving} onClick={onSaveDraft}>
            Guardar borrador
          </Button>
          <Button disabled={readOnly || saving} onClick={onSaveActive}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Guardando..." : "Guardar diagnostico"}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export function OrthodonticDiagnosisFieldControl({
  field,
  value,
  readOnly,
  canManageCatalogs,
  menuOpen,
  onMenuOpen,
  onEditOptions,
  onChange
}: {
  field: OrthodonticDiagnosisCatalogField;
  value: OrthodonticDiagnosisFormValue;
  readOnly: boolean;
  canManageCatalogs: boolean;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  onEditOptions: () => void;
  onChange: (value: OrthodonticDiagnosisFormValue) => void;
}) {
  const selectedIds = new Set([...(value.optionIds ?? []), value.optionId].filter(Boolean));
  const visibleOptions = field.options.filter((option) => option.isActive || selectedIds.has(option.id));
  const showMenu = canManageCatalogs && (field.inputType === "select" || field.inputType === "checkbox");
  const label = (
    <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
      <span className="text-xs font-semibold text-slate-600">
        {field.name}
        {field.isHighlighted ? <span className="ml-1 text-sky-700">★</span> : null}
      </span>
      {showMenu ? (
        <div className="relative">
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={`Opciones de ${field.name}`}
            onClick={() => onMenuOpen(!menuOpen)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={onEditOptions}
              >
                Editar opciones
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (field.inputType === "textarea") {
    return (
      <label className="md:col-span-2">
        {label}
        <Textarea
          rows={4}
          value={value.valueText ?? ""}
          disabled={readOnly}
          onChange={(event) => onChange({ valueText: event.target.value })}
        />
      </label>
    );
  }
  if (field.inputType === "number") {
    return (
      <label>
        {label}
        <Input
          type="number"
          value={value.valueNumber ?? ""}
          disabled={readOnly}
          onChange={(event) => onChange({ valueNumber: event.target.value })}
        />
      </label>
    );
  }
  if (field.inputType === "select") {
    return (
      <label>
        {label}
        <Select
          value={value.optionId ?? ""}
          disabled={readOnly}
          onChange={(event) => onChange({ optionId: event.target.value })}
        >
          <option value="">Seleccione una opcion</option>
          {visibleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {!option.isActive ? " (inactiva)" : ""}
            </option>
          ))}
        </Select>
      </label>
    );
  }
  if (field.inputType === "checkbox") {
    return (
      <div>
        {label}
        <div className="space-y-1 rounded-md border border-slate-200 p-3">
          {visibleOptions.map((option) => {
            const checked = selectedIds.has(option.id);
            return (
              <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={readOnly}
                  onChange={(event) => {
                    const current = value.optionIds ?? [];
                    onChange({
                      optionIds: event.target.checked
                        ? [...new Set([...current, option.id])]
                        : current.filter((id) => id !== option.id)
                    });
                  }}
                />
                <span className={!option.isActive ? "text-slate-400 line-through" : ""}>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <label>
      {label}
      <Input
        value={value.valueText ?? ""}
        disabled={readOnly}
        onChange={(event) => onChange({ valueText: event.target.value })}
      />
    </label>
  );
}
