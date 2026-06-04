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
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  agendaSlotMinutes?: number | null;
  defaultAppointmentDurationMinutes?: number | null;
  specialties: { id: string; name: string }[];
  branches: {
    id: string;
    name: string;
    agendaSlotMinutes?: number | null;
    defaultAppointmentDurationMinutes?: number | null;
    status?: "ACTIVE" | "PAUSED" | "ENDED";
    startsAt?: string | Date | null;
    endsAt?: string | Date | null;
    endedReason?: string | null;
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

export type ProfessionalBranchTransferPayload = {
  branchId: string;
  fromProfessionalId: string;
  toProfessionalId: string;
  effectiveAt?: string;
  moveFutureAppointments?: boolean;
  moveFutureBlocks?: boolean;
  copySchedules?: boolean;
  copyAgendaConfig?: boolean;
  endSourceAssignment?: boolean;
  notes?: string;
};

export type ProfessionalBranchTransferResult = {
  id: string;
  branchId: string;
  fromProfessionalId: string;
  toProfessionalId: string;
  effectiveAt: string;
  appointmentsTransferred: number;
  blocksTransferred: number;
  schedulesCopied: number;
};

export async function listProfessionals(params?: {
  search?: string;
  active?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}) {
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

export async function transferProfessionalBranch(payload: ProfessionalBranchTransferPayload) {
  const { data } = await http.post<ProfessionalBranchTransferResult>("/professionals/branch-transfer", payload);
  return data;
}
