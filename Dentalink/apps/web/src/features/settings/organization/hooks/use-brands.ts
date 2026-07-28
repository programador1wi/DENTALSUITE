import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBrands, createBrand, updateBrand, deleteBrand } from "../services/brands.service";

export function useBrands() {
  return useQuery({
    queryKey: ["settings", "brands"],
    queryFn: getBrands
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "brands"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    }
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateBrand>[1] }) => updateBrand(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "brands"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    }
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "brands"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    }
  });
}
