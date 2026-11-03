import { EmptyState } from "@/components/feedback/empty-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import type { Schedule } from "@/features/settings/schedules/services/schedules.service";
import { CalendarDays, Clock, Plus, UserRound } from "lucide-react";
import { useState } from "react";

import { AppointmentCard } from "./appointment-card";
import type { AppointmentMenuAction } from "./appointment-actions-menu";
import {
  DEFAULT_AGENDA_END_HOUR,
  DEFAULT_AGENDA_SLOT_MINUTES,
  DEFAULT_AGENDA_START_HOUR,
  buildTimelineMarkersFromRange,
  buildTimeSlotsFromRange,
  getProfessionalBranchAgendaConfig,
  normalizeAgendaSlotMinutes,
  resolveAgendaTimelineRange,
  timeToMinutes
} from "../utils/agenda-grid-config";
import {
  addDays,
  appointmentToDayMinutes,
  buildTimeSlots,
  clampInt,
  formatDisplayTime,
  formatWeekDay,
  getAgendaSlotHeight,
  getAppointmentPlacement,
  getSlotButtonPlacement,
  getTimeRangePlacement,
  getWeekStart,
  parseDateInput,
  rangeOverlapsMinutes,
  rangeOverlapsTimeRange,
  slotRange,
  toDateInputValue
} from "./calendar-layout";

type CalendarProfessional = Pick<Professional, "id" | "firstName" | "lastName"> &
  Partial<Pick<Professional, "color" | "specialties" | "branches">>;

type CalendarCreateSlot = {
  professionalId: string;
  branchId?: string;
  chairId?: string;
  chairIndex?: number;
  allowOverbooking?: boolean;
  status?: AppointmentStatus;
  startAt: string;
  endAt: string;
};

type StatusActionState = { appointmentId: string; status: AppointmentStatus } | null;

function dayKey(value: string) {
  return toDateInputValue(new Date(value));
}
const DEFAULT_DAY_START_HOUR = DEFAULT_AGENDA_START_HOUR;
const DEFAULT_DAY_END_HOUR = DEFAULT_AGENDA_END_HOUR;
const DEFAULT_DAY_SLOT_MINUTES = DEFAULT_AGENDA_SLOT_MINUTES;
const FREE_APPOINTMENT_STATUSES = new Set<AppointmentStatus>([
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "NO_SHOW",
  "RESCHEDULED"
]);

export function CalendarView({
  appointments,
  date,
  view = "day",
  professionals = [],
  selectedProfessionalId = "",
  selectedBranchId = "",
  daySlotMinutes = DEFAULT_DAY_SLOT_MINUTES,
  dayStartHour = DEFAULT_DAY_START_HOUR,
  dayEndHour = DEFAULT_DAY_END_HOUR,
  schedules = [],
  density = "comfortable",
  showOverbookingOnly = false,
  onSelectProfessional,
  onCreateClick,
  onCreateSlotClick,
  onEdit,
  onCancel,
  onReschedule,
  onChangeStatus,
  onContactWhatsApp,
  onConfirm,
  onArrive,
  onWaitingRoom,
  onStart,
  onComplete,
  onNoShow,
  statusAction,
  onMenuAction
}: {
  appointments: Appointment[];
  date: string;
  view?: "day" | "week" | "month";
  professionals?: CalendarProfessional[];
  selectedProfessionalId?: string;
  selectedBranchId?: string;
  daySlotMinutes?: number;
  dayStartHour?: number;
  dayEndHour?: number;
  schedules?: Schedule[];
  density?: "comfortable" | "compact";
  showOverbookingOnly?: boolean;
  onSelectProfessional?: (professionalId: string) => void;
  onCreateClick?: () => void;
  onCreateSlotClick?: (slot: CalendarCreateSlot) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onChangeStatus?: (appointment: Appointment, status: AppointmentStatus) => void;
  onContactWhatsApp?: (appointment: Appointment) => void;
  onConfirm: (id: string) => void;
  onArrive: (id: string) => void;
  onWaitingRoom: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
  statusAction?: StatusActionState;
  onMenuAction?: (appointment: Appointment, action: AppointmentMenuAction) => void;
}) {
  const normalizedDaySlotMinutes = normalizeAgendaSlotMinutes(daySlotMinutes, DEFAULT_DAY_SLOT_MINUTES);
  const normalizedDayStartHour = clampInt(dayStartHour, 0, 23, DEFAULT_DAY_START_HOUR);
  const normalizedDayEndHour = clampInt(dayEndHour, 0, 23, DEFAULT_DAY_END_HOUR);
  const dayTimeSlots = buildTimeSlots(normalizedDayStartHour, normalizedDayEndHour, normalizedDaySlotMinutes, { endExclusive: true });
  const standardSlotHeight = getAgendaSlotHeight(normalizedDaySlotMinutes);
  const daySlotHeight = density === "compact"
    ? Math.max(20, Math.round(standardSlotHeight * 0.75))
    : standardSlotHeight;
  const fallbackTimelineStartMinutes = normalizedDayStartHour * 60;
  const fallbackTimelineEndMinutes = normalizedDayEndHour * 60;
  const [selectedWeeklyLane, setSelectedWeeklyLane] = useState<number | "OVERBOOKING">(1);

  if (view === "week") {
    const weekStart = getWeekStart(parseDateInput(date));
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index);
      return {
        date: day,
        key: toDateInputValue(day),
        label: formatWeekDay(day),
        shortLabel: day.toLocaleDateString("es-MX", { weekday: "short" }),
        count: 0
      };
    });
    const dayKeys = new Set(days.map((day) => day.key));
    const appointmentsInWeek = appointments.filter((appointment) => dayKeys.has(dayKey(appointment.startAt)));

    if (!selectedProfessionalId) {
      return (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-12 text-center flex flex-col items-center justify-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <UserRound className="h-6 w-6" />
          </div>
          <h4 className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">Selecciona un profesional</h4>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-sm">
            Por favor, selecciona un doctor en el filtro superior para visualizar su agenda semanal.
          </p>
        </div>
      );
    }

    const selectedProfessional =
      professionals.find((professional) => professional.id === selectedProfessionalId) ??
      appointmentsInWeek.find((appointment) => appointment.professionalId === selectedProfessionalId)?.professional;

    if (!selectedProfessional) {
      return <EmptyState title="Doctor no disponible" description="El doctor seleccionado no esta activo para esta sucursal." />;
    }

    const selectedAppointments = appointmentsInWeek.filter((appointment) => appointment.professionalId === selectedProfessional.id);
    const weeklySchedules = schedules.filter(
      (schedule) =>
        schedule.professionalId === selectedProfessional.id &&
        schedule.isActive &&
        (!selectedBranchId || schedule.branchId === selectedBranchId)
    );
    const maxWeeklyChairs = Math.max(1, ...weeklySchedules.map((schedule) => schedule.simultaneousChairs ?? 1));
    const effectiveWeeklyLane =
      selectedWeeklyLane === "OVERBOOKING" ? "OVERBOOKING" : Math.min(selectedWeeklyLane, maxWeeklyChairs);
    const weeklyChairTabs = Array.from({ length: maxWeeklyChairs }, (_, index) => index + 1);
    const appointmentsByDay = selectedAppointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
      const key = dayKey(appointment.startAt);
      acc[key] = [...(acc[key] ?? []), appointment];
      return acc;
    }, {});
    const totalTimelineHeight = dayTimeSlots.length * daySlotHeight;

    return (
      <div className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {weeklyChairTabs.map((chairIndex) => (
              <button
                key={chairIndex}
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  effectiveWeeklyLane === chairIndex
                    ? "bg-[var(--action-brand)] text-white"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                onClick={() => setSelectedWeeklyLane(chairIndex)}
              >
                Sillon {chairIndex}
              </button>
            ))}
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                effectiveWeeklyLane === "OVERBOOKING"
                  ? "bg-[var(--action-brand)] text-white"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              onClick={() => setSelectedWeeklyLane("OVERBOOKING")}
            >
              Sobreagendamiento
            </button>
          </div>

          {professionals.length > 0 && onSelectProfessional ? (
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-slate-500" />
              <select
                className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-cyan-500 focus:outline-none"
                value={selectedProfessionalId}
                onChange={(e) => onSelectProfessional(e.target.value)}
              >
                <option value="" disabled>Seleccionar doctor</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    Dr(a). {p.lastName}, {p.firstName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto" data-responsive-overflow="contained" aria-label="Calendario semanal desplazable">
          <div className="min-w-[980px]">
            <div
              className="grid border-b border-[var(--border-default)]/60 bg-[var(--bg-subtle)]/40"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))" }}
            >
              <div className="sticky left-0 z-30 flex h-20 items-center justify-center border-r border-[var(--border-default)] bg-[var(--bg-subtle)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                Hora
              </div>
              {days.map((day) => {
                const dayCount = appointmentsByDay[day.key]?.length ?? 0;
                const cleanShortLabel = day.shortLabel.replace(".", "").toUpperCase();

                return (
                  <div key={day.key} className="flex h-20 flex-col items-center justify-center border-r border-[var(--border-default)]/60 py-2 text-center last:border-r-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                      {cleanShortLabel}
                    </span>
                    <span className="text-xl font-black text-[var(--text-primary)] mt-0.5 leading-none">
                      {day.date.getDate()}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-zinc-100/80 px-2 py-0.5 text-[9px] font-bold text-zinc-500 mt-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      {dayCount} {dayCount === 1 ? "cita" : "citas"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))" }}
            >
              <div className="sticky left-0 z-20 border-r border-[var(--border-default)] bg-[var(--bg-subtle)]/80">
                {dayTimeSlots.map((time) => (
                  <div
                    key={time}
                    className="flex items-start justify-center border-b border-[var(--border-default)]/70 pt-1 text-[10px] font-medium text-[var(--text-secondary)]"
                    style={{ height: daySlotHeight }}
                  >
                    {time}
                  </div>
                ))}
              </div>

              {days.map((day) => {
                const daySchedule = weeklySchedules.find((schedule) => schedule.dayOfWeek === day.date.getDay());
                const selectedChairIndex = effectiveWeeklyLane === "OVERBOOKING" ? null : effectiveWeeklyLane;
                const dayAppointments = (appointmentsByDay[day.key] ?? []).filter((appointment) =>
                  effectiveWeeklyLane === "OVERBOOKING"
                    ? appointment.isOverbooking
                    : !appointment.isOverbooking && (appointment.chairIndex ?? 1) === selectedChairIndex
                );
                const dayBreaks = weeklySchedules.filter(
                  (schedule) =>
                    schedule.dayOfWeek === day.date.getDay() &&
                    schedule.breakStartTime &&
                    schedule.breakEndTime
                );

                return (
                  <div
                    key={day.key}
                    className="relative border-r border-[var(--border-default)] bg-[var(--bg-surface)] last:border-r-0"
                    style={{ height: totalTimelineHeight }}
                  >
                    {dayTimeSlots.flatMap((time, index) => {
                      const slotStartMinutes = timeToMinutes(time);
                      const slotEndMinutes = slotStartMinutes === null ? null : slotStartMinutes + normalizedDaySlotMinutes;
                      const scheduleStartMinutes = daySchedule ? timeToMinutes(daySchedule.startTime) : null;
                      const scheduleEndMinutes = daySchedule ? timeToMinutes(daySchedule.endTime) : null;
                      const normalLaneAvailable =
                        effectiveWeeklyLane !== "OVERBOOKING" &&
                        daySchedule &&
                        selectedChairIndex !== null &&
                        selectedChairIndex <= (daySchedule.simultaneousChairs ?? 1);
                      const insideSchedule =
                        slotStartMinutes !== null &&
                        slotEndMinutes !== null &&
                        scheduleStartMinutes !== null &&
                        scheduleEndMinutes !== null &&
                        slotStartMinutes >= scheduleStartMinutes &&
                        slotEndMinutes <= scheduleEndMinutes;
                      const overlapsBreak =
                        slotStartMinutes !== null &&
                        slotEndMinutes !== null &&
                        dayBreaks.some((schedule) =>
                          rangeOverlapsTimeRange(slotStartMinutes, slotEndMinutes, schedule.breakStartTime, schedule.breakEndTime)
                        );
                      const shouldRenderSlot =
                        effectiveWeeklyLane === "OVERBOOKING"
                          ? Boolean(daySchedule && insideSchedule && !overlapsBreak)
                          : Boolean(normalLaneAvailable && insideSchedule && !overlapsBreak);
                      if (!shouldRenderSlot) return [];

                      return [
                        <button
                          key={time}
                          type="button"
                          onClick={() => {
                            if (onCreateSlotClick) {
                              onCreateSlotClick({
                                professionalId: selectedProfessional.id,
                                branchId: selectedBranchId || undefined,
                                chairIndex: selectedChairIndex ?? undefined,
                                allowOverbooking: effectiveWeeklyLane === "OVERBOOKING",
                                ...slotRange(day.key, time, normalizedDaySlotMinutes)
                              });
                              return;
                            }
                            onCreateClick?.();
                          }}
                          className="group absolute left-0 right-0 border-b border-[var(--border-default)]/50 transition-colors hover:bg-[var(--bg-brand-light)]/40"
                          style={{ top: index * daySlotHeight, height: daySlotHeight }}
                        >
                          <span className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-md text-[var(--text-brand)] opacity-0 transition-opacity group-hover:opacity-100">
                            <Plus className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      ];
                    })}

                    {dayAppointments.map((appointment) => {
                      const placement = getAppointmentPlacement(appointment, {
                        startMinutes: fallbackTimelineStartMinutes,
                        endMinutes: fallbackTimelineEndMinutes,
                        slotMinutes: normalizedDaySlotMinutes,
                        slotHeight: daySlotHeight
                      });
                      if (!placement) return null;

                      return (
                        <div
                          key={appointment.id}
                          className="absolute z-10 px-1 transition-all has-[.menu-open]:z-[50] has-[.tooltip-open]:z-[40]"
                          style={{
                            top: placement.top,
                            height: placement.height,
                            left: 0,
                            right: 0
                          }}
                        >
                          {appointment.status === "BLOCKED" ? (
                            <BlockedAppointmentBlock appointment={appointment} compact={true} onCancel={onCancel} />
                          ) : (
                              <AppointmentCard
                                appointment={appointment}
                                compact={true}
                                pendingStatus={statusAction?.appointmentId === appointment.id ? statusAction.status : undefined}
                                onEdit={onEdit}
                              onCancel={onCancel}
                              onReschedule={onReschedule}
                              onChangeStatus={onChangeStatus}
                              onContactWhatsApp={onContactWhatsApp}
                              onConfirm={onConfirm}
                              onArrive={onArrive}
                              onWaitingRoom={onWaitingRoom}
                              onStart={onStart}
                              onComplete={onComplete}
                              onNoShow={onNoShow}
                              onMenuAction={onMenuAction}
                            />
                          )}
                        </div>
                      );
                    })}

                    {dayBreaks.map((schedule) => {
                      const placement = getTimeRangePlacement(schedule.breakStartTime!, schedule.breakEndTime!, {
                        startMinutes: fallbackTimelineStartMinutes,
                        endMinutes: fallbackTimelineEndMinutes,
                        slotMinutes: normalizedDaySlotMinutes,
                        slotHeight: daySlotHeight
                      });
                      if (!placement) return null;

                      return (
                        <BreakBlock
                          key={schedule.id}
                          top={placement.top}
                          height={placement.height}
                          range={`${schedule.breakStartTime} - ${schedule.breakEndTime}`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DAY VIEW: MULTI-PROFESSIONAL COLUMN GRID (SaaS Premium Redesign) ---
  if (view === "day") {
    const appointmentsForDate = appointments.filter((appointment) => dayKey(appointment.startAt) === date);
    const dayOfWeek = parseDateInput(date).getDay();
    const schedulesForDate = schedules.filter(
      (schedule) =>
        schedule.dayOfWeek === dayOfWeek &&
        schedule.isActive &&
        (!selectedBranchId || schedule.branchId === selectedBranchId) &&
        (!selectedProfessionalId || schedule.professionalId === selectedProfessionalId)
    );
    const displayProfessionals = selectedProfessionalId
      ? professionals.filter((p) => p.id === selectedProfessionalId)
      : professionals;

    if (displayProfessionals.length === 0) {
      return (
        <div className="space-y-4">
          <EmptyState 
            title="Sin doctores para agendar" 
            description="No hay doctores activos registrados para mostrar columnas en este día." 
          />
          {onCreateClick && (
            <div className="flex justify-center">
              <button 
                onClick={onCreateClick}
                className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white hover:bg-brand-600 shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
              >
                + Crear Nueva Cita
              </button>
            </div>
          )}
        </div>
      );
    }

    const displayProfessionalIds = new Set(displayProfessionals.map((professional) => professional.id));
    const daySchedules = schedulesForDate.filter((schedule) => displayProfessionalIds.has(schedule.professionalId));
    
    const displayColumns = showOverbookingOnly
      ? displayProfessionals.map((professional) => ({ professional, chairIndex: null, isOverbookingColumn: true }))
      : displayProfessionals.flatMap((professional) => {
          const professionalSchedules = daySchedules.filter((schedule) => schedule.professionalId === professional.id);
          const maxChairs = Math.max(1, ...professionalSchedules.map((schedule) => schedule.simultaneousChairs ?? 1));
          return Array.from({ length: maxChairs }, (_, index) => ({ professional, chairIndex: index + 1, isOverbookingColumn: false }));
        });
        
    const dayTimelineRange = resolveAgendaTimelineRange({
      schedules: daySchedules,
      fallbackStartHour: normalizedDayStartHour,
      fallbackEndHour: normalizedDayEndHour
    });
    const timelineScale = { slotMinutes: normalizedDaySlotMinutes, slotHeight: daySlotHeight };
    const dayScaleTimeSlots = buildTimeSlotsFromRange(
      dayTimelineRange.startMinutes,
      dayTimelineRange.endMinutes,
      normalizedDaySlotMinutes,
      { endExclusive: true }
    );
    const dayTimelineHeight = dayScaleTimeSlots.length * daySlotHeight;
    const hourAxisMarkers = buildTimelineMarkersFromRange(
      dayTimelineRange.startMinutes,
      dayTimelineRange.endMinutes,
      normalizedDaySlotMinutes,
      timelineScale,
      { endExclusive: true }
    );

    return (
      <div className="w-full space-y-4">
        {/* Responsive horizontal scroll shell for daily clinical columns (Option 2: Executive Card Columns) */}
        <div className="w-full">
          <div className="overflow-x-auto max-h-[calc(100vh-240px)] overflow-y-auto overscroll-contain custom-scrollbar p-1" data-responsive-overflow="contained" aria-label="Agenda por profesionales desplazable">
            <div className="flex gap-3.5 min-w-[700px] pb-2">
              {/* Columns list for each active professional as independent card columns */}
              {displayColumns.map(({ professional: prof, chairIndex, isOverbookingColumn }) => {
                const profApps = appointmentsForDate
                  .filter((a) => a.professionalId === prof.id && (isOverbookingColumn ? a.isOverbooking : (!a.isOverbooking && (a.chairIndex ?? 1) === chairIndex)))
                  .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
                const profAppsCount = profApps.length;
                const professionalAgenda = getProfessionalBranchAgendaConfig(prof, selectedBranchId, normalizedDaySlotMinutes);
                const professionalSchedules = daySchedules.filter((schedule) => schedule.professionalId === prof.id);
                const professionalSchedule = professionalSchedules[0];
                const scheduleStartMinutes = professionalSchedule ? timeToMinutes(professionalSchedule.startTime) : null;
                const scheduleEndMinutes = professionalSchedule ? timeToMinutes(professionalSchedule.endTime) : null;
                const professionalVisualMarkers = buildTimelineMarkersFromRange(
                  dayTimelineRange.startMinutes,
                  dayTimelineRange.endMinutes,
                  professionalAgenda.slotMinutes,
                  timelineScale,
                  { endExclusive: false }
                );

                const professionalTimeSlots =
                  professionalSchedule && scheduleStartMinutes !== null && scheduleEndMinutes !== null
                    ? buildTimeSlotsFromRange(scheduleStartMinutes, scheduleEndMinutes, professionalAgenda.slotMinutes, {
                        endExclusive: true
                      })
                    : [];
                const profBreaks = professionalSchedules.filter((schedule) => schedule.breakStartTime && schedule.breakEndTime);
                const busyAppointments = profApps.filter((appointment) => !FREE_APPOINTMENT_STATUSES.has(appointment.status));

                return (
                  <div 
                    key={`${prof.id}-${chairIndex}`} 
                    className="flex-1 min-w-[280px] sm:min-w-[320px] shrink-0 flex flex-col bg-white rounded-2xl border border-zinc-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    {/* Professional Info Column Header (Card Style) */}
                    <div
                      className="sticky top-0 h-11 bg-zinc-50/90 backdrop-blur-md border-b border-zinc-200/80 flex items-center z-20 shrink-0 overflow-hidden"
                      style={prof.color ? { borderTop: `3px solid ${prof.color}` } : undefined}
                    >
                      <div className="w-[44px] shrink-0 border-r border-zinc-200/70 bg-zinc-100/60 h-full flex items-center justify-center select-none">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div className="flex-1 flex items-center gap-1.5 px-3 py-1 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: prof.color || "#0f766e" }}
                            />
                            <p className="text-xs font-bold text-zinc-800 truncate">
                              {prof.firstName} {prof.lastName}
                            </p>
                            {isOverbookingColumn ? (
                              <span className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200/80 px-2 py-0.5 text-[9px] font-bold text-orange-700 shrink-0 select-none">
                                Sobreagendamiento
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-cyan-50 border border-cyan-200/70 px-2 py-0.5 text-[9px] font-bold text-cyan-800 shrink-0 select-none">
                                Sillón {chairIndex}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Slots under this doctor */}
                    <div className="relative shrink-0 overflow-hidden bg-slate-50/30" style={{ height: dayTimelineHeight + 10 }}>
                      {professionalVisualMarkers.map((marker) => {
                        return (
                          <div
                            key={marker.time}
                            className="absolute left-[44px] right-0 z-[1] border-b border-zinc-200/40"
                            style={{ top: marker.top }}
                          />
                        );
                      })}

                      {professionalVisualMarkers.map((marker) => {
                        const isFirst = marker.top === 0;
                        return (
                          <span
                            key={`time-${marker.time}`}
                            className="absolute left-0 w-[44px] text-center text-[9px] font-bold text-zinc-400 select-none tabular-nums"
                            style={{ top: isFirst ? 2 : marker.top - 6 }}
                          >
                            {marker.time}
                          </span>
                        );
                      })}

                      <div className="absolute top-0 bottom-0 left-[44px] border-l border-zinc-200/70 z-[2]" />

                      <div className="absolute top-0 bottom-0 left-[44px] right-0">
                          {professionalSchedules.map((schedule) => {
                            const placement = getTimeRangePlacement(schedule.startTime, schedule.endTime, {
                              startMinutes: dayTimelineRange.startMinutes,
                              endMinutes: dayTimelineRange.endMinutes,
                              slotMinutes: normalizedDaySlotMinutes,
                              slotHeight: daySlotHeight
                            });
                            if (!placement) return null;

                            return (
                              <HelpTooltip
                                key={`working-${schedule.id}`}
                                content={`Horario laboral ${schedule.startTime} - ${schedule.endTime}`}
                                position="right"
                                triggerClassName="absolute left-1 right-1 z-0 block"
                                triggerStyle={{ top: placement.top, height: placement.height }}
                              >
                                <div className="h-full w-full rounded-lg border border-[var(--border-default)] bg-[var(--status-success-bg)]/80 shadow-[inset_3px_0_0_var(--status-success-text)]" />
                              </HelpTooltip>
                            );
                          })}

                          {professionalTimeSlots.map((time) => {
                            const slotStartMinutes = timeToMinutes(time);
                            const slotEndMinutes =
                              slotStartMinutes === null ? null : slotStartMinutes + professionalAgenda.defaultAppointmentDurationMinutes;
                            const isInsideSchedule =
                              slotStartMinutes !== null &&
                              slotEndMinutes !== null &&
                              scheduleStartMinutes !== null &&
                              scheduleEndMinutes !== null &&
                              slotStartMinutes >= scheduleStartMinutes &&
                              slotEndMinutes <= scheduleEndMinutes;
                            const overlapsBreak =
                              slotStartMinutes !== null &&
                              slotEndMinutes !== null &&
                              profBreaks.some((schedule) =>
                                rangeOverlapsTimeRange(slotStartMinutes, slotEndMinutes, schedule.breakStartTime, schedule.breakEndTime)
                              );
                            const overlapsBusyAppointment =
                              slotStartMinutes !== null &&
                              slotEndMinutes !== null &&
                              busyAppointments.some((appointment) =>
                                rangeOverlapsMinutes(slotStartMinutes, slotEndMinutes, appointmentToDayMinutes(appointment))
                              );
                            const placement =
                              slotStartMinutes === null
                                ? null
                                : getSlotButtonPlacement(slotStartMinutes, professionalAgenda.slotMinutes, {
                                    startMinutes: dayTimelineRange.startMinutes,
                                    endMinutes: dayTimelineRange.endMinutes,
                                    slotMinutes: normalizedDaySlotMinutes,
                                    slotHeight: daySlotHeight
                                  });

                            if (!isInsideSchedule || overlapsBreak || overlapsBusyAppointment || !placement) return null;
                            if (professionalSchedule && !isOverbookingColumn && (chairIndex ?? 1) > (professionalSchedule.simultaneousChairs ?? 1)) return null;

                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => {
                                  if (onCreateSlotClick) {
                                    onCreateSlotClick({
                                      professionalId: prof.id,
                                      branchId: selectedBranchId || undefined,
                                      chairIndex: isOverbookingColumn ? undefined : (chairIndex ?? undefined),
                                      allowOverbooking: isOverbookingColumn,
                                      ...slotRange(date, time, professionalAgenda.defaultAppointmentDurationMinutes)
                                    });
                                    return;
                                  }
                                  onCreateClick?.();
                                }}
                                className="group/slot absolute left-0 right-0 z-[3] border-b border-[var(--status-success-bg)]/60 p-1 transition-colors duration-150 hover:bg-[var(--status-success-bg)]/70"
                                style={{ top: placement.top, height: placement.height }}
                              >
                                <span className="flex h-full items-center justify-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]/55 text-[10px] font-medium text-[var(--status-success-text)] opacity-0 shadow-sm transition-opacity duration-150 group-hover/slot:opacity-100">
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Disponible</span>
                                </span>
                              </button>
                            );
                          })}

                          {profApps.map((app) => {
                            const placement = getAppointmentPlacement(app, {
                              startMinutes: dayTimelineRange.startMinutes,
                              endMinutes: dayTimelineRange.endMinutes,
                              slotMinutes: normalizedDaySlotMinutes,
                              slotHeight: daySlotHeight
                            });
                            if (!placement) return null;

                            return (
                              <div
                                key={app.id}
                                className="absolute z-10 px-1 py-0.5 transition-all has-[.menu-open]:z-[50] has-[.tooltip-open]:z-[40]"
                                style={{
                                  top: placement.top,
                                  height: placement.height,
                                  left: 0,
                                  right: 0
                                }}
                              >
                                {app.status === "BLOCKED" ? (
                                  <BlockedAppointmentBlock appointment={app} compact={true} onCancel={onCancel} />
                                ) : (
                                    <AppointmentCard
                                      appointment={app}
                                      compact={true}
                                      pendingStatus={statusAction?.appointmentId === app.id ? statusAction.status : undefined}
                                      onEdit={onEdit}
                                    onCancel={onCancel}
                                    onReschedule={onReschedule}
                                    onChangeStatus={onChangeStatus}
                                    onConfirm={onConfirm}
                                    onArrive={onArrive}
                                    onWaitingRoom={onWaitingRoom}
                                    onStart={onStart}
                                    onComplete={onComplete}
                                    onNoShow={onNoShow}
                                    onMenuAction={onMenuAction}
                                  />
                                )}
                              </div>
                            );
                          })}


                          {profBreaks.map((schedule) => {
                            const placement = getTimeRangePlacement(schedule.breakStartTime!, schedule.breakEndTime!, {
                              startMinutes: dayTimelineRange.startMinutes,
                              endMinutes: dayTimelineRange.endMinutes,
                              slotMinutes: normalizedDaySlotMinutes,
                              slotHeight: daySlotHeight
                            });
                            if (!placement) return null;

                            return (
                              <BreakBlock
                                key={schedule.id}
                                top={placement.top}
                                height={placement.height}
                                range={`${schedule.breakStartTime} - ${schedule.breakEndTime}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

  // --- WEEK / MONTH VIEW FALLBACK (Standard Day Groups) ---
  const groups = appointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
    const key = toDateInputValue(new Date(appointment.startAt));
    acc[key] = [...(acc[key] ?? []), appointment];
    return acc;
  }, {});

  if (!Object.keys(groups).length) {
    return <EmptyState title="Sin citas" description="No hay citas para los filtros seleccionados." />;
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([date, rows]) => (
        <section key={date} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase text-slate-500">{new Date(`${date}T00:00:00`).toLocaleDateString()}</h3>
          <div className="grid gap-3 xl:grid-cols-2">
            {rows.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                pendingStatus={statusAction?.appointmentId === appointment.id ? statusAction.status : undefined}
                onEdit={onEdit}
                onCancel={onCancel}
                onReschedule={onReschedule}
                onChangeStatus={onChangeStatus}
                onContactWhatsApp={onContactWhatsApp}
                onConfirm={onConfirm}
                onArrive={onArrive}
                onWaitingRoom={onWaitingRoom}
                onStart={onStart}
                onComplete={onComplete}
                onNoShow={onNoShow}
                onMenuAction={onMenuAction}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BlockedAppointmentBlock({
  appointment,
  compact,
  onCancel
}: {
  appointment: Appointment;
  compact?: boolean;
  onCancel: (appointment: Appointment) => void;
}) {
  const range = `${formatDisplayTime(appointment.startAt)} - ${formatDisplayTime(appointment.endAt)}`;
  
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  if (durationMin <= 20) {
    return (
      <HelpTooltip content={`${appointment.title || "Bloqueo"} ${range}`} position="top" triggerClassName="h-full w-full">
        <button
          type="button"
          onClick={() => onCancel(appointment)}
          className="flex h-full w-full items-center overflow-hidden rounded-[var(--radius-sm)] border border-slate-350 bg-slate-50 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(100,116,139,0.12)_6px,rgba(100,116,139,0.12)_12px)] px-2 text-left text-slate-700 shadow-sm transition-[border-color,box-shadow] hover:border-slate-400 hover:shadow-[var(--shadow-card-hover)]"
        >
          <div className="flex items-center gap-1.5 text-[9.5px] font-medium w-full overflow-hidden select-none">
            <span className="shrink-0 text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Bloqueo</span>
            <span className="shrink-0 text-slate-300">|</span>
            <span className="truncate font-bold text-slate-700">{appointment.title || "Bloqueo programado"}</span>
            <span className="shrink-0 text-slate-300">|</span>
            <span className="shrink-0 text-[8px] font-semibold text-slate-500">{range}</span>
          </div>
        </button>
      </HelpTooltip>
    );
  }

  return (
    <HelpTooltip content={`${appointment.title} ${range}`} position="top" triggerClassName="h-full w-full">
      <button
        type="button"
        onClick={() => onCancel(appointment)}
        className="flex h-full w-full flex-col justify-center gap-0.5 overflow-hidden rounded-[var(--radius-sm)] border border-slate-350 bg-slate-50 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(100,116,139,0.12)_6px,rgba(100,116,139,0.12)_12px)] px-2 py-1 text-left text-slate-700 shadow-sm transition-[border-color,box-shadow] hover:border-slate-400 hover:shadow-[var(--shadow-card-hover)]"
      >
        <span className="truncate text-[8px] font-bold uppercase tracking-wider text-slate-500 leading-none">{compact ? "Bloqueo" : "Horario bloqueado"}</span>
        <span className="truncate text-[10px] font-bold text-slate-700 leading-tight">{appointment.title || "Bloqueo programado"}</span>
        <span className="truncate text-[8.5px] font-semibold text-slate-500 leading-none">{range}</span>
      </button>
    </HelpTooltip>
  );
}

function BreakBlock({ top, height }: { top: number; height: number; range: string }) {
  return (
    <div
      className="absolute left-1 right-1 z-[2] select-none bg-slate-100 bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(100,116,139,0.22)_6px,rgba(100,116,139,0.22)_12px)] border-y border-slate-300/80"
      style={{
        top,
        height
      }}
    />
  );
}
