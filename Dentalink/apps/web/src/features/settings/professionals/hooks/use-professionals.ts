import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProfessional,
  deactivateProfessional,
  listProfessionals,
  updateProfessional,
  type ProfessionalPayload
} from "../services/professionals.service";

export function useProfessionals(search?: string, active?: string) {
  return useQuery({
    queryKey: ["settings", "professionals", search, active],
    queryFn: () => listProfessionals({ search, active })
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
