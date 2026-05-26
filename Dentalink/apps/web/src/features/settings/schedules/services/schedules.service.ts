import { http } from "@/lib/api/http-client";

export type Schedule = {
  id: string;
  professionalId: string;
  branchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  isActive: boolean;
  professional: { firstName: string; lastName: string };
  branch: { name: string };
};

export type SchedulePayload = {
  professionalId: string;
  branchId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStartTime?: string;
  breakEndTime?: string;
};

export async function listSchedules(params?: { professionalId?: string; branchId?: string; dayOfWeek?: string; active?: string }) {
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
