import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrganizationSettings, updateOrganizationSettings } from "../services/organization.service";

export function useOrganizationSettings(enabled = true) {
  return useQuery({
    queryKey: ["settings", "organization"],
    queryFn: getOrganizationSettings,
    enabled
  });
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOrganizationSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "organization"] })
  });
}
