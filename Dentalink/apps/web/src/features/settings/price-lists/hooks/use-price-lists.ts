import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPriceList, deactivatePriceList, listPriceLists, updatePriceList, type PriceListPayload } from "../services/price-lists.service";

export function usePriceLists(search?: string, active?: string) {
  return useQuery({
    queryKey: ["settings", "price-lists", search, active],
    queryFn: () => listPriceLists({ search, active })
  });
}

export function useCreatePriceList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PriceListPayload) => createPriceList(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "price-lists"] })
  });
}

export function useUpdatePriceList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PriceListPayload> & { isActive?: boolean } }) =>
      updatePriceList(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "price-lists"] })
  });
}

export function useDeactivatePriceList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivatePriceList(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "price-lists"] })
  });
}
