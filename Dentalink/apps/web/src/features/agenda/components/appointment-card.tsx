import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { Appointment } from "../services/appointments.service";
import { appointmentStatusLabel, appointmentStatusTone, appointmentColorPalette } from "./appointment-status";
import { MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function AppointmentCard({
  appointment,
  compact = false,
  onEdit,
  onCancel,
  onReschedule,
  onConfirm,
  onArrive,
  onWaitingRoom,
  onStart,
  onComplete,
  onNoShow
}: {
  appointment: Appointment;
  compact?: boolean;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onConfirm: (id: string) => void;
  onArrive: (id: string) => void;
  onWaitingRoom: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [compactMenuOpenUp, setCompactMenuOpenUp] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const patientName = appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "Bloqueo Clínico";
  const patientId = appointment.patient?.id || "N/A";
  const hasPatient = Boolean(appointment.patientId);

  // Auto-close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const palette = appointmentColorPalette[appointment.status] || appointmentColorPalette.SCHEDULED;

  if (compact) {
    return (
      <div 
        ref={cardRef}
        className={cn(
          "relative h-full w-full rounded-sm border p-1 transition-all duration-200 hover:shadow-sm cursor-pointer flex flex-col justify-start",
          menuOpen ? "z-[80] overflow-visible" : "z-0 overflow-hidden",
          palette.cardClass
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => onEdit(appointment)}
      >
        <div className={cn("flex items-center justify-between gap-1 h-full w-full", menuOpen ? "overflow-visible" : "overflow-hidden")}>
          {/* Dot Indicator */}
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/80", palette.dotClass)} />
          
          {/* Patient Text */}
          <span className="text-[10px] font-semibold text-zinc-900 truncate flex-1 leading-tight">
            ({patientId.slice(0,5)}) {patientName.split(" ")[0]} {appointment.patient?.lastName.split(" ")[0] || ""}
          </span>
          
          {/* Icons */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <MessageSquare className="w-3 h-3 text-[#428bca]" />
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setCompactMenuOpenUp(rect.bottom + 340 > window.innerHeight && rect.top > 340);
                  setMenuOpen(!menuOpen);
                  setShowTooltip(false);
                }}
                className="flex items-center justify-center rounded-full bg-zinc-900/10 hover:bg-zinc-900/20 text-zinc-800 p-0.5 transition"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {menuOpen && (
                <div
                  className={cn(
                    "absolute right-0 z-[1000] max-h-80 w-56 overflow-y-auto overscroll-contain rounded border border-gray-200 bg-white py-1 shadow-xl ring-1 ring-black/5 text-[11px] font-medium text-gray-700 animate-in fade-in-0 zoom-in-95",
                    compactMenuOpenUp ? "bottom-5" : "top-5"
                  )}
                >
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/treatments`); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
                    Ir a plan de tratamiento
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/payments`); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
                    Cobranza
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/profile`); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
                    Datos personales
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/clinical`); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
                    Ir a la ficha clínica del paciente
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; window.location.href = `mailto:?subject=${encodeURIComponent(`Solicitud de datos - ${patientName}`)}`; setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
                    Enviar solicitud de datos por mail
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; void navigator.clipboard?.writeText(`${window.location.origin}/patients/${appointment.patientId}/profile`); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300">
                    Copiar link para solicitar datos
                  </button>
                  
                  <div className="my-1 border-t border-gray-200"></div>
                  
                  <button onClick={() => { onEdit(appointment); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100">
                    Modificar duracion
                  </button>
                  <button onClick={() => { onEdit(appointment); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100">
                    Agregar comentario
                  </button>
                  <button onClick={() => { onReschedule(appointment); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100">
                    Cambiar fecha
                  </button>
                  
                  {/* Status submenu replacement */}
                  <div className="w-full text-left px-3 py-1.5 text-gray-400 cursor-default uppercase text-[9px] mt-1 border-t border-gray-100 pt-2">
                    Cambiar Estado
                  </div>
                  <button onClick={() => { onConfirm(appointment.id); setMenuOpen(false); }} className="w-full text-left px-3 py-1 hover:bg-gray-100 text-emerald-700">✔️ Confirmar</button>
                  <button onClick={() => { onArrive(appointment.id); setMenuOpen(false); }} className="w-full text-left px-3 py-1 hover:bg-gray-100 text-indigo-700">🚗 Llegó</button>
                  <button onClick={() => { onWaitingRoom(appointment.id); setMenuOpen(false); }} className="w-full text-left px-3 py-1 hover:bg-gray-100 text-purple-700">🛋️ En Sala</button>
                  <button onClick={() => { onStart(appointment.id); setMenuOpen(false); }} className="w-full text-left px-3 py-1 hover:bg-gray-100 text-cyan-700">🦷 Iniciar</button>
                  <button onClick={() => { onComplete(appointment.id); setMenuOpen(false); }} className="w-full text-left px-3 py-1 hover:bg-gray-100 text-emerald-700">🎓 Finalizar</button>
                  <button onClick={() => { onNoShow(appointment.id); setMenuOpen(false); }} className="w-full text-left px-3 py-1 hover:bg-gray-100 text-red-600">❌ Falta</button>
                  
                  <div className="my-1 border-t border-gray-200"></div>

                  <button onClick={() => { alert("Notificar por email"); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100">
                    Notificar por e-mail
                  </button>
                  <button onClick={() => { alert("Ver historial"); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-gray-100">
                    Ver historial de cambios
                  </button>
                  <button onClick={() => { onCancel(appointment); setMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600">
                    Anular
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hover Tooltip - Estilo Dentalink Imagen 2 */}
        {showTooltip && !menuOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 w-64 rounded bg-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-gray-200 p-2 animate-in fade-in-0 zoom-in-95 pointer-events-none">
            {/* Arrow */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45"></div>
            
            <div className="relative z-10 flex flex-col gap-0.5">
              <div className="text-[11px] font-bold text-gray-700">
                {appointment.title.toUpperCase()} <span className="text-gray-400 font-normal">({appointment.chair?.name || "BOX 1"})</span>
              </div>
              <div className="text-[11px] text-gray-500 mb-2 border-b border-gray-100 pb-1.5">
                {appointmentStatusLabel(appointment.status)}
              </div>
              <div className="text-[11px] text-gray-800">
                ({patientId.slice(0,5)}) {patientName.toUpperCase()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STANDARD (Not compact) MODE
  return (
    <article className={cn("relative rounded-lg border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 shadow-sm h-full flex flex-col justify-between p-4 text-xs", palette.cardClass)}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[9px] font-medium text-zinc-500/90 whitespace-nowrap">
            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h4 className="font-semibold text-zinc-900 tracking-tight leading-tight truncate">
            {appointment.title}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge value={appointmentStatusLabel(appointment.status)} tone={appointmentStatusTone(appointment.status)} />
          
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="flex h-5 w-5 items-center justify-center rounded bg-transparent text-zinc-400 hover:bg-zinc-100/60 hover:text-zinc-700 transition active:scale-95"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-6 z-30 w-48 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in-50 slide-in-from-top-1 text-xs select-none">
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                  Gestión de Cita
                </div>
                <div className="py-0.5 space-y-0.5">
                  <button onClick={() => { onEdit(appointment); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">📝 Editar Datos</button>
                  <button onClick={() => { onReschedule(appointment); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">📅 Reagendar</button>
                </div>
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 border-t border-b border-zinc-100">Actualizar Estado</div>
                <div className="py-0.5 space-y-0.5">
                  <button onClick={() => { onConfirm(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">✔️ Confirmar Cita</button>
                  <button onClick={() => { onArrive(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">🚗 Llegó a Clínica</button>
                  <button onClick={() => { onWaitingRoom(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">🛋️ Ingresar a Sala</button>
                  <button onClick={() => { onStart(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">🦷 Iniciar Atención</button>
                  <button onClick={() => { onComplete(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">🎓 Finalizar Atención</button>
                  <button onClick={() => { onNoShow(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">❌ No asistió (Falta)</button>
                </div>
                <div className="border-t border-zinc-100 pt-1 mt-1">
                  <button onClick={() => { onCancel(appointment); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700">⚠️ Cancelar Cita</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3.5 space-y-1.5 text-[11px] font-normal text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-400 uppercase font-medium tracking-wider shrink-0 w-12">Paciente:</span>
          <span className="text-zinc-800 font-semibold truncate">{patientName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-400 uppercase font-medium tracking-wider shrink-0 w-12">Doctor:</span>
          <span className="text-zinc-700 truncate">{appointment.professional.firstName} {appointment.professional.lastName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-400 uppercase font-medium tracking-wider shrink-0 w-12">Sillón:</span>
          <span className="text-zinc-600 truncate">{appointment.branch.name}{appointment.chair ? ` • ${appointment.chair.name}` : ""}</span>
        </div>
      </div>
    </article>
  );
}
