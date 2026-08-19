import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { changePassword, me, updateProfile } from "../services/auth.service";
import type { AuthUser, ChangePasswordPayload, UpdateProfilePayload } from "@/types/auth";
import { useAuthStore } from "@/stores/auth.store";

export function useMeQuery(enabled = true) {
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery<AuthUser, Error>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const currentUser = await me();
      setUser(currentUser);
      return currentUser;
    },
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always"
  });

  return query;
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation<AuthUser, Error, UpdateProfilePayload>({
    mutationFn: updateProfile,
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.setQueryData(["auth", "me"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Perfil actualizado correctamente");
    },
    onError: (error) => {
      toast.error(error.message || "Error al actualizar el perfil");
    }
  });
}

export function useChangePasswordMutation() {
  return useMutation<{ success: boolean; message: string }, Error, ChangePasswordPayload>({
    mutationFn: changePassword,
    onSuccess: (res) => {
      toast.success(res.message || "Contraseña actualizada exitosamente");
    },
    onError: (error) => {
      toast.error(error.message || "Error al cambiar la contraseña");
    }
  });
}
