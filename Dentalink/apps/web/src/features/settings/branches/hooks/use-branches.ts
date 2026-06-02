import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBranch, deactivateBranch, listBranches, updateBranch, type BranchPayload } from "../services/branches.service";
import { useAuthStore } from "@/stores/auth.store";

export function useBranches(search?: string, status?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["settings", "branches", search, status, accessToken],
    queryFn: () => listBranches({ search, status }),
    enabled: Boolean(accessToken)
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BranchPayload) => createBranch(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "branches"] })
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BranchPayload> & { status?: "ACTIVE" | "INACTIVE" } }) =>
      updateBranch(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "branches"] })
  });
}

export function useDeactivateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateBranch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "branches"] })
  });
}
