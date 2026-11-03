import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createMassReprogrammingBatch,
  definitivelyCancelReprogrammingCase,
  getReprogrammingAvailability,
  getReprogrammingCase,
  listReprogrammingCases,
  previewMassReprogramming,
  rescheduleAppointmentCase,
  retryReprogrammingBatch,
  type ReprogrammingCaseStatus,
  type ReprogrammingCriteria,
  type RescheduleCasePayload
} from "../services/appointment-reprogramming.service";

export function useReprogrammingCases(params: {
  branchId?: string;
  professionalId?: string;
  search?: string;
  status?: ReprogrammingCaseStatus;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ["appointment-reprogramming", "cases", params],
    queryFn: () => listReprogrammingCases(params)
  });
}

export function useReprogrammingCase(caseId: string | null) {
  return useQuery({
    queryKey: ["appointment-reprogramming", "case", caseId],
    queryFn: () => {
      if (!caseId) throw new Error("caseId requerido");
      return getReprogrammingCase(caseId);
    },
    enabled: Boolean(caseId)
  });
}

export function useReprogrammingAvailability(params: {
  branchId: string;
  professionalId: string;
  chairId?: string;
  date: string;
  durationMinutes?: string;
}) {
  return useQuery({
    queryKey: ["appointment-reprogramming", "availability", params],
    queryFn: () => getReprogrammingAvailability(params),
    enabled: Boolean(params.branchId && params.professionalId && params.date && params.durationMinutes)
  });
}

export function usePreviewMassReprogramming() {
  return useMutation({
    mutationFn: (payload: ReprogrammingCriteria) => previewMassReprogramming(payload),
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useCreateMassReprogrammingBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey
    }: {
      payload: ReprogrammingCriteria & { selectedAppointmentIds: string[]; excludedAppointmentIds?: string[] };
      idempotencyKey: string;
    }) => createMassReprogrammingBatch(payload, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-reprogramming"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useRetryReprogrammingBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryReprogrammingBatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointment-reprogramming"] }),
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useRescheduleAppointmentCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, payload }: { caseId: string; payload: RescheduleCasePayload }) =>
      rescheduleAppointmentCase(caseId, payload),
    onSuccess: () => {
      toast.success("Cita reprogramada");
      queryClient.invalidateQueries({ queryKey: ["appointment-reprogramming"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useDefinitivelyCancelReprogrammingCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      payload
    }: {
      caseId: string;
      payload: { version: number; reason: string; observation?: string };
    }) => definitivelyCancelReprogrammingCase(caseId, payload),
    onSuccess: () => {
      toast.success("Caso cerrado sin nueva cita");
      queryClient.invalidateQueries({ queryKey: ["appointment-reprogramming"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}
