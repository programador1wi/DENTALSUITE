import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Printer, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/feedback/loading-state";
import type {
  OrthodonticCatalogField,
  TreatmentPlanDetail,
  TreatmentPlanPrintDocumentType,
  TreatmentPlanStatus
} from "@/features/treatments/services/treatments.service";
import { OrthodonticOptionsModal } from "./orthodontic-options-modal";
import { numericId } from "./treatment-modal-helpers";

export type OrthodonticProfileFormState = {
  technicalDescription: string;
  startDate: string;
  estimatedMonths: string;
  estimatedControls: string;
  totalAligners: string;
  indicatedExtractions: string;
  performedExtractions: string;
  reevaluationDate: string;
  interconsultations: string;
  lastUpperArch: string;
  lastLowerArch: string;
  nextControlAt: string;
  nextRadiographyAt: string;
  hygieneStatus: string;
  alert: string;
  indications: string;
  elastics: string;
  planNotes: string;
  catalogSelections: Record<string, string[]>;
};

export const ORTHODONTIC_FIELD_GROUPS = {
  general: ["treatment_type", "treatment_time"],
  biomechanics: ["upper_anchor", "lower_anchor", "attachments"],
  radiography: ["radiographic_control", "periodicity"],
  appliances: [
    "brackets",
    "aligners",
    "plates",
    "upper_tubes",
    "lower_tubes",
    "upper_bands",
    "lower_bands",
    "upper_anterior_cementation",
    "upper_posterior_cementation",
    "lower_anterior_cementation",
    "lower_posterior_cementation"
  ]
} as const;

function treatmentPlanStatusLabel(status: TreatmentPlanStatus) {
  const labels: Record<TreatmentPlanStatus, string> = {
    DRAFT: "Borrador",
    PRESENTED: "Presentado",
    ACCEPTED: "Aceptado",
    IN_PROGRESS: "En ejecucion",
    COMPLETED: "Finalizado",
    CANCELLED: "Cancelado",
    REJECTED: "Rechazado"
  };
  return labels[status] ?? status;
}

export function DerivedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export function OrthodonticTechnicalPlanModal({
  open,
  plan,
  form,
  fields,
  loadingCatalogs,
  saving,
  readOnly,
  canManageCatalogs,
  onClose,
  onPrintDocument,
  onFieldChange,
  onSelectionChange,
  onSave,
  onCreateCatalogOption,
  onUpdateCatalogOption,
  onDeactivateCatalogOption,
  onReactivateCatalogOption,
  onSortCatalogOptions
}: {
  open: boolean;
  plan: TreatmentPlanDetail;
  form: OrthodonticProfileFormState;
  fields: OrthodonticCatalogField[];
  loadingCatalogs: boolean;
  saving: boolean;
  readOnly: boolean;
  canManageCatalogs: boolean;
  onClose: () => void;
  onPrintDocument: (type: TreatmentPlanPrintDocumentType) => void;
  onFieldChange: (
    field: Exclude<keyof OrthodonticProfileFormState, "catalogSelections">,
    value: string
  ) => void;
  onSelectionChange: (
    fieldCode: string,
    optionId: string,
    allowsMultiple: boolean,
    checked?: boolean
  ) => void;
  onSave: () => void;
  onCreateCatalogOption: (fieldId: string, label: string) => Promise<unknown>;
  onUpdateCatalogOption: (
    optionId: string,
    payload: { label?: string; sortOrder?: number }
  ) => Promise<unknown>;
  onDeactivateCatalogOption: (optionId: string, reason?: string) => Promise<unknown>;
  onReactivateCatalogOption: (optionId: string) => Promise<unknown>;
  onSortCatalogOptions: (fieldId: string, optionIds: string[]) => Promise<unknown>;
}) {
  const [editingField, setEditingField] = useState<OrthodonticCatalogField | null>(null);
  const [openFieldMenu, setOpenFieldMenu] = useState<string | null>(null);
  const fieldByCode = useMemo(() => new Map(fields.map((field) => [field.code, field])), [fields]);
  const professionalName = `${plan.professional.firstName} ${plan.professional.lastName}`.trim();
  const patientName = `${plan.patient.firstName} ${plan.patient.lastName}`.trim();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editingField) setEditingField(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingField, onClose, open]);

  if (!open) return null;

  const renderCatalog = (code: string) => {
    const field = fieldByCode.get(code);
    if (!field) return null;
    return (
      <OrthodonticCatalogControl
        key={code}
        field={field}
        value={form.catalogSelections[code] ?? []}
        readOnly={readOnly}
        canManageCatalogs={canManageCatalogs}
        menuOpen={openFieldMenu === code}
        onMenuOpen={(nextOpen) => setOpenFieldMenu(nextOpen ? code : null)}
        onEditOptions={() => {
          setOpenFieldMenu(null);
          setEditingField(field);
        }}
        onSelectionChange={(optionId, checked) =>
          onSelectionChange(code, optionId, field.allowsMultiple, checked)
        }
      />
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan de tratamiento"
        className="flex max-h-[90vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Plan de tratamiento</h2>
              <p className="mt-1 text-xs text-slate-500">
                #{numericId(plan.id)} · {patientName || "Paciente"} · Dr(a){" "}
                {professionalName || "No informado"} · {treatmentPlanStatusLabel(plan.status)}
              </p>
            </div>
            <Badge value={readOnly ? "Solo lectura" : "Editable"} tone={readOnly ? "default" : "success"} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadingCatalogs ? (
            <LoadingState message="Cargando catalogos de ortodoncia..." />
          ) : (
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Informacion general</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Plan de tratamiento</span>
                    <Textarea
                      className="mt-1"
                      rows={3}
                      disabled={readOnly}
                      value={form.technicalDescription}
                      onChange={(event) => onFieldChange("technicalDescription", event.target.value)}
                    />
                  </label>
                  {ORTHODONTIC_FIELD_GROUPS.general.map(renderCatalog)}
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Inicio tratamiento</span>
                    <Input
                      className="mt-1"
                      type="date"
                      disabled={readOnly}
                      value={form.startDate}
                      onChange={(event) => onFieldChange("startDate", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Cantidad controles</span>
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={form.estimatedControls}
                      onChange={(event) => onFieldChange("estimatedControls", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Meses estimados</span>
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={form.estimatedMonths}
                      onChange={(event) => onFieldChange("estimatedMonths", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Alineadores totales</span>
                    <Input
                      className="mt-1"
                      type="number"
                      min={0}
                      disabled={readOnly}
                      value={form.totalAligners}
                      onChange={(event) => onFieldChange("totalAligners", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Biomecanica</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {ORTHODONTIC_FIELD_GROUPS.biomechanics.map(renderCatalog)}
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Extracciones indicadas</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.indicatedExtractions}
                      onChange={(event) => onFieldChange("indicatedExtractions", event.target.value)}
                    />
                  </label>
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Extracciones realizadas</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.performedExtractions}
                      onChange={(event) => onFieldChange("performedExtractions", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Control radiografico</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {ORTHODONTIC_FIELD_GROUPS.radiography.map(renderCatalog)}
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Reevaluacion</span>
                    <Input
                      className="mt-1"
                      type="date"
                      disabled={readOnly}
                      value={form.reevaluationDate}
                      onChange={(event) => onFieldChange("reevaluationDate", event.target.value)}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-600">Proxima Rx/Cf</span>
                    <Input
                      className="mt-1"
                      type="datetime-local"
                      disabled={readOnly}
                      value={form.nextRadiographyAt}
                      onChange={(event) => onFieldChange("nextRadiographyAt", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Aparatologia</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {ORTHODONTIC_FIELD_GROUPS.appliances.map(renderCatalog)}
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Interconsultas</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.interconsultations}
                      onChange={(event) => onFieldChange("interconsultations", event.target.value)}
                    />
                  </label>
                  <label className="md:col-span-3">
                    <span className="text-xs font-semibold text-slate-600">Notas del plan</span>
                    <Textarea
                      className="mt-1"
                      rows={2}
                      disabled={readOnly}
                      value={form.planNotes}
                      onChange={(event) => onFieldChange("planNotes", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Datos derivados de evoluciones</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <DerivedField label="Ultimo arco superior" value={form.lastUpperArch || "Sin evolucion"} />
                  <DerivedField label="Ultimo arco inferior" value={form.lastLowerArch || "Sin evolucion"} />
                  <DerivedField label="Higiene actual" value={form.hygieneStatus || "Sin evolucion"} />
                  <DerivedField label="Elasticos actuales" value={form.elastics || "Sin evolucion"} />
                  <DerivedField label="Ultima alerta" value={form.alert || "Sin alerta"} />
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          {readOnly ? (
            <>
              <Button variant="secondary" onClick={() => onPrintDocument("CARE_PLAN")}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              <Button disabled={saving || loadingCatalogs} onClick={onSave}>
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </>
          )}
        </footer>
      </div>

      <OrthodonticOptionsModal
        field={editingField}
        canManage={canManageCatalogs}
        onClose={() => setEditingField(null)}
        onCreate={onCreateCatalogOption}
        onUpdate={onUpdateCatalogOption}
        onDeactivate={onDeactivateCatalogOption}
        onReactivate={onReactivateCatalogOption}
        onSort={onSortCatalogOptions}
      />
    </div>,
    document.body
  );
}

export function OrthodonticCatalogControl({
  field,
  value,
  readOnly,
  canManageCatalogs,
  menuOpen,
  onMenuOpen,
  onEditOptions,
  onSelectionChange
}: {
  field: OrthodonticCatalogField;
  value: string[];
  readOnly: boolean;
  canManageCatalogs: boolean;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  onEditOptions: () => void;
  onSelectionChange: (optionId: string, checked?: boolean) => void;
}) {
  const selectedIds = new Set(value);
  const visibleOptions = field.options.filter((option) => option.isActive || selectedIds.has(option.id));
  const inactiveSelected = visibleOptions.filter((option) => selectedIds.has(option.id) && !option.isActive);

  return (
    <div className={field.allowsMultiple ? "md:col-span-1" : ""}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{field.name}</span>
        {canManageCatalogs ? (
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
      {field.allowsMultiple ? (
        <div className="min-h-[42px] rounded-md border border-slate-300 bg-white p-2">
          <div className="grid gap-1">
            {visibleOptions.map((option) => (
              <label key={option.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={selectedIds.has(option.id)}
                  onChange={(event) => onSelectionChange(option.id, event.target.checked)}
                />
                <span className={option.isActive ? "" : "text-slate-400 line-through"}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <Select
          disabled={readOnly}
          value={value[0] ?? ""}
          onChange={(event) => onSelectionChange(event.target.value)}
        >
          <option value="">Seleccionar</option>
          {visibleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
              {option.isActive ? "" : " (inactiva)"}
            </option>
          ))}
        </Select>
      )}
      {inactiveSelected.length ? (
        <p className="mt-1 text-xs font-medium text-amber-700">Opcion inactiva conservada en historial.</p>
      ) : null}
    </div>
  );
}
