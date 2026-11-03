import { http } from "@/lib/api/http-client";

export type UserDiscountPolicyRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  branches: Array<{ id: string; name: string }>;
  isActive: boolean;
  hasPermission: boolean;
  maximumDiscountPercent: string;
  policyVersion: number | null;
  updatedAt: string | null;
  updatedById: string | null;
  updatedByName: string | null;
};

export async function listUserDiscountPolicies(params: {
  search?: string;
  permission?: "WITH_PERMISSION" | "WITHOUT_PERMISSION" | "ALL";
  active?: "true" | "false" | "all";
}) {
  const { data } = await http.get<UserDiscountPolicyRow[]>("/discount-policies/users", { params });
  return data;
}

export async function updateUserDiscountPolicy(
  userId: string,
  payload: { maximumDiscountPercent: number; expectedVersion?: number }
) {
  const { data } = await http.put<{
    userId: string;
    maximumDiscountPercent: string;
    version: number;
    updatedAt: string;
  }>(`/discount-policies/users/${userId}`, payload);
  return data;
}
