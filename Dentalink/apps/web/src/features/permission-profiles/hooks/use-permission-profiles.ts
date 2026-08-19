import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { http } from "@/lib/api/http-client";

// API Functions
const getPermissionProfiles = async () => {
  const { data } = await http.get(`/permission-profiles`);
  return data;
};

const getPermissionProfile = async (id: string) => {
  const { data } = await http.get(`/permission-profiles/${id}`);
  return data;
};

const createProfile = async (payload: any) => {
  const { data } = await http.post(`/permission-profiles`, payload);
  return data;
};

const updateProfile = async (id: string, payload: any) => {
  const { data } = await http.patch(`/permission-profiles/${id}`, payload);
  return data;
};

// Hooks
export function usePermissionProfilesQuery() {
  return useQuery({
    queryKey: ["permission-profiles"],
    queryFn: getPermissionProfiles,
  });
}

export function usePermissionProfileQuery(id: string) {
  return useQuery({
    queryKey: ["permission-profiles", id],
    queryFn: () => getPermissionProfile(id),
    enabled: !!id,
  });
}

export function useCreateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles"] });
      toast.success("Perfil creado correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear el perfil");
    }
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => updateProfile(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["permission-profiles", id] });
      toast.success("Perfil actualizado correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar el perfil");
    }
  });
}
