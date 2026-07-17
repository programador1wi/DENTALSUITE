export const DEFAULT_AGENDA_SLOT_MINUTES = 30;
export const DEFAULT_AGENDA_START_HOUR = 8;
export const DEFAULT_AGENDA_END_HOUR = 19;
export const MIN_AGENDA_SLOT_MINUTES = 5;
export const MAX_AGENDA_SLOT_MINUTES = 120;

type AgendaBranchConfig = {
  id: string;
  agendaSlotMinutes?: number | null;
  defaultAppointmentDurationMinutes?: number | null;
  agendaStartHour?: number | null;
  agendaEndHour?: number | null;
};

type AgendaProfessionalConfig = {
  branches?: AgendaBranchConfig[] | null;
};

type AgendaScheduleConfig = {
  id?: string;
  professionalId: string;
  branchId?: string;
  dayOfWeek?: number;
  date?: string;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  isActive?: boolean;
};

type AgendaAppointmentConfig = {
  id: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  status?: string;
};

type DayColumnModelInput<TProfessional extends AgendaProfessionalConfig & { id: string }, TAppointment extends AgendaAppointmentConfig> = {
  professional: TProfessional;
  branchId?: string;
  date: string;
  schedules: AgendaScheduleConfig[];
  specialSchedules?: AgendaScheduleConfig[];
  appointments: TAppointment[];
  fallbackSlotMinutes: number;
  fallbackStartHour: number;
  fallbackEndHour: number;
  freeStatuses?: readonly string[];
};

const DEFAULT_FREE_STATUSES = [
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "CANCELLED_CONFLICT",
  "CANCELLED_RESCHEDULED",
  "NO_SHOW",
  "RESCHEDULED"
];

export function resolveAgendaViewConfig({
  activeBranch,
  activeBranchId,
  selectedProfessionalBranch,
  visibleProfessionals
}: {
  activeBranch?: AgendaBranchConfig | null;
  activeBranchId?: string;
  selectedProfessionalBranch?: AgendaBranchConfig | null;
  visibleProfessionals: AgendaProfessionalConfig[];
}) {
  const branchSlotMinutes = normalizeAgendaSlotMinutes(activeBranch?.agendaSlotMinutes, DEFAULT_AGENDA_SLOT_MINUTES);
  const selectedProfessionalSlotMinutes = normalizeOptionalAgendaSlotMinutes(selectedProfessionalBranch?.agendaSlotMinutes);
  const globalProfessionalSlotMinutes = resolveGlobalProfessionalSlotMinutes({
    activeBranchId,
    branchSlotMinutes,
    visibleProfessionals
  });

  const agendaSlotMinutes = selectedProfessionalSlotMinutes ?? globalProfessionalSlotMinutes ?? branchSlotMinutes;
  const defaultAppointmentDurationMinutes =
    normalizeOptionalAppointmentDuration(selectedProfessionalBranch?.defaultAppointmentDurationMinutes) ?? agendaSlotMinutes;
  const agendaStartHour = normalizeHour(activeBranch?.agendaStartHour, DEFAULT_AGENDA_START_HOUR);
  const agendaEndHour = normalizeHour(activeBranch?.agendaEndHour, DEFAULT_AGENDA_END_HOUR);

  return {
    agendaSlotMinutes,
    defaultAppointmentDurationMinutes,
    branchSlotMinutes,
    agendaStartHour,
    agendaEndHour
  };
}

export function getProfessionalBranchAgendaConfig(
  professional: AgendaProfessionalConfig,
  branchId: string | undefined,
  fallbackSlotMinutes: number
) {
  const branch = branchId ? professional.branches?.find((item) => item.id === branchId) : undefined;
  const slotMinutes = normalizeOptionalAgendaSlotMinutes(branch?.agendaSlotMinutes) ?? fallbackSlotMinutes;
  const defaultAppointmentDurationMinutes =
    normalizeOptionalAppointmentDuration(branch?.defaultAppointmentDurationMinutes) ?? slotMinutes;

  return { slotMinutes, defaultAppointmentDurationMinutes };
}

export function normalizeAgendaSlotMinutes(value: number | null | undefined, fallback = DEFAULT_AGENDA_SLOT_MINUTES) {
  return normalizeOptionalAgendaSlotMinutes(value) ?? fallback;
}

export function isTimeAlignedToSlot(time: string, startTime: string, slotMinutes: number) {
  const minutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  if (minutes === null || startMinutes === null || slotMinutes <= 0) return false;
  return (minutes - startMinutes) % slotMinutes === 0;
}

export function buildProfessionalDayColumnModel<
  TProfessional extends AgendaProfessionalConfig & { id: string },
  TAppointment extends AgendaAppointmentConfig
>({
  professional,
  branchId,
  date,
  schedules,
  specialSchedules = [],
  appointments,
  fallbackSlotMinutes,
  fallbackStartHour,
  fallbackEndHour,
  freeStatuses = DEFAULT_FREE_STATUSES
}: DayColumnModelInput<TProfessional, TAppointment>) {
  const agendaConfig = getProfessionalBranchAgendaConfig(professional, branchId, fallbackSlotMinutes);
  const targetDate = parseDateInput(date);
  const targetDay = targetDate.getDay();
  const freeStatusSet = new Set(freeStatuses);
  const fallbackStartMinutes = fallbackStartHour * 60;
  const fallbackEndMinutes = fallbackEndHour * 60;
  const effectiveSchedules = [...schedules, ...specialSchedules]
    .filter((schedule) => {
      if (schedule.professionalId !== professional.id) return false;
      if (schedule.isActive === false) return false;
      if (branchId && schedule.branchId && schedule.branchId !== branchId) return false;
      if (schedule.date) return schedule.date === date;
      if (schedule.dayOfWeek !== undefined) return schedule.dayOfWeek === targetDay;
      return true;
    })
    .flatMap((schedule) => {
      const rawStartMinutes = timeToMinutes(schedule.startTime);
      const rawEndMinutes = timeToMinutes(schedule.endTime);
      if (rawStartMinutes === null || rawEndMinutes === null) return [];

      const startMinutes = Math.max(fallbackStartMinutes, rawStartMinutes);
      const endMinutes = Math.min(fallbackEndMinutes, rawEndMinutes);
      if (endMinutes <= startMinutes) return [];

      return [{ ...schedule, startMinutes, endMinutes }];
    })
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes);

  const startMinutes = effectiveSchedules.length
    ? Math.min(...effectiveSchedules.map((schedule) => schedule.startMinutes))
    : fallbackStartMinutes;
  const endMinutes = effectiveSchedules.length
    ? Math.max(...effectiveSchedules.map((schedule) => schedule.endMinutes))
    : fallbackEndMinutes;
  const dayAppointments = appointments
    .filter((appointment) => appointment.professionalId === professional.id && appointmentDayKey(appointment.startAt) === date)
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
  const visibleAppointments = dayAppointments.filter((appointment) =>
    appointmentInsideAnySchedule(appointment, effectiveSchedules)
  );
  const outOfScheduleAppointments = dayAppointments.filter((appointment) => !visibleAppointments.includes(appointment));
  const busyAppointments = dayAppointments.filter((appointment) => !freeStatusSet.has(appointment.status ?? ""));
  const availableSlots = uniqueSlots(
    effectiveSchedules.flatMap((schedule) =>
      buildTimeSlotsFromRange(schedule.startMinutes, schedule.endMinutes, agendaConfig.slotMinutes, { endExclusive: true }).flatMap((time) => {
        const slotStartMinutes = timeToMinutes(time);
        if (slotStartMinutes === null) return [];

        const slotEndMinutes = slotStartMinutes + agendaConfig.defaultAppointmentDurationMinutes;
        if (slotEndMinutes > schedule.endMinutes) return [];
        if (rangeOverlapsTimeRange(slotStartMinutes, slotEndMinutes, schedule.breakStartTime, schedule.breakEndTime)) return [];

        const overlapsBusy = busyAppointments.some((appointment) =>
          rangeOverlapsMinutes(slotStartMinutes, slotEndMinutes, appointmentToDayMinutes(appointment))
        );
        if (overlapsBusy) return [];

        return [{ time, startMinutes: slotStartMinutes, endMinutes: slotEndMinutes }];
      })
    )
  );

  return {
    professionalId: professional.id,
    slotMinutes: agendaConfig.slotMinutes,
    defaultAppointmentDurationMinutes: agendaConfig.defaultAppointmentDurationMinutes,
    startMinutes,
    endMinutes,
    schedules: effectiveSchedules,
    timeSlots: buildTimeSlotsFromRange(startMinutes, endMinutes, agendaConfig.slotMinutes, { endExclusive: true }),
    availableSlots,
    visibleAppointments,
    outOfScheduleAppointments,
    appointments: dayAppointments
  };
}

export function resolveAgendaTimelineRange({
  schedules,
  fallbackStartHour,
  fallbackEndHour
}: {
  schedules: AgendaScheduleConfig[];
  fallbackStartHour: number;
  fallbackEndHour: number;
}) {
  return {
    startMinutes: fallbackStartHour * 60,
    endMinutes: fallbackEndHour * 60
  };
}

export function buildTimeSlotsFromRange(
  startMinutes: number,
  endMinutes: number,
  stepMinutes: number,
  options?: { endExclusive?: boolean }
) {
  const slots: string[] = [];
  const endExclusive = options?.endExclusive ?? false;
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || !Number.isFinite(stepMinutes)) return slots;
  if (stepMinutes <= 0 || endMinutes < startMinutes) return slots;

  for (let minutes = startMinutes; endExclusive ? minutes < endMinutes : minutes <= endMinutes; minutes += stepMinutes) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

export function buildTimelineMarkersFromRange(
  startMinutes: number,
  endMinutes: number,
  stepMinutes: number,
  scale: { slotMinutes: number; slotHeight: number },
  options?: { endExclusive?: boolean }
) {
  if (scale.slotMinutes <= 0 || scale.slotHeight <= 0) return [];

  return buildTimeSlotsFromRange(startMinutes, endMinutes, stepMinutes, options).flatMap((time) => {
    const minutes = timeToMinutes(time);
    if (minutes === null) return [];

    return [
      {
        time,
        top: ((minutes - startMinutes) / scale.slotMinutes) * scale.slotHeight
      }
    ];
  });
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function appointmentDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function appointmentInsideAnySchedule(
  appointment: AgendaAppointmentConfig,
  schedules: Array<AgendaScheduleConfig & { startMinutes: number; endMinutes: number }>
) {
  const appointmentMinutes = appointmentToDayMinutes(appointment);
  if (!appointmentMinutes) return false;
  return schedules.some(
    (schedule) =>
      appointmentMinutes.startMinutes >= schedule.startMinutes &&
      appointmentMinutes.endMinutes <= schedule.endMinutes &&
      !rangeOverlapsTimeRange(
        appointmentMinutes.startMinutes,
        appointmentMinutes.endMinutes,
        schedule.breakStartTime,
        schedule.breakEndTime
      )
  );
}

function appointmentToDayMinutes(appointment: AgendaAppointmentConfig) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return {
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    endMinutes: end.getHours() * 60 + end.getMinutes()
  };
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

function uniqueSlots(slots: Array<{ time: string; startMinutes: number; endMinutes: number }>) {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    const key = `${slot.startMinutes}-${slot.endMinutes}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveGlobalProfessionalSlotMinutes({
  activeBranchId,
  branchSlotMinutes,
  visibleProfessionals
}: {
  activeBranchId?: string;
  branchSlotMinutes: number;
  visibleProfessionals: AgendaProfessionalConfig[];
}) {
  if (!activeBranchId) return null;

  const slotMinutes = visibleProfessionals
    .map((professional) => getProfessionalBranchAgendaConfig(professional, activeBranchId, branchSlotMinutes).slotMinutes)
    .filter((slot): slot is number => Number.isFinite(slot));

  if (!slotMinutes.length) return null;

  return Math.min(...slotMinutes);
}

function normalizeOptionalAgendaSlotMinutes(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  const normalized = Math.trunc(Number(value));
  if (normalized < MIN_AGENDA_SLOT_MINUTES || normalized > MAX_AGENDA_SLOT_MINUTES) return null;
  return normalized;
}

function normalizeOptionalAppointmentDuration(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  const normalized = Math.trunc(Number(value));
  if (normalized < MIN_AGENDA_SLOT_MINUTES || normalized > 480) return null;
  return normalized;
}

function normalizeHour(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(Number(value));
  if (normalized < 0 || normalized > 23) return fallback;
  return normalized;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
