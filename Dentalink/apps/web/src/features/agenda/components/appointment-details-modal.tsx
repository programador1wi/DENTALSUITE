import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  CalendarDays, 
  Clock, 
  CreditCard, 
  FileText, 
  History, 
  Mail, 
  MessageSquare, 
  ShieldAlert, 
  User, 
  Link as LinkIcon,
  XCircle,
  Stethoscope,
  Activity,
  ChevronDown,
  Lightbulb
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import { http } from "@/lib/api/http-client";
import { appointmentStatusLabel, appointmentColorPalette } from "./appointment-status";
import { useAppointments } from "../hooks/use-appointments";
import type { Appointment } from "../services/appointments.service";
import type { AppointmentMenuAction } from "./appointment-actions-menu";

interface AttendanceStats {
  patientId: string;
  sampleSize: number;
  totals: {
    attended: number;
    rescheduled: number;
    noShow: number;
    totalValid: number;
  };
  probabilities: {
    attended: number;
    rescheduled: number;
    noShow: number;
  };
  confidence: "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH";
  recentAppointments: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
    outcome: "ATTENDED" | "RESCHEDULED" | "NO_SHOW";
  }[];
}

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: AppointmentMenuAction) => void;
}

export function AppointmentDetailsModal({
  appointment,
  open,
  onOpenChange,
  onAction,
}: AppointmentDetailsModalProps) {
  const navigate = useNavigate();
  const hasPatient = Boolean(appointment.patientId);

  // Fetch Attendance Statistics when modal is open and has patient
  const { data: stats, isLoading: isLoadingStats, isError: isErrorStats } = useQuery({
    queryKey: ["appointments", "attendance-stats", appointment.patientId],
    queryFn: async () => {
      const response = await http.get<AttendanceStats>(`/appointments/patient/${appointment.patientId}/attendance-stats`);
      return response.data;
    },
    enabled: open && hasPatient,
    staleTime: 5 * 60 * 1000,
  });

  const handleAction = (action: AppointmentMenuAction) => {
    onAction(action);
    // Note: Do not close this details modal automatically if we just open a secondary modal over it, 
    // unless the UX demands it. Since this is the control panel, keep it open or let the parent decide.
  };

  const goToPatientRoute = (path: string) => {
    if (!appointment.patientId) return;
    navigate(path);
    onOpenChange(false);
  };

  const copyDataRequestLink = async () => {
    if (!appointment.patientId) return;
    const link = `${window.location.origin}/patients/${appointment.patientId}/profile`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado");
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Link copiado");
    }
  };

  const palette = appointmentColorPalette[appointment.status] || appointmentColorPalette.SCHEDULED;
  const patientName = appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : "Bloqueo Clínico";
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const timeRange = `${start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })} - ${end.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

  const isHighRisk = stats && (stats.probabilities.noShow + stats.probabilities.rescheduled) > 40 && ["MEDIUM", "HIGH"].includes(stats.confidence);

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Gestión de Cita"
      size="3xl"
    >
      <div className="flex flex-col gap-5">
        {/* COMPACT RESPONSIVE HEADER */}
        <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border p-3.5 shadow-xs", palette.cardClass)}>
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-xs", palette.dotClass)} style={appointment.professional?.color ? { backgroundColor: appointment.professional.color } : {}}>
              <User className="h-5 w-5 text-white/90" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">{patientName}</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-slate-600 text-xs mt-0.5">
                <span className="font-semibold bg-white/60 px-1.5 py-0.5 rounded border border-white/30 truncate max-w-[180px]">{appointment.title}</span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="font-medium flex items-center gap-1 text-[11px]"><Clock className="w-3 h-3 text-slate-500"/> {timeRange}</span>
              </div>
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5">
            <span className={cn("px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md shadow-2xs border border-slate-200/60", palette.cardClass)}>
              {appointmentStatusLabel(appointment.status)}
            </span>
            <span className="text-[10px] font-semibold text-slate-600 bg-white/70 px-2 py-0.5 rounded border border-slate-200/60">
              Box: {appointment.chair?.name || "No asignado"}
            </span>
          </div>
        </div>

        {/* 2 COLUMN DENSE LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: ACTIONS */}
          <div className="flex flex-col gap-4">
            
            {/* Patient Actions */}
            <div>
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2 pl-1">Paciente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/treatments`)} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:pointer-events-none text-left shadow-sm">
                  <Stethoscope className="h-4 w-4 text-brand-500 group-hover:scale-110 transition-transform shrink-0" /> Plan de Tratamiento
                </button>
                <button type="button" disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/clinical`)} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:pointer-events-none text-left shadow-sm">
                  <Activity className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform shrink-0" /> Ficha Clínica
                </button>
                <button type="button" disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/payments`)} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:pointer-events-none text-left shadow-sm">
                  <CreditCard className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" /> Cobranza
                </button>
                <button type="button" disabled={!hasPatient} onClick={() => goToPatientRoute(`/patients/${appointment.patientId}/profile`)} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:pointer-events-none text-left shadow-sm">
                  <FileText className="h-4 w-4 text-slate-500 group-hover:scale-110 transition-transform shrink-0" /> Datos Personales
                </button>
              </div>
            </div>

            {/* Appointment Actions */}
            <div>
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2 pl-1">Cita</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => handleAction("changeStatus")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-amber-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 text-left shadow-sm">
                  <ShieldAlert className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform shrink-0" /> Cambiar Estado
                </button>
                <button type="button" onClick={() => handleAction("changeDate")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 text-left shadow-sm">
                  <CalendarDays className="h-4 w-4 text-indigo-500 group-hover:scale-110 transition-transform shrink-0" /> Cambiar Fecha
                </button>
                <button type="button" onClick={() => handleAction("modifyDuration")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 text-left shadow-sm">
                  <Clock className="h-4 w-4 text-sky-500 group-hover:scale-110 transition-transform shrink-0" /> Modificar Duración
                </button>
                <button type="button" onClick={() => handleAction("addComment")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 text-left shadow-sm">
                  <MessageSquare className="h-4 w-4 text-slate-500 group-hover:scale-110 transition-transform shrink-0" /> Comentario
                </button>
                <button type="button" onClick={() => handleAction("viewHistory")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 text-left shadow-sm">
                  <History className="h-4 w-4 text-slate-500 group-hover:scale-110 transition-transform shrink-0" /> Ver Historial
                </button>
                <button type="button" onClick={() => handleAction("cancel")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-red-200 bg-white hover:border-red-400 hover:bg-red-50 transition-all text-xs font-semibold text-red-700 text-left shadow-sm">
                  <XCircle className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform shrink-0" /> Anular Cita
                </button>
              </div>
            </div>

            {/* Communication Actions */}
            <div>
              <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2 pl-1">Comunicación</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button type="button" disabled={!hasPatient} onClick={() => handleAction("contactWhatsApp")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 transition-all text-xs font-semibold text-emerald-800 disabled:opacity-50 disabled:pointer-events-none text-left shadow-sm">
                  <MessageSquare className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" /> WhatsApp
                </button>
                <button type="button" disabled={!hasPatient} onClick={() => handleAction("requestDataEmail")} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:pointer-events-none text-left shadow-sm">
                  <Mail className="h-4 w-4 text-slate-500 group-hover:scale-110 transition-transform shrink-0" /> Solicitar Datos
                </button>
                <button type="button" disabled={!hasPatient} onClick={() => void copyDataRequestLink()} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 disabled:opacity-50 disabled:pointer-events-none text-left shadow-sm">
                  <LinkIcon className="h-4 w-4 text-slate-500 group-hover:scale-110 transition-transform shrink-0" /> Copiar Link
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: STATISTICS & HISTORY */}
          <div className="flex flex-col">
            <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2 pl-1">Inteligencia de Asistencia</h3>

            {!hasPatient ? (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-500 text-center h-full">
                <User className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">Bloqueo Clínico</p>
                <p className="text-xs mt-1">Sin métricas de asistencia.</p>
              </div>
            ) : isLoadingStats ? (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-500 text-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mb-3"></div>
                <p className="text-sm font-semibold text-slate-700">Analizando...</p>
              </div>
            ) : isErrorStats ? (
              <div className="flex flex-col items-center justify-center p-8 border border-red-200 bg-red-50/80 rounded-xl text-red-700 text-center h-full">
                <ShieldAlert className="h-8 w-8 text-red-400 mb-2" />
                <p className="text-sm font-bold text-red-800">Error de conexión</p>
              </div>
            ) : stats ? (
              <div className="flex flex-col gap-3">
                {isHighRisk && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 shadow-sm flex gap-3 items-start">
                    <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <strong className="block font-bold text-red-900 text-xs mb-0.5">Asesor de Sobreagendamiento</strong>
                      <p className="text-[11px] text-red-800 leading-tight">
                        Alta probabilidad matemática de inasistencia. Requiere confirmación.
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-none">Comportamiento</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{stats.sampleSize} citas previas</p>
                    </div>
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-black tracking-widest uppercase border self-start sm:self-auto",
                      stats.confidence === "HIGH" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      stats.confidence === "MEDIUM" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      stats.confidence === "LOW" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-slate-50 text-slate-600 border-slate-200"
                    )}>
                      Confianza {
                        stats.confidence === "HIGH" ? "ALTA" :
                        stats.confidence === "MEDIUM" ? "MEDIA" :
                        stats.confidence === "LOW" ? "BAJA" : "INSUFICIENTE"
                      }
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {/* Attended Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                        <span className="text-emerald-700">Asistencia Cumplida</span>
                        <span className="text-emerald-900">{stats.probabilities.attended}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${stats.probabilities.attended}%` }} />
                      </div>
                    </div>

                    {/* Rescheduled Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                        <span className="text-amber-700">Reagendamientos</span>
                        <span className="text-amber-900">{stats.probabilities.rescheduled}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-1000 ease-out" style={{ width: `${stats.probabilities.rescheduled}%` }} />
                      </div>
                    </div>

                    {/* No Show Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold mb-1.5">
                        <span className="text-red-700">Inasistencias</span>
                        <span className="text-red-900">{stats.probabilities.noShow}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 transition-all duration-1000 ease-out" style={{ width: `${stats.probabilities.noShow}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Intelligent Analysis Note */}
                <AttendanceAnalysisNote stats={stats} />

              </div>
            ) : null}
          </div>
        </div>

        {/* FULL WIDTH ACCORDION */}
        {appointment?.patientId ? <PatientAppointmentsAccordion patientId={appointment.patientId} /> : null}
      </div>
    </Modal>
  );
}

function PatientAppointmentsAccordion({ patientId }: { patientId: string }) {
  const { data: appointments = [], isLoading } = useAppointments({ patientId });

  if (isLoading) return <div className="p-4 text-center text-xs text-slate-500 animate-pulse">Cargando historial de citas...</div>;
  if (!appointments.length) return null;

  return (
    <details className="group border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden mt-2">
      <summary className="flex cursor-pointer items-center justify-between bg-slate-50 px-4 py-3 font-semibold text-slate-700 outline-none hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <span className="text-sm">Cronología Completa ({appointments.length})</span>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-200 overflow-x-auto max-h-[350px] overflow-y-auto custom-scrollbar">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10">
            <tr className="border-b border-slate-200 text-left font-bold uppercase tracking-wider text-slate-500 text-[9px]">
              <th className="px-4 py-3">Tratamiento</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Profesional</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Hora</th>
              <th className="px-4 py-3">Dur.</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {appointments.map((appt) => {
              const startAt = new Date(appt.startAt);
              const palette = appointmentColorPalette[appt.status] || appointmentColorPalette.SCHEDULED;
              return (
                <tr key={appt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {appt.treatmentPlan ? (
                      <div className="font-semibold text-[var(--action-primary)] truncate max-w-[140px]" title={appt.treatmentPlan.name}>
                        {appt.treatmentPlan.name}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                    {appt.branch?.name || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                    {appt.professional?.firstName} {appt.professional?.lastName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {startAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {startAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {appt.durationMinutes} min
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn("px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border shadow-sm", palette.cardClass)}>
                      {appointmentStatusLabel(appt.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Generates a contextual, intelligent analysis note based on attendance statistics.
 * Evaluates multiple behavioral signals: raw probabilities, recent streak patterns,
 * rescheduling-to-attendance conversion, confidence level, and sample size.
 */
function AttendanceAnalysisNote({ stats }: { stats: AttendanceStats }) {
  const analysis = generateAttendanceAnalysis(stats);

  const toneStyles = {
    positive: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      icon: "text-emerald-600",
      title: "text-emerald-900",
      text: "text-emerald-800",
      label: "PRONÓSTICO FAVORABLE",
      labelBg: "bg-emerald-100 text-emerald-700",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      icon: "text-amber-600",
      title: "text-amber-900",
      text: "text-amber-800",
      label: "REQUIERE ATENCIÓN",
      labelBg: "bg-amber-100 text-amber-700",
    },
    negative: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: "text-red-600",
      title: "text-red-900",
      text: "text-red-800",
      label: "ALTO RIESGO",
      labelBg: "bg-red-100 text-red-700",
    },
    neutral: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      icon: "text-slate-500",
      title: "text-slate-800",
      text: "text-slate-600",
      label: "DATOS INSUFICIENTES",
      labelBg: "bg-slate-100 text-slate-600",
    },
  };

  const tone = toneStyles[analysis.tone];

  return (
    <div className={cn("rounded-xl border p-3.5 shadow-sm", tone.bg, tone.border)}>
      <div className="flex gap-3 items-start">
        <Lightbulb className={cn("h-4 w-4 mt-0.5 shrink-0", tone.icon)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <strong className={cn("text-xs font-bold", tone.title)}>Análisis Predictivo</strong>
            <span className={cn("text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", tone.labelBg)}>
              {tone.label}
            </span>
          </div>
          <p className={cn("text-[11px] leading-relaxed", tone.text)}>
            {analysis.message}
          </p>
          {analysis.recommendation && (
            <p className={cn("text-[10px] mt-2 font-semibold italic", tone.text, "opacity-80")}>
              → {analysis.recommendation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface AnalysisResult {
  tone: "positive" | "warning" | "negative" | "neutral";
  message: string;
  recommendation: string | null;
}

function generateAttendanceAnalysis(stats: AttendanceStats): AnalysisResult {
  const { probabilities, confidence, sampleSize, recentAppointments, totals } = stats;

  // Insufficient data
  if (confidence === "INSUFFICIENT" || sampleSize <= 2) {
    return {
      tone: "neutral",
      message: `Este paciente tiene solo ${sampleSize} cita(s) registrada(s). No hay suficiente historial para generar un pronóstico confiable de asistencia.`,
      recommendation: "Se recomienda confirmar la cita por teléfono o WhatsApp como medida preventiva.",
    };
  }

  // Analyze recent streak (last 3-5 appointments)
  const recentOutcomes = recentAppointments.slice(0, 5).map((a) => a.outcome);
  const lastThree = recentOutcomes.slice(0, 3);

  const recentNoShowStreak = lastThree.every((o) => o === "NO_SHOW");
  const recentAllAttended = lastThree.every((o) => o === "ATTENDED");
  const hasRecentRescheduleThenAttend =
    recentOutcomes.length >= 2 &&
    recentOutcomes.some((o) => o === "RESCHEDULED") &&
    recentOutcomes.some((o) => o === "ATTENDED");

  // Did last appointment result in attendance after rescheduling history?
  const rescheduledThenAttended =
    totals.rescheduled > 0 && totals.attended > 0 && probabilities.attended > probabilities.noShow;

  // Case 1: Consecutive no-shows recently
  if (recentNoShowStreak) {
    return {
      tone: "negative",
      message: `Las últimas ${lastThree.length} citas de este paciente resultaron en inasistencia consecutiva. El patrón indica un riesgo muy alto (${probabilities.noShow}%) de que no se presente a esta cita.`,
      recommendation: "Confirmar obligatoriamente antes de reservar el espacio. Considerar sobreagendamiento controlado en este horario.",
    };
  }

  // Case 2: High no-show probability
  if (probabilities.noShow >= 50) {
    const reschedulingNote =
      totals.rescheduled > 0
        ? ` Ha reagendado ${totals.rescheduled} vez(es), lo que sugiere interés parcial pero dificultad para cumplir horarios.`
        : "";
    return {
      tone: "negative",
      message: `Probabilidad de inasistencia del ${probabilities.noShow}% basada en ${sampleSize} citas históricas.${reschedulingNote} Solo ha asistido efectivamente a ${totals.attended} de ${totals.totalValid} citas.`,
      recommendation: "Enviar recordatorio el día anterior y confirmar el mismo día. Evaluar si el horario o sucursal son convenientes para el paciente.",
    };
  }

  // Case 3: Reschedules frequently but tends to attend eventually
  if (rescheduledThenAttended && probabilities.rescheduled >= 20) {
    return {
      tone: "warning",
      message: `Este paciente tiende a reagendar (${probabilities.rescheduled}% de las veces), pero cuando confirma, generalmente asiste (${probabilities.attended}% de asistencia efectiva). De ${totals.totalValid} citas, ${totals.rescheduled} fueron reagendadas y ${totals.attended} cumplidas.`,
      recommendation: "Es probable que solicite cambio de fecha. Mantener flexibilidad en el horario y confirmar con anticipación.",
    };
  }

  // Case 4: Mixed signals - moderate no-show risk
  if (probabilities.noShow >= 30 && probabilities.noShow < 50) {
    const trendNote = hasRecentRescheduleThenAttend
      ? " Sin embargo, recientemente ha mostrado compromiso al reagendar y luego asistir."
      : "";
    return {
      tone: "warning",
      message: `Riesgo moderado de inasistencia (${probabilities.noShow}%). Asistencia histórica del ${probabilities.attended}% en ${sampleSize} citas.${trendNote}`,
      recommendation: "Enviar recordatorio automatizado y considerar confirmación telefónica.",
    };
  }

  // Case 5: Recent perfect attendance streak
  if (recentAllAttended && probabilities.attended >= 60) {
    return {
      tone: "positive",
      message: `Paciente altamente confiable. Ha asistido a sus últimas ${lastThree.length} citas consecutivas con una tasa de asistencia general del ${probabilities.attended}%. De ${totals.totalValid} citas históricas, ${totals.attended} fueron cumplidas exitosamente.`,
      recommendation: null,
    };
  }

  // Case 6: Good attendance overall
  if (probabilities.attended >= 50) {
    const caveat =
      totals.rescheduled > 0
        ? ` Aunque ha reagendado ${totals.rescheduled} vez(es) (${probabilities.rescheduled}%), la tendencia general es positiva.`
        : "";
    return {
      tone: "positive",
      message: `Pronóstico favorable de asistencia (${probabilities.attended}%).${caveat} De ${totals.totalValid} citas registradas, ${totals.attended} se completaron satisfactoriamente.`,
      recommendation: totals.rescheduled > 0 ? "Un recordatorio estándar debería ser suficiente." : null,
    };
  }

  // Fallback
  return {
    tone: "warning",
    message: `Comportamiento mixto. Asistencia del ${probabilities.attended}%, reagendamientos del ${probabilities.rescheduled}%, inasistencias del ${probabilities.noShow}% en ${sampleSize} citas analizadas.`,
    recommendation: "Se sugiere confirmar la cita directamente con el paciente.",
  };
}
