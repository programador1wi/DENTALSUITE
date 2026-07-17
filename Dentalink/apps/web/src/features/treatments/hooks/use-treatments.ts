import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  acceptBudget,
  activateAlternative,
  addTreatmentPlanItem,
  addTreatmentPlanSection,
  applyTreatmentPlanReprice,
  applyBulkDiscountToTreatmentPlanItems,
  changeTreatmentPlanBranch,
  createAlternative,
  createBudget,
  createOrthodonticDiagnosisFieldOption,
  createOrthodonticFieldOption,
  createOrthodonticMonthlyItems,
  createTreatmentPlan,
  deactivateOrthodonticDiagnosisFieldOption,
  deactivateOrthodonticFieldOption,
  deactivateTreatmentPlan,
  deleteTreatmentPlanItem,
  duplicateTreatmentPlan,
  generateTreatmentPlanDocument,
  getBudget,
  getOrthodonticDiagnosis,
  getOrthodonticDiagnosisStatus,
  getOrthodonticSummary,
  getTreatmentPlan,
  getTreatmentPlanPriceCatalog,
  getTreatmentPlanPrintOptions,
  getTreatmentPlanProcedures,
  listOrthodonticEvolutions,
  listBudgets,
  listOrthodonticDiagnosisCatalog,
  listTreatmentPlans,
  pauseTreatmentPlan,
  previewTreatmentPlanDocument,
  previewTreatmentPlanReprice,
  printBudget,
  printTreatmentPlanDocument,
  rejectBudget,
  reactivateOrthodonticDiagnosisFieldOption,
  reactivateOrthodonticFieldOption,
  reactivateTreatmentPlan,
  resumeTreatmentPlan,
  sendBudget,
  saveOrthodonticDiagnosisActive,
  saveOrthodonticDiagnosisDraft,
  sortOrthodonticDiagnosisFieldOptions,
  sortOrthodonticFieldOptions,
  startOrthodonticTreatment,
  listOrthodonticOptionFields,
  updateOrthodonticDiagnosisFieldOption,
  updateOrthodonticFieldOption,
  updateOrthodonticDiagnosis,
  updateOrthodonticProfile,
  updateTreatmentPlan,
  updateTreatmentPlanItem,
  updateTreatmentPlanItemStatus,
  type BudgetStatus,
  type CreateTreatmentPlanPayload,
  type SaveOrthodonticDiagnosisPayload,
  type OrthodonticProfilePayload,
  type TreatmentPlanPrintDocumentType,
  type TreatmentPlanKind,
  type TreatmentPlanItemPayload,
  type TreatmentPlanStatus,
  type TreatmentPlanItemStatus
} from "../services/treatments.service";

export function useTreatmentPlans(
  params?: {
    patientId?: string;
    branchId?: string;
    professionalId?: string;
    status?: TreatmentPlanStatus;
    kind?: TreatmentPlanKind;
  },
  enabled = true
) {
  return useQuery({
    queryKey: ["treatment-plans", params],
    queryFn: () => listTreatmentPlans(params),
    enabled
  });
}

export function useTreatmentPlan(id: string) {
  return useQuery({
    queryKey: ["treatment-plan", id],
    queryFn: () => getTreatmentPlan(id),
    enabled: Boolean(id)
  });
}

export function useTreatmentPlanProcedures(id: string, enabled = true) {
  return useQuery({
    queryKey: ["treatment-plan-procedures", id],
    queryFn: () => getTreatmentPlanProcedures(id),
    enabled: Boolean(id) && enabled
  });
}

export function useTreatmentPlanPriceCatalog(id: string, enabled = true) {
  return useQuery({
    queryKey: ["treatment-plan-price-catalog", id],
    queryFn: () => getTreatmentPlanPriceCatalog(id),
    enabled: Boolean(id) && enabled
  });
}

export function useTreatmentPlanPrintOptions(id: string, enabled = true) {
  return useQuery({
    queryKey: ["treatment-plan-print-options", id],
    queryFn: () => getTreatmentPlanPrintOptions(id),
    enabled: Boolean(id) && enabled
  });
}

export function useOrthodonticSummary(id: string, enabled = true) {
  return useQuery({
    queryKey: ["orthodontic-summary", id],
    queryFn: () => getOrthodonticSummary(id),
    enabled: Boolean(id) && enabled
  });
}

export function useOrthodonticOptionFields(enabled = true) {
  return useQuery({
    queryKey: ["orthodontic-option-fields"],
    queryFn: listOrthodonticOptionFields,
    enabled
  });
}

export function useOrthodonticDiagnosisCatalog(enabled = true) {
  return useQuery({
    queryKey: ["orthodontic-diagnosis-catalog"],
    queryFn: listOrthodonticDiagnosisCatalog,
    enabled
  });
}

export function useOrthodonticDiagnosisStatus(id: string, enabled = true) {
  return useQuery({
    queryKey: ["orthodontic-diagnosis-status", id],
    queryFn: () => getOrthodonticDiagnosisStatus(id),
    enabled: Boolean(id) && enabled
  });
}

export function useOrthodonticDiagnosis(id: string, enabled = true) {
  return useQuery({
    queryKey: ["orthodontic-diagnosis", id],
    queryFn: () => getOrthodonticDiagnosis(id),
    enabled: Boolean(id) && enabled
  });
}

export function useOrthodonticEvolutions(
  id: string,
  params?: {
    page?: number;
    pageSize?: number;
    dateFrom?: string;
    dateTo?: string;
    professionalId?: string;
    hasHygiene?: boolean;
    search?: string;
  },
  enabled = true
) {
  return useQuery({
    queryKey: ["orthodontic-evolutions", id, params],
    queryFn: () => listOrthodonticEvolutions(id, params),
    enabled: Boolean(id) && enabled
  });
}

export function useBudgets(
  params?: { patientId?: string; treatmentPlanId?: string; status?: BudgetStatus },
  enabled = true
) {
  return useQuery({
    queryKey: ["budgets", params],
    queryFn: () => listBudgets(params),
    enabled
  });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: ["budget", id],
    queryFn: () => getBudget(id),
    enabled: Boolean(id)
  });
}

export function useTreatmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
    queryClient.invalidateQueries({ queryKey: ["treatment-plan"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["budget"] });
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["patient"] });
    queryClient.invalidateQueries({ queryKey: ["clinical"] });
    queryClient.invalidateQueries({ queryKey: ["patient-payments"] });
    queryClient.invalidateQueries({ queryKey: ["treatment-plan-procedures"] });
    queryClient.invalidateQueries({ queryKey: ["treatment-plan-price-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["treatment-plan-print-options"] });
    queryClient.invalidateQueries({ queryKey: ["orthodontic-summary"] });
    queryClient.invalidateQueries({ queryKey: ["orthodontic-evolutions"] });
    queryClient.invalidateQueries({ queryKey: ["orthodontic-option-fields"] });
    queryClient.invalidateQueries({ queryKey: ["orthodontic-diagnosis"] });
    queryClient.invalidateQueries({ queryKey: ["orthodontic-diagnosis-status"] });
    queryClient.invalidateQueries({ queryKey: ["orthodontic-diagnosis-catalog"] });
  };

  const onError = (error: Error) => toast.error(error.message);

  return {
    previewReprice: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload?: { itemIds?: string[]; clinicalDate?: string } }) =>
        previewTreatmentPlanReprice(id, payload ?? {}),
      onError
    }),
    applyReprice: useMutation({
      mutationFn: ({
        id,
        payload
      }: {
        id: string;
        payload: { itemIds?: string[]; clinicalDate?: string; reason: string };
      }) => applyTreatmentPlanReprice(id, payload),
      onSuccess: invalidate,
      onError
    }),
    createTreatmentPlan: useMutation({
      mutationFn: (payload: CreateTreatmentPlanPayload) => createTreatmentPlan(payload),
      onSuccess: invalidate,
      onError
    }),
    updateTreatmentPlan: useMutation({
      mutationFn: ({
        id,
        payload
      }: {
        id: string;
        payload: Partial<CreateTreatmentPlanPayload> & { status?: TreatmentPlanStatus };
      }) => updateTreatmentPlan(id, payload),
      onSuccess: invalidate,
      onError
    }),
    updateOrthodonticProfile: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: OrthodonticProfilePayload }) =>
        updateOrthodonticProfile(id, payload),
      onSuccess: invalidate,
      onError
    }),
    updateOrthodonticDiagnosis: useMutation({
      mutationFn: ({ id, diagnosis }: { id: string; diagnosis: Record<string, unknown> }) =>
        updateOrthodonticDiagnosis(id, { diagnosis }),
      onSuccess: invalidate,
      onError
    }),
    saveOrthodonticDiagnosisDraft: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: SaveOrthodonticDiagnosisPayload }) =>
        saveOrthodonticDiagnosisDraft(id, payload),
      onSuccess: invalidate,
      onError
    }),
    saveOrthodonticDiagnosisActive: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: SaveOrthodonticDiagnosisPayload }) =>
        saveOrthodonticDiagnosisActive(id, payload),
      onSuccess: invalidate,
      onError
    }),
    startOrthodonticTreatment: useMutation({
      mutationFn: ({
        id,
        payload
      }: {
        id: string;
        payload: { startDate?: string; durationMonths?: number };
      }) => startOrthodonticTreatment(id, payload),
      onSuccess: invalidate,
      onError
    }),
    createOrthodonticMonthlyItems: useMutation({
      mutationFn: ({
        id,
        payload
      }: {
        id: string;
        payload: {
          procedureId: string;
          months: number;
          unitPrice?: number;
          startDate?: string;
          sectionName?: string;
          notes?: string;
        };
      }) => createOrthodonticMonthlyItems(id, payload),
      onSuccess: invalidate,
      onError
    }),
    createOrthodonticFieldOption: useMutation({
      mutationFn: ({ fieldId, label }: { fieldId: string; label: string }) =>
        createOrthodonticFieldOption(fieldId, { label }),
      onSuccess: invalidate,
      onError
    }),
    updateOrthodonticFieldOption: useMutation({
      mutationFn: ({
        optionId,
        payload
      }: {
        optionId: string;
        payload: { label?: string; sortOrder?: number; deactivationReason?: string };
      }) => updateOrthodonticFieldOption(optionId, payload),
      onSuccess: invalidate,
      onError
    }),
    deactivateOrthodonticFieldOption: useMutation({
      mutationFn: ({ optionId, reason }: { optionId: string; reason?: string }) =>
        deactivateOrthodonticFieldOption(optionId, { deactivationReason: reason }),
      onSuccess: invalidate,
      onError
    }),
    reactivateOrthodonticFieldOption: useMutation({
      mutationFn: (optionId: string) => reactivateOrthodonticFieldOption(optionId),
      onSuccess: invalidate,
      onError
    }),
    sortOrthodonticFieldOptions: useMutation({
      mutationFn: ({ fieldId, optionIds }: { fieldId: string; optionIds: string[] }) =>
        sortOrthodonticFieldOptions(fieldId, optionIds),
      onSuccess: invalidate,
      onError
    }),
    createOrthodonticDiagnosisFieldOption: useMutation({
      mutationFn: ({ fieldId, label }: { fieldId: string; label: string }) =>
        createOrthodonticDiagnosisFieldOption(fieldId, { label }),
      onSuccess: invalidate,
      onError
    }),
    updateOrthodonticDiagnosisFieldOption: useMutation({
      mutationFn: ({
        optionId,
        payload
      }: {
        optionId: string;
        payload: { label?: string; sortOrder?: number; deactivationReason?: string };
      }) => updateOrthodonticDiagnosisFieldOption(optionId, payload),
      onSuccess: invalidate,
      onError
    }),
    deactivateOrthodonticDiagnosisFieldOption: useMutation({
      mutationFn: ({ optionId, reason }: { optionId: string; reason?: string }) =>
        deactivateOrthodonticDiagnosisFieldOption(optionId, { deactivationReason: reason }),
      onSuccess: invalidate,
      onError
    }),
    reactivateOrthodonticDiagnosisFieldOption: useMutation({
      mutationFn: (optionId: string) => reactivateOrthodonticDiagnosisFieldOption(optionId),
      onSuccess: invalidate,
      onError
    }),
    sortOrthodonticDiagnosisFieldOptions: useMutation({
      mutationFn: ({ fieldId, optionIds }: { fieldId: string; optionIds: string[] }) =>
        sortOrthodonticDiagnosisFieldOptions(fieldId, optionIds),
      onSuccess: invalidate,
      onError
    }),
    changeBranch: useMutation({
      mutationFn: ({
        id,
        branchId,
        professionalId,
        moveFutureAppointments
      }: {
        id: string;
        branchId: string;
        professionalId: string;
        moveFutureAppointments?: boolean;
      }) => changeTreatmentPlanBranch(id, { branchId, professionalId, moveFutureAppointments }),
      onSuccess: invalidate,
      onError
    }),
    addSection: useMutation({
      mutationFn: ({
        treatmentPlanId,
        name,
        sortOrder
      }: {
        treatmentPlanId: string;
        name: string;
        sortOrder?: number;
      }) => addTreatmentPlanSection(treatmentPlanId, { name, sortOrder }),
      onSuccess: invalidate,
      onError
    }),
    addItem: useMutation({
      mutationFn: ({
        treatmentPlanId,
        payload
      }: {
        treatmentPlanId: string;
        payload: TreatmentPlanItemPayload;
      }) => addTreatmentPlanItem(treatmentPlanId, payload),
      onSuccess: invalidate,
      onError
    }),
    updateItem: useMutation({
      mutationFn: ({
        treatmentPlanId,
        itemId,
        payload
      }: {
        treatmentPlanId: string;
        itemId: string;
        payload: TreatmentPlanItemPayload;
      }) => updateTreatmentPlanItem(treatmentPlanId, itemId, payload),
      onSuccess: invalidate,
      onError
    }),
    deleteItem: useMutation({
      mutationFn: ({ treatmentPlanId, itemId }: { treatmentPlanId: string; itemId: string }) =>
        deleteTreatmentPlanItem(treatmentPlanId, itemId),
      onSuccess: invalidate,
      onError
    }),
    duplicateTreatmentPlan: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) => duplicateTreatmentPlan(id, { reason }),
      onSuccess: invalidate,
      onError
    }),
    createAlternative: useMutation({
      mutationFn: ({ parentId, payload }: { parentId: string; payload: CreateTreatmentPlanPayload }) =>
        createAlternative(parentId, payload),
      onSuccess: invalidate,
      onError
    }),
    activateAlternative: useMutation({
      mutationFn: ({ parentId, alternativeId }: { parentId: string; alternativeId: string }) =>
        activateAlternative(parentId, alternativeId),
      onSuccess: invalidate,
      onError
    }),
    updateItemStatus: useMutation({
      mutationFn: ({
        treatmentPlanId,
        itemId,
        status,
        completionPercentage,
        expectedVersion,
        notes
      }: {
        treatmentPlanId: string;
        itemId: string;
        status: TreatmentPlanItemStatus;
        completionPercentage?: number;
        expectedVersion?: number;
        notes?: string;
      }) =>
        updateTreatmentPlanItemStatus(treatmentPlanId, itemId, {
          status,
          notes,
          completionPercentage,
          expectedVersion
        }),
      onSuccess: invalidate,
      onError
    }),
    applyBulkDiscount: useMutation({
      mutationFn: ({
        treatmentPlanId,
        itemIds,
        discountType,
        value
      }: {
        treatmentPlanId: string;
        itemIds: string[];
        discountType: "PERCENTAGE" | "AMOUNT";
        value: number;
      }) => applyBulkDiscountToTreatmentPlanItems(treatmentPlanId, { itemIds, discountType, value }),
      onSuccess: invalidate,
      onError
    }),
    createBudget: useMutation({
      mutationFn: ({
        treatmentPlanId,
        discountTotal,
        expiresAt,
        notes
      }: {
        treatmentPlanId: string;
        discountTotal?: number;
        expiresAt?: string;
        notes?: string;
      }) => createBudget(treatmentPlanId, { discountTotal, expiresAt, notes }),
      onSuccess: invalidate,
      onError
    }),
    sendBudget: useMutation({ mutationFn: (id: string) => sendBudget(id), onSuccess: invalidate, onError }),
    acceptBudget: useMutation({
      mutationFn: (id: string) => acceptBudget(id),
      onSuccess: invalidate,
      onError
    }),
    rejectBudget: useMutation({
      mutationFn: (id: string) => rejectBudget(id),
      onSuccess: invalidate,
      onError
    }),
    printBudget: useMutation({ mutationFn: (id: string) => printBudget(id), onError }),
    printTreatmentPlanDocument: useMutation({
      mutationFn: ({
        treatmentPlanId,
        type,
        budgetId
      }: {
        treatmentPlanId: string;
        type: TreatmentPlanPrintDocumentType;
        budgetId?: string;
      }) => printTreatmentPlanDocument(treatmentPlanId, { type, budgetId }),
      onError
    }),
    previewTreatmentPlanDocument: useMutation({
      mutationFn: ({
        treatmentPlanId,
        type,
        budgetId
      }: {
        treatmentPlanId: string;
        type: TreatmentPlanPrintDocumentType;
        budgetId?: string;
      }) => previewTreatmentPlanDocument(treatmentPlanId, { type, budgetId }),
      onError
    }),
    generateTreatmentPlanDocument: useMutation({
      mutationFn: ({
        treatmentPlanId,
        type,
        budgetId
      }: {
        treatmentPlanId: string;
        type: TreatmentPlanPrintDocumentType;
        budgetId?: string;
      }) => generateTreatmentPlanDocument(treatmentPlanId, { type, budgetId }),
      onError
    }),
    deactivateTreatmentPlan: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
        deactivateTreatmentPlan(id, { reason }),
      onSuccess: invalidate,
      onError
    }),
    reactivateTreatmentPlan: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
        reactivateTreatmentPlan(id, { reason }),
      onSuccess: invalidate,
      onError
    }),
    pauseTreatment: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) => pauseTreatmentPlan(id, { reason }),
      onSuccess: invalidate,
      onError
    }),
    resumeTreatment: useMutation({
      mutationFn: (id: string) => resumeTreatmentPlan(id),
      onSuccess: invalidate,
      onError
    })
  };
}
