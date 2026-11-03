import type {
  AttendanceMode,
  Schedule,
  ScheduleBlockAppointment
} from "../services/schedules.service";

export type DayForm = {
  startTime: string;
  endTime: string;
  chairId: string;
  simultaneousChairs: number;
  hasBreak: boolean;
  breakStartTime: string;
  breakEndTime: string;
  attendanceMode: AttendanceMode;
  noAttend: boolean;
};

export type BlockForm = {
  branchId: string;
  professionalId: string;
  chairId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  notes: string;
};

export const days = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" }
];

export const fixedEndTimesByDay: Partial<Record<number, string>> = {
  1: "19:00",
  2: "19:00",
  3: "19:00",
  4: "19:00",
  5: "19:00",
  6: "15:00"
};

export const timeOptions = buildTimeOptions(10, 19, 60);

export function defaultDayForm(dayOfWeek: number, chairId = ""): DayForm {
  const hasBreak = dayOfWeek !== 0 && dayOfWeek !== 6;
  if (dayOfWeek === 0) {
    return {
      startTime: "10:00",
      endTime: fixedEndTimesByDay[dayOfWeek] ?? "19:00",
      chairId,
      simultaneousChairs: 1,
      hasBreak: false,
      breakStartTime: "",
      breakEndTime: "",
      attendanceMode: "PRESENTIAL",
      noAttend: true
    };
  }
  return {
    startTime: "10:00",
    endTime: fixedEndTimesByDay[dayOfWeek] ?? "19:00",
    chairId,
    simultaneousChairs: 1,
    hasBreak,
    breakStartTime: hasBreak ? "14:00" : "",
    breakEndTime: hasBreak ? "15:00" : "",
    attendanceMode: "PRESENTIAL",
    noAttend: false
  };
}

export function emptyWeeklyForm(chairId = "") {
  return Object.fromEntries(days.map((day) => [day.value, defaultDayForm(day.value, chairId)])) as Record<
    number,
    DayForm
  >;
}

export function emptyBlockForm(branchId = "", professionalId = "", chairId = ""): BlockForm {
  return {
    branchId,
    professionalId,
    chairId,
    date: toDateInputValue(new Date()),
    startTime: "10:00",
    endTime: "11:00",
    reason: "Bloqueo programado",
    notes: ""
  };
}

function scheduleToDayForm(schedule: Schedule): DayForm {
  const hasBreak = schedule.dayOfWeek !== 6 && Boolean(schedule.breakStartTime && schedule.breakEndTime);
  return {
    startTime: schedule.startTime,
    endTime: fixedEndTimesByDay[schedule.dayOfWeek] ?? schedule.endTime,
    chairId: schedule.chairId ?? "",
    simultaneousChairs: schedule.simultaneousChairs ?? 1,
    hasBreak,
    breakStartTime: hasBreak ? schedule.breakStartTime ?? "" : "",
    breakEndTime: hasBreak ? schedule.breakEndTime ?? "" : "",
    attendanceMode: schedule.attendanceMode ?? "PRESENTIAL",
    noAttend: !schedule.isActive
  };
}

export function weeklyFormFromSchedules(schedules: Schedule[], chairId = "") {
  const form = emptyWeeklyForm(chairId);
  for (const schedule of schedulesByDayMap(schedules).values()) form[schedule.dayOfWeek] = scheduleToDayForm(schedule);
  return form;
}

export function schedulesByDayMap(schedules: Schedule[]) {
  const map = new Map<number, Schedule>();
  for (const schedule of schedules) {
    const current = map.get(schedule.dayOfWeek);
    if (!current || (!current.isActive && schedule.isActive)) map.set(schedule.dayOfWeek, schedule);
  }
  return map;
}

export function validateWeeklyForm(form: Record<number, DayForm>) {
  for (const day of days) {
    const row = form[day.value];
    if (row.noAttend) continue;
    if (!row.startTime || !row.endTime) return `${day.label}: indica hora de inicio y termino.`;
    const requiredEndTime = fixedEndTimesByDay[day.value];
    if (requiredEndTime && row.endTime !== requiredEndTime) {
      return `${day.label}: la hora de termino debe ser ${requiredEndTime}.`;
    }
    if (toMinutes(row.startTime) >= toMinutes(row.endTime)) {
      return `${day.label}: la hora de inicio debe ser anterior a la hora de termino.`;
    }
    if (day.value === 6 && row.hasBreak) return "Sabado no debe tener descanso.";
    if (row.hasBreak) {
      if (!row.breakStartTime || !row.breakEndTime) {
        return `${day.label}: completa el inicio y termino del descanso.`;
      }
      const start = toMinutes(row.startTime);
      const end = toMinutes(row.endTime);
      const breakStart = toMinutes(row.breakStartTime);
      const breakEnd = toMinutes(row.breakEndTime);
      if (breakStart >= breakEnd) return `${day.label}: el inicio del descanso debe ser anterior al termino.`;
      if (breakStart < start || breakEnd > end) return `${day.label}: el descanso debe estar dentro del horario laboral.`;
    }
  }
  return "";
}

export function validateChairConflicts(
  form: Record<number, DayForm>,
  currentSchedulesByDay: Map<number, Schedule>,
  branchSchedules: Schedule[],
  chairNamesById: Map<string, string>
) {
  for (const day of days) {
    const row = form[day.value];
    if (row.noAttend || !row.chairId) continue;
    const current = currentSchedulesByDay.get(day.value);
    const start = toMinutes(row.startTime);
    const end = toMinutes(row.endTime);
    const conflict = branchSchedules.find((schedule) => {
      if (!schedule.isActive || schedule.id === current?.id || schedule.chairId !== row.chairId || schedule.dayOfWeek !== day.value) {
        return false;
      }
      return start < toMinutes(schedule.endTime) && end > toMinutes(schedule.startTime);
    });
    if (conflict) {
      const chairName = conflict.chair?.name ?? chairNamesById.get(row.chairId) ?? "El box seleccionado";
      const professionalName = `${conflict.professional.firstName} ${conflict.professional.lastName}`.trim();
      return `${day.label}: ${chairName} ya esta asignado a ${professionalName} de ${conflict.startTime} a ${conflict.endTime}. Elige otro box, ajusta el horario o deja "Sin box".`;
    }
  }
  return "";
}

export function scheduleSaveErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo actualizar el horario.";
  if (message.includes("Overlapping schedule for selected chair")) {
    return "El box seleccionado ya tiene otro horario activo en ese dia y rango. Elige otro box, ajusta las horas o deja el dia sin box.";
  }
  if (message.includes("Overlapping schedule for professional and branch")) {
    return "El profesional ya tiene otro horario activo en esa sucursal, dia y rango.";
  }
  return message;
}

export function blockDateRange(form: BlockForm) {
  if (!form.date || !form.startTime || !form.endTime) return null;
  const startAt = new Date(`${form.date}T${form.startTime}:00`);
  const endAt = new Date(`${form.date}T${form.endTime}:00`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) return null;
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

function buildTimeOptions(startHour: number, endHour: number, stepMinutes: number) {
  const options: string[] = [];
  for (let minutes = startHour * 60; minutes <= endHour * 60; minutes += stepMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return options;
}

export function normalizeDayForm(dayOfWeek: number, row: DayForm): DayForm {
  const fixedEndTime = fixedEndTimesByDay[dayOfWeek];
  const hasBreak = dayOfWeek === 6 ? false : row.hasBreak;
  return {
    ...row,
    endTime: fixedEndTime ?? row.endTime,
    hasBreak,
    breakStartTime: hasBreak ? row.breakStartTime : "",
    breakEndTime: hasBreak ? row.breakEndTime : ""
  };
}

export function endTimeOptionsForDay(dayOfWeek: number) {
  const fixedEndTime = fixedEndTimesByDay[dayOfWeek];
  return fixedEndTime ? [fixedEndTime] : timeOptions;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function diffMinutes(startAt: Date, endAt: Date) {
  return Math.round((endAt.getTime() - startAt.getTime()) / 60000);
}

export function startOfTodayIso() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

export function endOfFutureIso() {
  const future = new Date();
  future.setFullYear(future.getFullYear() + 2);
  future.setHours(0, 0, 0, 0);
  return future.toISOString();
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatTimeRange(startAt: string, endAt: string) {
  return `${formatTime(startAt)} - ${formatTime(endAt)}`;
}

export function formatCreatedBy(block: ScheduleBlockAppointment) {
  if (!block.createdBy) return "Sistema";
  return `${block.createdBy.firstName} ${block.createdBy.lastName}`.trim();
}
