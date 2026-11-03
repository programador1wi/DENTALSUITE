import { useMemo, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/use-permissions";
import { ClinicalDocumentBlockEditor, ClinicalDocumentPreview } from "@/features/clinical-documents/clinical-document-block-editor";
import { emptyClinicalDocumentContent, normalizeClinicalDocumentContent, type ClinicalDocumentContent } from "@/features/clinical-documents/clinical-document-content";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalDocuments, useClinicalMutations, useClinicalTemplates } from "../hooks/use-clinical";

export function ClinicalDocumentsPage() {
  const { id = "" } = useParams();
  const documents = useClinicalDocuments(id);
  const templates = useClinicalTemplates(id);
  const mutations = useClinicalMutations(id);
  const { hasPermission } = usePermissions();
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<ClinicalDocumentContent>(emptyClinicalDocumentContent());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const selectedTemplate = useMemo(() => templates.data?.find((template) => template.id === templateId), [templateId, templates.data]);

  const selectTemplate = (value: string) => {
    setTemplateId(value);
    const template = templates.data?.find((item) => item.id === value);
    if (!template) return;
    setTitle(template.name);
    setContent(normalizeClinicalDocumentContent(template.content));
  };

  const saveDocument = async () => {
    await mutations.createDocument.mutateAsync({ templateId: templateId || undefined, title, content });
    setTemplateId("");
    setTitle("");
    setContent(emptyClinicalDocumentContent());
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await mutations.deleteDocument.mutateAsync({ documentId: deleteTarget.id, reason: deleteReason });
    setDeleteTarget(null);
    setDeleteReason("");
  };

  return (
    <ClinicalShell patientId={id} title="Documentos clinicos" description="Plantillas y documentos del expediente.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--text-brand)]" />
            <h3 className="text-base font-semibold text-slate-900">Documento del expediente</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Plantilla
              <Select className="mt-1" value={templateId} onChange={(event) => selectTemplate(event.target.value)}>
                <option value="">Selecciona plantilla</option>
                {templates.data?.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Titulo del documento
              <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>
          <div className="mt-4">
            <ClinicalDocumentBlockEditor value={content} onChange={setContent} />
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled={!title || !content.blocks.length || mutations.createDocument.isPending} onClick={() => void saveDocument()}>
              {mutations.createDocument.isPending ? "Guardando..." : "Guardar en expediente"}
            </Button>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-base font-semibold text-slate-900">Vista previa activa</h3>
          {selectedTemplate || content.blocks.length ? <ClinicalDocumentPreview content={content} /> : <EmptyState title="Sin plantilla" description="Selecciona una plantilla para previsualizar." />}
        </Card>
      </div>

      <div className="space-y-3">
        {!documents.data?.length ? <EmptyState title="Sin documentos" description="No hay documentos clinicos registrados." /> : null}
        {documents.data?.map((document) => (
          <Card key={document.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{document.title}</p>
                <p className="text-xs text-slate-500">{document.template?.name ?? "Sin plantilla"} / {new Date(document.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge value={document.status} tone="default" />
                {hasPermission("clinical.documents.delete") ? (
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget({ id: document.id, title: document.title })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-3">
              <ClinicalDocumentPreview content={normalizeClinicalDocumentContent(document.content)} />
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(deleteTarget)} title="Eliminar documento clinico" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{deleteTarget?.title}</p>
          <Textarea rows={4} placeholder="Motivo" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" disabled={!deleteReason.trim() || mutations.deleteDocument.isPending} onClick={() => void confirmDelete()}>
              {mutations.deleteDocument.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </div>
      </Modal>
    </ClinicalShell>
  );
}
