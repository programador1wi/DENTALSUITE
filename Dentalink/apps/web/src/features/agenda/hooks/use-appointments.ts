import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addAppointmentNote,
  arriveAppointment,
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointmentReminder,
  createAppointment,
  createAppointmentsBatch,
  deleteAppointment,
  getAvailability,
  getAppointment,
  listAppointmentNotes,
  listAppointmentReminders,
  listAppointments,
  noShowAppointment,
  rescheduleAppointment,
  startAppointment,
  updateAppointmentReminder,
  updateAppointment,
  waitingRoomAppointment,
  type AppointmentNotePayload,
  type AppointmentPayload,
  type AppointmentQuery,
  type AppointmentReminderPayload,
  type AppointmentReminderUpdatePayload,
  type CreateAppointmentsBatchPayload,
  type RescheduleAppointmentPayload
} from "../services/appointments.service";

export function useAppointments(params: AppointmentQuery, enabled = true) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: () => listAppointments(params),
    enabled
  });
}

export function useAppointment(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["appointments", id],
    queryFn: () => {
      if (!id) throw new Error("ID required");
      return getAppointment(id);
    },
    enabled: enabled && Boolean(id)
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

export function useAppointmentNotes(id: string, enabled = true) {
  return useQuery({
    queryKey: ["appointments", id, "notes"],
    queryFn: () => listAppointmentNotes(id),
    enabled: enabled && Boolean(id)
  });
}

export function useAppointmentReminders(id: string, enabled = true) {
  return useQuery({
    queryKey: ["appointments", id, "reminders"],
    queryFn: () => listAppointmentReminders(id),
    enabled: enabled && Boolean(id)
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

export function useCreateAppointmentsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAppointmentsBatchPayload) => createAppointmentsBatch(payload),
    onSuccess: () => {
      toast.success("Citas creadas");
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

export function useAddAppointmentNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AppointmentNotePayload }) => addAppointmentNote(id, payload),
    onSuccess: (_data, variables) => {
      toast.success("Comentario agregado");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments", variables.id, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-history", variables.id] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useCreateAppointmentReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AppointmentReminderPayload }) => createAppointmentReminder(id, payload),
    onSuccess: (_data, variables) => {
      toast.success("Recordatorio registrado");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments", variables.id, "reminders"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-history", variables.id] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useUpdateAppointmentReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reminderId,
      payload
    }: {
      id: string;
      reminderId: string;
      payload: AppointmentReminderUpdatePayload;
    }) => updateAppointmentReminder(id, reminderId, payload),
    onSuccess: (_data, variables) => {
      toast.success("Recordatorio actualizado");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments", variables.id, "reminders"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-history", variables.id] });
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
    cancel: useMutation({
      mutationFn: ({ id, reason, cancelledBy }: { id: string; reason: string; cancelledBy?: "patient" | "clinic" | "conflict" | "rescheduled" }) =>
        cancelAppointment(id, { reason, cancelledBy }),
      ...options
    }),
    reschedule: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: RescheduleAppointmentPayload }) => rescheduleAppointment(id, payload),
      ...options
    })
  };
}
