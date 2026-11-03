import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPaymentMethod,
  deactivatePaymentMethod,
  listPaymentMethods,
  listPaymentMethodAudit,
  reactivatePaymentMethod,
  updatePaymentMethod,
  type PaymentMethod,
  type PaymentMethodPayload
} from "../services/payment-methods.service";

type PaymentMethodFilters = {
  type?: PaymentMethod["type"];
  allowsRefund?: string;
  acceptsMultipleSettlements?: string;
};

export function usePaymentMethods(
  search?: string,
  active?: string,
  enabled = true,
  filters: PaymentMethodFilters = {}
) {
  return useQuery({
    queryKey: ["settings", "payment-methods", search, active, filters],
    queryFn: () => listPaymentMethods({ search, active, ...filters }),
    enabled
  });
}

export function usePaymentMethodAudit(id?: string, enabled = true) {
  return useQuery({
    queryKey: ["settings", "payment-methods", id, "audit"],
    queryFn: () => listPaymentMethodAudit(id!),
    enabled: Boolean(id) && enabled
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PaymentMethodPayload) => createPaymentMethod(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "payment-methods"] })
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload
    }: {
      id: string;
      payload: Partial<PaymentMethodPayload> & { expectedVersion: number };
    }) => updatePaymentMethod(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "payment-methods"] })
  });
}

export function useDeactivatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedVersion, reason }: { id: string; expectedVersion: number; reason?: string }) =>
      deactivatePaymentMethod(id, expectedVersion, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "payment-methods"] })
  });
}

export function useReactivatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
      reactivatePaymentMethod(id, expectedVersion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "payment-methods"] })
  });
}
