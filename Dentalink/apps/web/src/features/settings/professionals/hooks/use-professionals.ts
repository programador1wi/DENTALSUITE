import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkUpdateProfessionalContracts,
  createProfessional,
  deactivateProfessional,
  listProfessionals,
  previewBulkProfessionalContracts,
  transferProfessionalBranch,
  updateProfessional,
  type BulkProfessionalContractPayload,
  type ProfessionalBranchTransferPayload,
  type ProfessionalPayload
} from "../services/professionals.service";

type ProfessionalQueryOptions = {
  branchId?: string;
  page?: number;
  pageSize?: number;
};

export function useProfessionals(search?: string, active?: string, options?: ProfessionalQueryOptions) {
  return useQuery({
    queryKey: ["settings", "professionals", search, active, options],
    queryFn: () => listProfessionals({ search, active, ...options })
  });
}

export function useCreateProfessional() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfessionalPayload) => createProfessional(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] })
  });
}

export function useUpdateProfessional() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProfessionalPayload> & { isActive?: boolean } }) =>
      updateProfessional(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] })
  });
}

export function useDeactivateProfessional() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateProfessional(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] })
  });
}

export function useTransferProfessionalBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfessionalBranchTransferPayload) => transferProfessionalBranch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "schedules"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    }
  });
}

export function useBulkUpdateProfessionalContracts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkProfessionalContractPayload) => bulkUpdateProfessionalContracts(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "payroll"] });
    }
  });
}

export function useBulkProfessionalContractPreview() {
  return useMutation({
    mutationFn: (payload: BulkProfessionalContractPayload) => previewBulkProfessionalContracts(payload)
  });
}
