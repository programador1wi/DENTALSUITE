import { http } from "@/lib/api/http-client";

export type CollaboratorKind = "ADMINISTRATIVE" | "CLINICAL";
export type CollaboratorAccessStatus = "ACTIVE" | "INACTIVE" | "LOCKED" | "PENDING";
export type CollaboratorClinicalStatus = "ACTIVE" | "INACTIVE" | "NOT_APPLICABLE";

export type CollaboratorDirectoryItem = {
  id: string;
  userId: string | null;
  professionalId: string | null;
  kind: CollaboratorKind;
  hasAccess: boolean;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: { id: string; code: string | null; name: string } | null;
  accessBranches: { id: string; code: string | null; name: string; isPrimary: boolean }[];
  clinicalBranch: { id: string; code: string | null; name: string } | null;
  specialties: { id: string; name: string }[];
  licenseNumber: string | null;
  commissionRate: string | null;
  accessStatus: CollaboratorAccessStatus | null;
  clinicalStatus: CollaboratorClinicalStatus;
};

export type CollaboratorDirectoryResponse = {
  items: CollaboratorDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateCollaboratorPayload = {
  kind: CollaboratorKind;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId: string;
  branchIds: string[];
  primaryBranchId?: string;
  clinicalProfile?: {
    licenseNumber?: string;
    color?: string;
    commissionRate?: number;
    specialtyIds: string[];
    branchId: string;
    chairId?: string;
    agendaSlotMinutes?: number;
    defaultAppointmentDurationMinutes?: number;
    schedules?: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      breakStartTime?: string;
      breakEndTime?: string;
    }[];
  };
};

export type CreateProfessionalAccessPayload = {
  email: string;
  password: string;
  roleId: string;
  branchIds: string[];
  primaryBranchId?: string;
};

export async function listCollaborators(params?: {
  search?: string;
  branchId?: string;
  kind?: "ALL" | "ADMINISTRATIVE" | "CLINICAL" | "CLINICAL_WITHOUT_ACCESS";
  accessStatus?: string;
  clinicalStatus?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await http.get<CollaboratorDirectoryResponse>("/collaborators", { params });
  return data;
}

export async function createCollaborator(payload: CreateCollaboratorPayload) {
  const { data } = await http.post<{ userId: string; professionalId: string | null }>("/collaborators", payload);
  return data;
}

export async function createProfessionalAccess(professionalId: string, payload: CreateProfessionalAccessPayload) {
  const { data } = await http.post<{ userId: string; professionalId: string }>(
    `/collaborators/professionals/${professionalId}/access`,
    payload
  );
  return data;
}
