import { http } from "@/lib/api/http-client";

export type FinancialInstitution = {
  id: string;
  name: string;
  isActive: boolean;
};

export type FinancialInstitutionPayload = {
  name: string;
};

export async function listFinancialInstitutions(params?: { search?: string; active?: string }) {
  const { data } = await http.get<FinancialInstitution[]>("/settings/financial-institutions", { params });
  return data;
}

export async function createFinancialInstitution(payload: FinancialInstitutionPayload) {
  const { data } = await http.post<FinancialInstitution>("/settings/financial-institutions", payload);
  return data;
}

export async function updateFinancialInstitution(
  id: string,
  payload: Partial<FinancialInstitutionPayload> & { isActive?: boolean }
) {
  const { data } = await http.patch<FinancialInstitution>(`/settings/financial-institutions/${id}`, payload);
  return data;
}

export async function deactivateFinancialInstitution(id: string) {
  const { data } = await http.patch<FinancialInstitution>(`/settings/financial-institutions/${id}/deactivate`);
  return data;
}
