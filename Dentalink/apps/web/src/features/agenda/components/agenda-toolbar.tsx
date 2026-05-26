import { Link } from "react-router-dom";
import { 
  List, 
  LayoutTemplate, 
  Users, 
  AlertTriangle, 
  ChevronDown, 
  Calendar as CalendarIcon, 
  Printer, 
  Mail, 
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AgendaToolbarProps {
  view: "day" | "week" | "month" | "list";
  totalAppointments: number;
  onCreateClick: () => void;
  onGoToday: () => void;
  onPrint: () => void;
  onEmail: () => void;
}

export function AgendaToolbar({ view, totalAppointments, onCreateClick, onGoToday, onPrint, onEmail }: AgendaToolbarProps) {
  return (
    <div className="flex flex-col xl:flex-row items-center justify-between bg-white/80 backdrop-blur-md border border-zinc-200/80 rounded-2xl shadow-sm mb-6 px-4 py-3 overflow-x-auto gap-4">
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
        {/* Split Button: Dar Cita */}
        <div className="flex items-center shadow-sm rounded-xl">
          <button 
            onClick={onCreateClick}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 text-sm font-medium rounded-l-xl transition-all border border-zinc-900 hover:border-zinc-800 focus:ring-2 focus:ring-zinc-900/20 outline-none"
          >
            <Plus className="h-4 w-4" />
            Dar cita
          </button>
          <div className="w-[1px] h-full bg-zinc-700/50"></div>
          <button className="flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 text-white px-2.5 py-2 text-sm rounded-r-xl transition-all border border-zinc-900 hover:border-zinc-800 focus:ring-2 focus:ring-zinc-900/20 outline-none">
            <ChevronDown className="w-4 h-4 opacity-80" />
          </button>
        </div>

        <div className="w-[1px] h-6 bg-zinc-200 mx-1"></div>

        {/* Date Button */}
        <button
          type="button"
          onClick={onGoToday}
          className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/80 px-3 py-2 text-sm font-medium rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-zinc-200 outline-none hover:border-zinc-300"
        >
          <CalendarIcon className="w-4 h-4 text-zinc-500" />
          Fecha
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
