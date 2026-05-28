import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  deactivateUser,
  listUsers,
  lockAllUserAccess,
  updateUser,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserListItem
} from "../services/users.service";

export function useUsersQuery(search?: string, status?: string, branchId?: string) {
  return useQuery<UserListItem[], Error>({
    queryKey: ["settings", "users", search, status, branchId],
    queryFn: () => listUsers({ search, status, branchId })
  });
}

export function useLockAllUserAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: lockAllUserAccess,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "users"] })
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "users"] })
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) => updateUser(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "users"] })
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "users"] })
  });
}
