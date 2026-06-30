import { type FormEvent, useMemo, useState } from "react";
import { Pencil, RotateCcw, X, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/features/clinical/components/rich-text-editor";
import {
  useCreateSpecialty,
  useCreateSpecialtyAppointmentReason,
  useCreateSpecialtyClinicalTemplate,
  useDeactivateSpecialty,
  useSpecialties,
  useSpecialtyAppointmentReasons,
  useSpecialtyClinicalTemplates,
  useUpdateSpecialty,
  useUpdateSpecialtyAppointmentReason,
  useUpdateSpecialtyClinicalTemplate
} from "../hooks/use-specialties";
import type {
  Specialty,
  SpecialtyAppointmentReason,
  SpecialtyClinicalTemplate,
  SpecialtyClinicalTemplateType
} from "../services/specialties.service";
import { ALLOWED_SPECIALTY_NAMES } from "../utils/allowed-specialties";

type SpecialtyForm = {
  name: string;
  description: string;
};

type TemplateTarget = {
  specialty: Specialty;
  type: SpecialtyClinicalTemplateType;
};

type TemplateForm = {
  name: string;
  content: string;
};

type ReasonForm = {
  name: string;
  durationMinutes: string;
  color: string;
};

const emptySpecialtyForm: SpecialtyForm = { name: "", description: "" };
const emptyTemplateForm: TemplateForm = { name: "", content: "" };
const emptyReasonForm: ReasonForm = { name: "", durationMinutes: "30", color: "#0ea5e9" };
const reasonDurationOptions = [5, 10, 15, 20, 30, 40, 60];
const reasonColorOptions = [
  "#000000",
  "#eeeeee",
  "#ff9900",
  "#9900ff",
  "#2ef4c6",
  "#2a9ce4",
  "#ff0000",
  "#00ff00",
  "#f1c232",
  "#f4cccc",
  "#6aa84f",
  "#999999",
  "#45818e"
];

function textOrUndefined(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function templateLabel(type: SpecialtyClinicalTemplateType) {
  return type === "PRESCRIPTION" ? "Prescripciones" : "Evoluciones";
}

function sortReasonsByLegacyId(reasons: SpecialtyAppointmentReason[]) {
  return [...reasons].sort((left, right) => {
    const leftLegacyId = left.legacyId ?? Number.MAX_SAFE_INTEGER;
    const rightLegacyId = right.legacyId ?? Number.MAX_SAFE_INTEGER;
    if (leftLegacyId !== rightLegacyId) return leftLegacyId - rightLegacyId;
    return left.name.localeCompare(right.name, "es");
  });
}

function reasonDisplayId(reason: SpecialtyAppointmentReason, index: number) {
  return typeof reason.legacyId === "number" ? reason.legacyId : index + 1;
}

export function SpecialtiesSettingsPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"true" | "false">("true");
  const [specialtyModalOpen, setSpecialtyModalOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [specialtyForm, setSpecialtyForm] = useState<SpecialtyForm>(emptySpecialtyForm);
  const [templateTarget, setTemplateTarget] = useState<TemplateTarget | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<SpecialtyClinicalTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplateForm);
  const [reasonSpecialty, setReasonSpecialty] = useState<Specialty | null>(null);
  const [reasonEditorOpen, setReasonEditorOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<SpecialtyAppointmentReason | null>(null);
  const [reasonForm, setReasonForm] = useState<ReasonForm>(emptyReasonForm);

  const specialties = useSpecialties(search || undefined, view);
  const templates = useSpecialtyClinicalTemplates(templateTarget?.specialty.id, templateTarget?.type);
  const reasons = useSpecialtyAppointmentReasons(reasonSpecialty?.id);
  const createSpecialty = useCreateSpecialty();
  const updateSpecialty = useUpdateSpecialty();
  const deactivateSpecialty = useDeactivateSpecialty();
  const createTemplate = useCreateSpecialtyClinicalTemplate();
  const updateTemplate = useUpdateSpecialtyClinicalTemplate();
  const createReason = useCreateSpecialtyAppointmentReason();
  const updateReason = useUpdateSpecialtyAppointmentReason();
  const sortedReasons = useMemo(() => sortReasonsByLegacyId(reasons.data ?? []), [reasons.data]);

  const specialtyPending =
    createSpecialty.isPending || updateSpecialty.isPending || deactivateSpecialty.isPending;
  const templatePending = createTemplate.isPending || updateTemplate.isPending;
  const reasonPending = createReason.isPending || updateReason.isPending;

  const openNewSpecialty = () => {
    setEditingSpecialty(null);
    setSpecialtyForm(emptySpecialtyForm);
    setSpecialtyModalOpen(true);
  };

  const openEditSpecialty = (specialty: Specialty) => {
    setEditingSpecialty(specialty);
    setSpecialtyForm({
      name: specialty.name,
      description: specialty.description ?? ""
    });
    setSpecialtyModalOpen(true);
  };

  const closeSpecialtyModal = () => {
    setEditingSpecialty(null);
    setSpecialtyForm(emptySpecialtyForm);
    setSpecialtyModalOpen(false);
  };

  const submitSpecialty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!specialtyForm.name.trim()) return;

    const payload = {
      name: specialtyForm.name.trim(),
      description: textOrUndefined(specialtyForm.description)
    };

    if (editingSpecialty) {
      await updateSpecialty.mutateAsync({ id: editingSpecialty.id, payload });
    } else {
      await createSpecialty.mutateAsync(payload);
    }

    closeSpecialtyModal();
  };

  const openTemplates = (specialty: Specialty, type: SpecialtyClinicalTemplateType) => {
    setTemplateTarget({ specialty, type });
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
  };

  const closeTemplates = () => {
    setTemplateTarget(null);
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
  };

  const editTemplate = (template: SpecialtyClinicalTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({ name: template.name, content: template.content });
  };

  const submitTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateTarget || !templateForm.name.trim() || !templateForm.content.trim()) return;

    if (editingTemplate) {
      await updateTemplate.mutateAsync({
        specialtyId: templateTarget.specialty.id,
        templateId: editingTemplate.id,
        payload: {
          name: templateForm.name.trim(),
          content: templateForm.content.trim()
        }
      });
    } else {
      await createTemplate.mutateAsync({
        specialtyId: templateTarget.specialty.id,
        payload: {
          type: templateTarget.type,
          name: templateForm.name.trim(),
          content: templateForm.content.trim()
        }
      });
    }

    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
  };

  const openReasons = (specialty: Specialty) => {
    setReasonSpecialty(specialty);
    setReasonEditorOpen(false);
    setEditingReason(null);
    setReasonForm(emptyReasonForm);
  };

  const closeReasons = () => {
    setReasonSpecialty(null);
    setReasonEditorOpen(false);
    setEditingReason(null);
    setReasonForm(emptyReasonForm);
  };

  const openNewReason = () => {
    setEditingReason(null);
    setReasonForm(emptyReasonForm);
    setReasonEditorOpen(true);
  };

  const editReason = (reason: SpecialtyAppointmentReason) => {
    setEditingReason(reason);
    setReasonForm({
      name: reason.name,
      durationMinutes: String(reason.durationMinutes),
      color: reason.color ?? "#0ea5e9"
    });
    setReasonEditorOpen(true);
  };

  const closeReasonEditor = () => {
    setEditingReason(null);
    setReasonForm(emptyReasonForm);
    setReasonEditorOpen(false);
  };

  const submitReason = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reasonSpecialty || !reasonForm.name.trim()) return;
    const durationMinutes = Number(reasonForm.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 60) return;

    const payload = {
      name: reasonForm.name.trim(),
      durationMinutes,
      color: textOrUndefined(reasonForm.color)
    };

    if (editingReason) {
      await updateReason.mutateAsync({
        specialtyId: reasonSpecialty.id,
        reasonId: editingReason.id,
        payload
      });
    } else {
      await createReason.mutateAsync({ specialtyId: reasonSpecialty.id, payload });
    }

    closeReasonEditor();
  };

  const toggleReasonStatus = async (reason: SpecialtyAppointmentReason) => {
    if (!reasonSpecialty) return;
    await updateReason.mutateAsync({
      specialtyId: reasonSpecialty.id,
      reasonId: reason.id,
      payload: { isActive: !reason.isActive }
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestion de especialidades"
        description="Especialidades clinicas con plantillas y motivos de atencion por tipo de consulta."
        helpText="Las especialidades se asignan a profesionales y concentran las plantillas de prescripciones, evoluciones y motivos de atencion."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            active={view}
            onChange={(nextView) => setView(nextView as "true" | "false")}
            items={[
              { key: "true", label: "Habilitadas" },
              { key: "false", label: "Deshabilitadas" }
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <EntitySearchBox
              placeholder="Buscar especialidad"
              value={search}
              onValueChange={setSearch}
              items={search.trim() ? specialties.data ?? [] : []}
              onSelect={(specialty) => {
                setSearch(specialty.name);
                openEditSpecialty(specialty);
              }}
              getItemKey={(specialty) => specialty.id}
              emptyMessage="Sin especialidades encontradas"
              renderItem={(specialty) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{specialty.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{specialty.description || "Sin descripcion"}</p>
                </div>
              )}
              className="sm:w-72"
            />
            <Button onClick={openNewSpecialty}>Nueva especialidad</Button>
          </div>
        </div>
      </Card>

      {specialties.isLoading ? <LoadingState message="Cargando especialidades..." /> : null}
      {specialties.isError ? <ErrorState message={specialties.error.message} /> : null}

      {!specialties.isLoading && specialties.data ? (
        !specialties.data.length ? (
          <EmptyState title="Sin especialidades" description="No hay registros para estos filtros." />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse bg-white text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Plantillas</th>
                    <th className="px-4 py-3">Motivo de atencion</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {specialties.data.map((specialty, index) => (
                    <tr key={specialty.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{specialty.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {specialty.description || "Sin descripcion"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => openTemplates(specialty, "PRESCRIPTION")}
                          >
                            Prescripciones
                          </Button>
                          <Button variant="secondary" onClick={() => openTemplates(specialty, "EVOLUTION")}>
                            Evoluciones
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Button variant="secondary" onClick={() => openReasons(specialty)}>
                          Configurar
                        </Button>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          value={specialty.isActive ? "HABILITADA" : "DESHABILITADA"}
                          tone={specialty.isActive ? "success" : "warning"}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => openEditSpecialty(specialty)}>
                            Editar
                          </Button>
                          {specialty.isActive ? (
                            <Button
                              variant="danger"
                              disabled={specialtyPending}
                              onClick={() => void deactivateSpecialty.mutateAsync(specialty.id)}
                            >
                              Deshabilitar
                            </Button>
                          ) : (
                            <Button
                              disabled={specialtyPending}
                              onClick={() =>
                                void updateSpecialty.mutateAsync({
                                  id: specialty.id,
                                  payload: { isActive: true }
                                })
                              }
                            >
                              Habilitar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      <Modal
        open={specialtyModalOpen}
        title={editingSpecialty ? "Editar especialidad" : "Nueva especialidad"}
        onClose={closeSpecialtyModal}
      >
        <form className="space-y-4" onSubmit={submitSpecialty}>
          <label className="block text-sm text-slate-700">
            Nombre
            <Select
              required
              value={specialtyForm.name}
              onChange={(event) => setSpecialtyForm((current) => ({ ...current, name: event.target.value }))}
            >
              <option value="">Seleccionar especialidad</option>
              {ALLOWED_SPECIALTY_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm text-slate-700">
            Descripcion
            <Textarea
              value={specialtyForm.description}
              onChange={(event) =>
                setSpecialtyForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeSpecialtyModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={specialtyPending}>
              {editingSpecialty ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(templateTarget)}
        title={
          templateTarget
            ? `${templateLabel(templateTarget.type)} de ${templateTarget.specialty.name}`
            : "Plantillas"
        }
        onClose={closeTemplates}
        size="xl"
      >
        <div className="space-y-4">
          {templates.isLoading ? <LoadingState message="Cargando plantillas..." /> : null}
          {templates.isError ? <ErrorState message={templates.error.message} /> : null}
          {templates.data?.length ? (
            <div className="max-h-56 space-y-2 overflow-auto pr-1">
              {templates.data.map((template) => (
                <div key={template.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{template.name}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                        <span>Creado el {new Date(template.createdAt).toLocaleDateString()}</span>
                        {template.createdBy && (
                          <>
                            <span>&bull;</span>
                            <span>Por {template.createdBy.firstName} {template.createdBy.lastName}</span>
                          </>
                        )}
                        {!template.createdBy && (
                          <>
                            <span>&bull;</span>
                            <span>Por el Sistema</span>
                          </>
                        )}
                      </div>
                      <div 
                        className="mt-1 line-clamp-2 text-xs text-slate-500 prose prose-sm max-w-none prose-p:my-0 prose-headings:my-0 prose-ul:my-0 prose-ol:my-0"
                        dangerouslySetInnerHTML={{ __html: template.content }}
                      />
                    </div>
                    <Badge
                      value={template.isActive ? "ACTIVA" : "INACTIVA"}
                      tone={template.isActive ? "success" : "warning"}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => editTemplate(template)}>
                      Editar
                    </Button>
                    <Button
                      variant={template.isActive ? "danger" : "primary"}
                      disabled={templatePending || !templateTarget}
                      onClick={() =>
                        templateTarget
                          ? void updateTemplate.mutateAsync({
                              specialtyId: templateTarget.specialty.id,
                              templateId: template.id,
                              payload: { isActive: !template.isActive }
                            })
                          : undefined
                      }
                    >
                      {template.isActive ? "Deshabilitar" : "Habilitar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : !templates.isLoading ? (
            <EmptyState
              title="Sin plantillas"
              description="Crea la primera plantilla para esta especialidad."
            />
          ) : null}

          <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={submitTemplate}>
            <h4 className="text-sm font-semibold text-slate-900">
              {editingTemplate ? "Editar plantilla" : "Nueva plantilla"}
            </h4>
            <label className="block text-sm text-slate-700">
              Nombre
              <Input
                required
                value={templateForm.name}
                onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <div className="block text-sm text-slate-700">
              Contenido
              <div className="mt-1.5">
                <RichTextEditor
                  value={templateForm.content}
                  onChange={(val) => setTemplateForm((current) => ({ ...current, content: val }))}
                  placeholder="Redacta el contenido de la plantilla"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingTemplate ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm(emptyTemplateForm);
                  }}
                >
                  Cancelar edicion
                </Button>
              ) : null}
              <Button type="submit" disabled={templatePending}>
                {editingTemplate ? "Actualizar plantilla" : "Crear plantilla"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        open={Boolean(reasonSpecialty)}
        title="Motivos de atención de la especialidad"
        onClose={closeReasons}
        size="2xl"
      >
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-brand-strong)]">
            Los motivos de atención se preguntarán al momento de agendar una cita con la especialidad
            {reasonSpecialty ? ` ${reasonSpecialty.name}.` : "."}
          </div>

          {reasons.isLoading ? <LoadingState message="Cargando motivos..." /> : null}
          {reasons.isError ? <ErrorState message={reasons.error.message} /> : null}

          {sortedReasons.length ? (
            <div className="max-h-[58vh] overflow-auto rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)]">
              <table className="w-full min-w-[760px] border-collapse bg-[var(--bg-surface)] text-[var(--text-sm)]">
                <thead className="sticky top-0 z-10 border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-subtle)] text-left text-[var(--text-xs)] font-medium uppercase text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-[var(--space-4)] py-[var(--space-3)]">ID</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)]">Nombre del motivo</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)]">Duración</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)]">Color</th>
                    <th className="px-[var(--space-4)] py-[var(--space-3)] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {sortedReasons.map((reason, index) => (
                    <tr
                      key={reason.id}
                      className={!reason.isActive ? "bg-[var(--bg-subtle)] text-[var(--text-secondary)]" : undefined}
                    >
                      <td className="whitespace-nowrap px-[var(--space-4)] py-[var(--space-3)] font-medium">
                        {reasonDisplayId(reason, index)}
                      </td>
                      <td className="min-w-[320px] px-[var(--space-4)] py-[var(--space-3)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={!reason.isActive ? "line-through" : undefined}>{reason.name}</span>
                          {!reason.isActive ? <Badge value="Suspendido" tone="warning" /> : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-[var(--space-4)] py-[var(--space-3)]">
                        {reason.durationMinutes} min
                      </td>
                      <td className="px-[var(--space-4)] py-[var(--space-3)]">
                        <span
                          aria-label={`Color ${reason.color ?? "#0ea5e9"}`}
                          className="block h-5 w-5 rounded-[var(--radius-full)] border border-[var(--border-strong)]"
                          style={{ backgroundColor: reason.color ?? "#0ea5e9" }}
                        />
                      </td>
                      <td className="px-[var(--space-4)] py-[var(--space-3)]">
                        <div className="flex justify-end gap-2">
                          <HelpTooltip content="Editar motivo" position="top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Editar ${reason.name}`}
                              className="h-8 w-8 px-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => editReason(reason)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </HelpTooltip>
                          <HelpTooltip content={reason.isActive ? "Suspender motivo" : "Reactivar motivo"} position="top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`${reason.isActive ? "Suspender" : "Reactivar"} ${reason.name}`}
                              className={`h-8 w-8 px-0 ${reason.isActive ? "text-red-500 hover:bg-red-50 hover:text-red-600" : "text-green-600 hover:bg-green-50 hover:text-green-700"}`}
                              disabled={reasonPending}
                              onClick={() =>
                                void updateReason.mutateAsync({
                                  specialtyId: reasonSpecialty!.id,
                                  reasonId: reason.id,
                                  payload: { isActive: !reason.isActive }
                                })
                              }
                            >
                              {reason.isActive ? <Trash2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                            </Button>
                          </HelpTooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !reasons.isLoading ? (
            <EmptyState
              title="Sin motivos"
              description="Configura el primer motivo de atención para esta especialidad."
            />
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-default)] pt-[var(--space-4)] sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeReasons}>
              Cerrar
            </Button>
            <Button type="button" disabled={!reasonSpecialty} onClick={openNewReason}>
              Agregar motivo de atención
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(reasonSpecialty && reasonEditorOpen)}
        title={editingReason ? "Editar motivo de atención" : "Agregar motivo de atención"}
        onClose={closeReasonEditor}
        size="lg"
      >
        <form className="space-y-4" onSubmit={submitReason}>
          <label className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
            Nombre
            <Input
              required
              value={reasonForm.name}
              onChange={(event) => setReasonForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          {editingReason ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-primary)]">
              Cambiar el nombre afectará este motivo en esta especialidad; las citas ya creadas conservan su texto histórico.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Duración
              <Select
                required
                value={reasonForm.durationMinutes}
                onChange={(event) =>
                  setReasonForm((current) => ({ ...current, durationMinutes: event.target.value }))
                }
              >
                {reasonDurationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} min
                  </option>
                ))}
              </Select>
            </label>

            <label className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Color personalizado
              <Input
                type="color"
                value={reasonForm.color}
                onChange={(event) =>
                  setReasonForm((current) => ({ ...current, color: event.target.value }))
                }
                className="h-10 p-1"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">Color</p>
            <div className="flex flex-wrap gap-2">
              {reasonColorOptions.map((color) => {
                const selected = reasonForm.color.toLowerCase() === color;
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    aria-pressed={selected}
                    className={`h-7 w-7 rounded-[var(--radius-full)] border border-[var(--border-strong)] transition-[transform,border-color] duration-[var(--duration-fast)] ease-[var(--ease-default)] active:scale-[0.96] ${
                      selected ? "ring-2 ring-[var(--border-brand)] ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setReasonForm((current) => ({ ...current, color }))}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-[var(--space-4)]">
            <Button type="button" variant="secondary" onClick={closeReasonEditor}>
              Cancelar
            </Button>
            <Button type="submit" disabled={reasonPending}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
