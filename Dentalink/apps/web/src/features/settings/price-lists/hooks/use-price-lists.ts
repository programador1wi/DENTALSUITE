import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPriceList,
  createPriceListCategory,
  deactivatePriceList,
  deactivatePriceListCategory,
  getPriceList,
  getPriceListAvailabilityMatrix,
  listPriceLists,
  updatePriceList,
  updatePriceListBranchAssignments,
  updatePriceListCategory,
  type BranchPriceListAssignmentPayload,
  type PriceListCategoryPayload,
  type PriceListPayload
} from "../services/price-lists.service";

export function usePriceLists(search?: string, active?: string, branchId?: string, enabled = true) {
  return useQuery({
    queryKey: ["settings", "price-lists", search, active, branchId],
    queryFn: () => listPriceLists({ search, active, branchId }),
    enabled
  });
}

export function usePriceList(id?: string) {
  return useQuery({
    queryKey: ["settings", "price-lists", id],
    queryFn: () => getPriceList(id ?? ""),
    enabled: Boolean(id)
  });
}

export function usePriceListAvailabilityMatrix() {
  return useQuery({
    queryKey: ["settings", "price-lists", "availability-matrix"],
    queryFn: getPriceListAvailabilityMatrix
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
    mutationFn: ({
      id,
      payload
    }: {
      id: string;
      payload: Partial<PriceListPayload> & { isActive?: boolean };
    }) => updatePriceList(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "price-lists"] })
  });
}

export function useUpdatePriceListBranchAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignments }: { id: string; assignments: BranchPriceListAssignmentPayload[] }) =>
      updatePriceListBranchAssignments(id, assignments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "price-lists"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    }
  });
}

export function useDeactivatePriceList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivatePriceList(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "price-lists"] })
  });
}

export function usePriceListCategoryMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings", "price-lists"] });

  return {
    createCategory: useMutation({
      mutationFn: ({ priceListId, payload }: { priceListId: string; payload: PriceListCategoryPayload }) =>
        createPriceListCategory(priceListId, payload),
      onSuccess: invalidate
    }),
    updateCategory: useMutation({
      mutationFn: ({
        priceListId,
        categoryId,
        payload
      }: {
        priceListId: string;
        categoryId: string;
        payload: PriceListCategoryPayload;
      }) => updatePriceListCategory(priceListId, categoryId, payload),
      onSuccess: invalidate
    }),
    deactivateCategory: useMutation({
      mutationFn: ({ priceListId, categoryId }: { priceListId: string; categoryId: string }) =>
        deactivatePriceListCategory(priceListId, categoryId),
      onSuccess: invalidate
    })
  };
}
