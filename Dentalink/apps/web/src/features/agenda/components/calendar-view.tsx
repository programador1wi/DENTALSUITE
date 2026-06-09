import { EmptyState } from "@/components/feedback/empty-state";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import type { Appointment, AppointmentStatus } from "../services/appointments.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import type { Schedule } from "@/features/settings/schedules/services/schedules.service";
import { CalendarDays, Clock, Plus, UserRound } from "lucide-react";

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

type CalendarProfessional = Pick<Professional, "id" | "firstName" | "lastName"> &
  Partial<Pick<Professional, "color" | "specialties" | "branches">>;

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
  onSelectProfessional,
  onCreateClick,
  onCreateSlotClick,
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
  onSelectProfessional?: (professionalId: string) => void;
  onCreateClick?: () => void;
  onCreateSlotClick?: (slot: { professionalId: string; branchId?: string; startAt: string; endAt: string }) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onChangeStatus?: (appointment: Appointment, status: AppointmentStatus) => void;
  onConfirm: (id: string) => void;
  onArrive: (id: string) => void;
  onWaitingRoom: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
  onMenuAction?: (appointment: Appointment, action: AppointmentMenuAction) => void;
}) {
  const normalizedDaySlotMinutes = normalizeAgendaSlotMinutes(daySlotMinutes, DEFAULT_DAY_SLOT_MINUTES);
  const normalizedDayStartHour = clampInt(dayStartHour, 0, 23, DEFAULT_DAY_START_HOUR);
  const normalizedDayEndHour = clampInt(dayEndHour, 0, 23, DEFAULT_DAY_END_HOUR);
  const dayTimeSlots = buildTimeSlots(normalizedDayStartHour, normalizedDayEndHour, normalizedDaySlotMinutes, { endExclusive: true });
  const daySlotHeight = getAgendaSlotHeight(normalizedDaySlotMinutes);
  const fallbackTimelineStartMinutes = normalizedDayStartHour * 60;
  const fallbackTimelineEndMinutes = normalizedDayEndHour * 60;

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
      const appointmentCounts = appointmentsInWeek.reduce<Record<string, number>>((acc, appointment) => {
        acc[appointment.professionalId] = (acc[appointment.professionalId] ?? 0) + 1;
        return acc;
      }, {});
      const displayProfessionals = professionals.length > 0
        ? professionals
        : Array.from(new Set(appointmentsInWeek.map((appointment) => appointment.professionalId))).map((id) => {
            const appointment = appointmentsInWeek.find((item) => item.professionalId === id);
            return {
              id,
              firstName: appointment?.professional?.firstName || "Doctor",
              lastName: appointment?.professional?.lastName || "",
              color: appointment?.professional?.color,
              specialties: [],
              branches: []
            };
          });

      if (displayProfessionals.length === 0) {
        return <EmptyState title="Sin doctores para agendar" description="No hay doctores activos registrados para esta sucursal." />;
      }

      return (
        <div className="rounded-xl border border-zinc-200/70 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-zinc-100 px-4 py-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Semana</p>
              <h3 className="text-sm font-semibold text-zinc-900">{formatWeekRange(weekStart)}</h3>
            </div>
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              <UserRound className="h-3.5 w-3.5" />
              {displayProfessionals.length} doctores
            </div>
          </div>

          <div className="grid gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {displayProfessionals.map((professional) => {
              const count = appointmentCounts[professional.id] ?? 0;
              const accentColor = professional.color || "var(--text-primary)";

              return (
                <button
                  key={professional.id}
                  type="button"
                  onClick={() => onSelectProfessional?.(professional.id)}
                  className="group flex min-h-24 items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-left transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {professional.firstName.charAt(0)}{professional.lastName.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">
                      {professional.firstName} {professional.lastName}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2 py-0.5 ring-1 ring-zinc-200">
                        <CalendarDays className="h-3 w-3" />
                        {count} {count === 1 ? "cita" : "citas"}
                      </span>
                      {professional.specialties?.[0]?.name && (
                        <span className="truncate rounded-full bg-zinc-50 px-2 py-0.5 ring-1 ring-zinc-200">
                          {professional.specialties[0].name}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
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
    const appointmentsByDay = selectedAppointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
      const key = dayKey(appointment.startAt);
      acc[key] = [...(acc[key] ?? []), appointment];
      return acc;
    }, {});
    const totalTimelineHeight = dayTimeSlots.length * daySlotHeight;

    return (
      <div className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--border-default)]/50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--text-brand-strong)] text-[var(--text-inverse)] font-semibold text-xs">
              {selectedProfessional.firstName.charAt(0)}{selectedProfessional.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{formatWeekRange(weekStart)}</p>
              <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">
                {selectedProfessional.firstName} {selectedProfessional.lastName}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              <Clock className="h-3.5 w-3.5" />
              {selectedAppointments.length} {selectedAppointments.length === 1 ? "cita" : "citas"}
            </span>
            {onSelectProfessional && (
              <button
                type="button"
                onClick={() => onSelectProfessional("")}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                Cambiar doctor
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div
              className="grid border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/70"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(128px, 1fr))" }}
            >
              <div className="sticky left-0 z-30 flex h-14 items-center justify-center border-r border-[var(--border-default)] bg-[var(--bg-subtle)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                Hora
              </div>
              {days.map((day) => {
                const dayCount = appointmentsByDay[day.key]?.length ?? 0;

                return (
                  <div key={day.key} className="flex h-14 flex-col justify-center border-r border-[var(--border-default)] px-3 last:border-r-0">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{day.shortLabel}</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{day.label}</span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">{dayCount} {dayCount === 1 ? "cita" : "citas"}</span>
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
                const dayAppointments = appointmentsByDay[day.key] ?? [];
                const dayBreaks = schedules.filter(
                  (schedule) =>
                    schedule.professionalId === selectedProfessional.id &&
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
                    {dayTimeSlots.map((time, index) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => {
                          if (onCreateSlotClick) {
                            onCreateSlotClick({
                              professionalId: selectedProfessional.id,
                              branchId: selectedBranchId || undefined,
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
                    ))}

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
                            <BlockedAppointmentBlock appointment={appointment} compact={true} onEdit={onEdit} />
                          ) : (
                            <AppointmentCard
                              appointment={appointment}
                              compact={true}
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
        {/* Responsive horizontal scroll shell for daily clinical columns */}
        <div className="w-full rounded-xl border border-[var(--border-default)]/60 bg-[var(--bg-surface)] shadow-sm transition-all duration-200">
          <div className="overflow-x-auto">
            <div className="flex min-w-[700px]">
              {/* Sticky Hours Timeline Left Panel */}
              <div className="w-16 shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-subtle)]/20 flex flex-col z-20">
                {/* Visual corner connector indicator */}
                <div className="h-16 border-b border-[var(--border-default)] flex items-center justify-center bg-[var(--bg-subtle)]/40 shrink-0 select-none">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Hora
                  </span>
                </div>
                
                {/* Time indicators for each visible slot division */}
                <div className="relative shrink-0" style={{ height: dayTimelineHeight }}>
                  {hourAxisMarkers.map((marker) => (
                    <div
                      key={marker.time}
                      className="absolute left-0 right-0 flex items-start justify-center border-t border-[var(--border-default)]/50 pt-1 text-center"
                      style={{ top: marker.top }}
                    >
                      <span className="text-[10px] font-medium text-[var(--text-secondary)] tracking-tight">
                        {marker.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columns list for each active professional */}
              <div className="flex flex-1 divide-x divide-[var(--border-default)]/40">
                {displayProfessionals.map((prof) => {
                  const profApps = appointmentsForDate
                    .filter((a) => a.professionalId === prof.id)
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
                    { endExclusive: true }
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
                    <div key={prof.id} className="flex-1 min-w-[220px] flex flex-col">
                      {/* Professional Info Column Header */}
                      <div className="sticky top-0 h-16 bg-[var(--bg-surface)]/95 backdrop-blur-md px-4 py-3 border-b border-[var(--border-default)]/60 flex items-center gap-2.5 z-20 shrink-0">
                        <div className="h-8 w-8 rounded-full bg-[var(--text-brand-strong)] text-[var(--text-inverse)] flex items-center justify-center font-semibold text-xs shrink-0 select-none">
                          {prof.firstName.charAt(0)}{prof.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {prof.firstName} {prof.lastName}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)]/60 px-2 py-0.5 text-[9px] font-medium text-[var(--text-secondary)] mt-0.5 select-none">
                            {profAppsCount} {profAppsCount === 1 ? "cita" : "citas"}
                          </span>
                        </div>
                      </div>

                      {/* Timeline Slots under this doctor */}
                      <div className="relative shrink-0 overflow-hidden bg-[var(--bg-subtle)]/5" style={{ height: dayTimelineHeight }}>
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

                        {professionalVisualMarkers.map((marker) => {
                          return (
                            <div
                              key={marker.time}
                              className="absolute left-0 right-0 z-[1] border-b border-[var(--border-default)]/25"
                              style={{ top: marker.top }}
                            />
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

                          return (
                            <button
                              key={time}
                              type="button"
                              onClick={() => {
                                if (onCreateSlotClick) {
                                  onCreateSlotClick({
                                    professionalId: prof.id,
                                    branchId: selectedBranchId || undefined,
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
                                <BlockedAppointmentBlock appointment={app} compact={true} onEdit={onEdit} />
                              ) : (
                                <AppointmentCard
                                  appointment={app}
                                  compact={true}
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
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- WEEK / MONTH VIEW FALLBACK (Standard Day Groups) ---
  const groups = appointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
    const key = dayKey(appointment.startAt);
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
  onEdit
}: {
  appointment: Appointment;
  compact?: boolean;
  onEdit: (appointment: Appointment) => void;
}) {
  const range = `${formatDisplayTime(appointment.startAt)} - ${formatDisplayTime(appointment.endAt)}`;

  return (
    <HelpTooltip content={`${appointment.title} ${range}`} position="top" triggerClassName="h-full w-full">
      <button
        type="button"
        onClick={() => onEdit(appointment)}
        className="flex h-full w-full flex-col justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border-brand-light)] bg-[var(--bg-brand-light)] px-2 py-1 text-left text-[var(--text-brand-strong)] shadow-sm transition-[border-color,box-shadow] hover:border-[var(--border-brand)] hover:shadow-[var(--shadow-card-hover)]"
      >
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em]">{compact ? "Bloqueo" : "Horario bloqueado"}</span>
        <span className="truncate text-[11px] font-semibold">{appointment.title || "Bloqueo programado"}</span>
        <span className="truncate text-[10px] font-medium text-[var(--text-brand)]">{range}</span>
      </button>
    </HelpTooltip>
  );
}

function BreakBlock({ top, height, range }: { top: number; height: number; range: string }) {
  return (
    <HelpTooltip
      content={`Horario de comida ${range}`}
      position="right"
      triggerClassName="absolute left-1 right-1 z-[2] block"
      triggerStyle={{
        top,
        height
      }}
    >
      <div className="flex h-full w-full select-none items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-blue-900/30 bg-blue-900 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] px-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-white shadow-sm">
        <span className="truncate">Comida {range}</span>
      </div>
    </HelpTooltip>
  );
}

function slotRange(date: string, time: string, durationMinutes = DEFAULT_DAY_SLOT_MINUTES) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
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

function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatWeekDay(date: Date) {
  const weekday = date.toLocaleDateString("es-MX", { weekday: "long" });
  return `${capitalize(weekday)} ${date.getDate()}`;
}

function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const end = weekEnd.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `${start} al ${end}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildTimeSlots(
  startHour: number,
  endHour: number,
  stepMinutes: number,
  options?: { endExclusive?: boolean }
) {
  return buildTimeSlotsFromRange(startHour * 60, endHour * 60, stepMinutes, options);
}

function getAppointmentPlacement(
  appointment: Appointment,
  config: { startMinutes: number; endMinutes: number; slotMinutes: number; slotHeight: number }
) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const startMinutes = Math.max(config.startMinutes, start.getHours() * 60 + start.getMinutes());
  const endMinutes = Math.min(config.endMinutes, end.getHours() * 60 + end.getMinutes());
  if (endMinutes <= startMinutes) return null;

  const top = ((startMinutes - config.startMinutes) / config.slotMinutes) * config.slotHeight + 2;
  const height = Math.max(20, ((endMinutes - startMinutes) / config.slotMinutes) * config.slotHeight - 4);

  return { top, height };
}

function getSlotButtonPlacement(
  startMinutes: number,
  durationMinutes: number,
  config: { startMinutes: number; endMinutes: number; slotMinutes: number; slotHeight: number }
) {
  const endMinutes = Math.min(config.endMinutes, startMinutes + durationMinutes);
  if (startMinutes < config.startMinutes || endMinutes <= startMinutes) return null;

  const top = ((startMinutes - config.startMinutes) / config.slotMinutes) * config.slotHeight;
  const height = Math.max(20, ((endMinutes - startMinutes) / config.slotMinutes) * config.slotHeight);

  return { top, height };
}

function getTimeRangePlacement(
  startTime: string,
  endTime: string,
  config: { startMinutes: number; endMinutes: number; slotMinutes: number; slotHeight: number }
) {
  const rawStartMinutes = timeToMinutes(startTime);
  const rawEndMinutes = timeToMinutes(endTime);
  if (rawStartMinutes === null || rawEndMinutes === null) return null;

  const startMinutes = Math.max(config.startMinutes, rawStartMinutes);
  const endMinutes = Math.min(config.endMinutes, rawEndMinutes);
  if (endMinutes <= startMinutes) return null;

  const top = ((startMinutes - config.startMinutes) / config.slotMinutes) * config.slotHeight + 2;
  const height = Math.max(20, ((endMinutes - startMinutes) / config.slotMinutes) * config.slotHeight - 4);

  return { top, height };
}

function rangeOverlapsTimeRange(
  startMinutes: number,
  endMinutes: number,
  rangeStartTime?: string | null,
  rangeEndTime?: string | null
) {
  if (!rangeStartTime || !rangeEndTime) return false;
  const rangeStartMinutes = timeToMinutes(rangeStartTime);
  const rangeEndMinutes = timeToMinutes(rangeEndTime);
  if (rangeStartMinutes === null || rangeEndMinutes === null) return false;

  return startMinutes < rangeEndMinutes && endMinutes > rangeStartMinutes;
}

function rangeOverlapsMinutes(
  startMinutes: number,
  endMinutes: number,
  range: { startMinutes: number; endMinutes: number } | null
) {
  if (!range) return false;
  return startMinutes < range.endMinutes && endMinutes > range.startMinutes;
}

function appointmentToDayMinutes(appointment: Appointment) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);

  return {
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    endMinutes: end.getHours() * 60 + end.getMinutes()
  };
}

function formatDisplayTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  if (normalized < min || normalized > max) return fallback;
  return normalized;
}

function getAgendaSlotHeight(slotMinutes: number) {
  if (slotMinutes <= 10) return 24;
  if (slotMinutes <= 20) return 38;
  return 56;
}
