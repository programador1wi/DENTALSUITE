import { http } from "@/lib/api/http-client";

export type UserListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  role: { id: string; code?: string | null; name: string } | null;
  branches: { id: string; code?: string | null; name: string; isPrimary: boolean }[];
  professional?: {
    id: string;
    commissionRate: string;
    isActive: boolean;
  } | null;
};

export type CreateUserPayload = {
  branchIds: string[];
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
  primaryBranchId?: string;
  roleId: string;
};

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, "email">> & {
  status?: "ACTIVE" | "INACTIVE" | "LOCKED" | "PENDING";
};

export async function listUsers(params?: { search?: string; status?: string; branchId?: string }) {
  const { data } = await http.get<UserListItem[]>("/users", { params });
  return data;
}

export async function createUser(payload: CreateUserPayload) {
  const { data } = await http.post<UserListItem>("/users", payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  const { data } = await http.patch<UserListItem>(`/users/${id}`, payload);
  return data;
}

export async function deactivateUser(id: string) {
  const { data } = await http.patch<UserListItem>(`/users/${id}/deactivate`);
  return data;
}

export async function lockAllUserAccess() {
  const { data } = await http.patch<{ updated: number }>("/users/lock-access");
  return data;
}
