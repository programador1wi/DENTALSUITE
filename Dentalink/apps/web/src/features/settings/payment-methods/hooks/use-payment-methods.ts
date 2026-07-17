import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPaymentMethod,
  deactivatePaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
  type PaymentMethodPayload
} from "../services/payment-methods.service";

export function usePaymentMethods(search?: string, active?: string, enabled = true) {
  return useQuery({
    queryKey: ["settings", "payment-methods", search, active],
    queryFn: () => listPaymentMethods({ search, active }),
    enabled
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
      payload: Partial<PaymentMethodPayload> & { isActive?: boolean };
    }) => updatePaymentMethod(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "payment-methods"] })
  });
}

export function useDeactivatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivatePaymentMethod(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "payment-methods"] })
  });
}
