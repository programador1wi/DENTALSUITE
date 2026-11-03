import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createChair, deactivateChair, listChairs, updateChair, type ChairPayload } from "../services/chairs.service";

export function useChairs(search?: string, active?: string, branchId?: string, enabled = true) {
  return useQuery({
    queryKey: ["settings", "chairs", search, active, branchId],
    queryFn: () => listChairs({ search, active, branchId }),
    enabled
  });
}

export function useCreateChair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChairPayload) => createChair(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "chairs"] })
  });
}

export function useUpdateChair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ChairPayload> & { isActive?: boolean } }) =>
      updateChair(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "chairs"] })
  });
}

export function useDeactivateChair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateChair(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "chairs"] })
  });
}
