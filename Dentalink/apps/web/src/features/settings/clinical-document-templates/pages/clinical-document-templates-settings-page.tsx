import { useMemo, useState } from "react";
import { Copy, Edit, Eye, Plus, Power, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { TableActionGroup } from "@/components/ui/table-toolbar";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { ClinicalDocumentBlockEditor, ClinicalDocumentPreview } from "@/features/clinical-documents/clinical-document-block-editor";
import { emptyClinicalDocumentContent, normalizeClinicalDocumentContent, type ClinicalDocumentContent } from "@/features/clinical-documents/clinical-document-content";
import {
  useClinicalDocumentTemplatesSettings,
  useCreateClinicalDocumentTemplateSettings,
  useDeactivateClinicalDocumentTemplateSettings,
  useDuplicateClinicalDocumentTemplateSettings,
  useUpdateClinicalDocumentTemplateSettings,
  useUploadClinicalDocumentTemplateAsset
} from "../hooks/use-clinical-document-templates";
import type { ClinicalDocumentTemplateSettings } from "../services/clinical-document-templates.service";

type TemplateForm = { name: string; description: string; content: ClinicalDocumentContent };

const emptyForm: TemplateForm = { name: "", description: "", content: emptyClinicalDocumentContent() };

export function ClinicalDocumentTemplatesSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("true");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ClinicalDocumentTemplateSettings | null>(null);

  const templates = useClinicalDocumentTemplatesSettings(search || undefined, active || undefined);
  const createTemplate = useCreateClinicalDocumentTemplateSettings();
  const updateTemplate = useUpdateClinicalDocumentTemplateSettings();
  const duplicateTemplate = useDuplicateClinicalDocumentTemplateSettings();
  const deactivateTemplate = useDeactivateClinicalDocumentTemplateSettings();
  const uploadAsset = useUploadClinicalDocumentTemplateAsset();

  const rows = useMemo(() => templates.data ?? [], [templates.data]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (template: ClinicalDocumentTemplateSettings) => {
    setEditingId(template.id);
    setForm({ name: template.name, description: template.description ?? "", content: normalizeClinicalDocumentContent(template.content) });
    setEditorOpen(true);
  };

  const submit = async () => {
    const payload = { name: form.name, description: form.description || undefined, content: form.content };
    if (editingId) await updateTemplate.mutateAsync({ id: editingId, payload });
    else await createTemplate.mutateAsync(payload);
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Documentos clínicos" description="Plantillas para documentos del expediente del paciente." />

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <EntitySearchBox
            placeholder="Buscar documento clínico"
            value={search}
            onValueChange={setSearch}
            items={search.trim() ? rows : []}
            onSelect={(template) => openEdit(template)}
            getItemKey={(template) => template.id}
            emptyMessage="Sin documentos encontrados"
            renderItem={(template) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{template.name}</p>
                <p className="truncate text-xs text-slate-500">{template.description || "Sin descripción"}</p>
              </div>
            )}
          />
          <Select value={active} onChange={(event) => setActive(event.target.value)}>
            <option value="true">Documentos habilitados</option>
            <option value="false">Documentos deshabilitados</option>
            <option value="">Todos los estados</option>
          </Select>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => window.open("https://www.youtube.com/results?search_query=Dentalink+documentos+clinicos", "_blank", "noopener,noreferrer")}>
              <Video className="h-4 w-4" />
              Ver video
            </Button>
            <Button type="button" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Nuevo documento clínico
            </Button>
          </div>
        </div>
      </Card>

      {templates.isLoading ? <LoadingState message="Cargando documentos clínicos..." /> : null}
      {templates.error ? <ErrorState message={templates.error.message} /> : null}

      <DataTable
        rows={rows}
        empty={<EmptyState title="Sin documentos clínicos" description="No hay plantillas para mostrar." />}
        columns={[
          { key: "name", title: "Nombre", render: (row) => <button className="text-left font-medium text-[var(--text-brand)] hover:underline" onClick={() => setPreviewTemplate(row)}>{row.name}</button> },
          { key: "isActive", title: "Estado", render: (row) => <Badge value={row.isActive ? "Activa" : "Inactiva"} tone={row.isActive ? "success" : "warning"} /> },
          {
            key: "id",
            title: "Acciones",
            actions: true,
            headerClassName: "text-right",
            cellClassName: "text-right",
            render: (row) => (
              <TableActionGroup>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPreviewTemplate(row)}
                  title="Vista previa"
                >
                  <Eye className="h-4 w-4" />
                  <span className="hidden xl:inline">Vista previa</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openEdit(row)}
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void duplicateTemplate.mutateAsync(row.id)}
                  title="Duplicar plantilla"
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden xl:inline">Duplicar</span>
                </Button>
                {row.isActive ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => void deactivateTemplate.mutateAsync(row.id)}
                  >
                    <Power className="h-4 w-4" />
                    Deshabilitar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void updateTemplate.mutateAsync({ id: row.id, payload: { isActive: true } })}
                  >
                    <Power className="h-4 w-4" />
                    Habilitar
                  </Button>
                )}
              </TableActionGroup>
            )
          }
        ]}
      />

      <Modal open={editorOpen} title={editingId ? "Editar documento clínico" : "Nuevo documento clínico"} onClose={() => setEditorOpen(false)} size="2xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Nombre
              <Input className="mt-1" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Descripción
              <Input className="mt-1" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
          </div>
          <ClinicalDocumentBlockEditor
            value={form.content}
            onChange={(content) => setForm((prev) => ({ ...prev, content }))}
            onAssetUpload={(file) => uploadAsset.mutateAsync(file)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={!form.name || createTemplate.isPending || updateTemplate.isPending} onClick={() => void submit()}>
              {createTemplate.isPending || updateTemplate.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(previewTemplate)} title={previewTemplate?.name ?? "Vista previa"} onClose={() => setPreviewTemplate(null)} size="xl">
        {previewTemplate ? <ClinicalDocumentPreview content={normalizeClinicalDocumentContent(previewTemplate.content)} /> : null}
      </Modal>
    </div>
  );
}
