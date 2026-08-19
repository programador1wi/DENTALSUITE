import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import {
  Banknote,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardList,
  FileSignature,
  FlaskConical,
  HeartPulse,
  Home,
  List,
  Microscope,
  Pill,
  Printer,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { LoadingState } from "@/components/feedback/loading-state";
import { Modal } from "@/components/ui/modal";
import { ClinicalShell } from "../components/clinical-shell";
import { usePatientHistory } from "../hooks/use-clinical";
import type { PatientHistoryCategory, PatientHistoryEvent, PatientHistoryQuery } from "../services/clinical.service";

const categoryMeta: Record<PatientHistoryCategory, { label: string; icon: LucideIcon; tone: string; border: string; priority: number }> = {
  APPOINTMENTS: { label: "Citas", icon: CalendarClock, tone: "text-red-600 bg-red-50", border: "border-r-red-500", priority: 10 },
  TREATMENT_PLANS: { label: "Planes", icon: ClipboardList, tone: "text-sky-700 bg-sky-50", border: "border-r-sky-500", priority: 20 },
  BUDGETS: { label: "Presupuestos", icon: ClipboardList, tone: "text-blue-700 bg-blue-50", border: "border-r-blue-500", priority: 30 },
  EVOLUTIONS: { label: "Evoluciones", icon: Stethoscope, tone: "text-pink-700 bg-pink-50", border: "border-r-pink-500", priority: 40 },
  PROCEDURES: { label: "Prestaciones", icon: CircleDot, tone: "text-amber-700 bg-amber-50", border: "border-r-amber-500", priority: 50 },
  MEDICAL_HISTORY: { label: "Antecedentes", icon: HeartPulse, tone: "text-teal-700 bg-teal-50", border: "border-r-teal-500", priority: 60 },
  ODONTOGRAM: { label: "Odontograma", icon: CircleDot, tone: "text-cyan-700 bg-cyan-50", border: "border-r-cyan-500", priority: 70 },
  PERIODONTOGRAM: { label: "Periodontograma", icon: Microscope, tone: "text-emerald-700 bg-emerald-50", border: "border-r-emerald-500", priority: 80 },
  PAYMENTS: { label: "Pagos", icon: Banknote, tone: "text-green-700 bg-green-50", border: "border-r-green-500", priority: 90 },
  REFUNDS: { label: "Devoluciones", icon: RotateCcw, tone: "text-orange-700 bg-orange-50", border: "border-r-orange-500", priority: 100 },
  BILLING: { label: "Facturacion", icon: Banknote, tone: "text-slate-700 bg-slate-100", border: "border-r-slate-500", priority: 110 },
  DOCUMENTS: { label: "Documentos", icon: FileSignature, tone: "text-indigo-700 bg-indigo-50", border: "border-r-indigo-500", priority: 120 },
  PRESCRIPTIONS: { label: "Recetas", icon: Pill, tone: "text-lime-700 bg-lime-50", border: "border-r-lime-500", priority: 130 },
  LABORATORY: { label: "Laboratorio", icon: FlaskConical, tone: "text-violet-700 bg-violet-50", border: "border-r-violet-500", priority: 140 },
  ORTHODONTICS: { label: "Ortodoncia", icon: ShieldAlert, tone: "text-fuchsia-700 bg-fuchsia-50", border: "border-r-fuchsia-500", priority: 150 },
  CONSENTS: { label: "Consentimientos", icon: FileSignature, tone: "text-purple-700 bg-purple-50", border: "border-r-purple-500", priority: 160 },
  INSURANCE: { label: "Reembolsos", icon: ShieldAlert, tone: "text-stone-700 bg-stone-100", border: "border-r-stone-500", priority: 170 },
  COLLABORATIONS: { label: "Colaboraciones", icon: UserRound, tone: "text-zinc-700 bg-zinc-100", border: "border-r-zinc-500", priority: 180 }
};

const allCategories = Object.keys(categoryMeta) as PatientHistoryCategory[];

export function ClinicalHistoryPage() {
  const { id = "" } = useParams();
  const [month, setMonth] = useState("");
  const order = "desc" as const;
  const [includeAnnulled, setIncludeAnnulled] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | PatientHistoryCategory>("ALL");
  const [cursor, setCursor] = useState<string | undefined>();
  const [events, setEvents] = useState<PatientHistoryEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"current" | "complete">("current");
  const [printPrivate, setPrintPrivate] = useState(false);
  const filterKey = JSON.stringify({ month, order, includeAnnulled, categoryFilter });

  const query: PatientHistoryQuery = useMemo(
    () => ({
      month: month || undefined,
      order,
      includeAnnulled,
      categories: categoryFilter === "ALL" ? allCategories.join(",") : categoryFilter,
      cursor,
      take: 40
    }),
    [categoryFilter, cursor, includeAnnulled, month, order]
  );
  const history = usePatientHistory(id, query);

  useEffect(() => {
    setCursor(undefined);
    setEvents([]);
    setNextCursor(null);
  }, [filterKey]);

  useEffect(() => {
    if (!history.data) return;
    setNextCursor(history.data.nextCursor ?? null);
    setEvents((current) => {
      if (!cursor) return history.data.items;
      const seen = new Set(current.map((event) => event.id));
      return [...current, ...history.data.items.filter((event) => !seen.has(event.id))];
    });
  }, [cursor, history.data]);

  const groups = useMemo(() => groupEvents(events), [events]);
  const availableCategories = history.data?.availableCategories ?? Object.keys(categoryMeta) as PatientHistoryCategory[];
  const monthOptions = useMemo(() => buildMonthOptions(events), [events]);
  const monthDropdownOptions = useMemo(() => {
    const options = [{ value: "", label: "Todos los meses" }, ...monthOptions];
    if (month && !options.some((option) => option.value === month)) {
      options.splice(1, 0, { value: month, label: monthLabelFromKey(month) });
    }
    return options;
  }, [month, monthOptions]);
  const categoryDropdownOptions = useMemo(
    () => [{ value: "ALL", label: "Todos" }, ...availableCategories.map((category) => ({ value: category, label: categoryMeta[category].label }))],
    [availableCategories]
  );
  const printEvents = printMode === "complete" ? events : events;

  const print = () => {
    setPrintOpen(false);
    window.setTimeout(() => window.print(), 60);
  };

  return (
    <ClinicalShell patientId={id} title="Historial" description="Linea de tiempo integral del expediente.">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #patient-history-print, #patient-history-print * { visibility: visible; }
          #patient-history-print { display: block !important; position: absolute; inset: 0; width: 100%; background: white; }
          .history-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <section className="bg-white print:hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-3 py-4">
          <h2 className="mr-8 text-[24px] font-light leading-none text-slate-800">Historial</h2>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
            Filtrar por mes:
            <HistoryDropdown className="w-[145px]" options={monthDropdownOptions} value={month} onChange={setMonth} />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
            Filtrar por:
            <HistoryDropdown
              className="w-[270px]"
              options={categoryDropdownOptions}
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value as "ALL" | PatientHistoryCategory)}
            />
          </label>
          <HelpTooltip content="Configurar impresion del historial" position="left" triggerClassName="ml-auto">
            <Button type="button" variant="ghost" size="sm" className="h-[38px] w-[42px] rounded bg-slate-100 px-0 text-slate-700 hover:bg-slate-200" onClick={() => setPrintOpen(true)} aria-label="Imprimir historial">
              <Printer className="h-[17px] w-[17px]" />
            </Button>
          </HelpTooltip>
          <label className="inline-flex h-[38px] items-center gap-2 rounded bg-slate-100 px-3 text-sm text-slate-800">
            <input type="checkbox" checked={includeAnnulled} onChange={(event) => setIncludeAnnulled(event.target.checked)} />
            Mostrar anuladas
          </label>
        </div>

        {history.isLoading && !events.length ? <LoadingState message="Cargando historial integral..." /> : null}
        {history.isError ? <ErrorState message={history.error.message} /> : null}
        {!history.isLoading && !history.isError ? (
          <div className="px-3 py-5">
            {groups.length > 0 ? <HistoryTimeline groups={groups} /> : <EmptyTimeline />}
            {nextCursor ? (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="secondary" onClick={() => setCursor(nextCursor)} disabled={history.isFetching}>
                  <ChevronDown className="h-4 w-4" />
                  {history.isFetching ? "Cargando..." : "Cargar eventos anteriores"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <PrintPreview context={history.data?.printContext} patient={history.data?.patient} groups={groupEvents(printEvents.filter((event) => printPrivate || !event.isPrivate))} />

      <Modal open={printOpen} title="Imprimir historial clinico" size="lg" onClose={() => setPrintOpen(false)}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="rounded-[var(--radius-md)] border border-slate-200 p-3 text-sm">
              <input type="radio" className="mr-2" checked={printMode === "current"} onChange={() => setPrintMode("current")} />
              Imprimir filtros actuales
            </label>
            <label className="rounded-[var(--radius-md)] border border-slate-200 p-3 text-sm">
              <input type="radio" className="mr-2" checked={printMode === "complete"} onChange={() => setPrintMode("complete")} />
              Imprimir historial cargado completo
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={includeAnnulled} onChange={(event) => setIncludeAnnulled(event.target.checked)} />
            Incluir anulados con motivo, usuario y fecha cuando exista
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={printPrivate} onChange={(event) => setPrintPrivate(event.target.checked)} />
            Incluir eventos privados visibles para mi usuario
          </label>
          <p className="text-sm text-slate-500">
            Logo resuelto: {history.data?.printContext?.branchLogoUrl ? "logo de sucursal/marca" : history.data?.printContext?.organizationLogoUrl ? "logo general" : "sin logo configurado"}.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPrintOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={print}><Printer className="h-4 w-4" /> Imprimir</Button>
          </div>
        </div>
      </Modal>
    </ClinicalShell>
  );
}

function HistoryDropdown({
  options,
  value,
  onChange,
  className = ""
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const containWheel = (event: WheelEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const atTop = target.scrollTop <= 0;
    const atBottom = Math.ceil(target.scrollTop + target.clientHeight) >= target.scrollHeight;
    if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
      event.preventDefault();
    }
    event.stopPropagation();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        className={`flex h-[38px] w-full items-center justify-between rounded border border-slate-300 bg-white px-3 text-left text-sm font-normal ${value ? "text-slate-700" : "text-slate-500"} shadow-none outline-none focus:border-[#3d8a88] focus:ring-1 focus:ring-[#3d8a88]/25`}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.label}</span>
        <span className="ml-2 flex h-full w-8 shrink-0 items-center justify-end border-l border-slate-200 pl-2 text-slate-400">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[1200] max-h-[188px] overflow-y-auto overscroll-contain rounded border border-slate-300 bg-white py-1 shadow-[0_10px_22px_rgba(15,23,42,0.12)]"
          onWheel={containWheel}
        >
          {options.map((option) => {
            const selectedOption = option.value === value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                role="option"
                aria-selected={selectedOption}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${selectedOption ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
                {selectedOption ? <Check className="ml-2 h-4 w-4 shrink-0 text-[#3d8a88]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function HistoryTimeline({ groups }: { groups: Array<{ date: string; label: string; cards: TimelineCardGroup[] }> }) {
  return (
    <div className="relative grid gap-y-5 lg:grid-cols-[385px_minmax(0,590px)]">
      <div className="absolute left-[360px] top-0 hidden h-full w-1 bg-[#3d8a88] lg:block" />
      {groups.map((group) => (
        <div key={group.date} className="contents">
          <div className="relative flex items-start justify-end pr-[74px] pt-[45px] text-sm font-semibold text-[#287f7c]">
            <span>{group.label}</span>
            <span className="absolute right-[16px] top-[40px] hidden h-5 w-5 rounded-full bg-[#3d8a88] ring-8 ring-white lg:block" />
          </div>
          <div className="space-y-5">
            {group.cards.map((card) => (
              <HistoryCard key={card.key} card={card} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryCard({ card }: { card: TimelineCardGroup }) {
  const meta = categoryMeta[card.category];
  const Icon = meta.icon;
  const isAnnulled = card.items.every((event) => event.isAnnulled);
  return (
    <article className={`history-card relative rounded border border-slate-200 bg-white shadow-sm before:absolute before:-left-2 before:top-10 before:h-4 before:w-4 before:rotate-45 before:border-b before:border-l before:border-slate-200 before:bg-white ${isAnnulled ? "opacity-75" : ""}`}>
      <div className={`flex h-[42px] items-center justify-between border-r-4 border-b border-slate-200 px-3 text-xs font-bold uppercase ${meta.border} ${meta.tone}`}>
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="truncate">{card.title}</span>
        </span>
        <Icon className="h-4 w-4 shrink-0" />
      </div>
      <div className="divide-y divide-slate-200 bg-slate-50">
        {card.items.map((event) => (
          <HistoryEventRow key={event.id} event={event} />
        ))}
      </div>
    </article>
  );
}

function HistoryEventRow({ event }: { event: PatientHistoryEvent }) {
  return (
    <div className="px-3 py-3 text-sm leading-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-slate-800">
            {event.sourceEntityType === "ClinicalEvolution" && event.treatmentPlanId ? <strong>Plan de tratamiento #{event.treatmentPlanId.slice(-6)}: </strong> : null}
            {event.isAnnulled ? "Cancelado" : event.summary}
          </p>
          {event.isAnnulled && event.annulmentReason ? <p className="text-xs text-red-600">{event.annulmentReason}</p> : null}
          <p className="text-[#287f7c]">
            {event.branch ? (
              <span className="inline-flex items-center gap-1">
                <Home className="h-3.5 w-3.5 fill-[#3d8a88] text-[#3d8a88]" />
                {event.branch.name}
              </span>
            ) : null}
            {event.branch && event.professional ? ", " : ""}
            {event.professional ? `Dr.(a) ${event.professional.name}` : ""}
            {event.toothId ? `, Pieza ${event.toothId}` : ""}
            {`, ${eventTime(event.occurredAt)}`}
          </p>
        </div>
        {event.isAnnulled ? <Badge value="Anulado" tone="danger" /> : event.category === "BUDGETS" ? <List className="h-4 w-4 shrink-0 text-blue-600" /> : null}
      </div>
    </div>
  );
}

function EmptyTimeline() {
  return (
    <div className="grid min-h-56 lg:grid-cols-[385px_minmax(0,590px)]">
      <div className="relative hidden lg:block">
        <div className="absolute right-6 top-0 h-full w-1 bg-[#3d8a88]" />
        <span className="absolute right-[16px] top-20 h-5 w-5 rounded-full bg-[#3d8a88] ring-8 ring-white" />
      </div>
      <div className="rounded border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600 shadow-sm">No hay eventos para los filtros seleccionados.</div>
    </div>
  );
}

function PrintPreview({
  context,
  patient,
  groups
}: {
  context?: { organizationName: string; branchLogoUrl?: string | null; organizationLogoUrl?: string | null; branchName: string; generatedAt: string; generatedBy: string };
  patient?: { firstName: string; lastName: string; documentType?: string | null; documentNumber?: string | null; birthDate?: string | null; phone?: string | null; email?: string | null; createdAt: string };
  groups: Array<{ date: string; label: string; cards: TimelineCardGroup[] }>;
}) {
  const logoUrl = context?.branchLogoUrl ?? context?.organizationLogoUrl ?? "";

  return (
    <section id="patient-history-print" className="hidden p-8 text-slate-900">
      <header className="mb-6 flex items-start justify-between border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Historia clinica</h1>
          <p className="text-sm">{context?.organizationName}</p>
          <p className="text-xs text-slate-600">{context?.branchName}</p>
        </div>
        {logoUrl ? <img src={logoUrl} alt="Logotipo" className="h-16 max-w-[220px] object-contain" /> : null}
      </header>
      {patient ? (
        <div className="mb-6 grid grid-cols-2 gap-2 text-xs">
          <span>Paciente: {patient.firstName} {patient.lastName}</span>
          <span>Documento: {patient.documentType || "ID"} {patient.documentNumber || "Sin registro"}</span>
          <span>Telefono: {patient.phone || "Sin registro"}</span>
          <span>Correo: {patient.email || "Sin registro"}</span>
          <span>Creado: {dateLabel(patient.createdAt)}</span>
          <span>Generado: {context ? dateLabel(context.generatedAt) : ""} por {context?.generatedBy}</span>
        </div>
      ) : null}
      <HistoryTimeline groups={groups} />
    </section>
  );
}

type TimelineCardGroup = {
  key: string;
  category: PatientHistoryCategory;
  title: string;
  items: PatientHistoryEvent[];
};

function groupEvents(events: PatientHistoryEvent[]) {
  const byDate = new Map<string, PatientHistoryEvent[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.occurredAt));
    byDate.set(key, [...(byDate.get(key) ?? []), event]);
  }
  return Array.from(byDate, ([date, items]) => ({
    date,
    label: timelineDateLabel(new Date(items[0].occurredAt)),
    cards: groupCards(items)
  }));
}

function groupCards(items: PatientHistoryEvent[]): TimelineCardGroup[] {
  const byCategory = new Map<string, TimelineCardGroup>();
  for (const event of items) {
    const key = `${event.category}:${event.title}`;
    const current = byCategory.get(key);
    if (current) {
      current.items.push(event);
    } else {
      byCategory.set(key, {
        key,
        category: event.category,
        title: event.title,
        items: [event]
      });
    }
  }
  return [...byCategory.values()].sort((left, right) => categoryMeta[left.category].priority - categoryMeta[right.category].priority);
}

function eventTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildMonthOptions(events: PatientHistoryEvent[]) {
  const months = new Map<string, string>();
  for (const event of events) {
    const date = new Date(event.occurredAt);
    const key = date.toISOString().slice(0, 7);
    months.set(key, monthLabelFromKey(key));
  }
  return [...months.entries()].map(([value, label]) => ({ value, label })).sort((left, right) => right.value.localeCompare(left.value));
}

function monthLabelFromKey(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function timelineDateLabel(date: Date) {
  const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(date).replace(/\.$/, "");
  return `${month}. ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
}
