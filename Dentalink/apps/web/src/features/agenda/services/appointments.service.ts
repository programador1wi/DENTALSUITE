import { http } from "@/lib/api/http-client";

export type AppointmentStatus =
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

export type Appointment = {
  id: string;
  organizationId: string;
  branchId: string;
  patientId?: string | null;
  professionalId: string;
  chairId?: string | null;
  specialtyId?: string | null;
  treatmentPlanId?: string | null;
  title: string;
  reason?: string | null;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  notes?: string | null;
  cancellationReason?: string | null;
  branch: { id: string; name: string };
  patient?: { id: string; firstName: string; lastName: string; phone?: string | null; email?: string | null } | null;
  professional: { id: string; firstName: string; lastName: string; color?: string | null };
  chair?: { id: string; name: string } | null;
  specialty?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  statusHistory?: AppointmentStatusHistory[];
  appointmentNotes?: AppointmentNote[];
  reminders?: AppointmentReminder[];
};

export type AppointmentStatusHistory = {
  id: string;
  appointmentId: string;
  previousStatus?: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  changedById: string;
  changedBy?: { id: string; firstName: string; lastName: string } | null;
  reason?: string | null;
  createdAt: string;
};

export type AppointmentNote = {
  id: string;
  appointmentId: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string } | null;
  note: string;
  isPrivate: boolean;
  createdAt: string;
};

export type AppointmentReminder = {
  id: string;
  appointmentId: string;
  channel: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentPayload = {
  branchId: string;
  patientId?: string;
  professionalId: string;
  chairId?: string;
  specialtyId?: string;
  treatmentPlanId?: string;
  title: string;
  reason?: string;
  status?: AppointmentStatus;
  startAt: string;
  endAt: string;
  durationMinutes?: number;
  notes?: string;
};

export type AppointmentQuery = {
  date?: string;
  view?: "day" | "week" | "month";
  start?: string;
  end?: string;
  branchId?: string;
  patientId?: string;
  professionalId?: string;
  chairId?: string;
  status?: string;
  search?: string;
};

export type AvailabilitySlot = {
  startAt: string;
  endAt: string;
  available: boolean;
};

export async function listAppointments(params?: AppointmentQuery) {
  const { data } = await http.get<Appointment[]>("/appointments", { params });
  return data;
}

export async function getAppointment(id: string) {
  const { data } = await http.get<Appointment>(`/appointments/${id}`);
  return data;
}

export async function createAppointment(payload: AppointmentPayload) {
  const { data } = await http.post<Appointment>("/appointments", payload);
  return data;
}

export async function updateAppointment(id: string, payload: Partial<AppointmentPayload>) {
  const { data } = await http.patch<Appointment>(`/appointments/${id}`, payload);
  return data;
}

export async function deleteAppointment(id: string) {
  const { data } = await http.delete<Appointment>(`/appointments/${id}`);
  return data;
}

export async function confirmAppointment(id: string) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/confirm`, {});
  return data;
}

export async function cancelAppointment(id: string, payload: { reason: string; cancelledBy?: "patient" | "clinic" }) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/cancel`, payload);
  return data;
}

export async function rescheduleAppointment(id: string, payload: { startAt: string; endAt: string; durationMinutes?: number; reason?: string }) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/reschedule`, payload);
  return data;
}

export async function arriveAppointment(id: string) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/arrive`, {});
  return data;
}

export async function waitingRoomAppointment(id: string) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/waiting-room`, {});
  return data;
}

export async function startAppointment(id: string) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/start`, {});
  return data;
}

export async function completeAppointment(id: string) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/complete`, {});
  return data;
}

export async function noShowAppointment(id: string) {
  const { data } = await http.post<Appointment>(`/appointments/${id}/no-show`, {});
  return data;
}

export async function getAvailability(params: {
  branchId: string;
  professionalId: string;
  chairId?: string;
  date: string;
  durationMinutes?: string;
}) {
  const { data } = await http.get<{ slots: AvailabilitySlot[] }>("/appointments/availability", { params });
  return data;
}
