import { http } from "@/lib/api/http-client";

export type RolePermission = {
  id: string;
  code?: string | null;
  module: string;
  action: string;
  resource: string;
  name?: string | null;
  description?: string | null;
};

export type RoleListItem = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: RolePermission[];
};

export type RoleDetail = RoleListItem & {
  organizationId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateRolePayload = {
  name: string;
  description?: string;
  permissionIds: string[];
};

export type UpdateRolePayload = {
  name?: string;
  description?: string;
  isActive?: boolean;
  permissionIds?: string[];
};

export async function listRoles(params?: { search?: string; active?: string }) {
  const { data } = await http.get<RoleListItem[]>("/roles", { params });
  return data;
}

export async function getRoleById(id: string) {
  const { data } = await http.get<RoleDetail>(`/roles/${id}`);
  return data;
}

export async function createRole(payload: CreateRolePayload) {
  const { data } = await http.post<RoleDetail>("/roles", payload);
  return data;
}

export async function updateRole(id: string, payload: UpdateRolePayload) {
  const { data } = await http.patch<RoleDetail>(`/roles/${id}`, payload);
  return data;
}

export async function deactivateRole(id: string) {
  const { data } = await http.patch<RoleListItem>(`/roles/${id}/deactivate`);
  return data;
}
