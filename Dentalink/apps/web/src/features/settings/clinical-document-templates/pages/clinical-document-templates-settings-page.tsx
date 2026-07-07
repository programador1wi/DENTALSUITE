import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Copy, Edit, Eye, FileText, Plus, Power, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
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
  const [actionsOpen, setActionsOpen] = useState<string | null>(null);

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
    setActionsOpen(null);
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
      <PageHeader title="Documentos clinicos" description="Plantillas para documentos del expediente del paciente." />

      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <EntitySearchBox
            placeholder="Buscar documento clinico"
            value={search}
            onValueChange={setSearch}
            items={search.trim() ? rows : []}
            onSelect={(template) => openEdit(template)}
            getItemKey={(template) => template.id}
            emptyMessage="Sin documentos encontrados"
            renderItem={(template) => (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{template.name}</p>
                <p className="truncate text-xs text-slate-500">{template.description || "Sin descripcion"}</p>
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
              Nuevo documento clinico
            </Button>
          </div>
        </div>
      </Card>

      {templates.isLoading ? <LoadingState message="Cargando documentos clinicos..." /> : null}
      {templates.error ? <ErrorState message={templates.error.message} /> : null}

      <DataTable
        rows={rows}
        empty={<EmptyState title="Sin documentos clinicos" description="No hay plantillas para mostrar." />}
        columns={[
          { key: "name", title: "Nombre", render: (row) => <button className="text-left font-medium text-[var(--text-brand)]" onClick={() => setPreviewTemplate(row)}>{row.name}</button> },
          { key: "isActive", title: "Estado", render: (row) => <Badge value={row.isActive ? "Activa" : "Inactiva"} tone={row.isActive ? "success" : "warning"} /> },
          {
            key: "id",
            title: "Acciones",
            render: (row) => (
              <div className="relative flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => setActionsOpen(actionsOpen === row.id ? null : row.id)}>
                  Acciones <ChevronDown className="h-4 w-4" />
                </Button>
                {actionsOpen === row.id ? (
                  <div className="absolute right-0 top-9 z-20 w-56 rounded border border-slate-200 bg-white p-1 shadow-lg">
                    <ActionButton icon={<Eye className="h-4 w-4" />} label="Vista previa" onClick={() => { setPreviewTemplate(row); setActionsOpen(null); }} />
                    <ActionButton icon={<Edit className="h-4 w-4" />} label="Editar" onClick={() => openEdit(row)} />
                    <ActionButton icon={<Copy className="h-4 w-4" />} label="Duplicar documento" onClick={() => { void duplicateTemplate.mutateAsync(row.id); setActionsOpen(null); }} />
                    <ActionButton icon={<Power className="h-4 w-4" />} label="Deshabilitar" disabled={!row.isActive} onClick={() => { void deactivateTemplate.mutateAsync(row.id); setActionsOpen(null); }} />
                  </div>
                ) : null}
              </div>
            )
          }
        ]}
      />

      <Modal open={editorOpen} title={editingId ? "Editar documento clinico" : "Nuevo documento clinico"} onClose={() => setEditorOpen(false)} size="2xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Nombre
              <Input className="mt-1" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Descripcion
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

function ActionButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
