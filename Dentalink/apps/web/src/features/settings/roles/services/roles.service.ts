import { http } from "@/lib/api/http-client";

export type RoleListItem = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: { id: string; code?: string | null; module: string; action: string; resource: string }[];
};

export async function listRoles(params?: { search?: string; active?: string }) {
  const { data } = await http.get<RoleListItem[]>("/roles", { params });
  return data;
}

export async function deactivateRole(id: string) {
  const { data } = await http.patch<RoleListItem>(`/roles/${id}/deactivate`);
  return data;
}
