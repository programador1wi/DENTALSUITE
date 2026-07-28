import {
  Archive,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FilePlus2,
  FileSignature,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import {
  useConsentTemplateAudit,
  useConsentTemplates,
  useConsentTemplateVersions,
  useConsentVariables,
  useDocumentsMutations
} from "@/features/documents/hooks/use-documents";
import type {
  ConsentTemplate,
  ConsentTemplateDraft,
  ConsentValidation,
  RequiredSigners
} from "@/features/documents/services/documents.service";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProcedures } from "@/features/settings/procedures/hooks/use-procedures";
import { useSpecialties } from "@/features/settings/specialties/hooks/use-specialties";
import { usePermissions } from "@/hooks/use-permissions";
import { ConsentTemplateEditor } from "../components/consent-template-editor";

const EMPTY_DOCUMENT: Record<string, unknown> = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1, textAlign: "left" }, content: [{ type: "text", text: "Consentimiento informado" }] },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: [{ type: "text", text: "Describe aquí el procedimiento, sus beneficios, riesgos y alternativas." }]
    }
  ]
};

const DEFAULT_SIGNERS: RequiredSigners = {
  patient: { enabled: true, required: true },
  professional: { enabled: true, required: true, mode: "TREATMENT_PROFESSIONAL" },
  representative: { enabled: false, required: false, replacesPatient: false }
};

const EMPTY_FORM: ConsentTemplateDraft = {
  name: "",
  internalDescription: "",
  scopeType: "ORGANIZATION",
  branchIds: [],
  specialtyId: "",
  treatmentTypeIds: [],
  editorSchemaJson: EMPTY_DOCUMENT,
  requiredSigners: DEFAULT_SIGNERS
};

type StatusTab = "PUBLISHED" | "DRAFT" | "INACTIVE";
type PreviewViewport = "desktop" | "tablet" | "mobile";

export function ConsentTemplatesSettingsPage() {
  const [status, setStatus] = useState<StatusTab>("PUBLISHED");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [scopeType, setScopeType] = useState<"" | ConsentTemplate["scopeType"]>("");
  const [editing, setEditing] = useState<ConsentTemplate | null>(null);
  const [form, setForm] = useState<ConsentTemplateDraft>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewValidation, setPreviewValidation] = useState<ConsentValidation | null>(null);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [versionsTemplateId, setVersionsTemplateId] = useState("");
  const [auditTemplateId, setAuditTemplateId] = useState("");

  const templates = useConsentTemplates({
    search: search || undefined,
    status,
    branchId: branchId || undefined,
    scopeType: scopeType || undefined
  });
  const variables = useConsentVariables();
  const branches = useBranches(undefined, "ACTIVE");
  const specialties = useSpecialties(undefined, "true");
  const procedures = useProcedures(undefined, "true");
  const versions = useConsentTemplateVersions(versionsTemplateId);
  const audit = useConsentTemplateAudit(auditTemplateId);
  const mutations = useDocumentsMutations();
  const { hasPermission } = usePermissions();

  const can = (exact: string, legacy: string) =>
    hasPermission("system.manage_all") || hasPermission(exact) || hasPermission(legacy);
  const isEditorOpen = editing !== null;
  const isDirty = isEditorOpen && JSON.stringify(form) !== initialForm;
  const templatesList = templates.data?.items ?? [];
  const pending =
    mutations.createConsentTemplate.isPending ||
    mutations.updateConsentTemplate.isPending ||
    mutations.publishConsentTemplate.isPending;

  const openCreate = () => {
    const next = structuredClone(EMPTY_FORM);
    setEditing({ id: "", version: 0 } as ConsentTemplate);
    setForm(next);
    setInitialForm(JSON.stringify(next));
  };

  const openEdit = (template: ConsentTemplate) => {
    if (!template.draftVersion) return;
    const next: ConsentTemplateDraft = {
      name: template.name,
      internalDescription: template.internalDescription ?? "",
      scopeType: template.scopeType,
      branchIds: template.branchIds,
      specialtyId: template.specialtyId ?? "",
      treatmentTypeIds: template.treatmentTypeIds,
      editorSchemaJson: template.draftVersion.editorSchemaJson,
      requiredSigners: template.draftVersion.requiredSigners ?? template.draftVersion.requiredSignersJson
    };
    setEditing(template);
    setForm(next);
    setInitialForm(JSON.stringify(next));
  };

  const closeEditor = () => {
    if (isDirty && !window.confirm("Hay cambios sin guardar. ¿Deseas descartarlos?")) return;
    setEditing(null);
    setInitialForm("");
  };

  const saveDraft = async () => {
    if (editing?.id) {
      const updated = await mutations.updateConsentTemplate.mutateAsync({
        id: editing.id,
        payload: { ...form, expectedVersion: editing.version }
      });
      setEditing(updated);
      setInitialForm(JSON.stringify(form));
      return updated;
    }
    const created = await mutations.createConsentTemplate.mutateAsync(form);
    setEditing(created);
    setInitialForm(JSON.stringify(form));
    return created;
  };

  const previewDraft = async () => {
    const preview = await mutations.previewConsentTemplate.mutateAsync({
      editorSchemaJson: form.editorSchemaJson,
      requiredSigners: form.requiredSigners
    });
    setPreviewHtml(preview.html);
    setPreviewValidation(preview.validation);
  };

  const publishDraft = async () => {
    const saved = await saveDraft();
    if (saved.validation.errors.length) {
      setPreviewValidation(saved.validation);
      return;
    }
    const published = await mutations.publishConsentTemplate.mutateAsync({
      id: saved.id,
      expectedVersion: saved.version
    });
    setEditing(published);
    setInitialForm(JSON.stringify(form));
  };

  const newVersionAndEdit = async (template: ConsentTemplate) => {
    const updated = await mutations.newConsentTemplateVersion.mutateAsync({
      id: template.id,
      expectedVersion: template.version
    });
    openEdit(updated);
  };

  return (
    <section className="space-y-[var(--space-5)]">
      <div className="flex flex-col justify-between gap-[var(--space-4)] md:flex-row md:items-start">
        <PageHeader
          title="Consentimientos informados"
          description="Plantillas versionadas y evidencia firmable para el expediente clínico."
          helpText="Publicar congela la versión. Los cambios posteriores se realizan en un nuevo borrador sin alterar documentos ya generados."
        />
        {can("consents.templates.create", "consent_templates.create") ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Button>
        ) : null}
      </div>

      <Card className="space-y-[var(--space-4)]">
        <Tabs
          active={status}
          onChange={(key) => setStatus(key as StatusTab)}
          items={[
            { key: "PUBLISHED", label: "Plantillas habilitadas" },
            { key: "DRAFT", label: "Borradores" },
            { key: "INACTIVE", label: "Inactivas" }
          ]}
        />
        <div className="grid gap-[var(--space-3)] lg:grid-cols-[minmax(260px,1fr)_240px_240px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-[var(--space-3)] top-3 h-4 w-4 text-[var(--text-secondary)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o descripción"
              className="pl-10"
              aria-label="Buscar plantillas"
            />
          </label>
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} aria-label="Filtrar por sucursal">
            <option value="">Todas las sucursales</option>
            {branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
          <Select value={scopeType} onChange={(event) => setScopeType(event.target.value as typeof scopeType)} aria-label="Filtrar por alcance">
            <option value="">Todos los alcances</option>
            <option value="ORGANIZATION">Toda la organización</option>
            <option value="BRANCHES">Sucursales</option>
            <option value="SPECIALTY">Especialidad</option>
            <option value="TREATMENTS">Tratamientos</option>
          </Select>
        </div>
      </Card>

      {templates.isLoading ? <LoadingState message="Cargando plantillas…" /> : null}
      {templates.isError ? <ErrorState message={templates.error.message} /> : null}
      {!templates.isLoading && !templates.isError && templatesList.length === 0 ? (
        <div className="space-y-[var(--space-4)]">
          <EmptyState
            title="No hay plantillas de consentimientos informados creadas"
            description="Crea un borrador, valida sus campos y publícalo para comenzar a generar documentos clínicos."
          />
          {can("consents.templates.create", "consent_templates.create") ? (
            <div className="flex justify-center">
              <Button onClick={openCreate}>
                <FilePlus2 className="h-4 w-4" />
                Nueva plantilla de consentimiento informado
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {templatesList.length ? (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[minmax(240px,1.4fr)_110px_100px_180px_150px_120px] gap-[var(--space-3)] border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-brand)] lg:grid">
            <span>Plantilla</span><span>Versión</span><span>Alcance</span><span>Firmas</span><span>Actualización</span><span>Acciones</span>
          </div>
          {templatesList.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              onEdit={() => openEdit(template)}
              onPreview={() => {
                const version = template.draftVersion ?? template.currentPublishedVersion;
                if (!version) return;
                mutations.previewConsentTemplate.mutate(
                  { editorSchemaJson: version.editorSchemaJson, requiredSigners: version.requiredSigners ?? version.requiredSignersJson },
                  {
                    onSuccess: (result) => {
                      setPreviewHtml(result.html);
                      setPreviewValidation(result.validation);
                    }
                  }
                );
              }}
              onDuplicate={() => mutations.duplicateConsentTemplate.mutate(template.id)}
              onNewVersion={() => newVersionAndEdit(template)}
              onPublish={() => mutations.publishConsentTemplate.mutate({ id: template.id, expectedVersion: template.version })}
              onDeactivate={() => {
                if (window.confirm("La plantilla dejará de generar nuevos documentos. Los consentimientos previos se conservarán.")) {
                  mutations.deactivateConsentTemplate.mutate({ id: template.id, expectedVersion: template.version });
                }
              }}
              onVersions={() => setVersionsTemplateId(template.id)}
              onAudit={() => setAuditTemplateId(template.id)}
              canEdit={can("consents.templates.update_draft", "consent_templates.update")}
              canPublish={can("consents.templates.publish", "consent_templates.update")}
              canDeactivate={can("consents.templates.deactivate", "consent_templates.deactivate")}
              canDuplicate={can("consents.templates.create", "consent_templates.create")}
            />
          ))}
        </Card>
      ) : null}

      <Modal open={isEditorOpen} title={editing?.id ? `Editar borrador · ${form.name || "Sin nombre"}` : "Nueva plantilla"} size="2xl" onClose={closeEditor}>
        <div className="space-y-[var(--space-6)]">
          <section className="grid gap-[var(--space-4)] md:grid-cols-2">
            <FormField label="Nombre del consentimiento" hint={`${form.name.length}/150 caracteres`}>
              <Input
                value={form.name}
                minLength={3}
                maxLength={150}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ej. Consentimiento para cirugía de terceros molares"
              />
            </FormField>
            <FormField label="Alcance">
              <Select value={form.scopeType} onChange={(event) => setForm((current) => ({ ...current, scopeType: event.target.value as ConsentTemplate["scopeType"] }))}>
                <option value="ORGANIZATION">Toda la organización</option>
                <option value="BRANCHES">Una o varias sucursales</option>
                <option value="SPECIALTY">Una especialidad</option>
                <option value="TREATMENTS">Tipos de tratamiento</option>
              </Select>
            </FormField>
            <FormField label="Descripción interna" hint={`${form.internalDescription?.length ?? 0}/500 · No visible para el paciente`} className="md:col-span-2">
              <Textarea
                rows={3}
                maxLength={500}
                value={form.internalDescription ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, internalDescription: event.target.value }))}
              />
            </FormField>

            {form.scopeType === "BRANCHES" ? (
              <FormField label="Sucursales habilitadas" className="md:col-span-2">
                <div className="grid max-h-44 gap-[var(--space-2)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-3)] md:grid-cols-2">
                  {branches.data?.map((branch) => (
                    <Check
                      key={branch.id}
                      label={branch.name}
                      checked={form.branchIds?.includes(branch.id) ?? false}
                      onChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          branchIds: checked
                            ? [...(current.branchIds ?? []), branch.id]
                            : (current.branchIds ?? []).filter((id) => id !== branch.id)
                        }))
                      }
                    />
                  ))}
                </div>
              </FormField>
            ) : null}

            {form.scopeType === "SPECIALTY" ? (
              <FormField label="Especialidad">
                <Select value={form.specialtyId ?? ""} onChange={(event) => setForm((current) => ({ ...current, specialtyId: event.target.value }))}>
                  <option value="">Selecciona especialidad</option>
                  {specialties.data?.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}
                </Select>
              </FormField>
            ) : null}

            {form.scopeType === "TREATMENTS" ? (
              <FormField label="Tipos de tratamiento" className="md:col-span-2">
                <div className="grid max-h-52 gap-[var(--space-2)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-3)] md:grid-cols-2">
                  {procedures.data?.map((procedure) => (
                    <Check
                      key={procedure.id}
                      label={`${procedure.code} · ${procedure.name}`}
                      checked={form.treatmentTypeIds?.includes(procedure.id) ?? false}
                      onChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          treatmentTypeIds: checked
                            ? [...(current.treatmentTypeIds ?? []), procedure.id]
                            : (current.treatmentTypeIds ?? []).filter((id) => id !== procedure.id)
                        }))
                      }
                    />
                  ))}
                </div>
              </FormField>
            ) : null}
          </section>

          <section className="space-y-[var(--space-3)]">
            <div>
              <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Constructor del consentimiento</h3>
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">El contenido canónico se guarda como JSON estructurado; los chips no pueden romperse parcialmente.</p>
            </div>
            <ConsentTemplateEditor
              value={form.editorSchemaJson}
              onChange={(editorSchemaJson) => setForm((current) => ({ ...current, editorSchemaJson }))}
              variables={variables.data ?? []}
            />
          </section>

          <SignatureSettings value={form.requiredSigners} onChange={(requiredSigners) => setForm((current) => ({ ...current, requiredSigners }))} />

          {previewValidation ? <ValidationPanel validation={previewValidation} /> : null}

          <div className="sticky bottom-0 -mx-[var(--space-6)] flex flex-wrap justify-end gap-[var(--space-2)] border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-[var(--space-6)] py-[var(--space-4)]">
            <Button variant="ghost" onClick={closeEditor}>Cancelar</Button>
            <Button variant="secondary" disabled={mutations.previewConsentTemplate.isPending} onClick={previewDraft}>
              <Eye className="h-4 w-4" />
              Vista previa
            </Button>
            <Button variant="secondary" disabled={pending || form.name.trim().length < 3} onClick={saveDraft}>
              Guardar borrador
            </Button>
            {can("consents.templates.publish", "consent_templates.update") ? (
              <Button disabled={pending || form.name.trim().length < 3} onClick={publishDraft}>
                <Send className="h-4 w-4" />
                Publicar plantilla
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(previewHtml)} title="Vista previa del consentimiento" size="2xl" onClose={() => setPreviewHtml("")}>
        <div className="space-y-[var(--space-4)]">
          <div className="flex flex-wrap justify-between gap-[var(--space-3)]">
            <Tabs
              active={previewViewport}
              onChange={(key) => setPreviewViewport(key as PreviewViewport)}
              items={[
                { key: "desktop", label: "Escritorio" },
                { key: "tablet", label: "Tableta" },
                { key: "mobile", label: "Móvil" }
              ]}
            />
            <Button variant="secondary" onClick={() => window.print()}>Vista de impresión</Button>
          </div>
          {previewValidation ? <ValidationPanel validation={previewValidation} /> : null}
          <div className="overflow-auto rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] p-[var(--space-4)]">
            <div
              className={`mx-auto transition-[max-width] ${previewViewport === "desktop" ? "max-w-[820px]" : previewViewport === "tablet" ? "max-w-[640px]" : "max-w-[390px]"}`}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(versionsTemplateId)} title="Historial de versiones" size="lg" onClose={() => setVersionsTemplateId("")}>
        {versions.isLoading ? <LoadingState message="Cargando versiones…" /> : null}
        <div className="space-y-[var(--space-2)]">
          {versions.data?.map((version) => (
            <div key={version.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-3)]">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Versión {version.versionNumber}</p>
                <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{new Date(version.createdAt).toLocaleString()}</p>
              </div>
              <Badge value={version.status} tone={version.status === "PUBLISHED" ? "success" : "warning"} />
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={Boolean(auditTemplateId)} title="Auditoría de plantilla" size="lg" onClose={() => setAuditTemplateId("")}>
        {audit.isLoading ? <LoadingState message="Cargando auditoría…" /> : null}
        <div className="space-y-[var(--space-2)]">
          {audit.data?.map((entry) => (
            <div key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-[var(--space-3)]">
              <div className="flex items-start justify-between gap-[var(--space-3)]">
                <p className="font-medium text-[var(--text-primary)]">{entry.action}</p>
                <time className="text-[var(--text-xs)] text-[var(--text-secondary)]">{new Date(entry.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">Actor: {entry.actorUserId ?? entry.userId ?? "Sistema"} · Correlation ID: {entry.correlationId ?? "—"}</p>
            </div>
          ))}
        </div>
      </Modal>
    </section>
  );
}

function TemplateRow({
  template,
  onEdit,
  onPreview,
  onDuplicate,
  onNewVersion,
  onPublish,
  onDeactivate,
  onVersions,
  onAudit,
  canEdit,
  canPublish,
  canDeactivate,
  canDuplicate
}: {
  template: ConsentTemplate;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onNewVersion: () => void;
  onPublish: () => void;
  onDeactivate: () => void;
  onVersions: () => void;
  onAudit: () => void;
  canEdit: boolean;
  canPublish: boolean;
  canDeactivate: boolean;
  canDuplicate: boolean;
}) {
  const version = template.draftVersion ?? template.currentPublishedVersion;
  const signers = version?.requiredSigners ?? version?.requiredSignersJson;
  const signerLabels = [
    signers?.patient.enabled ? "Paciente" : "",
    signers?.professional.enabled ? "Profesional" : "",
    signers?.representative.enabled ? "Representante" : ""
  ].filter(Boolean);
  const scopeLabel =
    template.scopeType === "ORGANIZATION" ? "Global" :
      template.scopeType === "BRANCHES" ? `${template.branchIds.length} suc.` :
        template.scopeType === "SPECIALTY" ? "Especialidad" : "Tratamientos";

  return (
    <div className="grid gap-[var(--space-3)] border-b border-[var(--border-default)] px-[var(--space-4)] py-[var(--space-4)] last:border-b-0 lg:grid-cols-[minmax(240px,1.4fr)_110px_100px_180px_150px_120px] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <p className="font-medium text-[var(--text-primary)]">{template.name}</p>
          <Badge value={template.status} tone={template.status === "PUBLISHED" ? "success" : template.status === "INACTIVE" ? "warning" : "brand"} />
        </div>
        <p className="mt-1 line-clamp-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{template.internalDescription || "Sin descripción interna"}</p>
        <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{template.generatedCount} consentimientos generados</p>
      </div>
      <div className="text-[var(--text-sm)]">
        <p className="font-medium text-[var(--text-primary)]">v{version?.versionNumber ?? "—"}</p>
        {template.draftVersion ? <span className="text-[var(--text-warning)]">Borrador</span> : null}
      </div>
      <div className="flex items-center gap-[var(--space-1)] text-[var(--text-sm)] text-[var(--text-secondary)]">
        <Building2 className="h-4 w-4" /> {scopeLabel}
      </div>
      <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">{signerLabels.join(", ") || "Sin firmantes"}</p>
      <div>
        <p className="text-[var(--text-sm)] text-[var(--text-primary)]">{new Date(template.updatedAt).toLocaleDateString()}</p>
        <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{template.updatedByName ?? "Usuario del sistema"}</p>
      </div>
      <div className="flex flex-wrap gap-[var(--space-1)]">
        <Action icon={Eye} label="Previsualizar" onClick={onPreview} />
        {template.draftVersion && canEdit ? <Action icon={Pencil} label="Editar borrador" onClick={onEdit} /> : null}
        {!template.draftVersion && template.currentPublishedVersion && canEdit ? <Action icon={FilePlus2} label="Crear nueva versión" onClick={onNewVersion} /> : null}
        {template.draftVersion && canPublish ? <Action icon={Send} label="Publicar" onClick={onPublish} /> : null}
        {canDuplicate ? <Action icon={Copy} label="Duplicar" onClick={onDuplicate} /> : null}
        <Action icon={History} label="Consultar versiones" onClick={onVersions} />
        <Action icon={ShieldCheck} label="Consultar auditoría" onClick={onAudit} />
        {template.status === "PUBLISHED" && canDeactivate ? <Action icon={Archive} label="Deshabilitar" onClick={onDeactivate} danger /> : null}
      </div>
    </div>
  );
}

function Action({ icon: Icon, label, onClick, danger = false }: { icon: typeof Eye; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${danger ? "text-[var(--text-danger)] hover:bg-[var(--bg-subtle)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-brand)]"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SignatureSettings({ value, onChange }: { value: RequiredSigners; onChange: (value: RequiredSigners) => void }) {
  return (
    <section className="space-y-[var(--space-3)]">
      <div>
        <h3 className="text-[var(--text-lg)] font-semibold text-[var(--text-brand-strong)]">Firmas requeridas</h3>
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Cada firma se captura por separado sobre el mismo hash del documento.</p>
      </div>
      <div className="grid gap-[var(--space-3)] lg:grid-cols-3">
        <SignerCard
          title="Firma del paciente"
          enabled={value.patient.enabled}
          required={value.patient.required}
          onEnabled={(enabled) => onChange({ ...value, patient: { enabled, required: enabled && value.patient.required } })}
          onRequired={(required) => onChange({ ...value, patient: { ...value.patient, required } })}
        />
        <SignerCard
          title="Firma profesional"
          enabled={value.professional.enabled}
          required={value.professional.required}
          onEnabled={(enabled) => onChange({ ...value, professional: { ...value.professional, enabled, required: enabled && value.professional.required } })}
          onRequired={(required) => onChange({ ...value, professional: { ...value.professional, required } })}
        >
          <Select
            value={value.professional.mode}
            disabled={!value.professional.enabled}
            onChange={(event) => onChange({ ...value, professional: { ...value.professional, mode: event.target.value as RequiredSigners["professional"]["mode"] } })}
          >
            <option value="TREATMENT_PROFESSIONAL">Responsable del tratamiento</option>
            <option value="MANUAL">Seleccionado manualmente</option>
            <option value="ANY_AUTHORIZED">Cualquier profesional autorizado</option>
          </Select>
        </SignerCard>
        <SignerCard
          title="Firma del representante"
          enabled={value.representative.enabled}
          required={value.representative.required}
          onEnabled={(enabled) => onChange({ ...value, representative: { ...value.representative, enabled, required: enabled && value.representative.required, replacesPatient: enabled && value.representative.replacesPatient } })}
          onRequired={(required) => onChange({ ...value, representative: { ...value.representative, required } })}
        >
          <Check
            label="Sustituye firma del paciente"
            checked={value.representative.replacesPatient}
            onChange={(replacesPatient) => onChange({ ...value, representative: { ...value.representative, replacesPatient } })}
            disabled={!value.representative.enabled}
          />
        </SignerCard>
      </div>
    </section>
  );
}

function SignerCard({
  title,
  enabled,
  required,
  onEnabled,
  onRequired,
  children
}: {
  title: string;
  enabled: boolean;
  required: boolean;
  onEnabled: (value: boolean) => void;
  onRequired: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border-default)] p-[var(--space-4)]">
      <p className="font-medium text-[var(--text-primary)]">{title}</p>
      <Check label="Incluir firma" checked={enabled} onChange={onEnabled} />
      <Check label="Firma obligatoria" checked={required} disabled={!enabled} onChange={onRequired} />
      {children}
    </div>
  );
}

function ValidationPanel({ validation }: { validation: ConsentValidation }) {
  if (!validation.errors.length && !validation.warnings.length) {
    return (
      <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] p-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-brand-strong)]">
        <CheckCircle2 className="h-4 w-4" /> Estructura válida para publicar.
      </div>
    );
  }
  return (
    <div className="grid gap-[var(--space-3)] md:grid-cols-2">
      {validation.errors.length ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--text-danger)] p-[var(--space-3)]">
          <p className="flex items-center gap-[var(--space-2)] font-medium text-[var(--text-danger)]"><XCircle className="h-4 w-4" /> Errores de publicación</p>
          <ul className="mt-[var(--space-2)] list-disc space-y-1 pl-[var(--space-5)] text-[var(--text-sm)] text-[var(--text-primary)]">
            {validation.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      ) : null}
      {validation.warnings.length ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--text-warning)] p-[var(--space-3)]">
          <p className="flex items-center gap-[var(--space-2)] font-medium text-[var(--text-primary)]"><TriangleAlert className="h-4 w-4 text-[var(--text-warning)]" /> Advertencias</p>
          <ul className="mt-[var(--space-2)] list-disc space-y-1 pl-[var(--space-5)] text-[var(--text-sm)] text-[var(--text-primary)]">
            {validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FormField({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-[var(--space-1)] ${className}`}>
      <span className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint ? <span className="block text-[var(--text-xs)] text-[var(--text-secondary)]">{hint}</span> : null}
    </label>
  );
}

function Check({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex items-center gap-[var(--space-2)] text-[var(--text-sm)] text-[var(--text-primary)]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--action-brand)] disabled:opacity-40"
      />
      {label}
    </label>
  );
}
