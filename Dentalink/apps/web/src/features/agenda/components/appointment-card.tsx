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
          "relative flex h-full w-full cursor-pointer flex-col justify-start rounded-[var(--radius-sm)] border p-[var(--space-1)] transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:shadow-[var(--shadow-card-hover)]",
          menuOpen ? "z-[80] overflow-visible" : "z-0 overflow-hidden",
          palette.cardClass
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => onEdit(appointment)}
      >
        <div className={cn("flex items-center justify-between gap-1 h-full w-full", menuOpen ? "overflow-visible" : "overflow-hidden")}>
          {/* Dot Indicator */}
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[var(--radius-full)] ring-1 ring-[var(--bg-surface)]", palette.dotClass)} />
          
          {/* Patient Text */}
          <span className="flex-1 truncate text-[10px] font-semibold leading-tight text-[var(--text-primary)]">
            ({patientId.slice(0,5)}) {patientName.split(" ")[0]} {appointment.patient?.lastName.split(" ")[0] || ""}
          </span>
          
          {/* Icons */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <MessageSquare className="h-3 w-3 text-[var(--text-brand)]" />
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
                className="flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--bg-subtle)] p-0.5 text-[var(--text-primary)] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--border-default)]"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {menuOpen && (
                <div
                  className={cn(
                    "absolute right-0 z-[1000] max-h-80 w-56 overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] py-[var(--space-1)] text-[var(--text-xs)] font-medium text-[var(--text-primary)] shadow-[var(--shadow-modal)] animate-in fade-in-0 zoom-in-95",
                    compactMenuOpenUp ? "bottom-5" : "top-5"
                  )}
                >
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/treatments`); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--border-strong)]">
                    Ir a plan de tratamiento
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/payments`); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--border-strong)]">
                    Cobranza
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/profile`); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--border-strong)]">
                    Datos personales
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; navigate(`/patients/${appointment.patientId}/clinical`); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--border-strong)]">
                    Ir a la ficha clínica del paciente
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; window.location.href = `mailto:?subject=${encodeURIComponent(`Solicitud de datos - ${patientName}`)}`; setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--border-strong)]">
                    Enviar solicitud de datos por mail
                  </button>
                  <button disabled={!hasPatient} onClick={() => { if (!appointment.patientId) return; void navigator.clipboard?.writeText(`${window.location.origin}/patients/${appointment.patientId}/profile`); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--border-strong)]">
                    Copiar link para solicitar datos
                  </button>
                  
                  <div className="my-[var(--space-1)] border-t border-[var(--border-default)]"></div>
                  
                  <button onClick={() => { onEdit(appointment); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)]">
                    Modificar duracion
                  </button>
                  <button onClick={() => { onEdit(appointment); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)]">
                    Agregar comentario
                  </button>
                  <button onClick={() => { onReschedule(appointment); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)]">
                    Cambiar fecha
                  </button>
                  
                  {/* Status submenu replacement */}
                  <div className="mt-[var(--space-1)] w-full cursor-default border-t border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[9px] uppercase text-[var(--text-secondary)]">
                    Cambiar Estado
                  </div>
                  <button onClick={() => { onConfirm(appointment.id); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-1)] text-left text-[var(--status-success-text)] hover:bg-[var(--bg-subtle)]">Confirmar</button>
                  <button onClick={() => { onArrive(appointment.id); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-1)] text-left text-[var(--text-brand)] hover:bg-[var(--bg-subtle)]">Llego</button>
                  <button onClick={() => { onWaitingRoom(appointment.id); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-1)] text-left text-[var(--status-purple-text)] hover:bg-[var(--bg-subtle)]">En sala</button>
                  <button onClick={() => { onStart(appointment.id); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-1)] text-left text-[var(--text-brand-strong)] hover:bg-[var(--bg-subtle)]">Iniciar</button>
                  <button onClick={() => { onComplete(appointment.id); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-1)] text-left text-[var(--status-success-text)] hover:bg-[var(--bg-subtle)]">Finalizar</button>
                  <button onClick={() => { onNoShow(appointment.id); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-1)] text-left text-[var(--text-danger)] hover:bg-[var(--bg-subtle)]">Falta</button>
                  
                  <div className="my-[var(--space-1)] border-t border-[var(--border-default)]"></div>

                  <button onClick={() => { alert("Notificar por email"); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)]">
                    Notificar por e-mail
                  </button>
                  <button onClick={() => { alert("Ver historial"); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left hover:bg-[var(--bg-subtle)]">
                    Ver historial de cambios
                  </button>
                  <button onClick={() => { onCancel(appointment); setMenuOpen(false); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-left text-[var(--text-danger)] hover:bg-[var(--status-danger-bg)]">
                    Anular
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hover Tooltip */}
        {showTooltip && !menuOpen && (
          <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-2)] shadow-[var(--shadow-card-hover)] animate-in fade-in-0 zoom-in-95">
            {/* Arrow */}
            <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-[var(--border-default)] bg-[var(--bg-surface)]"></div>
            
            <div className="relative z-10 flex flex-col gap-0.5">
              <div className="text-[var(--text-xs)] font-semibold text-[var(--text-primary)]">
                {appointment.title.toUpperCase()} <span className="font-normal text-[var(--text-secondary)]">({appointment.chair?.name || "BOX 1"})</span>
              </div>
              <div className="mb-[var(--space-2)] border-b border-[var(--border-default)] pb-[var(--space-1)] text-[var(--text-xs)] text-[var(--text-secondary)]">
                {appointmentStatusLabel(appointment.status)}
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-primary)]">
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
    <article className={cn("relative flex h-full flex-col justify-between rounded-[var(--radius-lg)] border p-[var(--space-4)] text-[var(--text-xs)] transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]", palette.cardClass)}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-0.5 min-w-0">
          <p className="whitespace-nowrap text-[9px] font-medium text-[var(--text-secondary)]">
            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h4 className="truncate font-semibold leading-tight text-[var(--text-primary)]">
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
              className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] bg-transparent text-[var(--text-secondary)] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-default)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-6 z-30 w-48 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-[var(--space-1)] text-[var(--text-xs)] shadow-[var(--shadow-modal)] animate-in fade-in-50 slide-in-from-top-1 select-none">
                <div className="border-b border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-1)] text-[9px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Gestión de Cita
                </div>
                <div className="py-0.5 space-y-0.5">
                  <button onClick={() => { onEdit(appointment); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">Editar datos</button>
                  <button onClick={() => { onReschedule(appointment); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">Reagendar</button>
                </div>
                <div className="border-y border-[var(--border-default)] px-[var(--space-2)] py-[var(--space-1)] text-[9px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Actualizar Estado</div>
                <div className="py-0.5 space-y-0.5">
                  <button onClick={() => { onConfirm(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">Confirmar cita</button>
                  <button onClick={() => { onArrive(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">Llego a clinica</button>
                  <button onClick={() => { onWaitingRoom(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">Ingresar a sala</button>
                  <button onClick={() => { onStart(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">Iniciar atencion</button>
                  <button onClick={() => { onComplete(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">Finalizar atencion</button>
                  <button onClick={() => { onNoShow(appointment.id); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">No asistio</button>
                </div>
                <div className="mt-[var(--space-1)] border-t border-[var(--border-default)] pt-[var(--space-1)]">
                  <button onClick={() => { onCancel(appointment); setMenuOpen(false); }} className="flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[var(--text-xs)] font-semibold text-[var(--text-danger)] hover:bg-[var(--status-danger-bg)]">Cancelar cita</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-[var(--space-3)] space-y-1.5 text-[var(--text-xs)] font-normal text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Paciente:</span>
          <span className="truncate font-semibold text-[var(--text-primary)]">{patientName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Doctor:</span>
          <span className="truncate text-[var(--text-primary)]">{appointment.professional.firstName} {appointment.professional.lastName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-[9px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Sillon:</span>
          <span className="truncate text-[var(--text-secondary)]">{appointment.branch.name}{appointment.chair ? ` - ${appointment.chair.name}` : ""}</span>
        </div>
      </div>
    </article>
  );
}
