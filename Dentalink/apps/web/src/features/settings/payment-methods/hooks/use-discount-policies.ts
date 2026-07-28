import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUserDiscountPolicies,
  updateUserDiscountPolicy
} from "../services/discount-policies.service";

export function useUserDiscountPolicies(params: {
  search?: string;
  permission: "WITH_PERMISSION" | "WITHOUT_PERMISSION" | "ALL";
  active: "true" | "false" | "all";
}) {
  return useQuery({
    queryKey: ["settings", "user-discount-policies", params],
    queryFn: () => listUserDiscountPolicies(params)
  });
}

export function useUpdateUserDiscountPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      maximumDiscountPercent,
      expectedVersion
    }: {
      userId: string;
      maximumDiscountPercent: number;
      expectedVersion?: number;
    }) => updateUserDiscountPolicy(userId, { maximumDiscountPercent, expectedVersion }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "user-discount-policies"] })
  });
}
