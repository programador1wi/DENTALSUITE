import { http } from "@/lib/api/http-client";

export type Chair = {
  id: string;
  branchId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  branch: { name: string };
};

export type ChairPayload = {
  branchId: string;
  name: string;
  description?: string;
};

export async function listChairs(params?: { search?: string; active?: string; branchId?: string }) {
  const { data } = await http.get<Chair[]>("/chairs", { params });
  return data;
}

export async function createChair(payload: ChairPayload) {
  const { data } = await http.post<Chair>("/chairs", payload);
  return data;
}

export async function updateChair(id: string, payload: Partial<ChairPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<Chair>(`/chairs/${id}`, payload);
  return data;
}

export async function deactivateChair(id: string) {
  const { data } = await http.patch<Chair>(`/chairs/${id}/deactivate`);
  return data;
}
