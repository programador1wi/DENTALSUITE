import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { http } from "@/lib/api/http-client";

// API Functions
const getUserPermissions = async (userId: string) => {
  const { data } = await http.get(`/users/${userId}/permissions`);
  return data;
};

const updateUserPermissions = async (userId: string, payload: any) => {
  const { data } = await http.patch(`/users/${userId}/permissions`, payload);
  return data;
};

const applyProfile = async (userId: string, profileId: string) => {
  const { data } = await http.post(`/users/${userId}/apply-profile`, { profileId });
  return data;
};

const copyPermissions = async (userId: string, sourceUserId: string) => {
  const { data } = await http.post(`/users/${userId}/copy-permissions`, { sourceUserId });
  return data;
};

const updateUserBranches = async (userId: string, payload: any) => {
  const { data } = await http.patch(`/users/${userId}/branches`, payload);
  return data;
};

// Hooks
export function useUserPermissionsQuery(userId: string) {
  return useQuery({
    queryKey: ["users", userId, "permissions"],
    queryFn: () => getUserPermissions(userId),
    enabled: !!userId,
  });
}

export function useUpdateUserPermissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: any }) => updateUserPermissions(userId, payload),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["users", userId, "permissions"] });
      toast.success("Permisos actualizados correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar los permisos");
    }
  });
}

export function useApplyProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, profileId }: { userId: string; profileId: string }) => applyProfile(userId, profileId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["users", userId, "permissions"] });
      toast.success("Perfil aplicado correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al aplicar el perfil");
    }
  });
}

export function useCopyPermissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, sourceUserId }: { userId: string; sourceUserId: string }) => copyPermissions(userId, sourceUserId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["users", userId, "permissions"] });
      toast.success("Permisos copiados correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al copiar los permisos");
    }
  });
}

export function useUpdateUserBranchesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: any }) => updateUserBranches(userId, payload),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["users", userId, "branches"] });
      toast.success("Sucursales actualizadas correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar las sucursales");
    }
  });
}
