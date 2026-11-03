import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authStoreApi } from "@/stores/auth.store";
import {
  createUser,
  deactivateUser,
  listUsers,
  lockAllUserAccess,
  reactivateUser,
  updateUser,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserListItem
} from "../services/users.service";

export function useUsersQuery(search?: string, status?: string, branchId?: string, enabled = true) {
  return useQuery<UserListItem[], Error>({
    queryKey: ["settings", "users", search, status, branchId],
    queryFn: () => listUsers({ search, status, branchId }),
    enabled
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "collaborators"] });
      if (authStoreApi.getState().user?.id === variables.id) {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    }
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "collaborators"] });
      if (authStoreApi.getState().user?.id === userId) {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    }
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivateUser(id),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["settings", "users"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "collaborators"] });
      if (authStoreApi.getState().user?.id === userId) {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    }
  });
}
