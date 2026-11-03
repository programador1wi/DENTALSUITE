import type { Appointment } from "../services/appointments.service";
import { DEFAULT_AGENDA_SLOT_MINUTES, buildTimeSlotsFromRange, timeToMinutes } from "../utils/agenda-grid-config";

export function slotRange(date: string, time: string, durationMinutes = DEFAULT_AGENDA_SLOT_MINUTES) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekStart(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function formatWeekDay(date: Date) {
  const weekday = date.toLocaleDateString("es-MX", { weekday: "long" });
  return `${capitalize(weekday)} ${date.getDate()}`;
}

export function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const end = weekEnd.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `${start} al ${end}`;
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildTimeSlots(
  startHour: number,
  endHour: number,
  stepMinutes: number,
  options?: { endExclusive?: boolean }
) {
  return buildTimeSlotsFromRange(startHour * 60, endHour * 60, stepMinutes, options);
}

export function getAppointmentPlacement(
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

export function getSlotButtonPlacement(
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

export function getTimeRangePlacement(
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

export function rangeOverlapsTimeRange(
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

export function rangeOverlapsMinutes(
  startMinutes: number,
  endMinutes: number,
  range: { startMinutes: number; endMinutes: number } | null
) {
  if (!range) return false;
  return startMinutes < range.endMinutes && endMinutes > range.startMinutes;
}

export function appointmentToDayMinutes(appointment: Appointment) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);

  return {
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    endMinutes: end.getHours() * 60 + end.getMinutes()
  };
}

export function formatDisplayTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  if (normalized < min || normalized > max) return fallback;
  return normalized;
}

export function getAgendaSlotHeight(slotMinutes: number) {
  if (slotMinutes <= 10) return 24;
  if (slotMinutes <= 20) return 38;
  return 56;
}
