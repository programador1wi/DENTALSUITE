import { useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  CalendarCheck,
  TrendingUp,
  Percent,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { cn } from "@/lib/utils/cn";
import type { Appointment, AppointmentStatus } from "@/features/agenda/services/appointments.service";

interface PatientAppointmentsStatsProps {
  appointments: Appointment[];
}

const STATUS_COLORS = {
  COMPLETED: "#10b981", // Emerald / Atendida
  UPCOMING: "#0284c7", // Sky / Agendada
  NO_SHOW: "#ef4444", // Red / No asiste
  CANCELLED: "#94a3b8", // Slate / Cancelada
  RESCHEDULED: "#f59e0b" // Amber / Reagendada
};

const CANCELLED_STATUSES = new Set<AppointmentStatus>([
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "CANCELLED_CONFLICT",
  "CANCELLED_RESCHEDULED"
]);

const UPCOMING_STATUSES = new Set<AppointmentStatus>([
  "SCHEDULED",
  "CONFIRMED",
  "CONFIRMED_BY_WHATSAPP",
  "CONFIRMED_BY_PHONE",
  "CONFIRMED_BY_EMAIL",
  "PENDING_CONFIRMATION",
  "NOTIFIED_BY_WHATSAPP",
  "NOTIFIED_BY_EMAIL",
  "ARRIVED",
  "WAITING_ROOM",
  "IN_PROGRESS"
]);

type ConfidenceLevel = "INSUFFICIENT" | "LOW" | "MEDIUM" | "HIGH";

interface AnalysisResult {
  tone: "positive" | "warning" | "negative" | "neutral";
  overbookingAdvice: string;
  overbookingRecommendation: string;
  message: string;
  recommendation: string | null;
  confidence: ConfidenceLevel;
}

export function PatientAppointmentsStats({ appointments }: PatientAppointmentsStatsProps) {
  const stats = useMemo(() => {
    const total = appointments.length;
    let completed = 0;
    let noShow = 0;
    let cancelled = 0;
    let rescheduled = 0;
    let upcoming = 0;

    for (const appt of appointments) {
      if (appt.status === "COMPLETED") {
        completed++;
      } else if (appt.status === "NO_SHOW") {
        noShow++;
      } else if (CANCELLED_STATUSES.has(appt.status)) {
        cancelled++;
      } else if (appt.status === "RESCHEDULED") {
        rescheduled++;
      } else if (UPCOMING_STATUSES.has(appt.status)) {
        upcoming++;
      }
    }

    const resolved = completed + noShow;
    const attendanceRate = resolved > 0 ? Math.round((completed / resolved) * 100) : total > 0 ? Math.round((completed / total) * 100) : 0;
    const noShowRate = resolved > 0 ? Math.round((noShow / resolved) * 100) : 0;
    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const rescheduledRate = total > 0 ? Math.round((rescheduled / total) * 100) : 0;

    const chartData = [
      { name: "Atendidas", value: completed, color: STATUS_COLORS.COMPLETED },
      { name: "Próximas / Agendadas", value: upcoming, color: STATUS_COLORS.UPCOMING },
      { name: "Inasistencias", value: noShow, color: STATUS_COLORS.NO_SHOW },
      { name: "Canceladas", value: cancelled, color: STATUS_COLORS.CANCELLED },
      { name: "Reagendadas", value: rescheduled, color: STATUS_COLORS.RESCHEDULED }
    ].filter((item) => item.value > 0);

    // Calculate probabilities with Laplace smoothing for statistical intelligence
    const alpha = 1;
    const denom = completed + noShow + rescheduled + alpha * 3;
    const probAttended = Math.round(((completed + alpha) / denom) * 100);
    const probNoShow = Math.round(((noShow + alpha) / denom) * 100);
    const probRescheduled = Math.round(((rescheduled + alpha) / denom) * 100);

    // Confidence level based on history sample size
    const validCount = completed + noShow + rescheduled;
    let confidence: ConfidenceLevel = "INSUFFICIENT";
    if (validCount >= 8) confidence = "HIGH";
    else if (validCount >= 4) confidence = "MEDIUM";
    else if (validCount >= 2) confidence = "LOW";

    // Streak of recent resolved appointments
    const sorted = [...appointments]
      .filter((a) => a.status === "COMPLETED" || a.status === "NO_SHOW" || a.status === "RESCHEDULED")
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    
    const recentOutcomes = sorted.slice(0, 3).map((a) => a.status);
    const recentNoShowStreak = recentOutcomes.length >= 2 && recentOutcomes.every((s) => s === "NO_SHOW");
    const recentAttendedStreak = recentOutcomes.length >= 2 && recentOutcomes.every((s) => s === "COMPLETED");

    let analysis: AnalysisResult;

    if (confidence === "INSUFFICIENT" || validCount <= 1) {
      analysis = {
        tone: "neutral",
        overbookingAdvice: "Historial Insuficiente para Sobreagendamiento",
        overbookingRecommendation: "No hay suficiente historial para recomendar sobreagendamiento automático. Aplicar política estándar de confirmación.",
        message: `El paciente tiene solo ${validCount} cita(s) resuelta(s). No hay suficientes datos para proyectar un comportamiento estadístico confiable.`,
        recommendation: "Confirmar la cita por teléfono o WhatsApp antes de la fecha programada.",
        confidence
      };
    } else if (recentNoShowStreak || probNoShow >= 45) {
      analysis = {
        tone: "negative",
        overbookingAdvice: "Alto Riesgo de Inasistencia — Apto para Sobreagendamiento Controlado",
        overbookingRecommendation: `Probabilidad de inasistencia estimada en ${probNoShow}%. Se sugiere sobreagendar de forma controlada en su horario o exigir confirmación obligatoria previa.`,
        message: `El paciente presenta un patrón reiterado de inasistencia (${noShow} inasistencias de ${validCount} citas analizadas).`,
        recommendation: "Exigir confirmación el mismo día. Si no confirma 2 horas antes, habilitar el espacio en lista de espera.",
        confidence
      };
    } else if (rescheduledRate >= 30 || probRescheduled >= 30) {
      analysis = {
        tone: "warning",
        overbookingAdvice: "Riesgo Moderado por Reagendamientos Frecuentes",
        overbookingRecommendation: "Paciente con alta propensión a reprogramar. No sobreagendar directamente, pero prever flexibilidad en el bloque de agenda.",
        message: `Ha reagendado el ${rescheduledRate}% de sus citas (${rescheduled} veces). Aunque tiene interés, presenta dificultades para cumplir el horario original.`,
        recommendation: "Recordar la cita con 48h de anticipación para permitir cancelaciones o cambios tempranos.",
        confidence
      };
    } else if (recentAttendedStreak || probAttended >= 60 || attendanceRate >= 75) {
      analysis = {
        tone: "positive",
        overbookingAdvice: "Paciente Confiable — NO Sobreagendar",
        overbookingRecommendation: "Alta adherencia y puntualidad demostrada. No se recomienda sobreagendar en su horario para evitar conflictos en sala de espera.",
        message: `Tasa de asistencia del ${attendanceRate}% con ${completed} citas concluidas con éxito. Pronóstico altamente favorable.`,
        recommendation: "Mantener confirmación automatizada estándar.",
        confidence
      };
    } else {
      analysis = {
        tone: "warning",
        overbookingAdvice: "Comportamiento Mixto de Asistencia",
        overbookingRecommendation: "Asistencia moderada. Monitorear confirmación antes de autorizar citas dobles en el mismo sillón.",
        message: `Asistencia efectiva del ${attendanceRate}%, inasistencias del ${noShowRate}% en ${validCount} citas registradas.`,
        recommendation: "Confirmar vía WhatsApp 24 horas antes.",
        confidence
      };
    }

    return {
      total,
      completed,
      noShow,
      cancelled,
      rescheduled,
      upcoming,
      attendanceRate,
      noShowRate,
      cancellationRate,
      chartData,
      analysis
    };
  }, [appointments]);

  if (stats.total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">No hay citas registradas para generar estadísticas.</p>
      </div>
    );
  }

  const analysis = stats.analysis;

  const toneConfig = {
    positive: {
      cardBg: "bg-emerald-50/70 border-emerald-200 text-emerald-900",
      badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: ShieldCheck,
      iconColor: "text-emerald-600",
      label: "PRONÓSTICO FAVORABLE"
    },
    warning: {
      cardBg: "bg-amber-50/70 border-amber-200 text-amber-900",
      badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      label: "REQUIERE ATENCIÓN"
    },
    negative: {
      cardBg: "bg-red-50/70 border-red-200 text-red-900",
      badgeBg: "bg-red-100 text-red-800 border-red-200",
      icon: ShieldAlert,
      iconColor: "text-red-600",
      label: "ALTO RIESGO"
    },
    neutral: {
      cardBg: "bg-slate-50 border-slate-200 text-slate-800",
      badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
      icon: Info,
      iconColor: "text-slate-500",
      label: "DATOS INSUFICIENTES"
    }
  }[analysis.tone];

  const IconComponent = toneConfig.icon;

  return (
    <div className="space-y-4">
      {/* Advisor Legend / Overbooking Recommendation Banner */}
      <div className={cn("rounded-xl border p-4 shadow-xs transition-all", toneConfig.cardBg)}>
        <div className="flex items-start gap-3.5">
          <div className={cn("mt-0.5 rounded-lg p-2 bg-white/80 shadow-xs", toneConfig.iconColor)}>
            <IconComponent className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Asesor de Sobreagendamiento
                </span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black tracking-wider uppercase", toneConfig.badgeBg)}>
                  {toneConfig.label}
                </span>
              </div>
              <span className={cn(
                "rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase",
                analysis.confidence === "HIGH" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                analysis.confidence === "MEDIUM" ? "bg-blue-100 text-blue-800 border-blue-200" :
                analysis.confidence === "LOW" ? "bg-amber-100 text-amber-800 border-amber-200" :
                "bg-slate-100 text-slate-600 border-slate-200"
              )}>
                Confianza {
                  analysis.confidence === "HIGH" ? "ALTA" :
                  analysis.confidence === "MEDIUM" ? "MEDIA" :
                  analysis.confidence === "LOW" ? "BAJA" : "INSUFICIENTE"
                }
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              {analysis.overbookingAdvice}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              {analysis.overbookingRecommendation}
            </p>

            {analysis.recommendation && (
              <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-slate-200/60 text-xs font-medium text-slate-800">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span><strong>Acción recomendada:</strong> {analysis.recommendation}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-[11px] text-slate-400">citas</span>
          </div>
        </div>

        {/* Atendidas */}
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Atendidas</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-950">{stats.completed}</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              {stats.attendanceRate}%
            </span>
          </div>
        </div>

        {/* Inasistencias */}
        <div className="rounded-lg border border-red-100 bg-red-50/30 p-3 shadow-xs">
          <div className="flex items-center justify-between text-red-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">No Asistió</span>
            <XCircle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-red-950">{stats.noShow}</span>
            {stats.noShow > 0 ? (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                {stats.noShowRate}%
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">0%</span>
            )}
          </div>
        </div>

        {/* Canceladas */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Canceladas</span>
            <Clock className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{stats.cancelled}</span>
            <span className="text-[11px] text-slate-400">{stats.cancellationRate}%</span>
          </div>
        </div>

        {/* Reagendadas */}
        <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-3 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Reagendadas</span>
            <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-amber-950">{stats.rescheduled}</span>
          </div>
        </div>

        {/* Próximas */}
        <div className="rounded-lg border border-sky-100 bg-sky-50/30 p-3 shadow-xs">
          <div className="flex items-center justify-between text-sky-700">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Próximas</span>
            <CalendarCheck className="h-3.5 w-3.5 text-sky-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-sky-950">{stats.upcoming}</span>
          </div>
        </div>
      </div>

      {/* Chart and Breakdown Section */}
      <div className="grid grid-cols-1 items-center gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs md:grid-cols-12">
        {/* Donut Chart */}
        <div className="flex flex-col items-center justify-center md:col-span-5 lg:col-span-4">
          <div className="relative h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={66}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {stats.chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value ?? 0} citas (${Math.round(((Number(value) || 0) / stats.total) * 100)}%)`,
                    String(name ?? "")
                  ]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Stat */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-lg font-bold text-slate-800">{stats.attendanceRate}%</span>
              <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                Asistencia
              </span>
            </div>
          </div>
        </div>

        {/* Legend and Distribution Breakdown */}
        <div className="space-y-2 md:col-span-7 lg:col-span-8">
          <div className="mb-1.5 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--action-primary)]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Distribución de Estados
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {stats.chartData.map((item) => {
              const percentage = Math.round((item.value / stats.total) * 100);
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-700 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="font-bold text-slate-900">{item.value}</span>
                    <span className="text-[10px] text-slate-400">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
            <Percent className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>
              Tasa de cumplimiento calculada sobre <strong>{stats.completed + stats.noShow}</strong> citas concluidas.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
