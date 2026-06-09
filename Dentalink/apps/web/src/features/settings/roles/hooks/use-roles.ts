import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRole,
  deactivateRole,
  getRoleById,
  listRoles,
  updateRole,
  type CreateRolePayload,
  type RoleDetail,
  type RoleListItem,
  type UpdateRolePayload
} from "../services/roles.service";

export function useRolesQuery(search?: string, active?: string) {
  return useQuery<RoleListItem[], Error>({
    queryKey: ["settings", "roles", search, active],
    queryFn: () => listRoles({ search, active })
  });
}

export function useRoleDetailQuery(id: string) {
  return useQuery<RoleDetail, Error>({
    queryKey: ["settings", "roles", id],
    queryFn: () => getRoleById(id),
    enabled: Boolean(id)
  });
}

export function useDeactivateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateRole(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "roles"] })
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRolePayload) => createRole(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "roles"] })
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRolePayload }) => updateRole(id, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "roles", variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["settings", "roles"] });
    }
  });
}
