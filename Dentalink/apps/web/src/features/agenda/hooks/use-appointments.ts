import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  arriveAppointment,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  deleteAppointment,
  getAvailability,
  listAppointments,
  noShowAppointment,
  rescheduleAppointment,
  startAppointment,
  updateAppointment,
  waitingRoomAppointment,
  type AppointmentPayload,
  type AppointmentQuery
} from "../services/appointments.service";

export function useAppointments(params: AppointmentQuery) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: () => listAppointments(params)
  });
}

export function useAvailability(params: {
  branchId: string;
  professionalId: string;
  chairId?: string;
  date: string;
  durationMinutes?: string;
}) {
  return useQuery({
    queryKey: ["appointments", "availability", params],
    queryFn: () => getAvailability(params),
    enabled: Boolean(params.branchId && params.professionalId && params.date)
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AppointmentPayload) => createAppointment(payload),
    onSuccess: () => {
      toast.success("Cita creada");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AppointmentPayload> }) => updateAppointment(id, payload),
    onSuccess: () => {
      toast.success("Cita actualizada");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useAppointmentActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["appointments"] });
  const options = {
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message)
  };

  return {
    confirm: useMutation({ mutationFn: confirmAppointment, ...options }),
    arrive: useMutation({ mutationFn: arriveAppointment, ...options }),
    waitingRoom: useMutation({ mutationFn: waitingRoomAppointment, ...options }),
    start: useMutation({ mutationFn: startAppointment, ...options }),
    complete: useMutation({ mutationFn: completeAppointment, ...options }),
    noShow: useMutation({ mutationFn: noShowAppointment, ...options }),
    remove: useMutation({ mutationFn: deleteAppointment, ...options }),
    cancel: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelAppointment(id, { reason }), ...options }),
    reschedule: useMutation({
      mutationFn: ({ id, startAt, endAt, reason }: { id: string; startAt: string; endAt: string; reason?: string }) =>
        rescheduleAppointment(id, { startAt, endAt, reason }),
      ...options
    })
  };
}
