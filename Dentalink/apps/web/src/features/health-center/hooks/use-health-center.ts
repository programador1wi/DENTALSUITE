import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import {
  archiveBrand,
  createBranchForBrand,
  createBrand,
  getHealthCenter,
  restoreBrand,
  updateBrand,
  type BrandPayload
} from "../services/health-center.service";
import type { BranchPayload } from "@/features/settings/branches/services/branches.service";

const HEALTH_CENTER_QUERY_KEY = ["health-center"];

export function useHealthCenter(params: { search?: string; status?: string }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: [...HEALTH_CENTER_QUERY_KEY, params.search ?? "", params.status ?? "", accessToken],
    queryFn: () => getHealthCenter(params),
    enabled: Boolean(accessToken)
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BrandPayload) => createBrand(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HEALTH_CENTER_QUERY_KEY })
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BrandPayload }) => updateBrand(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HEALTH_CENTER_QUERY_KEY })
  });
}

export function useArchiveBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveBrand(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HEALTH_CENTER_QUERY_KEY })
  });
}

export function useRestoreBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreBrand(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HEALTH_CENTER_QUERY_KEY })
  });
}

export function useCreateHealthCenterBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, payload }: { brandId: string; payload: BranchPayload }) => createBranchForBrand(brandId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HEALTH_CENTER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["settings", "branches"] });
    }
  });
}
