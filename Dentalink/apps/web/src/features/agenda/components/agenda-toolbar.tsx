import { useMemo, useRef, useState } from "react";
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
  Mail
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AgendaToolbarProps {
  view: "day" | "week" | "month" | "list";
  date: string;
  totalAppointments: number;
  onDateChange: (date: string) => void;
  onGoToday: () => void;
  onPrint: () => void;
  onEmail: () => void;
}

export function AgendaToolbar({ view, date, totalAppointments, onDateChange, onGoToday, onPrint, onEmail }: AgendaToolbarProps) {
  const shiftDate = (days: number) => onDateChange(addDays(date, days));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateInput(date));
  const datePickerRef = useRef<HTMLDivElement>(null);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const selectDate = (value: string) => {
    onDateChange(value);
    setVisibleMonth(parseDateInput(value));
    setDatePickerOpen(false);
  };

  return (
    <div className="relative z-40 flex flex-col xl:flex-row items-center justify-between bg-white/80 backdrop-blur-md border border-zinc-200/80 rounded-2xl shadow-sm mb-6 px-4 py-3 overflow-visible gap-4">
      {/* Left Section */}
      <div className="flex items-center gap-5">
        {/* Title & Badge */}
        <div className="flex items-center gap-3 pr-5 border-r border-zinc-200">
          <span className="text-zinc-800 font-semibold text-lg tracking-tight">Agenda</span>
          <span className="bg-cyan-50 text-cyan-700 border border-cyan-200/60 text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
            {totalAppointments} Citas
          </span>
        </div>

        {/* Navigation Tabs (Segmented Control Style) */}
        <div className="flex items-center gap-1.5 bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/50">
          <Link 
            to="/agenda/list"
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              view === "list" 
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50" 
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <List className="w-4 h-4" />
            Diaria
          </Link>

          <div className="relative group">
            <Link 
              to="/agenda/week"
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                view === "week" || view === "month"
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50" 
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
              )}
            >
              <LayoutTemplate className="w-4 h-4" />
              Semanal
              <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-50" />
            </Link>
          </div>

          <Link 
            to="/agenda/day"
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              view === "day" 
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50" 
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <Users className="w-4 h-4" />
            Diaria global
          </Link>

          <Link 
            to="/agenda/waiting-room"
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            Reprogramación
          </Link>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="flex h-9 w-9 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-200"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex h-9 min-w-[220px] items-center justify-center border-x border-zinc-200/80 px-3 text-sm font-semibold text-zinc-700">
            <span className="truncate">{formatAgendaDate(date)}</span>
          </div>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="flex h-9 w-9 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-200"
            aria-label="Dia siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="relative" ref={datePickerRef}>
          <button
            type="button"
            onClick={() => {
              setVisibleMonth(parseDateInput(date));
              setDatePickerOpen((open) => !open);
            }}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300"
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
                  <span key={dayLabel} className="py-1">{dayLabel}</span>
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
                      calendarDay.isCurrentMonth ? "text-zinc-700 hover:bg-cyan-50 hover:text-cyan-700" : "text-zinc-300 hover:bg-zinc-50",
                      calendarDay.value === date && "bg-brand-500 text-white hover:bg-brand-600 hover:text-white"
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
          className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300"
        >
          Hoy
        </button>

        {/* Print Button */}
        <button
          type="button"
          onClick={onPrint}
          className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300"
        >
          <Printer className="w-4 h-4 text-zinc-500" />
          Imprimir
          <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-zinc-400" />
        </button>

        {/* Mail Button */}
        <button
          type="button"
          onClick={onEmail}
          className="flex items-center justify-center bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300"
        >
          <Mail className="w-4 h-4 text-zinc-500" />
        </button>
      </div>
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
