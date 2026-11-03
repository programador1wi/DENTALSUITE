import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/api/http-client";
import {
  backendToFrontendSettings,
  defaultSettings,
  frontendToBackendDto,
  type SchedulingMode,
  type SchedulingSettings
} from "./scheduling-settings-model";

export function useStoredSettings(mode: SchedulingMode) {
  const queryClient = useQueryClient();
  const queryKey = ["online-scheduling", mode];

  const { data: settings = defaultSettings(mode) } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const { data } = await http.get(`/online-scheduling/config?mode=${mode.toUpperCase()}`);
        return backendToFrontendSettings(data, mode);
      } catch {
        return defaultSettings(mode);
      }
    }
  });

  const mutation = useMutation({
    mutationFn: async (newSettings: SchedulingSettings) => {
      const dto = frontendToBackendDto(newSettings, mode);
      const { data } = await http.patch("/online-scheduling/config", dto);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["online-scheduling-config-online"] });
    }
  });

  const setSettings = (updater: SchedulingSettings | ((current: SchedulingSettings) => SchedulingSettings)) => {
    const currentData = queryClient.getQueryData<SchedulingSettings>(queryKey) ?? settings;
    const nextSettings = typeof updater === "function" ? updater(currentData) : updater;
    queryClient.setQueryData(queryKey, nextSettings);
    mutation.mutate(nextSettings);
  };

  return [settings, setSettings] as const;
}
