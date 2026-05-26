import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deactivateRole, listRoles, type RoleListItem } from "../services/roles.service";

export function useRolesQuery(search?: string, active?: string) {
  return useQuery<RoleListItem[], Error>({
    queryKey: ["settings", "roles", search, active],
    queryFn: () => listRoles({ search, active })
  });
}

export function useDeactivateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateRole(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "roles"] })
  });
}
