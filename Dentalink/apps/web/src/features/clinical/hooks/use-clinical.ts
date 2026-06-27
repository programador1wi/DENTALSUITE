import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  comparePeriodontalCharts,
  cancelOdontogramRecord,
  createPeriodontalChart,
  createAllergy,
  createCondition,
  createDocumentFromTemplate,
  createDocumentTemplate,
  createEvolution,
  createToothCondition,
  createToothProcedure,
  createEvolutionAddendum,
  createMedication,
  createPrescription,
  listAppointmentHistory,
  getOdontogram,
  getToothHistory,
  getClinicalSummary,
  listPeriodontalCharts,
  listDocumentTemplates,
  listDocuments,
  listEvolutions,
  listPrescriptions,
  printPrescription,
  updatePrescriptionStatus,
  signEvolution,
  updateToothProcedureStatus,
  upsertMedicalHistory,
  type MedicalHistory,
  type PeriodontalMeasurement,
  type ToothProcedureStatus
} from "../services/clinical.service";

export function useClinicalSummary(patientId: string) {
  return useQuery({ queryKey: ["clinical", patientId, "summary"], queryFn: () => getClinicalSummary(patientId), enabled: Boolean(patientId) });
}

export function useClinicalAppointmentHistory(patientId: string) {
  return useQuery({
    queryKey: ["clinical", patientId, "appointment-history"],
    queryFn: () => listAppointmentHistory(patientId),
    enabled: Boolean(patientId)
  });
}

export function useClinicalEvolutions(patientId: string) {
  return useQuery({ queryKey: ["clinical", patientId, "evolutions"], queryFn: () => listEvolutions(patientId), enabled: Boolean(patientId) });
}

export function useClinicalPrescriptions(patientId: string) {
  return useQuery({ queryKey: ["clinical", patientId, "prescriptions"], queryFn: () => listPrescriptions(patientId), enabled: Boolean(patientId) });
}

export function useClinicalDocuments(patientId: string) {
  return useQuery({ queryKey: ["clinical", patientId, "documents"], queryFn: () => listDocuments(patientId), enabled: Boolean(patientId) });
}

export function useClinicalTemplates(patientId: string) {
  return useQuery({ queryKey: ["clinical", patientId, "templates"], queryFn: () => listDocumentTemplates(patientId), enabled: Boolean(patientId) });
}

export function useOdontogram(patientId: string, toothNumber?: string) {
  return useQuery({
    queryKey: ["clinical", patientId, "odontogram", toothNumber ?? "all"],
    queryFn: () => getOdontogram(patientId, toothNumber),
    enabled: Boolean(patientId)
  });
}

export function useToothHistory(patientId: string, toothNumber: string) {
  return useQuery({
    queryKey: ["clinical", patientId, "odontogram-history", toothNumber],
    queryFn: () => getToothHistory(patientId, toothNumber),
    enabled: Boolean(patientId && toothNumber)
  });
}

export function usePeriodontalCharts(patientId: string) {
  return useQuery({
    queryKey: ["clinical", patientId, "periodontogram"],
    queryFn: () => listPeriodontalCharts(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePeriodontalComparison(patientId: string, chartAId?: string, chartBId?: string) {
  return useQuery({
    queryKey: ["clinical", patientId, "periodontogram-compare", chartAId, chartBId],
    queryFn: () => comparePeriodontalCharts(patientId, chartAId!, chartBId!),
    enabled: Boolean(patientId && chartAId && chartBId && chartAId !== chartBId)
  });
}

export function useClinicalMutations(patientId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["clinical", patientId] });
  const options = { onSuccess: invalidate, onError: (error: Error) => toast.error(error.message) };

  return {
    upsertHistory: useMutation({ mutationFn: (payload: Partial<MedicalHistory>) => upsertMedicalHistory(patientId, payload), ...options }),
    createAllergy: useMutation({ mutationFn: (payload: { name: string; reaction?: string; severity?: string; notes?: string }) => createAllergy(patientId, payload), ...options }),
    createMedication: useMutation({ mutationFn: (payload: { name: string; dosage?: string; frequency?: string; notes?: string }) => createMedication(patientId, payload), ...options }),
    createCondition: useMutation({ mutationFn: (payload: { name: string; notes?: string }) => createCondition(patientId, payload), ...options }),
    createEvolution: useMutation({ mutationFn: (payload: Record<string, unknown>) => createEvolution(patientId, payload), ...options }),
    signEvolution: useMutation({ mutationFn: (evolutionId: string) => signEvolution(patientId, evolutionId), ...options }),
    createAddendum: useMutation({
      mutationFn: ({ evolutionId, professionalId, notes }: { evolutionId: string; professionalId: string; notes: string }) =>
        createEvolutionAddendum(patientId, evolutionId, { professionalId, notes }),
      ...options
    }),
    createPrescription: useMutation({ mutationFn: (payload: Record<string, unknown>) => createPrescription(patientId, payload), ...options }),
    printPrescription: useMutation({ mutationFn: (prescriptionId: string) => printPrescription(patientId, prescriptionId), ...options }),
    updatePrescriptionStatus: useMutation({
      mutationFn: ({ prescriptionId, status }: { prescriptionId: string; status: string }) =>
        updatePrescriptionStatus(patientId, prescriptionId, status),
      ...options
    }),
    createDocumentFromTemplate: useMutation({ mutationFn: (payload: { templateId: string; title: string }) => createDocumentFromTemplate(patientId, payload), ...options }),
    createDocumentTemplate: useMutation({
      mutationFn: (payload: { name: string; description?: string; content: string }) => createDocumentTemplate(patientId, payload),
      ...options
    }),
    createToothCondition: useMutation({
      mutationFn: (payload: { professionalId: string; appointmentId?: string; toothNumber: string; surface?: string; condition: string; diagnosis?: string; notes?: string }) =>
        createToothCondition(patientId, payload),
      ...options
    }),
    cancelOdontogramRecord: useMutation({ mutationFn: (odontogramRecordId: string) => cancelOdontogramRecord(patientId, odontogramRecordId), ...options }),
    createToothProcedure: useMutation({
      mutationFn: (payload: {
        professionalId: string;
        appointmentId?: string;
        procedureId?: string;
        treatmentPlanId?: string;
        toothNumber: string;
        surface?: string;
        diagnosis?: string;
        status?: ToothProcedureStatus;
        notes?: string;
      }) => createToothProcedure(patientId, payload),
      ...options
    }),
    updateToothProcedureStatus: useMutation({
      mutationFn: ({
        toothProcedureId,
        status,
        notes,
        createClinicalEvolution
      }: {
        toothProcedureId: string;
        status: ToothProcedureStatus;
        notes?: string;
        createClinicalEvolution?: boolean;
      }) => updateToothProcedureStatus(patientId, toothProcedureId, { status, notes, createClinicalEvolution }),
      ...options
    }),
    createPeriodontalChart: useMutation({
      mutationFn: (payload: { professionalId: string; appointmentId?: string; chartDate: string; notes?: string; measurements: PeriodontalMeasurement[] }) =>
        createPeriodontalChart(patientId, payload),
      ...options
    })
  };
}
