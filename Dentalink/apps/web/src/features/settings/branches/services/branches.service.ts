import { http } from "@/lib/api/http-client";

export type Branch = {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  agendaSlotMinutes?: number | null;
  agendaStartHour?: number | null;
  agendaEndHour?: number | null;
  status: "ACTIVE" | "INACTIVE";
};

export type BranchPayload = {
  code: string;
  name: string;
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
