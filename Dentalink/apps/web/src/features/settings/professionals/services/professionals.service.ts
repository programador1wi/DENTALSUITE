import { http } from "@/lib/api/http-client";

export type Professional = {
  id: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  color?: string | null;
  commissionRate: string;
  isActive: boolean;
  agendaSlotMinutes?: number | null;
  defaultAppointmentDurationMinutes?: number | null;
  specialties: { id: string; name: string }[];
  branches: {
    id: string;
    name: string;
    agendaSlotMinutes?: number | null;
    defaultAppointmentDurationMinutes?: number | null;
  }[];
};

export type ProfessionalPayload = {
  userId?: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
  phone?: string;
  email?: string;
  color?: string;
  commissionRate?: number;
  specialtyIds: string[];
  branchIds: string[];
};

export async function listProfessionals(params?: { search?: string; active?: string }) {
  const { data } = await http.get<Professional[]>("/professionals", { params });
  return data;
}

export async function createProfessional(payload: ProfessionalPayload) {
  const { data } = await http.post<Professional>("/professionals", payload);
  return data;
}

export async function updateProfessional(id: string, payload: Partial<ProfessionalPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<Professional>(`/professionals/${id}`, payload);
  return data;
}

export async function deactivateProfessional(id: string) {
  const { data } = await http.patch<Professional>(`/professionals/${id}/deactivate`);
  return data;
}
