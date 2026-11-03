import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCashDiscount,
  disableCashDiscount,
  duplicateCashDiscount,
  getCashDiscountConfigurationOptions,
  getCashDiscountAudit,
  listAvailableCashDiscounts,
  listCashDiscounts,
  previewCashDiscount,
  reactivateCashDiscount,
  updateCashDiscount,
  type CashDiscountPayload,
  type CashDiscountStatus
} from "../services/cash-discounts.service";

export function useCashDiscounts(
  params: {
    search?: string;
    status?: CashDiscountStatus;
    branchId?: string;
    type?: string;
    validity?: string;
  },
  enabled = true
) {
  return useQuery({
    queryKey: ["settings", "cash-discounts", params],
    queryFn: () => listCashDiscounts(params),
    enabled
  });
}

export function useCashDiscountConfigurationOptions(enabled = true) {
  return useQuery({
    queryKey: ["settings", "cash-discounts", "options"],
    queryFn: getCashDiscountConfigurationOptions,
    enabled
  });
}

export function useCashDiscountAudit(id?: string | null) {
  return useQuery({
    queryKey: ["settings", "cash-discounts", id, "audit"],
    queryFn: () => getCashDiscountAudit(id as string),
    enabled: Boolean(id)
  });
}

export function useCashDiscountMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings", "cash-discounts"] });
  return {
    create: useMutation({ mutationFn: createCashDiscount, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: CashDiscountPayload }) =>
        updateCashDiscount(id, payload),
      onSuccess: invalidate
    }),
    duplicate: useMutation({ mutationFn: duplicateCashDiscount, onSuccess: invalidate }),
    disable: useMutation({
      mutationFn: ({
        id,
        expectedVersion,
        reason
      }: {
        id: string;
        expectedVersion: number;
        reason?: string;
      }) => disableCashDiscount(id, { expectedVersion, reason }),
      onSuccess: invalidate
    }),
    reactivate: useMutation({
      mutationFn: ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
        reactivateCashDiscount(id, expectedVersion),
      onSuccess: invalidate
    })
  };
}

export function useAvailableCashDiscounts(patientId: string, branchId?: string, enabled = true) {
  return useQuery({
    queryKey: ["cash-discounts", "available", patientId, branchId],
    queryFn: () => listAvailableCashDiscounts(patientId, branchId as string),
    enabled: enabled && Boolean(patientId && branchId)
  });
}

export function useCashDiscountPreview() {
  return useMutation({
    mutationFn: ({
      patientId,
      payload
    }: {
      patientId: string;
      payload: Parameters<typeof previewCashDiscount>[1];
    }) => previewCashDiscount(patientId, payload)
  });
}
