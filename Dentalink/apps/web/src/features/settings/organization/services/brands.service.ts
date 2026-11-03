import { http } from "@/lib/api/http-client";

export interface BranchBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  branches: { id: string; name: string }[];
}

export async function getBrands() {
  const { data } = await http.get<BranchBrand[]>("/settings/brands");
  return data;
}

export async function createBrand(payload: { name: string; logoUrl?: string; branchIds?: string[] }) {
  const { data } = await http.post<BranchBrand>("/settings/brands", payload);
  return data;
}

export async function updateBrand(id: string, payload: { name: string; logoUrl?: string; branchIds?: string[] }) {
  const { data } = await http.put<BranchBrand>(`/settings/brands/${id}`, payload);
  return data;
}

export async function deleteBrand(id: string) {
  const { data } = await http.delete(`/settings/brands/${id}`);
  return data;
}
