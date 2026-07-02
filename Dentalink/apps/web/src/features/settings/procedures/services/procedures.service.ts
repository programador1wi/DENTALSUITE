import { http } from "@/lib/api/http-client";

export type ProcedureType = "CLINICAL" | "LAB" | "MIXED";

export type ProcedureCategory = {
  id: string;
  name: string;
  description?: string | null;
  type: ProcedureType;
  sortOrder: number;
  isActive: boolean;
};

export type Procedure = {
  id: string;
  categoryId: string;
  displayId: number;
  code: string;
  name: string;
  description?: string | null;
  type: ProcedureType;
  defaultDuration: number;
  requiresTooth: boolean;
  requiresSurface: boolean;
  requiresLab: boolean;
  isActive: boolean;
  category: { id: string; name: string };
};

export type ProcedureCategoryPayload = {
  name?: string;
  description?: string;
  type?: ProcedureType;
  sortOrder?: number;
  isActive?: boolean;
};

export type ProcedurePayload = {
  categoryId?: string;
  code?: string;
  name?: string;
  description?: string;
  type?: ProcedureType;
  defaultDuration?: number;
  requiresTooth?: boolean;
  requiresSurface?: boolean;
  requiresLab?: boolean;
  isActive?: boolean;
};

export async function listProcedureCategories(params?: { search?: string; active?: string }) {
  const { data } = await http.get<ProcedureCategory[]>("/procedure-categories", { params });
  return data;
}

export async function createProcedureCategory(payload: ProcedureCategoryPayload) {
  const { data } = await http.post<ProcedureCategory>("/procedure-categories", payload);
  return data;
}

export async function updateProcedureCategory(id: string, payload: ProcedureCategoryPayload) {
  const { data } = await http.patch<ProcedureCategory>(`/procedure-categories/${id}`, payload);
  return data;
}

export async function deactivateProcedureCategory(id: string) {
  const { data } = await http.patch<ProcedureCategory>(`/procedure-categories/${id}/deactivate`);
  return data;
}

export async function listProcedures(params?: { search?: string; active?: string; categoryId?: string }) {
  const { data } = await http.get<Procedure[]>("/procedures", { params });
  return data;
}

export async function createProcedure(payload: ProcedurePayload) {
  const { data } = await http.post<Procedure>("/procedures", payload);
  return data;
}

export async function updateProcedure(id: string, payload: ProcedurePayload) {
  const { data } = await http.patch<Procedure>(`/procedures/${id}`, payload);
  return data;
}

export async function deactivateProcedure(id: string) {
  const { data } = await http.patch<Procedure>(`/procedures/${id}/deactivate`);
  return data;
}
