import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createSchedule,
  createScheduleBlock,
  deactivateSchedule,
  deleteScheduleBlock,
  listFutureScheduleBlocks,
  listScheduleBlockConflicts,
  listSchedules,
  updateSchedule,
  updateProfessionalAgendaConfig,
  type ScheduleBlockPayload,
  type SchedulePayload
} from "../services/schedules.service";


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

export function useFutureScheduleBlocks(filters?: {
  professionalId?: string;
  branchId?: string;
  start?: string;
  end?: string;
}) {
  return useQuery({
    queryKey: ["settings", "schedule-blocks", filters],
    queryFn: () => listFutureScheduleBlocks(filters),
    enabled: Boolean(filters?.professionalId && filters?.branchId)
  });
}

export function useScheduleBlockConflicts(
  filters?: { professionalId: string; branchId: string; start: string; end: string },
  enabled = true
) {
  return useQuery({
    queryKey: ["settings", "schedule-block-conflicts", filters],
    queryFn: () => listScheduleBlockConflicts(filters as { professionalId: string; branchId: string; start: string; end: string }),
    enabled: enabled && Boolean(filters?.professionalId && filters?.branchId && filters?.start && filters?.end)
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

export function useCreateScheduleBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScheduleBlockPayload) => createScheduleBlock(payload),
    onSuccess: () => {
      toast.success("Bloqueo programado creado");
      queryClient.invalidateQueries({ queryKey: ["settings", "schedule-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useDeleteScheduleBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScheduleBlock(id),
    onSuccess: () => {
      toast.success("Bloqueo programado eliminado");
      queryClient.invalidateQueries({ queryKey: ["settings", "schedule-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useUpdateProfessionalAgendaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      professionalId,
      branchId,
      payload
    }: {
      professionalId: string;
      branchId: string;
      payload: {
        agendaSlotMinutes?: number | null;
        defaultAppointmentDurationMinutes?: number | null;
      };
    }) => updateProfessionalAgendaConfig(professionalId, branchId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "professionals"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}
