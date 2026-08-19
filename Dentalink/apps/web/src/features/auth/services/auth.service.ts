import { http } from "@/lib/api/http-client";
import type {
  AuthResponse,
  AuthUser,
  ChangePasswordPayload,
  LoginPayload,
  UpdateProfilePayload
} from "@/types/auth";

export async function login(payload: LoginPayload) {
  const { data } = await http.post<AuthResponse>("/auth/login", payload);
  return data;
}

export async function me() {
  const { data } = await http.get<AuthUser>("/auth/me");
  return data;
}

export async function logout(refreshToken?: string) {
  const { data } = await http.post<{ success: boolean }>("/auth/logout", {
    refreshToken
  });
  return data;
}

export async function updateProfile(payload: UpdateProfilePayload) {
  const { data } = await http.patch<AuthUser>("/auth/profile", payload);
  return data;
}

export async function changePassword(payload: ChangePasswordPayload) {
  const { data } = await http.post<{ success: boolean; message: string }>("/auth/change-password", payload);
  return data;
}
