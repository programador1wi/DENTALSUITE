import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSchedule, deactivateSchedule, listSchedules, updateSchedule, type SchedulePayload } from "../services/schedules.service";

type ScheduleFilters = {
  professionalId?: string;
  branchId?: string;
  dayOfWeek?: string;
  active?: string;
};

export function useSchedules(filters?: ScheduleFilters) {
  return useQuery({
    queryKey: ["settings", "schedules", filters],
    queryFn: () => listSchedules(filters)
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SchedulePayload) => createSchedule(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "schedules"] })
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SchedulePayload> & { isActive?: boolean } }) =>
      updateSchedule(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "schedules"] })
  });
}

export function useDeactivateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateSchedule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "schedules"] })
  });
}
