import { useState, useMemo, useRef, useEffect } from "react";
import { CheckCircle2, DollarSign, MessageSquare } from "lucide-react";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import { appointmentColorPalette } from "./appointment-status";
import { AppointmentActionsMenu, type AppointmentMenuAction } from "./appointment-actions-menu";
import { AppointmentStatusMenu } from "./appointment-status-menu";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const ALL_STATUSES: { status: AppointmentStatus; label: string }[] = [
  { status: "SCHEDULED",            label: "Agendada" },
  { status: "CONFIRMED",            label: "Confirmada" },
  { status: "CONFIRMED_BY_WHATSAPP",label: "Confirmada por WhatsApp" },
  { status: "CONFIRMED_BY_PHONE",   label: "Confirmada por teléfono" },
  { status: "CONFIRMED_BY_EMAIL",   label: "Confirmada por email" },
  { status: "PENDING_CONFIRMATION", label: "Por confirmar" },
  { status: "NOTIFIED_BY_WHATSAPP", label: "Notificada por WhatsApp" },
  { status: "NOTIFIED_BY_EMAIL",    label: "Notificada por email" },
  { status: "ARRIVED",              label: "Llegó a clínica" },
  { status: "WAITING_ROOM",         label: "Sala de espera" },
  { status: "IN_PROGRESS",          label: "En atención" },
  { status: "COMPLETED",            label: "Atendida" },
  { status: "RESCHEDULED",          label: "Reagendada" },
  { status: "NO_SHOW",              label: "No asistió" },
  { status: "CANCELLED_BY_PATIENT", label: "Cancelada (paciente)" },
  { status: "CANCELLED_BY_CLINIC",  label: "Cancelada (clínica)" },
  { status: "CANCELLED_CONFLICT",   label: "Cancelada conflicto" },
  { status: "CANCELLED_RESCHEDULED",label: "Anulada reprogramación" },
  { status: "BLOCKED",              label: "Bloqueada" },
];

function appointmentPatientName(appointment: Appointment) {
  return appointment.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim()
    : "Bloqueo clinico";
}

function appointmentSearchLabel(appointment: Appointment) {
  return appointment.patient ? appointmentPatientName(appointment) : appointment.title;
}

function appointmentMatchesTerm(appointment: Appointment, term: string) {
  const q = term.toLowerCase();
  const name = appointment.patient ? appointmentPatientName(appointment).toLowerCase() : "";
  const phone = appointment.patient?.phone?.toLowerCase() ?? "";
  return name.includes(q) || phone.includes(q) || appointment.title.toLowerCase().includes(q);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ActionHandlers = {
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment, cancelledBy?: "patient" | "clinic" | "conflict" | "rescheduled") => void;
  onReschedule: (appointment: Appointment) => void;
  onChangeStatus?: (appointment: Appointment, status: AppointmentStatus) => void;
  onConfirm: (id: string) => void;
  onArrive: (id: string) => void;
  onWaitingRoom: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
  onMenuAction?: (appointment: Appointment, action: AppointmentMenuAction) => void;
};

// ─── Main Component ────────────────────────────────────────────────────────────

export function AgendaDailyList({
  appointments,
  date,
  onDateChange,
  onCreateClick,
  ...handlers
}: {
  appointments: Appointment[];
  date: string;
  onDateChange: (date: string) => void;
  onCreateClick?: () => void;
} & ActionHandlers) {
  const [search, setSearch]               = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<AppointmentStatus>>(new Set());
  const [page, setPage]                   = useState(1);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // ── Date helpers ──
  const navigate = (delta: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    onDateChange(d.toISOString().slice(0, 10));
    setPage(1);
  };
  const goToday = () => { onDateChange(toDateInputValue(new Date())); setPage(1); };

  const dateObj   = new Date(`${date}T12:00:00`);
  const dayName   = dateObj.toLocaleDateString("es-CL", { weekday: "long" });
  const dayNum    = dateObj.getDate();
  const monthYear = dateObj.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  const isToday   = date === toDateInputValue(new Date());

  // ── Status filter toggle ──
  const toggleStatus = (status: AppointmentStatus) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
    setPage(1);
  };

  // ── Filter + search + sort ──
  const filtered = useMemo(() => {
    let list = [...appointments].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    if (activeStatuses.size > 0)
      list = list.filter(a => activeStatuses.has(a.status));
    if (search.trim()) {
      list = list.filter(a => appointmentMatchesTerm(a, search));
    }
    return list;
  }, [appointments, activeStatuses, search]);

  const appointmentSuggestions = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    return [...appointments]
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .filter((appointment) => appointmentMatchesTerm(appointment, q));
  }, [appointments, search]);

  const selectAppointment = (appointment: Appointment) => {
    const label = appointmentSearchLabel(appointment);
    const narrowed = [...appointments]
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .filter((item) => appointmentMatchesTerm(item, label));
    const index = Math.max(0, narrowed.findIndex((item) => item.id === appointment.id));

    setSearch(label);
    setActiveStatuses(new Set());
    setSelectedAppointmentId(appointment.id);
    setPage(Math.floor(index / PAGE_SIZE) + 1);
  };

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Compute visible page numbers (max 5 shown)
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums: (number | "…")[] = [1];
    if (safePage > 3) nums.push("…");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) nums.push(i);
    if (safePage < totalPages - 2) nums.push("…");
    nums.push(totalPages);
    return nums;
  }, [totalPages, safePage]);

  return (
    <div className="flex rounded-xl border border-zinc-200/70 bg-white shadow-sm overflow-hidden" style={{ minHeight: "640px" }}>

      {/* ── Left sidebar: status filters ── */}
      <aside className="w-52 shrink-0 border-r border-zinc-100 bg-zinc-50/60 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Estados</p>
          {activeStatuses.size > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">
              {activeStatuses.size}
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {ALL_STATUSES.map(({ status, label }) => {
            const pal    = appointmentColorPalette[status];
            const active = activeStatuses.has(status);
            const count  = appointments.filter(a => a.status === status).length;
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all duration-150 ${
                  active
                    ? "bg-white shadow-sm border border-zinc-200/80"
                    : "hover:bg-white/80 hover:shadow-sm"
                }`}
              >
                {/* Color dot */}
                <span className={`h-2.5 w-2.5 rounded-sm shrink-0 ${active ? pal.dotClass : "bg-zinc-300"}`} />
                <span className={`flex-1 text-[11px] truncate ${active ? "font-semibold text-zinc-800" : "font-medium text-zinc-500"}`}>
                  {label}
                </span>
                {count > 0 && (
                  <span className="text-[9px] font-semibold text-zinc-400">{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {activeStatuses.size > 0 && (
          <div className="px-3 py-2.5 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => { setActiveStatuses(new Set()); setPage(1); }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold text-zinc-500 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar filtros
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Date nav + search bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-100 bg-white/80 backdrop-blur-sm flex-wrap gap-y-2">

          {/* Date navigation */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95 shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center min-w-[110px]">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 capitalize">{dayName}</p>
              <p className="text-2xl font-black text-zinc-900 leading-none tracking-tight">{dayNum}</p>
              <p className="text-[10px] text-zinc-400 leading-snug capitalize">{monthYear}</p>
            </div>

            <button
              type="button"
              onClick={() => navigate(1)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-95 shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Counters */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/70 px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-sm">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {appointments.length} citas
            </span>
            {!isToday && (
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 transition shadow-sm"
              >
                Hoy
              </button>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <EntitySearchBox
              value={search}
              onValueChange={(value) => {
                setSearch(value);
                setPage(1);
                setSelectedAppointmentId(null);
              }}
              items={appointmentSuggestions}
              onSelect={selectAppointment}
              getItemKey={(appointment) => appointment.id}
              placeholder="Buscar paciente, teléfono o tratamiento..."
              inputClassName="h-8 rounded-lg border-zinc-200 bg-zinc-50/80 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-blue-300 focus:ring-blue-200"
              emptyMessage="Sin citas encontradas"
              renderItem={(appointment) => {
                const start = new Date(appointment.startAt);
                return (
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                      {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-zinc-800">{appointmentPatientName(appointment)}</span>
                      <span className="block truncate text-[10px] text-zinc-400">{appointment.title}</span>
                    </span>
                  </div>
                );
              }}
            />
          </div>


        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-24 text-center">
              <div className="h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <svg className="h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-zinc-600">Sin citas para este día</p>
              <p className="text-xs text-zinc-400 mt-1">
                {activeStatuses.size > 0 || search ? "Ajusta los filtros o la búsqueda" : "Agrega una nueva cita para comenzar"}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-50/95 backdrop-blur-sm border-b border-zinc-200/60">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-[88px]">Hora</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400">Paciente</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-40">Doctor</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-44">Tratamiento</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-36">Estado</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-28">Situación</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/80">
                {paginated.map(appointment => (
                  <AgendaListRow
                    key={appointment.id}
                    appointment={appointment}
                    highlighted={appointment.id === selectedAppointmentId}
                    {...handlers}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-5 py-2.5">
            <span className="text-[11px] text-zinc-400">
              Mostrando <span className="font-semibold text-zinc-600">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}</span> de <span className="font-semibold text-zinc-600">{filtered.length}</span> citas
            </span>
            <div className="flex items-center gap-1">
              <PaginationBtn onClick={() => setPage(p => p - 1)} disabled={safePage === 1}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </PaginationBtn>

              {pageNumbers.map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="w-7 text-center text-zinc-400 text-xs">…</span>
                ) : (
                  <PaginationBtn key={p} onClick={() => setPage(p)} active={p === safePage}>
                    {p}
                  </PaginationBtn>
                )
              )}

              <PaginationBtn onClick={() => setPage(p => p + 1)} disabled={safePage === totalPages}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </PaginationBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pagination Button ────────────────────────────────────────────────────────

function PaginationBtn({
  children, onClick, disabled, active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-7 min-w-[28px] px-1 flex items-center justify-center rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
        active
          ? "bg-blue-600 text-white border border-blue-600 shadow-sm"
          : "border border-zinc-200 text-zinc-600 hover:bg-white hover:border-zinc-300 bg-transparent"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

// ─── Row sub-component ────────────────────────────────────────────────────────

function AgendaListRow({
  appointment,
  onEdit,
  onCancel,
  onReschedule,
  onChangeStatus,
  onConfirm,
  onArrive,
  onWaitingRoom,
  onStart,
  onComplete,
  onNoShow,
  onMenuAction,
  highlighted
}: { appointment: Appointment; highlighted?: boolean } & ActionHandlers) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pal         = appointmentColorPalette[appointment.status];
  const start       = new Date(appointment.startAt);
  const end         = new Date(appointment.endAt);
  const patientName = appointment.patient
    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
    : "Bloqueo clínico";

  const hasAppointmentComment = Boolean(
    appointment.notes?.trim() ||
      appointment.appointmentNotes?.length ||
      (appointment._count?.appointmentNotes ?? 0) > 0
  );
  const commentButtonLabel = hasAppointmentComment ? "Editar comentario de cita" : "Agregar comentario de cita";

  // Determine inline primary action based on status flow
  const primaryAction = useMemo(() => getPrimaryAction(appointment.status, appointment.id, {
    onConfirm, onArrive, onWaitingRoom, onStart, onComplete,
  }), [appointment.status, appointment.id, onConfirm, onArrive, onWaitingRoom, onStart, onComplete]);

  const handleMenuAction = (action: AppointmentMenuAction) => {
    if (action === "changeDate") {
      onReschedule(appointment);
      return;
    }

    if (action === "cancel") {
      onCancel(appointment, "clinic");
      return;
    }

    if (!onMenuAction && (action === "modifyDuration" || action === "addComment" || action === "changeStatus")) {
      onEdit(appointment);
      return;
    }

    onMenuAction?.(appointment, action);
  };

  return (
    <tr className={`${highlighted ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : "hover:bg-blue-50/20"} transition-colors duration-100 group`}>

      {/* Hour block */}
      <td className="px-3 py-2.5">
        <div className={`inline-flex flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center border min-w-[64px] ${pal.cardClass}`}>
          <span className="text-[12px] font-black leading-none tabular-nums">
            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-[8px] font-semibold opacity-50 mt-0.5 tabular-nums">
            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </td>

      {/* Patient */}
      <td className="px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate font-semibold text-zinc-900 text-[12px] leading-snug">{patientName}</p>
          <button
            type="button"
            aria-label={commentButtonLabel}
            title={commentButtonLabel}
            onClick={(event) => {
              event.stopPropagation();
              handleMenuAction("addComment");
            }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200 ${
              hasAppointmentComment ? "text-blue-600" : "text-zinc-400 hover:text-blue-600"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {appointment.patient?.phone && (
            <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
              <svg className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {appointment.patient.phone}
            </span>
          )}
          {appointment.chair && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 border border-zinc-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">
              {appointment.chair.name}
            </span>
          )}
        </div>
      </td>

      {/* Doctor */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[9px] font-bold shrink-0 select-none">
            {appointment.professional.firstName.charAt(0)}{appointment.professional.lastName.charAt(0)}
          </div>
          <span className="text-[11px] font-medium text-zinc-700 truncate max-w-[120px]">
            {appointment.professional.firstName} {appointment.professional.lastName}
          </span>
        </div>
      </td>

      {/* Treatment */}
      <td className="px-4 py-2.5">
        <p className="text-[11px] font-semibold text-zinc-800 truncate max-w-[160px]">{appointment.title}</p>
        {appointment.specialty && (
          <p className="text-[9px] font-medium text-zinc-400 uppercase tracking-wide mt-0.5 truncate max-w-[160px]">
            {appointment.specialty.name}
          </p>
        )}
      </td>

      {/* Status badge */}
      <td className="px-4 py-2.5">
        <AppointmentStatusMenu
          appointment={appointment}
          variant="list"
          onChangeStatus={onChangeStatus}
          onConfirm={onConfirm}
          onArrive={onArrive}
          onWaitingRoom={onWaitingRoom}
          onStart={onStart}
          onComplete={onComplete}
          onNoShow={onNoShow}
          onReschedule={onReschedule}
          onCancel={onCancel}
          onHistory={onMenuAction ? (item) => onMenuAction(item, "viewHistory") : undefined}
        />
      </td>

      {/* Situación (Balance status) */}
      <td className="px-4 py-2.5">
        {appointment.patient ? (
          appointment.patient.hasDebt ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9.5px] font-black text-white shadow-sm whitespace-nowrap">
              <DollarSign className="h-3 w-3 shrink-0 stroke-[3]" />
              No hay saldo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9.5px] font-black text-white shadow-sm whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3 shrink-0 stroke-[3]" />
              Hay saldo
            </span>
          )
        ) : (
          <span className="text-zinc-400 font-medium text-[10px]">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-center gap-1">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 whitespace-nowrap border ${primaryAction.style}`}
            >
              {primaryAction.label}
            </button>
          )}

          <AppointmentActionsMenu
            appointment={appointment}
            triggerVariant="list"
            placement="auto"
            onAction={handleMenuAction}
          />

          <div className="hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition active:scale-95"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-40 w-44 rounded-xl border border-zinc-200/80 bg-white p-1 shadow-xl ring-1 ring-black/5 text-xs animate-in fade-in-50 slide-in-from-bottom-2">
                <MenuBtn icon="📝" onClick={() => { onEdit(appointment); setMenuOpen(false); }}>Editar datos</MenuBtn>
                <MenuBtn icon="📅" onClick={() => { onReschedule(appointment); setMenuOpen(false); }}>Reagendar</MenuBtn>
                <hr className="border-zinc-100 my-1" />
                <MenuBtn icon="✔️" onClick={() => { onConfirm(appointment.id); setMenuOpen(false); }}>Confirmar</MenuBtn>
                <MenuBtn icon="🚗" onClick={() => { onArrive(appointment.id); setMenuOpen(false); }}>Llegó a clínica</MenuBtn>
                <MenuBtn icon="🛋️" onClick={() => { onWaitingRoom(appointment.id); setMenuOpen(false); }}>Pasar a sala</MenuBtn>
                <MenuBtn icon="🦷" onClick={() => { onStart(appointment.id); setMenuOpen(false); }}>Iniciar atención</MenuBtn>
                <MenuBtn icon="🎓" onClick={() => { onComplete(appointment.id); setMenuOpen(false); }}>Finalizar atención</MenuBtn>
                <MenuBtn icon="❌" onClick={() => { onNoShow(appointment.id); setMenuOpen(false); }}>No asistió</MenuBtn>
                <hr className="border-zinc-100 my-1" />
                <MenuBtn icon="⚠️" onClick={() => { onCancel(appointment); setMenuOpen(false); }} danger>Cancelar cita</MenuBtn>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Menu button atom ─────────────────────────────────────────────────────────

function MenuBtn({ icon, children, onClick, danger }: { icon: string; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
        danger ? "text-red-600 hover:bg-red-50" : "text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      <span>{icon}</span>
      <span className="text-[11px]">{children}</span>
    </button>
  );
}

// ─── Primary action logic ──────────────────────────────────────────────────────

function getPrimaryAction(
  status: AppointmentStatus,
  id: string,
  handlers: Pick<ActionHandlers, "onConfirm" | "onArrive" | "onWaitingRoom" | "onStart" | "onComplete">
): { label: string; onClick: () => void; style: string } | null {
  const { onConfirm, onArrive, onWaitingRoom, onStart, onComplete } = handlers;
  switch (status) {
    case "SCHEDULED":
    case "PENDING_CONFIRMATION":
      return { label: "Confirmar →", onClick: () => onConfirm(id), style: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" };
    case "CONFIRMED":
      return { label: "Llegó →", onClick: () => onArrive(id), style: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" };
    case "ARRIVED":
      return { label: "→ Sala", onClick: () => onWaitingRoom(id), style: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" };
    case "WAITING_ROOM":
      return { label: "▶ Iniciar", onClick: () => onStart(id), style: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100" };
    case "IN_PROGRESS":
      return { label: "✓ Finalizar", onClick: () => onComplete(id), style: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" };
    default:
      return null;
  }
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
