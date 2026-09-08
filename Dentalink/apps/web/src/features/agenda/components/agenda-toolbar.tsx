import { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  List,
  LayoutTemplate,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Printer,
  Mail,
  Search,
  BellRing
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_ROUTES } from "@/lib/routes";

interface AgendaToolbarProps {
  view: "day" | "week" | "month" | "list" | "reprogramming" | "reminders";
  date: string;
  totalAppointments: number;
  onDateChange: (date: string) => void;
  onGoToday: () => void;
  onPrint?: () => void;
  onSelectPrintProfessional?: (professionalId: string | "ALL") => void;
  professionals?: { id: string; firstName: string; lastName: string }[];
  onEmail: () => void;
  showDateControls?: boolean;
  showOverbookingOnly?: boolean;
  onShowOverbookingOnlyChange?: (value: boolean) => void;
}

export function AgendaToolbar({
  view,
  date,
  totalAppointments,
  onDateChange,
  onGoToday,
  onPrint,
  onSelectPrintProfessional,
  professionals = [],
  onEmail,
  showDateControls = true,
  showOverbookingOnly = false,
  onShowOverbookingOnlyChange
}: AgendaToolbarProps) {
  const shiftDate = (days: number) => onDateChange(addDays(date, days));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const [printSearch, setPrintSearch] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateInput(date));
  const datePickerRef = useRef<HTMLDivElement>(null);
  const printDropdownRef = useRef<HTMLDivElement>(null);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (printDropdownRef.current && !printDropdownRef.current.contains(event.target as Node)) {
        setPrintDropdownOpen(false);
      }
    }
    if (printDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [printDropdownOpen]);

  const filteredPrintProfessionals = useMemo(() => {
    if (!printSearch.trim()) return professionals;
    const q = printSearch.toLowerCase();
    return professionals.filter(
      (p) =>
        `${p.lastName} ${p.firstName}`.toLowerCase().includes(q) ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
  }, [professionals, printSearch]);

  const selectDate = (value: string) => {
    onDateChange(value);
    setVisibleMonth(parseDateInput(value));
    setDatePickerOpen(false);
  };

  return (
    <div className="relative z-40 mb-5 flex min-w-0 flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 px-3 py-3 shadow-sm backdrop-blur-md xl:flex-row xl:items-center xl:justify-between xl:gap-4">
      {/* Left Section: Title + Navigation Tabs */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:flex-1">
        {/* Title & Badge */}
        <div className="flex shrink-0 items-center gap-2 sm:border-r sm:border-zinc-200 sm:pr-3">
          <span className="text-zinc-800 font-bold text-base tracking-tight whitespace-nowrap">Agenda</span>
          <span className="bg-cyan-50 text-cyan-700 border border-cyan-200/60 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
            {totalAppointments} Citas
          </span>
        </div>

        {/* Navigation Tabs (Segmented Control Style) */}
        <div className="grid min-w-0 grid-cols-5 items-center gap-0.5 rounded-xl border border-zinc-200/60 bg-zinc-100/90 p-0.5 sm:flex sm:w-auto">
          <Link
            to={APP_ROUTES.agenda.list}
            aria-label="Vista diaria"
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200 whitespace-nowrap sm:px-2.5",
              view === "list"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <List className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Diaria</span>
          </Link>

          <div className="group relative min-w-0">
            <Link
              to={APP_ROUTES.agenda.week}
              aria-label="Vista semanal"
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200 whitespace-nowrap sm:px-2.5",
                view === "week" || view === "month"
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
              )}
            >
              <LayoutTemplate className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Semanal</span>
              <ChevronDown className="ml-0.5 hidden h-3 w-3 shrink-0 opacity-50 sm:block" />
            </Link>
          </div>

          <Link
            to={APP_ROUTES.agenda.day}
            aria-label="Vista diaria global"
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200 whitespace-nowrap sm:px-2.5",
              view === "day"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Diaria global</span>
          </Link>

          <Link
            to={APP_ROUTES.agenda.reprogramming}
            aria-label="Reprogramación"
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200 whitespace-nowrap sm:px-2.5",
              view === "reprogramming"
                ? "bg-white text-amber-700 shadow-sm ring-1 ring-amber-200/80"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Reprogramación</span>
          </Link>

          <Link
            to={APP_ROUTES.agenda.reminders}
            aria-label="Recordatorios automáticos"
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200 whitespace-nowrap sm:px-2.5",
              view === "reminders"
                ? "bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-200/80"
                : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"
            )}
          >
            <BellRing className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Recordatorios</span>
          </Link>
        </div>
      </div>

      {/* Right Section: Toggle + Date Controls + Actions */}
      {showDateControls ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:shrink-0 xl:justify-end">
          {view === "day" && onShowOverbookingOnlyChange && (
            <label className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100/90 hover:bg-zinc-200/70 rounded-lg border border-zinc-200/80 cursor-pointer transition-colors shrink-0 whitespace-nowrap">
              <input
                type="radio"
                checked={showOverbookingOnly}
                onChange={() => onShowOverbookingOnlyChange(!showOverbookingOnly)}
                onClick={() => onShowOverbookingOnlyChange(!showOverbookingOnly)}
                className="w-3.5 h-3.5 text-cyan-600 bg-white border-zinc-300 focus:ring-cyan-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-zinc-700 whitespace-nowrap select-none">
                Mostrar Sobre Agendamiento
              </span>
            </label>
          )}

          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-zinc-200/80 bg-white shadow-sm sm:flex-none">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="flex h-8 w-8 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 focus:outline-none"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-8 min-w-0 flex-1 items-center justify-center border-x border-zinc-200/80 px-2 text-xs font-bold text-zinc-700 whitespace-nowrap sm:min-w-[170px]">
              <span className="truncate" title={formatAgendaDate(date)}>
                {formatAgendaDate(date)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="flex h-8 w-8 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 focus:outline-none"
              aria-label="Dia siguiente"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative shrink-0" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => {
                setVisibleMonth(parseDateInput(date));
                setDatePickerOpen((open) => !open);
              }}
              className="flex items-center gap-1.5 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all shadow-sm outline-none hover:border-zinc-300 whitespace-nowrap h-8"
            >
              <CalendarIcon className="w-4 h-4 text-zinc-500" />
              Fecha
            </button>

            {datePickerOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold text-zinc-900">{formatMonthYear(visibleMonth)}</span>
                  <button
                    type="button"
                    onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-zinc-400">
                  {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((dayLabel) => (
                    <span key={dayLabel} className="py-1">
                      {dayLabel}
                    </span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendarDays.map((calendarDay) => (
                    <button
                      type="button"
                      key={calendarDay.value}
                      onClick={() => selectDate(calendarDay.value)}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                        calendarDay.isCurrentMonth
                          ? "text-zinc-700 hover:bg-cyan-50 hover:text-cyan-700"
                          : "text-zinc-300 hover:bg-zinc-50",
                        calendarDay.value === date &&
                          "bg-brand-500 text-white hover:bg-brand-600 hover:text-white"
                      )}
                    >
                      {calendarDay.day}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onGoToday}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300 shrink-0 whitespace-nowrap"
          >
            Hoy
          </button>

          {/* Print Button Dropdown */}
          <div className="relative shrink-0" ref={printDropdownRef}>
            <button
              type="button"
              onClick={() => setPrintDropdownOpen((prev) => !prev)}
              aria-label="Opciones de impresión"
              className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300 whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-zinc-500" />
              <span className="hidden sm:inline">Imprimir</span>
              <ChevronDown
                className={`w-3.5 h-3.5 ml-0.5 text-zinc-400 transition-transform ${printDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {printDropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition"
                  onClick={() => {
                    if (onSelectPrintProfessional) {
                      onSelectPrintProfessional("ALL");
                    } else if (onPrint) {
                      onPrint();
                    }
                    setPrintDropdownOpen(false);
                  }}
                >
                  <span>Todos los profesionales</span>
                </button>

                <div className="my-1 border-t border-zinc-100 px-1 py-1">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      value={printSearch}
                      onChange={(e) => setPrintSearch(e.target.value)}
                      placeholder=""
                      className="w-full rounded-md border border-zinc-200 bg-zinc-50 pl-8 pr-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-cyan-500 focus:bg-white focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {filteredPrintProfessionals.map((prof) => (
                    <button
                      key={prof.id}
                      type="button"
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs text-zinc-700 hover:bg-cyan-50 hover:text-cyan-800 transition"
                      onClick={() => {
                        if (onSelectPrintProfessional) {
                          onSelectPrintProfessional(prof.id);
                        } else if (onPrint) {
                          onPrint();
                        }
                        setPrintDropdownOpen(false);
                      }}
                    >
                      <span className="truncate font-medium">
                        Dr(a). {prof.lastName}, {prof.firstName}
                      </span>
                    </button>
                  ))}

                  {filteredPrintProfessionals.length === 0 && (
                    <div className="py-3 text-center text-xs text-zinc-400 italic">
                      Sin doctores encontrados
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mail Button */}
          <button
            type="button"
            onClick={onEmail}
            className="flex items-center justify-center bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300 shrink-0"
          >
            <Mail className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function addDays(value: string, days: number) {
  const date = parseDateInput(value);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAgendaDate(value: string) {
  const date = parseDateInput(value);
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cursor = new Date(firstDay);
  cursor.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, () => {
    const date = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);

    return {
      day: date.getDate(),
      value: toDateInputValue(date),
      isCurrentMonth: date.getMonth() === monthDate.getMonth()
    };
  });
}
