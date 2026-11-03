import { http } from "@/lib/api/http-client";

export type Schedule = {
  id: string;
  professionalId: string;
  branchId: string;
  chairId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  simultaneousChairs: number;
  attendanceMode: AttendanceMode;
  isActive: boolean;
  professional: { firstName: string; lastName: string };
  branch: { name: string };
  chair?: { id: string; name: string } | null;
};

export type SchedulePayload = {
  professionalId: string;
  branchId: string;
  chairId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  simultaneousChairs?: number;
  attendanceMode?: AttendanceMode;
};

export type AttendanceMode = "PRESENTIAL" | "TELECONSULTATION" | "BOTH";

export type SpecialSchedule = {
  id: string;
  professionalId: string;
  branchId: string;
  chairId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  simultaneousChairs: number;
  attendanceMode: AttendanceMode;
  isActive: boolean;
  professional: { firstName: string; lastName: string };
  branch: { name: string };
  chair?: { id: string; name: string } | null;
};

export type SpecialSchedulePayload = {
  professionalId: string;
  branchId: string;
  chairId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  simultaneousChairs?: number;
  attendanceMode?: AttendanceMode;
};

export type ScheduleBlockStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "PENDING_CONFIRMATION"
  | "ARRIVED"
  | "WAITING_ROOM"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_CLINIC"
  | "NO_SHOW"
  | "RESCHEDULED"
  | "BLOCKED";

export type ScheduleBlockAppointment = {
  id: string;
  branchId: string;
  professionalId: string;
  chairId?: string | null;
  patientId?: string | null;
  title: string;
  reason?: string | null;
  status: ScheduleBlockStatus;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  notes?: string | null;
  branch: { id: string; name: string };
  professional: { id: string; firstName: string; lastName: string };
  chair?: { id: string; name: string } | null;
  patient?: { id: string; firstName: string; lastName: string; phone?: string | null } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
};

export type ScheduleBlockPayload = {
  branchId: string;
  professionalId: string;
  chairId?: string;
  title: string;
  reason?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  notes?: string;
};

export async function listSchedules(params?: { professionalId?: string; branchId?: string; dayOfWeek?: string; active?: string; pageSize?: number }) {
  const { data } = await http.get<Schedule[]>("/professional-schedules", { params });
  return data;
}

export async function createSchedule(payload: SchedulePayload) {
  const { data } = await http.post<Schedule>("/professional-schedules", payload);
  return data;
}

export async function updateSchedule(id: string, payload: Partial<SchedulePayload> & { isActive?: boolean }) {
  const { data } = await http.patch<Schedule>(`/professional-schedules/${id}`, payload);
  return data;
}

export async function deactivateSchedule(id: string) {
  const { data } = await http.patch<Schedule>(`/professional-schedules/${id}/deactivate`);
  return data;
}

export async function listFutureScheduleBlocks(params?: {
  professionalId?: string;
  branchId?: string;
  start?: string;
  end?: string;
}) {
  const { data } = await http.get<ScheduleBlockAppointment[]>("/appointments", {
    params: { ...params, status: "BLOCKED", pageSize: 100 }
  });
  return data;
}

export async function listScheduleBlockConflicts(params: {
  professionalId: string;
  branchId: string;
  start: string;
  end: string;
}) {
  const { data } = await http.get<ScheduleBlockAppointment[]>("/appointments", {
    params: { ...params, pageSize: 100 }
  });
  return data;
}

export async function createScheduleBlock(payload: ScheduleBlockPayload) {
  const { data } = await http.post<ScheduleBlockAppointment>("/appointments", {
    ...payload,
    status: "BLOCKED"
  });
  return data;
}

export async function deleteScheduleBlock(id: string) {
  const { data } = await http.delete<ScheduleBlockAppointment>(`/appointments/${id}`);
  return data;
}

export type ProfessionalAgendaConfig = {
  agendaSlotMinutes: number | null;
  defaultAppointmentDurationMinutes: number | null;
};

export async function updateProfessionalAgendaConfig(
  professionalId: string,
  branchId: string,
  payload: {
    agendaSlotMinutes?: number | null;
    defaultAppointmentDurationMinutes?: number | null;
  }
) {
  const { data } = await http.patch<ProfessionalAgendaConfig>(
    `/professionals/${professionalId}/branches/${branchId}/agenda-config`,
    payload
  );
  return data;
}

export async function listSpecialSchedules(params?: { professionalId?: string; branchId?: string; date?: string; active?: string; pageSize?: number }) {
  const { data } = await http.get<SpecialSchedule[]>("/professional-schedules/special", { params });
  return data;
}

export async function createSpecialSchedule(payload: SpecialSchedulePayload) {
  const { data } = await http.post<SpecialSchedule>("/professional-schedules/special", payload);
  return data;
}

export async function updateSpecialSchedule(id: string, payload: Partial<SpecialSchedulePayload> & { isActive?: boolean }) {
  const { data } = await http.patch<SpecialSchedule>(`/professional-schedules/special/${id}`, payload);
  return data;
}

export async function deactivateSpecialSchedule(id: string) {
  const { data } = await http.patch<SpecialSchedule>(`/professional-schedules/special/${id}/deactivate`);
  return data;
}

