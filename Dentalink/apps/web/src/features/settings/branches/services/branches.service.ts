import { http } from "@/lib/api/http-client";

export type Branch = {
  id: string;
  code: string;
  brandId?: string | null;
  brand?: { id: string; name: string; code: string } | null;
  zoneId?: string | null;
  zone?: { id: string; name: string; code: string } | null;
  name: string;
  description?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  secondaryPhone?: string | null;
  email?: string | null;
  replyToEmail?: string | null;
  website?: string | null;
  address?: string | null;
  exteriorNumber?: string | null;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  municipality?: string | null;
  references?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string | null;
  showInEmails?: boolean;
  showInDocuments?: boolean;
  showInOnlineScheduling?: boolean;
  allowOnlineAppointments?: boolean;
  allowNotifications?: boolean;
  agendaSlotMinutes?: number | null;
  agendaStartHour?: number | null;
  agendaEndHour?: number | null;
  dentalinkPlatformCode?: string | null;
  dentalinkSucursalId?: number | null;
  dentalinkSucursalName?: string | null;
  isActive?: boolean;
  status: "ACTIVE" | "INACTIVE";
};

export type BranchPayload = {
  code: string;
  name: string;
  description?: string;
  brandId?: string | null;
  zoneId?: string | null;
  countryCode?: string;
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  replyToEmail?: string;
  website?: string;
  city?: string;
  state?: string;
  address?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  neighborhood?: string;
  postalCode?: string;
  municipality?: string;
  references?: string;
  country?: string;
  timezone?: string;
  showInEmails?: boolean;
  showInDocuments?: boolean;
  showInOnlineScheduling?: boolean;
  allowOnlineAppointments?: boolean;
  allowNotifications?: boolean;
  agendaSlotMinutes?: number;
  agendaStartHour?: number;
  agendaEndHour?: number;
};

export async function listBranches(params?: { search?: string; status?: string }) {
  const { data } = await http.get<Branch[]>("/branches", { params });
  return data;
}

export async function createBranch(payload: BranchPayload) {
  const { data } = await http.post<Branch>("/branches", payload);
  return data;
}

export async function updateBranch(id: string, payload: Partial<BranchPayload> & { status?: "ACTIVE" | "INACTIVE" }) {
  const { data } = await http.patch<Branch>(`/branches/${id}`, payload);
  return data;
}

export async function deactivateBranch(id: string) {
  const { data } = await http.patch<Branch>(`/branches/${id}/deactivate`);
  return data;
}
