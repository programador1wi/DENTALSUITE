import { http } from "@/lib/api/http-client";

export type Branch = {
  id: string;
  code: string;
  brandId?: string | null;
  brand?: { id: string; name: string; code: string } | null;
  zoneId?: string | null;
  zone?: { id: string; name: string; code: string } | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
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
  brandId?: string | null;
  zoneId?: string | null;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
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
