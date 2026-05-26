import { type FormEvent, useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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

function textOrUndefined(value: string) {
  const normalized = value.trim();
  return normalized || undefined;
}

function templateLabel(type: SpecialtyClinicalTemplateType) {
  return type === "PRESCRIPTION" ? "Prescripciones" : "Evoluciones";
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

  const specialtyPending = createSpecialty.isPending || updateSpecialty.isPending || deactivateSpecialty.isPending;
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
    setEditingReason(null);
    setReasonForm(emptyReasonForm);
  };

  const closeReasons = () => {
    setReasonSpecialty(null);
    setEditingReason(null);
    setReasonForm(emptyReasonForm);
  };

  const editReason = (reason: SpecialtyAppointmentReason) => {
    setEditingReason(reason);
    setReasonForm({
      name: reason.name,
      durationMinutes: String(reason.durationMinutes),
      color: reason.color ?? "#0ea5e9"
    });
  };

  const submitReason = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reasonSpecialty || !reasonForm.name.trim()) return;
    const durationMinutes = Number(reasonForm.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) return;

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

    setEditingReason(null);
    setReasonForm(emptyReasonForm);
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
            <Input
              placeholder="Buscar especialidad"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
                        <p className="mt-1 text-xs text-slate-500">{specialty.description || "Sin descripcion"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => openTemplates(specialty, "PRESCRIPTION")}>
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
                        <Badge value={specialty.isActive ? "HABILITADA" : "DESHABILITADA"} tone={specialty.isActive ? "success" : "warning"} />
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
                              onClick={() => void updateSpecialty.mutateAsync({ id: specialty.id, payload: { isActive: true } })}
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
            <Input
              required
              value={specialtyForm.name}
              onChange={(event) => setSpecialtyForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="block text-sm text-slate-700">
            Descripcion
            <Textarea
              value={specialtyForm.description}
              onChange={(event) => setSpecialtyForm((current) => ({ ...current, description: event.target.value }))}
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
        title={templateTarget ? `${templateLabel(templateTarget.type)} de ${templateTarget.specialty.name}` : "Plantillas"}
        onClose={closeTemplates}
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
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{template.content}</p>
                    </div>
                    <Badge value={template.isActive ? "ACTIVA" : "INACTIVA"} tone={template.isActive ? "success" : "warning"} />
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
            <EmptyState title="Sin plantillas" description="Crea la primera plantilla para esta especialidad." />
          ) : null}

          <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={submitTemplate}>
            <h4 className="text-sm font-semibold text-slate-900">{editingTemplate ? "Editar plantilla" : "Nueva plantilla"}</h4>
            <label className="block text-sm text-slate-700">
              Nombre
              <Input
                required
                value={templateForm.name}
                onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="block text-sm text-slate-700">
              Contenido
              <Textarea
                required
                rows={4}
                value={templateForm.content}
                onChange={(event) => setTemplateForm((current) => ({ ...current, content: event.target.value }))}
              />
            </label>
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
        title={reasonSpecialty ? `Motivos de atencion de ${reasonSpecialty.name}` : "Motivos de atencion"}
        onClose={closeReasons}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Cada motivo define nombre, duracion y color para clasificar la atencion de esa especialidad.
          </div>
          {reasons.isLoading ? <LoadingState message="Cargando motivos..." /> : null}
          {reasons.isError ? <ErrorState message={reasons.error.message} /> : null}
          {reasons.data?.length ? (
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {reasons.data.map((reason) => (
                <div key={reason.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-3 w-3 rounded-full ring-1 ring-slate-200" style={{ backgroundColor: reason.color ?? "#0ea5e9" }} />
                      <div>
                        <p className="font-semibold text-slate-900">{reason.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{reason.durationMinutes} minutos</p>
                      </div>
                    </div>
                    <Badge value={reason.isActive ? "ACTIVO" : "INACTIVO"} tone={reason.isActive ? "success" : "warning"} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => editReason(reason)}>
                      Editar
                    </Button>
                    <Button
                      variant={reason.isActive ? "danger" : "primary"}
                      disabled={reasonPending || !reasonSpecialty}
                      onClick={() =>
                        reasonSpecialty
                          ? void updateReason.mutateAsync({
                              specialtyId: reasonSpecialty.id,
                              reasonId: reason.id,
                              payload: { isActive: !reason.isActive }
                            })
                          : undefined
                      }
                    >
                      {reason.isActive ? "Deshabilitar" : "Habilitar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : !reasons.isLoading ? (
            <EmptyState title="Sin motivos" description="Configura el primer motivo de atencion para esta especialidad." />
          ) : null}

          <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={submitReason}>
            <h4 className="text-sm font-semibold text-slate-900">{editingReason ? "Editar motivo" : "Nuevo motivo"}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-700">
                Nombre
                <Input
                  required
                  value={reasonForm.name}
                  onChange={(event) => setReasonForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-700">
                Duracion (minutos)
                <Input
                  required
                  min={5}
                  max={480}
                  step={5}
                  type="number"
                  value={reasonForm.durationMinutes}
                  onChange={(event) => setReasonForm((current) => ({ ...current, durationMinutes: event.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-700">
                Color
                <Input
                  type="color"
                  value={reasonForm.color}
                  onChange={(event) => setReasonForm((current) => ({ ...current, color: event.target.value }))}
                  className="h-10 p-1"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              {editingReason ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingReason(null);
                    setReasonForm(emptyReasonForm);
                  }}
                >
                  Cancelar edicion
                </Button>
              ) : null}
              <Button type="submit" disabled={reasonPending}>
                {editingReason ? "Actualizar motivo" : "Crear motivo"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
