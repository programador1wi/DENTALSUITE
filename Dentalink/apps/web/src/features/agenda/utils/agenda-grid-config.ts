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
  branches: AgendaBranchConfig[];
};

type AgendaScheduleConfig = {
  professionalId: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

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
    agendaStartHour,
    agendaEndHour
  };
}

export function getProfessionalBranchAgendaConfig(
  professional: AgendaProfessionalConfig,
  branchId: string | undefined,
  fallbackSlotMinutes: number
) {
  const branch = branchId ? professional.branches.find((item) => item.id === branchId) : undefined;
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

export function resolveAgendaTimelineRange({
  schedules,
  fallbackStartHour,
  fallbackEndHour
}: {
  schedules: AgendaScheduleConfig[];
  fallbackStartHour: number;
  fallbackEndHour: number;
}) {
  const ranges = schedules
    .filter((schedule) => schedule.isActive ?? true)
    .map((schedule) => ({
      start: timeToMinutes(schedule.startTime),
      end: timeToMinutes(schedule.endTime)
    }))
    .filter((range): range is { start: number; end: number } => range.start !== null && range.end !== null && range.end > range.start);

  if (!ranges.length) {
    return {
      startMinutes: fallbackStartHour * 60,
      endMinutes: fallbackEndHour * 60
    };
  }

  return {
    startMinutes: Math.min(...ranges.map((range) => range.start)),
    endMinutes: Math.max(...ranges.map((range) => range.end))
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

  for (let minutes = startMinutes; endExclusive ? minutes < endMinutes : minutes <= endMinutes; minutes += stepMinutes) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
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
