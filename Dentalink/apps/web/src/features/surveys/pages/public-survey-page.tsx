import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Send, ShieldCheck, Star } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  getPublicSurvey,
  startPublicSurvey,
  submitPublicSurvey,
  type SurveyQuestion
} from "../services/surveys.service";

type Answer = {
  questionId: string;
  optionId?: string;
  optionIds?: string[];
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
};

export function PublicSurveyPage() {
  const { token = "" } = useParams<{ token: string }>();
  const query = useQuery({ queryKey: ["public-survey", token], queryFn: () => getPublicSurvey(token), enabled: Boolean(token), retry: false });
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [started, setStarted] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const readySurvey = query.data?.state === "READY" ? query.data : null;

  useEffect(() => {
    if (!readySurvey || started) return;
    setStarted(true);
    startPublicSurvey(token).catch(() => setStarted(false));
  }, [readySurvey, started, token]);

  const submit = useMutation({
    mutationFn: () => submitPublicSurvey(token, Object.values(answers)),
    onSuccess: (result) => setSubmittedMessage(result.message)
  });

  const currentSection = readySurvey?.survey.sections[sectionIndex];
  const progress = readySurvey?.survey.sections.length ? Math.round(((sectionIndex + 1) / readySurvey.survey.sections.length) * 100) : 0;
  const updateAnswer = (answer: Answer) => setAnswers((current) => ({ ...current, [answer.questionId]: answer }));
  const missingRequired = useMemo(
    () => currentSection?.questions.find((question) => question.isRequired && !hasAnswer(answers[question.id])),
    [answers, currentSection]
  );

  if (query.isLoading) return <div className="w-full max-w-2xl"><LoadingState message="Abriendo encuesta segura..." /></div>;
  if (query.isError) return <div className="w-full max-w-2xl"><ErrorState message={query.error.message} /></div>;
  if (!query.data) return <div className="w-full max-w-2xl"><ErrorState message="El enlace de la encuesta no está disponible." /></div>;
  if (query.data.state !== "READY") return <PublicMessage title={query.data.state === "RESPONDED" ? "Encuesta respondida" : "Enlace expirado"} message={query.data.message} />;
  if (submittedMessage) return <PublicMessage title="Respuesta registrada" message={submittedMessage} success />;
  if (!currentSection) return <PublicMessage title="Encuesta no disponible" message="La encuesta no contiene secciones publicadas." />;

  const color = /^#[0-9a-f]{6}$/i.test(query.data.brand.primaryColor ?? "") ? query.data.brand.primaryColor ?? undefined : undefined;
  const isLast = sectionIndex === query.data.survey.sections.length - 1;
  const continueAction = () => {
    if (missingRequired) {
      document.getElementById(`question-${missingRequired.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (isLast) submit.mutate();
    else { setSectionIndex((value) => value + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-modal)]">
      <header className="border-b border-[var(--border-default)] p-[var(--space-5)] sm:p-[var(--space-6)]">
        <div className="flex items-center gap-4">
          {query.data.brand.logoUrl ? <img src={query.data.brand.logoUrl} alt={query.data.brand.organizationName} className="max-h-14 max-w-40 object-contain" /> : <span className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--bg-brand-light)] text-[var(--text-brand)]"><Send className="h-5 w-5" /></span>}
          <div className="min-w-0"><p className="truncate text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">{query.data.brand.organizationName}</p><p className="truncate text-[var(--text-xs)] text-[var(--text-secondary)]">{query.data.brand.branchName}</p></div>
        </div>
        <h1 className="mt-[var(--space-5)] text-[var(--text-2xl)] font-semibold text-[var(--text-brand-strong)]">{query.data.survey.name}</h1>
        {sectionIndex === 0 && <div className="prose prose-sm mt-3 max-w-none text-[var(--text-secondary)]" dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(query.data.survey.welcomeHtml) }} />}
      </header>
      <div className="px-[var(--space-5)] pt-[var(--space-5)] sm:px-[var(--space-6)]">
        <div className="flex items-center justify-between text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]"><span>Sección {sectionIndex + 1} de {query.data.survey.sections.length}</span><span>{progress}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-[var(--radius-full)] bg-[var(--bg-subtle)]"><div className="h-full rounded-[var(--radius-full)] transition-[width]" style={{ width: `${progress}%`, backgroundColor: color || "var(--action-brand)" }} /></div>
      </div>
      <main className="space-y-[var(--space-5)] p-[var(--space-5)] sm:p-[var(--space-6)]">
        <div><h2 className="text-[var(--text-xl)] font-semibold text-[var(--text-primary)]">{currentSection.name}</h2>{currentSection.description && <p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">{currentSection.description}</p>}</div>
        {currentSection.questions.map((question, index) => <PublicQuestion key={question.id} index={index + 1} question={question} answer={answers[question.id]} onChange={updateAnswer} invalid={missingRequired?.id === question.id} color={color} />)}
        {submit.isError && <ErrorState message={submit.error.message} />}
      </main>
      <footer className="border-t border-[var(--border-default)] bg-[var(--bg-subtle)] p-[var(--space-5)] sm:px-[var(--space-6)]">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Button variant="secondary" disabled={sectionIndex === 0 || submit.isPending} onClick={() => setSectionIndex((value) => value - 1)}><ArrowLeft className="h-4 w-4" /> Anterior</Button><Button onClick={continueAction} disabled={submit.isPending} style={color ? { backgroundColor: color, borderColor: color } : undefined}>{submit.isPending ? "Registrando..." : isLast ? "Enviar respuestas" : "Siguiente"}{isLast ? <Send className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</Button></div>
        {query.data.survey.footerHtml && <div className="prose prose-sm mt-5 max-w-none text-center text-[var(--text-secondary)]" dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(query.data.survey.footerHtml) }} />}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[var(--text-xs)] text-[var(--text-secondary)]"><ShieldCheck className="h-3.5 w-3.5" /> Enlace único y respuesta confidencial</p>
      </footer>
    </div>
  );
}

function PublicQuestion({ question, answer, onChange, index, invalid, color }: { question: SurveyQuestion; answer?: Answer; onChange: (answer: Answer) => void; index: number; invalid: boolean; color?: string }) {
  return <section id={`question-${question.id}`} className={`scroll-mt-6 rounded-[var(--radius-lg)] border p-[var(--space-4)] ${invalid ? "border-[var(--text-danger)] bg-[var(--status-danger-bg)]" : "border-[var(--border-default)]"}`}><div className="flex items-start gap-3"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg-subtle)] text-[var(--text-xs)] font-semibold text-[var(--text-secondary)]">{index}</span><div><p className="font-semibold text-[var(--text-primary)]">{question.text}{question.isRequired && <span className="ml-1 text-[var(--text-danger)]">*</span>}</p>{question.description && <p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">{question.description}</p>}</div></div><div className="mt-4 pl-0 sm:pl-10"><AnswerControl question={question} answer={answer} onChange={onChange} color={color} /></div>{invalid && <p className="mt-2 text-[var(--text-xs)] font-semibold text-[var(--text-danger)]">Responde esta pregunta para continuar.</p>}</section>;
}

function AnswerControl({ question, answer, onChange, color }: { question: SurveyQuestion; answer?: Answer; onChange: (answer: Answer) => void; color?: string }) {
  if (question.type === "FREE_TEXT") return <textarea value={answer?.valueText ?? ""} onChange={(event) => onChange({ questionId: question.id, valueText: event.target.value })} rows={4} maxLength={10_000} placeholder="Escribe tu respuesta" className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-[var(--text-sm)] text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--focus-ring)]" />;
  if (question.type === "STAR_RATING") return <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => onChange({ questionId: question.id, valueNumber: value })} aria-label={`${value} estrellas`} className="rounded-[var(--radius-md)] p-1"><Star className={`h-8 w-8 ${answer?.valueNumber && value <= answer.valueNumber ? "fill-[var(--status-warning-text)] text-[var(--status-warning-text)]" : "text-[var(--border-strong)]"}`} /></button>)}</div>;
  if (question.type === "NPS_10" || question.type === "LIKERT_5") {
    const min = question.type === "NPS_10" ? 0 : 1;
    const max = question.type === "NPS_10" ? 10 : 5;
    return <div><div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(max - min + 1, 11)}, minmax(38px, 1fr))` }}>{Array.from({ length: max - min + 1 }, (_, index) => min + index).map((value) => { const selected = answer?.valueNumber === value; return <button key={value} type="button" onClick={() => onChange({ questionId: question.id, valueNumber: value })} className={`h-10 rounded-[var(--radius-md)] border text-[var(--text-sm)] font-semibold ${selected ? "border-[var(--action-brand)] bg-[var(--action-brand)] text-white" : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-brand)]"}`} style={selected && color ? { backgroundColor: color, borderColor: color } : undefined}>{value}</button>; })}</div><div className="mt-2 flex justify-between text-[var(--text-xs)] text-[var(--text-secondary)]"><span>{question.type === "NPS_10" ? "Nada probable" : question.options[0]?.label}</span><span>{question.type === "NPS_10" ? "Muy probable" : question.options.at(-1)?.label}</span></div></div>;
  }
  if (question.type === "MULTIPLE_CHOICE") {
    const selected = answer?.optionIds ?? [];
    return <div className="space-y-2">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] p-3 hover:bg-[var(--bg-subtle)]"><input type="checkbox" checked={selected.includes(option.id)} onChange={(event) => onChange({ questionId: question.id, optionIds: event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id) })} className="h-4 w-4 accent-[var(--action-brand)]" /><span className="text-[var(--text-sm)] text-[var(--text-primary)]">{option.label}</span></label>)}</div>;
  }
  return <div className="space-y-2">{question.options.map((option) => { const selected = answer?.optionId === option.id; return <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border p-3 ${selected ? "border-[var(--border-brand)] bg-[var(--bg-brand-light)]" : "border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"}`}><input type="radio" name={question.id} checked={selected} onChange={() => onChange(question.type === "YES_NO" ? { questionId: question.id, optionId: option.id, valueBoolean: option.value === "true" } : { questionId: question.id, optionId: option.id })} className="h-4 w-4 accent-[var(--action-brand)]" /><span className="text-[var(--text-sm)] text-[var(--text-primary)]">{option.label}</span></label>; })}</div>;
}

function PublicMessage({ title, message, success = false }: { title: string; message: string; success?: boolean }) {
  return <div className="w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-8)] text-center shadow-[var(--shadow-modal)]"><span className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[var(--radius-full)] ${success ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}><CheckCircle2 className="h-7 w-7" /></span><h1 className="mt-4 text-[var(--text-2xl)] font-semibold text-[var(--text-brand-strong)]">{title}</h1><p className="mt-2 text-[var(--text-sm)] leading-6 text-[var(--text-secondary)]">{message}</p></div>;
}

function hasAnswer(answer?: Answer) {
  return Boolean(answer && (answer.optionId || answer.optionIds?.length || answer.valueText?.trim() || answer.valueNumber !== undefined || answer.valueBoolean !== undefined));
}

function sanitizePreviewHtml(value: string) {
  return value.replace(/<\s*(script|iframe|object|embed|form|input|button|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "").replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript\s*:/gi, "");
}
