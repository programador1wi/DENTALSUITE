import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useInventoryItems } from "@/features/labs-inventory/hooks/use-labs-inventory";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useTreatmentPlans } from "@/features/treatments/hooks/use-treatments";
import {
  usePhotographicTemplateMutations,
  usePhotographicTemplates
} from "@/features/treatments/hooks/use-photographic-templates";
import { useClinicalMutations } from "../hooks/use-clinical";
import { useOrthodonticArchSizes, useOrthodonticMaterials } from "../hooks/use-orthodontic-catalogs";
import type { ClinicalEvolution } from "../services/clinical.service";
import { ClinicalTemplateModal } from "./clinical-template-modal";
import { RichTextEditor } from "./rich-text-editor";

type ClinicalEvolutionModalProps = {
  patientId: string;
  branchId?: string;
  open: boolean;
  evolution?: ClinicalEvolution | null;
  initialTreatmentPlanId?: string;
  initialTreatmentPlanItemId?: string;
  initialCompletionPercentage?: number;
  onClose: () => void;
  onSuccess?: (evolution: ClinicalEvolution) => void;
};

type EvolutionForm = {
  professionalId: string;
  treatmentPlanId: string;
  treatmentPlanItemId: string;
  completionPercentage: number;
  notes: string;
  isPrivate: boolean;
};

type MaterialFormItem = {
  inventoryItemId: string;
  quantity: number;
  name: string;
  unit: string;
};

type OrthodonticFields = {
  radiography: boolean;
  intraPhotos: boolean;
  extraPhotos: boolean;
  upperArchMaterial: string;
  upperArchSize: string;
  lowerArchMaterial: string;
  lowerArchSize: string;
  upperAligner: string;
  lowerAligner: string;
  elasticsType: string;
  elasticsConfig: string;
  nextSessionIndications: string;
  nextControl: string;
  alert: string;
  recordHygiene: boolean;
  hygiene: string;
};

const EMPTY_FORM: EvolutionForm = {
  professionalId: "",
  treatmentPlanId: "",
  treatmentPlanItemId: "",
  completionPercentage: 100,
  notes: "",
  isPrivate: false
};

const EMPTY_ORTHO_FIELDS: OrthodonticFields = {
  radiography: false,
  intraPhotos: false,
  extraPhotos: false,
  upperArchMaterial: "",
  upperArchSize: "",
  lowerArchMaterial: "",
  lowerArchSize: "",
  upperAligner: "",
  lowerAligner: "",
  elasticsType: "",
  elasticsConfig: "",
  nextSessionIndications: "",
  nextControl: "",
  alert: "",
  recordHygiene: false,
  hygiene: ""
};

export function ClinicalEvolutionModal({
  patientId,
  branchId,
  open,
  evolution,
  initialTreatmentPlanId,
  initialTreatmentPlanItemId,
  initialCompletionPercentage = 100,
  onClose,
  onSuccess
}: ClinicalEvolutionModalProps) {
  const professionals = useProfessionals(undefined, "true", {
    branchId: branchId || undefined,
    pageSize: 100
  });
  const treatmentPlans = useTreatmentPlans({ patientId });
  const mutations = useClinicalMutations(patientId);
  const inventory = useInventoryItems({ active: "true", branchId: branchId || undefined });
  const orthoMaterials = useOrthodonticMaterials();
  const orthoSizes = useOrthodonticArchSizes();

  const [form, setForm] = useState<EvolutionForm>(EMPTY_FORM);
  const [materials, setMaterials] = useState<MaterialFormItem[]>([]);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [orthoFields, setOrthoFields] = useState<OrthodonticFields>(EMPTY_ORTHO_FIELDS);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [photographicAction, setPhotographicAction] = useState<"NONE" | "CREATE" | "LINK">("NONE");
  const [photographicSessionId, setPhotographicSessionId] = useState("");

  const isEditing = Boolean(evolution?.id);
  const selectedPlan = treatmentPlans.data?.find((plan) => plan.id === form.treatmentPlanId);
  const isOrthodontics = selectedPlan?.kind === "ORTHODONTICS";
  const photographicTemplates = usePhotographicTemplates(
    form.treatmentPlanId,
    open && Boolean(form.treatmentPlanId) && isOrthodontics
  );
  const photographicMutations = usePhotographicTemplateMutations(form.treatmentPlanId);
  const saving = mutations.createEvolution.isPending || mutations.updateEvolution.isPending;

  useEffect(() => {
    if (!open) return;

    if (!evolution) {
      resetForm();
      return;
    }

    setForm({
      professionalId: evolution.professionalId,
      treatmentPlanId: evolution.treatmentPlanId ?? "",
      treatmentPlanItemId: evolution.treatmentPlanItemId ?? "",
      completionPercentage: evolution.completionPercentage ?? 100,
      notes: evolution.notes ?? "",
      isPrivate: evolution.isPrivate
    });
    setMaterials(
      (evolution.materials ?? []).map((material) => ({
        inventoryItemId: material.inventoryItemId,
        quantity: Number(material.quantity) || 1,
        name: material.nameSnapshot ?? material.inventoryItem?.name ?? "Material clinico",
        unit: material.unitSnapshot ?? material.inventoryItem?.unit ?? "unidades"
      }))
    );
    setOrthoFields(orthodonticFieldsFromEvolution(evolution));
  }, [evolution, open]);

  useEffect(() => {
    if (!form.professionalId || !professionals.data) return;
    const isVisible = professionals.data.some((professional) => professional.id === form.professionalId);
    if (!isVisible) setForm((prev) => ({ ...prev, professionalId: "" }));
  }, [form.professionalId, professionals.data]);

  const currentDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date());

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      treatmentPlanId: initialTreatmentPlanId ?? "",
      treatmentPlanItemId: initialTreatmentPlanItemId ?? "",
      completionPercentage: initialCompletionPercentage
    });
    setMaterials([]);
    setSelectedInventoryItemId("");
    setSelectedQuantity(1);
    setOrthoFields(EMPTY_ORTHO_FIELDS);
    setPhotographicAction("NONE");
    setPhotographicSessionId("");
  };

  const canSubmit = Boolean(
    form.professionalId &&
    (form.notes.trim() || form.treatmentPlanItemId) &&
    (photographicAction !== "LINK" || photographicSessionId)
  );

  const syncPhotographicSession = async (savedEvolution: ClinicalEvolution) => {
    if (!form.treatmentPlanId || photographicAction === "NONE") return;
    if (photographicAction === "LINK" && photographicSessionId) {
      await photographicMutations.createLink.mutateAsync({
        sessionId: photographicSessionId,
        linkedEntityType: "CLINICAL_EVOLUTION",
        linkedEntityId: savedEvolution.id
      });
      return;
    }
    if (photographicAction === "CREATE") {
      await photographicMutations.createSession.mutateAsync({
        sessionType: "FOLLOW_UP",
        clinicalDate: new Date().toISOString().slice(0, 10),
        professionalId: form.professionalId,
        branchId,
        links: [
          {
            linkedEntityType: "CLINICAL_EVOLUTION",
            linkedEntityId: savedEvolution.id
          }
        ]
      });
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload = buildEvolutionPayload(form, materials, Boolean(isOrthodontics), orthoFields);

    if (isEditing && evolution?.id) {
      mutations.updateEvolution.mutate(
        { evolutionId: evolution.id, data: payload },
        {
          onSuccess: async (updated) => {
            await syncPhotographicSession(updated).catch(() => undefined);
            resetForm();
            onClose();
            toast.success("La evolucion fue actualizada correctamente.");
            onSuccess?.(updated);
          }
        }
      );
      return;
    }

    mutations.createEvolution.mutate(payload, {
      onSuccess: async (created) => {
        await syncPhotographicSession(created).catch(() => undefined);
        resetForm();
        onClose();
        toast.success("La evolucion fue registrada correctamente.");
        onSuccess?.(created);
      }
    });
  };

  const handleSelectTemplate = (content: string) => {
    setForm((prev) => ({ ...prev, notes: content }));
  };

  const addSelectedMaterial = () => {
    const item = inventory.data?.find((inventoryItem) => inventoryItem.id === selectedInventoryItemId);
    if (!item || selectedQuantity <= 0) return;

    setMaterials((prev) => {
      const existing = prev.find((material) => material.inventoryItemId === item.id);
      if (existing) {
        return prev.map((material) =>
          material.inventoryItemId === item.id
            ? { ...material, quantity: material.quantity + selectedQuantity }
            : material
        );
      }
      return [
        ...prev,
        { inventoryItemId: item.id, quantity: selectedQuantity, name: item.name, unit: item.unit }
      ];
    });
    setSelectedInventoryItemId("");
    setSelectedQuantity(1);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEditing ? "Editar evolucion" : "Nueva evolucion"}
        size="xl"
      >
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Profesional</label>
              <Select
                value={form.professionalId}
                onChange={(event) => setForm((prev) => ({ ...prev, professionalId: event.target.value }))}
                className="w-full text-sm"
              >
                <option value="">Buscar profesional...</option>
                {professionals.data?.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {`${professional.firstName} ${professional.lastName}`}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Tratamiento</label>
              <Select
                value={form.treatmentPlanId}
                onChange={(event) => setForm((prev) => ({ ...prev, treatmentPlanId: event.target.value }))}
                className="w-full text-sm"
              >
                <option value="">Buscar tratamiento...</option>
                {treatmentPlans.data?.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {`#${numericCode(plan.id)} - ${plan.name || "Plan de tratamiento"}`}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Fecha</label>
              <Input value={currentDate} readOnly className="w-full cursor-not-allowed bg-slate-50 text-sm" />
            </div>
          </div>

          {form.treatmentPlanItemId ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Avance de la prestacion vinculada
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 25, 50, 75, 100].map((percentage) => (
                  <button
                    key={percentage}
                    type="button"
                    className={`h-9 rounded border px-3 text-sm font-semibold transition ${
                      form.completionPercentage === percentage
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, completionPercentage: percentage }))}
                  >
                    {percentage === 100 ? "Realizar (100%)" : `${percentage}%`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <RichTextEditor
            value={form.notes}
            onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
            onUseTemplate={() => setIsTemplateModalOpen(true)}
            onDictate={() => undefined}
            onFeedback={() => undefined}
          />

          {isOrthodontics ? (
            <section className="space-y-4 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-800">Controles de Ortodoncia</h3>

              <div className="flex flex-wrap gap-6">
                <Checkbox
                  label="Control radiografico"
                  checked={orthoFields.radiography}
                  onChange={(checked) => setOrthoFields((prev) => ({ ...prev, radiography: checked }))}
                />
                <Checkbox
                  label="Fotografias intraorales"
                  checked={orthoFields.intraPhotos}
                  onChange={(checked) => setOrthoFields((prev) => ({ ...prev, intraPhotos: checked }))}
                />
                <Checkbox
                  label="Fotografias extraorales"
                  checked={orthoFields.extraPhotos}
                  onChange={(checked) => setOrthoFields((prev) => ({ ...prev, extraPhotos: checked }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <CatalogSelect
                  label="Arco sup - Material"
                  value={orthoFields.upperArchMaterial}
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, upperArchMaterial: value }))}
                  options={orthoMaterials.data ?? []}
                />
                <CatalogSelect
                  label="Arco sup - Tamano"
                  value={orthoFields.upperArchSize}
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, upperArchSize: value }))}
                  options={orthoSizes.data ?? []}
                />
                <CatalogSelect
                  label="Arco inf - Material"
                  value={orthoFields.lowerArchMaterial}
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, lowerArchMaterial: value }))}
                  options={orthoMaterials.data ?? []}
                />
                <CatalogSelect
                  label="Arco inf - Tamano"
                  value={orthoFields.lowerArchSize}
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, lowerArchSize: value }))}
                  options={orthoSizes.data ?? []}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextField
                  label="Alineador superior"
                  value={orthoFields.upperAligner}
                  placeholder="Ej: Fase 2, #4"
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, upperAligner: value }))}
                />
                <TextField
                  label="Alineador inferior"
                  value={orthoFields.lowerAligner}
                  placeholder="Ej: Fase 2, #4"
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, lowerAligner: value }))}
                />
                <TextField
                  label="Tipo de elasticos"
                  value={orthoFields.elasticsType}
                  placeholder="Ej: 3/16 Medium"
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, elasticsType: value }))}
                />
                <TextField
                  label="Configuracion elasticos"
                  value={orthoFields.elasticsConfig}
                  placeholder="Ej: Clase II bilateral"
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, elasticsConfig: value }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Proximo Control</label>
                  <Select
                    value={orthoFields.nextControl}
                    onChange={(event) =>
                      setOrthoFields((prev) => ({ ...prev, nextControl: event.target.value }))
                    }
                    className="w-full text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="1 semana">1 semana</option>
                    <option value="2 semanas">2 semanas</option>
                    <option value="3 semanas">3 semanas</option>
                    <option value="1 mes">1 mes</option>
                    <option value="6 semanas">6 semanas</option>
                    <option value="2 meses">2 meses</option>
                  </Select>
                </div>
                <TextField
                  label="Alerta visible en perfil"
                  value={orthoFields.alert}
                  placeholder="Ej: Paciente viaja pronto"
                  onChange={(value) => setOrthoFields((prev) => ({ ...prev, alert: value }))}
                />
              </div>

              <TextField
                label="Indicaciones proxima sesion"
                value={orthoFields.nextSessionIndications}
                placeholder="Ej: Tomar Rx panoramica antes de la cita"
                onChange={(value) => setOrthoFields((prev) => ({ ...prev, nextSessionIndications: value }))}
              />

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <Checkbox
                  label="Registrar higiene en esta evolucion"
                  checked={orthoFields.recordHygiene}
                  onChange={(checked) =>
                    setOrthoFields((prev) => ({
                      ...prev,
                      recordHygiene: checked,
                      hygiene: checked ? prev.hygiene || "4" : ""
                    }))
                  }
                />
                {orthoFields.recordHygiene ? (
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-500">Higiene</label>
                      <span className="text-xs font-bold text-blue-600">{orthoFields.hygiene}/7</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="7"
                      step="1"
                      value={orthoFields.hygiene || "4"}
                      onChange={(event) =>
                        setOrthoFields((prev) => ({ ...prev, hygiene: event.target.value }))
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>Deficiente (1)</span>
                      <span>Excelente (7)</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No se agregara punto a la curva de higiene.</p>
                )}
              </div>

              <div className="rounded-md border border-sky-200 bg-sky-50/70 p-3">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-slate-900">Plantilla fotografica opcional</h4>
                  <p className="mt-1 text-xs text-slate-600">
                    La evolucion puede guardarse sin plantilla. Vincular no modifica progreso ni crea
                    controles.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    value={photographicAction}
                    onChange={(event) => {
                      setPhotographicAction(event.target.value as "NONE" | "CREATE" | "LINK");
                      if (event.target.value !== "LINK") setPhotographicSessionId("");
                    }}
                  >
                    <option value="NONE">Continuar sin plantilla</option>
                    <option value="CREATE">Crear nueva plantilla y vincular</option>
                    <option value="LINK">Vincular plantilla existente</option>
                  </Select>
                  {photographicAction === "LINK" ? (
                    <Select
                      value={photographicSessionId}
                      onChange={(event) => setPhotographicSessionId(event.target.value)}
                    >
                      <option value="">Seleccionar plantilla...</option>
                      {(photographicTemplates.data?.sessions ?? []).map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name} - {new Date(session.clinicalDate).toLocaleDateString("es-MX")}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <div className="flex items-center rounded-md border border-dashed border-sky-200 px-3 text-xs text-sky-800">
                      {photographicAction === "CREATE"
                        ? "Se creara despues de guardar la evolucion."
                        : "No se realizara ninguna accion fotografica."}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <section className="border-t border-slate-100 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Materiales e Inventario (Opcional)</h3>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Producto / Material</label>
                <Select
                  value={selectedInventoryItemId}
                  onChange={(event) => setSelectedInventoryItemId(event.target.value)}
                  className="w-full text-sm"
                >
                  <option value="">Seleccionar material...</option>
                  {inventory.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit}) - Stock: {item.stock}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-24">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Cantidad</label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={selectedQuantity}
                  onChange={(event) => setSelectedQuantity(Number(event.target.value))}
                  className="w-full text-sm"
                />
              </div>
              <Button
                variant="secondary"
                type="button"
                disabled={!selectedInventoryItemId || selectedQuantity <= 0}
                onClick={addSelectedMaterial}
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>

            {materials.length ? (
              <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-100/50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Material</th>
                      <th className="px-3 py-2 font-medium">Cantidad</th>
                      <th className="w-10 px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {materials.map((material) => (
                      <tr key={material.inventoryItemId}>
                        <td className="px-3 py-2 font-medium text-slate-900">{material.name}</td>
                        <td className="px-3 py-2">
                          {material.quantity} {material.unit}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-red-500"
                            onClick={() =>
                              setMaterials((prev) =>
                                prev.filter((item) => item.inventoryItemId !== material.inventoryItemId)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={form.isPrivate}
                onChange={(event) => setForm((prev) => ({ ...prev, isPrivate: event.target.checked }))}
              />
              <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300"></div>
              <span className="ml-2 text-sm font-medium text-slate-600">Evolucion privada</span>
            </label>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                disabled={!canSubmit || saving}
                onClick={handleSubmit}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {isEditing ? "Guardar cambios" : "Crear nueva evolucion"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ClinicalTemplateModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        specialties={
          professionals.data?.find((professional) => professional.id === form.professionalId)?.specialties ||
          []
        }
        professionalId={form.professionalId}
        templateType="EVOLUTION"
      />
    </>
  );
}

function Checkbox({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
      />
      {label}
    </label>
  );
}

function CatalogSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      <Select value={value} onChange={(event) => onChange(event.target.value)} className="w-full text-sm">
        <option value="">Seleccionar...</option>
        {options.map((option) => (
          <option key={option.id} value={option.name}>
            {option.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-500">{label}</label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}

function buildEvolutionPayload(
  form: EvolutionForm,
  materials: MaterialFormItem[],
  isOrthodontics: boolean,
  orthoFields: OrthodonticFields
) {
  const payload: Record<string, unknown> = {
    professionalId: form.professionalId,
    notes: form.notes,
    isPrivate: form.isPrivate,
    materials: materials.map((material) => ({
      inventoryItemId: material.inventoryItemId,
      quantity: material.quantity
    }))
  };

  if (form.treatmentPlanId) payload.treatmentPlanId = form.treatmentPlanId;
  if (form.treatmentPlanItemId) {
    payload.treatmentPlanItemId = form.treatmentPlanItemId;
    payload.completionPercentage = form.completionPercentage;
  }
  if (isOrthodontics) payload.fields = orthodonticFieldsToPayload(orthoFields);
  return payload;
}

function orthodonticFieldsToPayload(fields: OrthodonticFields) {
  return [
    ...(fields.radiography ? [{ label: "Control Radiografico", value: "Si", group: "ORTHODONTICS" }] : []),
    ...(fields.intraPhotos ? [{ label: "Fotografias Intraorales", value: "Si", group: "ORTHODONTICS" }] : []),
    ...(fields.extraPhotos ? [{ label: "Fotografias Extraorales", value: "Si", group: "ORTHODONTICS" }] : []),
    ...(fields.upperArchMaterial
      ? [{ label: "Arco superior - Material", value: fields.upperArchMaterial, group: "ORTHODONTICS" }]
      : []),
    ...(fields.upperArchSize
      ? [{ label: "Arco superior - Tamano", value: fields.upperArchSize, group: "ORTHODONTICS" }]
      : []),
    ...(fields.lowerArchMaterial
      ? [{ label: "Arco inferior - Material", value: fields.lowerArchMaterial, group: "ORTHODONTICS" }]
      : []),
    ...(fields.lowerArchSize
      ? [{ label: "Arco inferior - Tamano", value: fields.lowerArchSize, group: "ORTHODONTICS" }]
      : []),
    ...(fields.upperAligner
      ? [{ label: "Alineador superior", value: fields.upperAligner, group: "ORTHODONTICS" }]
      : []),
    ...(fields.lowerAligner
      ? [{ label: "Alineador inferior", value: fields.lowerAligner, group: "ORTHODONTICS" }]
      : []),
    ...(fields.elasticsType
      ? [{ label: "Tipo de elasticos", value: fields.elasticsType, group: "ORTHODONTICS" }]
      : []),
    ...(fields.elasticsConfig
      ? [{ label: "Configuracion elasticos", value: fields.elasticsConfig, group: "ORTHODONTICS" }]
      : []),
    ...(fields.nextSessionIndications
      ? [
          {
            label: "Indicaciones Proxima Sesion",
            value: fields.nextSessionIndications,
            group: "ORTHODONTICS"
          }
        ]
      : []),
    ...(fields.nextControl
      ? [{ label: "Proximo Control", value: fields.nextControl, group: "ORTHODONTICS" }]
      : []),
    ...(fields.alert ? [{ label: "Alerta", value: fields.alert, group: "ORTHODONTICS" }] : []),
    ...(fields.recordHygiene && fields.hygiene
      ? [{ label: "Higiene", value: fields.hygiene, group: "ORTHODONTICS" }]
      : [])
  ];
}

function orthodonticFieldsFromEvolution(evolution: ClinicalEvolution): OrthodonticFields {
  const fields = evolution.fields ?? [];
  const findValue = (...patterns: string[]) =>
    fields.find((field) => patterns.some((pattern) => normalized(field.label).includes(pattern)))?.value ??
    "";

  return {
    radiography: Boolean(findValue("radiograf")),
    intraPhotos: Boolean(findValue("intraoral")),
    extraPhotos: Boolean(findValue("extraoral")),
    upperArchMaterial: findValue("arco superior material"),
    upperArchSize: findValue("arco superior tama", "arco superior tamano"),
    lowerArchMaterial: findValue("arco inferior material"),
    lowerArchSize: findValue("arco inferior tama", "arco inferior tamano"),
    upperAligner: findValue("alineador superior"),
    lowerAligner: findValue("alineador inferior"),
    elasticsType: findValue("tipo de el", "tipo de elasticos"),
    elasticsConfig: findValue("configuraci", "configuracion elasticos"),
    nextSessionIndications: findValue("indicaciones"),
    nextControl: findValue("proximo control", "prximo control"),
    alert: findValue("alerta"),
    recordHygiene: Boolean(findValue("higiene")),
    hygiene: findValue("higiene")
  };
}

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim();
}

function numericCode(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 1000000)
    .toString()
    .padStart(6, "0");
}
