import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deactivateRole,
  getRoleById,
  listRoles,
  updateRolePermissions,
  type RoleDetail,
  type RoleListItem
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

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, permissionIds }: { id: string; permissionIds: string[] }) =>
      updateRolePermissions(id, permissionIds),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "roles", variables.id] });
      void queryClient.invalidateQueries({ queryKey: ["settings", "roles"] });
    }
  });
}
