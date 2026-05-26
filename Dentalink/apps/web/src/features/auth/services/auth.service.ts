import { http } from "@/lib/api/http-client";
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  RegisterOrganizationPayload
} from "@/types/auth";

export async function login(payload: LoginPayload) {
  const { data } = await http.post<AuthResponse>("/auth/login", payload);
  return data;
}

export async function registerOrganization(payload: RegisterOrganizationPayload) {
  const { data } = await http.post<AuthResponse>("/auth/register-organization", payload);
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
