import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addPatientAlert,
  addPatientNote,
  createPatient,
  deactivatePatient,
  getPatient,
  getPatientsAnalysis,
  getPatientTimeline,
  listPatients,
  mergePatients,
  searchPatients,
  updatePatient,
  type PatientAnalysisQuery,
  type PatientMedicalAlertInput,
  type PatientPayload,
  type PatientsQuery
} from "../services/patients.service";

export function usePatients(params?: PatientsQuery) {
  return useQuery({
    queryKey: ["patients", "list", params],
    queryFn: () => listPatients(params)
  });
}

export function usePatientsAnalysis(params?: PatientAnalysisQuery) {
  return useQuery({
    queryKey: ["patients", "analysis", params],
    queryFn: () => getPatientsAnalysis(params)
  });
}

export function usePatientSearch(params: {
  q?: string;
  phone?: string;
  email?: string;
  documentNumber?: string;
}) {
  return useQuery({
    queryKey: ["patients", "search", params],
    queryFn: () => searchPatients(params),
    enabled: Boolean(params.q || params.phone || params.email || params.documentNumber)
  });
}

export function usePatient(id?: string) {
  return useQuery({
    queryKey: ["patients", "detail", id],
    queryFn: () => getPatient(id as string),
    enabled: Boolean(id)
  });
}

export function usePatientTimeline(id?: string) {
  return useQuery({
    queryKey: ["patients", "timeline", id],
    queryFn: () => getPatientTimeline(id as string),
    enabled: Boolean(id)
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatientPayload) => createPatient(payload),
    onSuccess: () => {
      toast.success("Paciente creado");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PatientPayload> }) =>
      updatePatient(id, payload),
    onSuccess: (_, variables) => {
      toast.success("Paciente actualizado");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", variables.id] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useDeactivatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivatePatient(id),
    onSuccess: () => {
      toast.success("Paciente desactivado");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useAddPatientNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, isPrivate }: { id: string; note: string; isPrivate?: boolean }) =>
      addPatientNote(id, { note, isPrivate }),
    onSuccess: (_, variables) => {
      toast.success("Nota registrada");
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["patients", "timeline", variables.id] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useAddPatientAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PatientMedicalAlertInput }) =>
      addPatientAlert(id, payload),
    onSuccess: (_, variables) => {
      toast.success("Alerta medica registrada");
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["patients", "timeline", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["patients", "list"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useMergePatients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mergePatients,
    onSuccess: () => {
      toast.success("Fichas fusionadas");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}
