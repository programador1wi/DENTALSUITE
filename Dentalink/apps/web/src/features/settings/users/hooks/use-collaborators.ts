import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCollaborator,
  createProfessionalAccess,
  listCollaborators,
  type CreateCollaboratorPayload,
  type CreateProfessionalAccessPayload
} from "../services/collaborators.service";

export function useCollaboratorsQuery(params: Parameters<typeof listCollaborators>[0], enabled = true) {
  return useQuery({
    queryKey: ["settings", "collaborators", params],
    queryFn: () => listCollaborators(params),
    enabled
  });
}

export function useCreateCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCollaboratorPayload) => createCollaborator(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] });
    }
  });
}

export function useCreateProfessionalAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ professionalId, payload }: { professionalId: string; payload: CreateProfessionalAccessPayload }) =>
      createProfessionalAccess(professionalId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] });
    }
  });
}
