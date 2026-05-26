import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClinicalShell } from "../components/clinical-shell";
import { useClinicalDocuments, useClinicalMutations, useClinicalTemplates } from "../hooks/use-clinical";

export function ClinicalDocumentsPage() {
  const { id = "" } = useParams();
  const documents = useClinicalDocuments(id);
  const templates = useClinicalTemplates(id);
  const mutations = useClinicalMutations(id);
  const [templateForm, setTemplateForm] = useState({ name: "", description: "", content: "" });
  const [documentForm, setDocumentForm] = useState({ templateId: "", title: "" });

  return (
    <ClinicalShell patientId={id} title="Documentos clinicos" description="Plantillas y documentos del expediente.">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-base font-semibold">Nueva plantilla</h3>
          <Input placeholder="Nombre" value={templateForm.name} onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))} />
          <Input className="mt-2" placeholder="Descripcion" value={templateForm.description} onChange={(event) => setTemplateForm((prev) => ({ ...prev, description: event.target.value }))} />
          <Textarea className="mt-2" rows={5} placeholder="Contenido" value={templateForm.content} onChange={(event) => setTemplateForm((prev) => ({ ...prev, content: event.target.value }))} />
          <Button className="mt-3" disabled={!templateForm.name || !templateForm.content} onClick={() => void mutations.createDocumentTemplate.mutate(templateForm)}>Crear plantilla</Button>
        </Card>

        <Card>
          <h3 className="mb-3 text-base font-semibold">Documento desde plantilla</h3>
          <Select value={documentForm.templateId} onChange={(event) => setDocumentForm((prev) => ({ ...prev, templateId: event.target.value }))}>
            <option value="">Plantilla</option>
            {templates.data?.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </Select>
          <Input className="mt-2" placeholder="Titulo del documento" value={documentForm.title} onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))} />
          <Button className="mt-3" disabled={!documentForm.templateId || !documentForm.title} onClick={() => void mutations.createDocumentFromTemplate.mutate(documentForm)}>
            Crear documento
          </Button>
        </Card>
      </div>

      <div className="space-y-3">
        {!documents.data?.length ? <EmptyState title="Sin documentos" description="No hay documentos clinicos registrados." /> : null}
        {documents.data?.map((document) => (
          <Card key={document.id}>
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{document.title}</p>
                <p className="text-xs text-slate-500">{document.template?.name ?? "Sin plantilla"} / {document.status}</p>
              </div>
              <span className="text-xs text-slate-500">{new Date(document.createdAt).toLocaleString()}</span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{document.content}</pre>
          </Card>
        ))}
      </div>
    </ClinicalShell>
  );
}
