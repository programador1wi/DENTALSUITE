import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addPatientAlert,
  addPatientNote,
  changePatientBenefitCoverageStatus,
  completePatientTask,
  createPatientBenefitCoverage,
  createPatient,
  createPatientTask,
  deactivatePatient,
  getPatient,
  getPatientEmail,
  getPatientsAnalysis,
  getPatientTimeline,
  listPatientBenefitsCoverages,
  listPatientEmails,
  listPatientTasks,
  listPatients,
  mergePatients,
  searchPatients,
  sendPatientEmail,
  updatePatient,
  updatePatientBenefitCoverage,
  updatePatientTask,
  validatePatientInsurance,
  type PatientBenefitCoveragePayload,
  type PatientAnalysisQuery,
  type PatientEmailsQuery,
  type PatientMedicalAlertInput,
  type PatientPayload,
  type PatientTaskPayload,
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

export function usePatientBenefitsCoverages(id?: string) {
  return useQuery({
    queryKey: ["patients", "benefits-coverages", id],
    queryFn: () => listPatientBenefitsCoverages(id as string),
    enabled: Boolean(id)
  });
}

export function usePatientTasks(id?: string, includeCompleted = false) {
  return useQuery({
    queryKey: ["patients", "tasks", id, includeCompleted],
    queryFn: () => listPatientTasks(id as string, includeCompleted),
    enabled: Boolean(id)
  });
}

export function usePatientEmails(id?: string, params?: PatientEmailsQuery) {
  return useQuery({
    queryKey: ["patients", "emails", id, params],
    queryFn: () => listPatientEmails(id as string, params),
    enabled: Boolean(id)
  });
}

export function usePatientEmail(id?: string, emailId?: string) {
  return useQuery({
    queryKey: ["patients", "emails", id, emailId],
    queryFn: () => getPatientEmail(id as string, emailId as string),
    enabled: Boolean(id && emailId)
  });
}

export function useSendPatientEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
      idempotencyKey
    }: {
      id: string;
      payload: Parameters<typeof sendPatientEmail>[1];
      idempotencyKey: string;
    }) => sendPatientEmail(id, payload, idempotencyKey),
    onSuccess: (_, variables) => {
      toast.success("Correo enviado correctamente");
      queryClient.invalidateQueries({ queryKey: ["patients", "emails", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", variables.id] });
    },
    onError: (error: Error) => toast.error(error.message)
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

export function usePatientBenefitsCoverageMutations() {
  const queryClient = useQueryClient();
  const invalidate = (patientId: string) => {
    queryClient.invalidateQueries({ queryKey: ["patients", "benefits-coverages", patientId] });
    queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
    queryClient.invalidateQueries({ queryKey: ["patients"] });
  };

  return {
    createCoverage: useMutation({
      mutationFn: ({
        id,
        payload,
        idempotencyKey
      }: {
        id: string;
        payload: PatientBenefitCoveragePayload;
        idempotencyKey: string;
      }) => createPatientBenefitCoverage(id, payload, idempotencyKey),
      onSuccess: (_, variables) => {
        toast.success("Beneficio registrado");
        invalidate(variables.id);
      },
      onError: (error: Error) => toast.error(error.message)
    }),
    updateCoverage: useMutation({
      mutationFn: ({
        id,
        coverageId,
        payload
      }: {
        id: string;
        coverageId: string;
        payload: Partial<PatientBenefitCoveragePayload> & { expectedVersion?: number };
      }) => updatePatientBenefitCoverage(id, coverageId, payload),
      onSuccess: (_, variables) => {
        toast.success("Cobertura actualizada");
        invalidate(variables.id);
      },
      onError: (error: Error) => toast.error(error.message)
    }),
    changeStatus: useMutation({
      mutationFn: ({
        id,
        coverageId,
        action,
        reason
      }: {
        id: string;
        coverageId: string;
        action: "activate" | "deactivate" | "cancel";
        reason?: string;
      }) => changePatientBenefitCoverageStatus(id, coverageId, action, reason),
      onSuccess: (_, variables) => {
        toast.success("Estado de cobertura actualizado");
        invalidate(variables.id);
      },
      onError: (error: Error) => toast.error(error.message)
    }),
    validateInsurance: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof validatePatientInsurance>[1] }) =>
        validatePatientInsurance(id, payload),
      onSuccess: (_, variables) => {
        toast.success("Validacion registrada");
        invalidate(variables.id);
      },
      onError: (error: Error) => toast.error(error.message)
    })
  };
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
    mutationFn: ({
      id,
      note,
      isPrivate,
      fileAttachmentIds
    }: {
      id: string;
      note: string;
      isPrivate?: boolean;
      fileAttachmentIds?: string[];
    }) => addPatientNote(id, { note, isPrivate, fileAttachmentIds }),
    onSuccess: (_, variables) => {
      toast.success("Nota registrada");
      queryClient.invalidateQueries({ queryKey: ["patients", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["patients", "timeline", variables.id] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function usePatientTaskMutations() {
  const queryClient = useQueryClient();
  const invalidate = (patientId: string) => {
    queryClient.invalidateQueries({ queryKey: ["patients", "tasks", patientId] });
    queryClient.invalidateQueries({ queryKey: ["patients", "detail", patientId] });
  };

  return {
    createTask: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: PatientTaskPayload }) => createPatientTask(id, payload),
      onSuccess: (_, variables) => {
        toast.success("Tarea creada");
        invalidate(variables.id);
      },
      onError: (error: Error) => toast.error(error.message)
    }),
    updateTask: useMutation({
      mutationFn: ({
        id,
        taskId,
        payload
      }: {
        id: string;
        taskId: string;
        payload: Partial<PatientTaskPayload>;
      }) => updatePatientTask(id, taskId, payload),
      onSuccess: (_, variables) => {
        toast.success("Tarea actualizada");
        invalidate(variables.id);
      },
      onError: (error: Error) => toast.error(error.message)
    }),
    completeTask: useMutation({
      mutationFn: ({ id, taskId }: { id: string; taskId: string }) => completePatientTask(id, taskId),
      onSuccess: (_, variables) => {
        toast.success("Tarea finalizada");
        invalidate(variables.id);
      },
      onError: (error: Error) => toast.error(error.message)
    })
  };
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
