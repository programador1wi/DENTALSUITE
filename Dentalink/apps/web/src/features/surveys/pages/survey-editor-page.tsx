import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  GripVertical,
  Mail,
  Pencil,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/lib/routes";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SafeHtml } from "@/components/ui/safe-html";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { RichTextEditor } from "@/features/clinical/components/rich-text-editor";
import {
  activateSurveyDefinition,
  addSurveyQuestion,
  addSurveySection,
  deleteSurveyQuestion,
  deleteSurveySection,
  getSurveyDefinition,
  prepareSurveyDraft,
  reorderSurveyQuestions,
  reorderSurveySections,
  updateSurveyDefinition,
  updateSurveyQuestion,
  updateSurveySection,
  type SurveyDefinition,
  type SurveyQuestion,
  type SurveyQuestionPayload,
  type SurveyQuestionType,
  type SurveySection
} from "../services/surveys.service";

const variables = [
  "{nombrePaciente}",
  "{apellidosPaciente}",
  "{fechaAtencion}",
  "{horaAtencion}",
  "{nombreSucursal}",
  "{direccionSucursal}",
  "{telefonoSucursal}",
  "{nombreProfesional}",
  "{nombreOrganizacion}",
  "{enlaceEncuesta}"
];

const questionTypeLabels: Record<SurveyQuestionType, string> = {
  LIKERT_5: "Escala Likert 1–5",
  NPS_10: "NPS 0–10",
  YES_NO: "Sí / No",
  SINGLE_CHOICE: "Opción única",
  MULTIPLE_CHOICE: "Selección múltiple",
  FREE_TEXT: "Texto libre",
  STAR_RATING: "Calificación por estrellas"
};

export function SurveyEditorPage({ surveyId }: { surveyId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["crm-surveys", "detail", surveyId], queryFn: () => getSurveyDefinition(surveyId) });
  const [draftPrepared, setDraftPrepared] = useState(false);
  const [name, setName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHeaderHtml, setEmailHeaderHtml] = useState("");
  const [emailFooterHtml, setEmailFooterHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sectionEditor, setSectionEditor] = useState<SurveySection | null>(null);
  const [questionEditor, setQuestionEditor] = useState<{ sectionId: string; question?: SurveyQuestion } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeEditor, setActiveEditor] = useState<"header" | "footer">("header");
  const [insertRequest, setInsertRequest] = useState<{ id: number; text: string }>();
  const version = query.data?.draftVersion ?? query.data?.editorVersion;

  const replaceDetail = (data: SurveyDefinition) => {
    queryClient.setQueryData(["crm-surveys", "detail", surveyId], data);
    queryClient.invalidateQueries({ queryKey: ["crm-surveys", "list"] });
  };

  useEffect(() => {
    if (!query.data || query.data.draftVersion || query.data.status === "ARCHIVED" || draftPrepared) return;
    setDraftPrepared(true);
    prepareSurveyDraft(surveyId)
      .then(replaceDetail)
      .catch((error: Error) => toast.error(error.message));
  }, [draftPrepared, query.data, surveyId]);

  useEffect(() => {
    if (!query.data || !version || dirty) return;
    setName(query.data.name);
    setEmailSubject(version.emailSubject);
    setEmailHeaderHtml(version.emailHeaderHtml);
    setEmailFooterHtml(version.emailFooterHtml);
    setExpandedSections(new Set(version.sections.map((section) => section.id)));
  }, [dirty, query.data, version?.id]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => updateSurveyDefinition(surveyId, { name, emailSubject, emailHeaderHtml, emailFooterHtml }),
    onSuccess: (data) => {
      replaceDetail(data);
      setDirty(false);
      setEditingName(false);
      toast.success("Borrador guardado");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const structureMutation = useMutation({
    mutationFn: (operation: () => Promise<SurveyDefinition>) => operation(),
    onSuccess: (data) => replaceDetail(data),
    onError: (error: Error) => toast.error(error.message)
  });

  const activate = useMutation({
    mutationFn: async () => {
      if (dirty) await updateSurveyDefinition(surveyId, { name, emailSubject, emailHeaderHtml, emailFooterHtml });
      return activateSurveyDefinition(surveyId);
    },
    onSuccess: (data) => {
      replaceDetail(data);
      setDirty(false);
      toast.success("Encuesta publicada y activa");
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const goBack = () => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Deseas salir del constructor?")) return;
    navigate(APP_ROUTES.crm.surveysList);
  };

  if (query.isLoading) return <LoadingState message="Preparando constructor..." />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  if (!query.data || !version) return <ErrorState message="La encuesta no tiene una versión editable." />;

  const sections = version.sections;
  const markDirty = (callback: () => void) => {
    callback();
    setDirty(true);
  };

  return (
    <>
      <div className="space-y-[var(--space-4)]">
        <div className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-5)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <button type="button" onClick={goBack} className="inline-flex items-center gap-1 text-[var(--text-sm)] font-medium text-[var(--text-brand)] hover:underline"><ArrowLeft className="h-4 w-4" /> Volver al listado de encuestas</button>
            <div className="mt-3 flex items-center gap-2">
              {editingName ? (
                <Input value={name} onChange={(event) => markDirty(() => setName(event.target.value))} onBlur={() => setEditingName(false)} autoFocus className="max-w-xl text-[var(--text-lg)] font-semibold" maxLength={160} />
              ) : (
                <h3 className="truncate text-[var(--text-2xl)] font-semibold text-[var(--text-primary)]">{name || "Encuesta sin nombre"}</h3>
              )}
              <button type="button" onClick={() => setEditingName(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]" aria-label="Editar nombre"><Pencil className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><Badge value={`Versión ${version.version}`} tone="brand" /><Badge value={version.status === "DRAFT" ? "Borrador editable" : "Publicada"} tone={version.status === "DRAFT" ? "default" : "success"} />{dirty && <Badge value="Cambios sin guardar" tone="warning" />}</div>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4" /> Vista previa</Button><Button onClick={() => activate.mutate()} disabled={activate.isPending || query.data.status === "ARCHIVED"}><CheckCircle2 className="h-4 w-4" /> {activate.isPending ? "Publicando..." : "Activar encuesta"}</Button></div>
        </div>

        <div className="grid items-start gap-[var(--space-5)] xl:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="space-y-[var(--space-4)] hover:translate-y-0 xl:sticky xl:top-[var(--space-5)]">
            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-3 text-center text-[var(--text-sm)] font-semibold text-[var(--text-primary)]"><Mail className="mr-2 inline h-4 w-4 text-[var(--text-brand)]" /> Medio activo: Email</div>
            <Button variant="secondary" className="w-full" onClick={() => structureMutation.mutate(() => addSurveySection(surveyId))} disabled={structureMutation.isPending}><Plus className="h-4 w-4" /> Añadir sección</Button>
            <div className="border-t border-[var(--border-default)] pt-[var(--space-4)]"><p className="text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Variables dinámicas</p><Select value="" onChange={(event) => { if (!event.target.value) return; setInsertRequest({ id: Date.now(), text: event.target.value }); }} className="mt-2"><option value="">Agregar campo…</option>{variables.map((variable) => <option key={variable} value={variable}>{variable}</option>)}</Select><p className="mt-2 text-[var(--text-xs)] leading-5 text-[var(--text-secondary)]">Se insertará en {activeEditor === "header" ? "encabezado" : "pie"}, en la posición actual del cursor.</p></div>
            <Button className="w-full" onClick={() => save.mutate()} disabled={!dirty || save.isPending}><Save className="h-4 w-4" /> {save.isPending ? "Guardando..." : "Guardar"}</Button>
          </Card>

          <div className="space-y-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] p-[var(--space-4)] md:p-[var(--space-5)]">
            <EditorBlock title="Asunto email" description="Obligatorio para publicar; admite variables autorizadas.">
              <Input value={emailSubject} onChange={(event) => markDirty(() => setEmailSubject(event.target.value))} maxLength={180} />
              <p className="mt-1 text-right text-[var(--text-xs)] text-[var(--text-secondary)]">{emailSubject.length}/180</p>
            </EditorBlock>
            <EditorBlock title="Encabezado email" description="Mensaje que verá el paciente antes del botón de respuesta.">
              <div onMouseDown={() => setActiveEditor("header")}>
                <RichTextEditor value={emailHeaderHtml} onChange={(value) => markDirty(() => setEmailHeaderHtml(value))} placeholder="Escribe la invitación al paciente" editorClassName="!min-h-[140px]" insertTextRequest={activeEditor === "header" ? insertRequest : undefined} />
              </div>
            </EditorBlock>

            {sections.map((section, sectionIndex) => {
              const expanded = expandedSections.has(section.id);
              return (
                <section key={section.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
                  <div className="flex items-center gap-2 bg-[var(--action-brand)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-inverse)]">
                    <GripVertical className="h-4 w-4 shrink-0 opacity-60" />
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setExpandedSections((current) => toggleSet(current, section.id))}>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="truncate font-semibold">{section.name}</span><span className="text-[var(--text-xs)] opacity-75">{section.questions.length} preguntas</span></button>
                    <button type="button" className="rounded p-1 hover:bg-white/10" onClick={() => setSectionEditor(section)} title="Editar sección"><Pencil className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1 hover:bg-white/10" onClick={() => duplicateSection(section)} title="Duplicar sección"><Copy className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1 hover:bg-white/10 disabled:opacity-30" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)} title="Mover arriba"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1 hover:bg-white/10 disabled:opacity-30" disabled={sectionIndex === sections.length - 1} onClick={() => moveSection(sectionIndex, 1)} title="Mover abajo"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" className="rounded p-1 hover:bg-white/10" onClick={() => removeSection(section)} title="Eliminar sección"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {expanded && (
                    <div className="space-y-3 p-[var(--space-4)]">
                      {section.description && <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">{section.description}</p>}
                      {section.questions.map((question, questionIndex) => (
                        <QuestionCard key={question.id} question={question} onEdit={() => setQuestionEditor({ sectionId: section.id, question })} onDuplicate={() => duplicateQuestion(section.id, question)} onDelete={() => removeQuestion(question)} onMoveUp={() => moveQuestion(section, questionIndex, -1)} onMoveDown={() => moveQuestion(section, questionIndex, 1)} canMoveUp={questionIndex > 0} canMoveDown={questionIndex < section.questions.length - 1} />
                      ))}
                      {!section.questions.length && <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] p-4 text-center text-[var(--text-sm)] text-[var(--text-secondary)]">Esta sección todavía no tiene preguntas.</div>}
                      <Button variant="secondary" size="sm" onClick={() => setQuestionEditor({ sectionId: section.id })}><Plus className="h-4 w-4" /> Añadir pregunta</Button>
                    </div>
                  )}
                </section>
              );
            })}
            {!sections.length && <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-[var(--space-8)] text-center"><Plus className="mx-auto h-6 w-6 text-[var(--text-brand)]" /><p className="mt-3 font-semibold text-[var(--text-primary)]">Añade la primera sección</p><p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">Una encuesta necesita al menos una sección y una pregunta para publicarse.</p></div>}

            <EditorBlock title="Pie de email" description="Agradecimiento, contacto y aviso de privacidad.">
              <div onMouseDown={() => setActiveEditor("footer")}>
                <RichTextEditor value={emailFooterHtml} onChange={(value) => markDirty(() => setEmailFooterHtml(value))} placeholder="Gracias por ayudarnos a mejorar" editorClassName="!min-h-[120px]" insertTextRequest={activeEditor === "footer" ? insertRequest : undefined} />
              </div>
            </EditorBlock>
          </div>
        </div>
      </div>

      <SectionEditorModal section={sectionEditor} onClose={() => setSectionEditor(null)} onSave={(payload) => { if (!sectionEditor) return; structureMutation.mutate(() => updateSurveySection(sectionEditor.id, payload), { onSuccess: () => setSectionEditor(null) }); }} />
      <QuestionEditorModal context={questionEditor} surveyType={query.data.type} onClose={() => setQuestionEditor(null)} onSave={(payload) => { if (!questionEditor) return; structureMutation.mutate(() => questionEditor.question ? updateSurveyQuestion(questionEditor.question.id, payload) : addSurveyQuestion(questionEditor.sectionId, payload), { onSuccess: () => setQuestionEditor(null) }); }} />
      <Modal open={previewOpen} title="Vista previa del correo y la encuesta" onClose={() => setPreviewOpen(false)} size="xl">
        <SurveyFullPreview name={name} subject={emailSubject} header={emailHeaderHtml} footer={emailFooterHtml} sections={sections} />
      </Modal>
    </>
  );

  function moveSection(index: number, direction: -1 | 1) {
    const ids = sections.map((section) => section.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    structureMutation.mutate(() => reorderSurveySections(surveyId, ids));
  }
  function moveQuestion(section: SurveySection, index: number, direction: -1 | 1) {
    const ids = section.questions.map((question) => question.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    structureMutation.mutate(() => reorderSurveyQuestions(section.id, ids));
  }
  function removeSection(section: SurveySection) {
    if (window.confirm(`¿Eliminar la sección “${section.name}” y sus preguntas?`)) structureMutation.mutate(() => deleteSurveySection(section.id));
  }
  function removeQuestion(question: SurveyQuestion) {
    if (window.confirm(`¿Eliminar la pregunta “${question.text}”?`)) structureMutation.mutate(() => deleteSurveyQuestion(question.id));
  }
  function duplicateQuestion(sectionId: string, question: SurveyQuestion) {
    structureMutation.mutate(() => addSurveyQuestion(sectionId, questionToPayload(question, `${question.text} (copia)`)));
  }
  async function duplicateSection(section: SurveySection) {
    try {
      let data = await addSurveySection(surveyId);
      const created = data.draftVersion?.sections[data.draftVersion.sections.length - 1];
      if (!created) throw new Error("No fue posible identificar la sección duplicada");
      data = await updateSurveySection(created.id, { name: `${section.name} (copia)`, description: section.description });
      for (const question of section.questions) data = await addSurveyQuestion(created.id, questionToPayload(question));
      replaceDetail(data);
      toast.success("Sección duplicada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible duplicar la sección");
    }
  }
}

function EditorBlock({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-4)]"><div className="mb-3"><h4 className="font-semibold text-[var(--text-primary)]">{title}</h4>{description && <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{description}</p>}</div>{children}</section>;
}

function QuestionCard({ question, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: { question: SurveyQuestion; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean }) {
  return <article className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-3"><div className="flex items-start gap-3"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--text-primary)]">{question.text}</p>{question.isRequired && <Badge value="Obligatoria" tone="brand" />}</div>{question.description && <p className="mt-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{question.description}</p>}<p className="mt-2 text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{questionTypeLabels[question.type]}</p><QuestionScale question={question} /></div><div className="flex shrink-0 flex-wrap gap-1"><IconButton label="Editar" onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton><IconButton label="Duplicar" onClick={onDuplicate}><Copy className="h-4 w-4" /></IconButton><IconButton label="Mover arriba" onClick={onMoveUp} disabled={!canMoveUp}><ArrowUp className="h-4 w-4" /></IconButton><IconButton label="Mover abajo" onClick={onMoveDown} disabled={!canMoveDown}><ArrowDown className="h-4 w-4" /></IconButton><IconButton label="Eliminar" onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconButton></div></div></article>;
}

function QuestionScale({ question }: { question: SurveyQuestion }) {
  if (question.type === "FREE_TEXT") return <div className="mt-3 h-12 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]" />;
  if (!question.options.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{question.options.map((option) => <span key={option.id} className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-1 text-[var(--text-xs)] text-[var(--text-secondary)]">{option.label}</span>)}</div>;
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={label} className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] hover:bg-[var(--bg-subtle)] disabled:opacity-30 ${danger ? "text-[var(--text-danger)]" : "text-[var(--text-secondary)]"}`}>{children}</button>;
}

function SectionEditorModal({ section, onClose, onSave }: { section: SurveySection | null; onClose: () => void; onSave: (payload: { name: string; description?: string | null }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => { setName(section?.name ?? ""); setDescription(section?.description ?? ""); }, [section]);
  return <Modal open={Boolean(section)} title="Editar sección" onClose={onClose}><div className="space-y-4"><Labeled label="Nombre"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} /></Labeled><Labeled label="Descripción opcional"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></Labeled><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave({ name, description })}>Guardar sección</Button></div></div></Modal>;
}

function QuestionEditorModal({ context, surveyType, onClose, onSave }: { context: { sectionId: string; question?: SurveyQuestion } | null; surveyType: "SATISFACTION" | "NPS" | "CUSTOM"; onClose: () => void; onSave: (payload: SurveyQuestionPayload) => void }) {
  const initialType: SurveyQuestionType = surveyType === "NPS" ? "NPS_10" : "LIKERT_5";
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SurveyQuestionType>(initialType);
  const [required, setRequired] = useState(true);
  const [options, setOptions] = useState<{ id?: string; label: string; value?: string }[]>([]);
  useEffect(() => {
    const question = context?.question;
    setText(question?.text ?? "¿Cómo calificarías la atención recibida?");
    setDescription(question?.description ?? "");
    setType(question?.type ?? initialType);
    setRequired(question?.isRequired ?? true);
    setOptions(question?.options.map((option) => ({ id: option.id, label: option.label, value: option.value })) ?? defaultOptionDraft(initialType));
  }, [context, initialType]);
  const changeType = (next: SurveyQuestionType) => { setType(next); setOptions(defaultOptionDraft(next)); };
  return <Modal open={Boolean(context)} title={context?.question ? "Editar pregunta" : "Nueva pregunta"} onClose={onClose} size="lg"><div className="space-y-4"><Labeled label="Pregunta"><Textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-20" /></Labeled><Labeled label="Descripción opcional"><Input value={description} onChange={(event) => setDescription(event.target.value)} /></Labeled><div className="grid gap-4 sm:grid-cols-2"><Labeled label="Tipo"><Select value={type} onChange={(event) => changeType(event.target.value as SurveyQuestionType)}>{Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Labeled><label className="flex items-center gap-3 self-end rounded-[var(--radius-md)] border border-[var(--border-default)] p-3 text-[var(--text-sm)] font-semibold text-[var(--text-primary)]"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} className="h-4 w-4 accent-[var(--action-brand)]" /> Pregunta obligatoria</label></div>{typeHasOptions(type) && <div><div className="mb-2 flex items-center justify-between"><p className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">Opciones</p>{(type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") && <Button variant="secondary" size="sm" onClick={() => setOptions([...options, { label: `Opción ${options.length + 1}`, value: String(options.length + 1) }])}><Plus className="h-4 w-4" /> Agregar</Button>}</div><div className="max-h-72 space-y-2 overflow-y-auto">{options.map((option, index) => <div key={option.id ?? index} className="flex items-center gap-2"><span className="w-6 text-center text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">{index + (type === "NPS_10" ? 0 : 1)}</span><Input value={option.label} onChange={(event) => setOptions(options.map((item, optionIndex) => optionIndex === index ? { ...item, label: event.target.value } : item))} disabled={type === "NPS_10"} />{(type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") && <IconButton label="Eliminar opción" onClick={() => setOptions(options.filter((_, optionIndex) => optionIndex !== index))} danger><Trash2 className="h-4 w-4" /></IconButton>}</div>)}</div></div>}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave({ text, description, type, isRequired: required, options })}>Guardar pregunta</Button></div></div></Modal>;
}

function SurveyFullPreview({ name, subject, header, footer, sections }: { name: string; subject: string; header: string; footer: string; sections: SurveySection[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Correo</p>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)]">
          <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-[var(--text-sm)]"><strong>Asunto:</strong> {subject}</div>
          <div className="space-y-5 p-5">
            <SafeHtml html={header} className="prose prose-sm max-w-none" />
            <div className="text-center"><span className="inline-flex rounded-[var(--radius-md)] bg-[var(--action-brand)] px-5 py-3 font-semibold text-white">Responder encuesta</span></div>
            <SafeHtml html={footer} className="prose prose-sm max-w-none text-[var(--text-secondary)]" />
          </div>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Formulario público</p>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] p-5">
          <h3 className="text-[var(--text-xl)] font-semibold text-[var(--text-primary)]">{name}</h3>
          <div className="mt-4 space-y-4">{sections.map((section) => <section key={section.id}><p className="font-semibold text-[var(--text-brand-strong)]">{section.name}</p>{section.questions.map((question) => <div key={question.id} className="mt-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-3"><p className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">{question.text}{question.isRequired ? " *" : ""}</p><QuestionScale question={question} /></div>)}</section>)}</div>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">{label}</span>{children}</label>;
}

function toggleSet(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

function questionToPayload(question: SurveyQuestion, text = question.text): SurveyQuestionPayload {
  return { text, description: question.description, type: question.type, isRequired: question.isRequired, options: question.options.map((option) => ({ label: option.label, value: option.value })) };
}

function typeHasOptions(type: SurveyQuestionType) {
  return type !== "FREE_TEXT";
}

function defaultOptionDraft(type: SurveyQuestionType) {
  if (type === "LIKERT_5") return ["Muy en desacuerdo", "En desacuerdo", "Neutro", "De acuerdo", "Muy de acuerdo"].map((label, index) => ({ label, value: String(index + 1) }));
  if (type === "NPS_10") return Array.from({ length: 11 }, (_, index) => ({ label: String(index), value: String(index) }));
  if (type === "YES_NO") return [{ label: "Sí", value: "true" }, { label: "No", value: "false" }];
  if (type === "STAR_RATING") return Array.from({ length: 5 }, (_, index) => ({ label: `${index + 1} estrella${index ? "s" : ""}`, value: String(index + 1) }));
  if (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") return [{ label: "Opción 1", value: "1" }, { label: "Opción 2", value: "2" }];
  return [];
}
