import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  acceptBudget,
  activateAlternative,
  addTreatmentPlanItem,
  addTreatmentPlanSection,
  applyBulkDiscountToTreatmentPlanItems,
  changeTreatmentPlanBranch,
  createAlternative,
  createBudget,
  createOrthodonticMonthlyItems,
  createTreatmentPlan,
  deactivateTreatmentPlan,
  deleteTreatmentPlanItem,
  duplicateTreatmentPlan,
  getBudget,
  getOrthodonticSummary,
  getTreatmentPlan,
  getTreatmentPlanProcedures,
  listOrthodonticEvolutions,
  listBudgets,
  listTreatmentPlans,
  pauseTreatmentPlan,
  printBudget,
  printTreatmentPlanDocument,
  rejectBudget,
  reactivateTreatmentPlan,
  resumeTreatmentPlan,
  sendBudget,
  startOrthodonticTreatment,
  updateOrthodonticDiagnosis,
  updateOrthodonticProfile,
  updateTreatmentPlan,
  updateTreatmentPlanItem,
  updateTreatmentPlanItemStatus,
  type BudgetStatus,
  type CreateTreatmentPlanPayload,
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

export function useOrthodonticSummary(id: string, enabled = true) {
  return useQuery({
    queryKey: ["orthodontic-summary", id],
    queryFn: () => getOrthodonticSummary(id),
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
    queryClient.invalidateQueries({ queryKey: ["orthodontic-summary"] });
    queryClient.invalidateQueries({ queryKey: ["orthodontic-evolutions"] });
  };

  const onError = (error: Error) => toast.error(error.message);

  return {
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
    startOrthodonticTreatment: useMutation({
      mutationFn: ({ id, startDate }: { id: string; startDate?: string }) =>
        startOrthodonticTreatment(id, { startDate }),
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
      mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
        duplicateTreatmentPlan(id, { reason }),
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
      }) => updateTreatmentPlanItemStatus(treatmentPlanId, itemId, { status, notes, completionPercentage, expectedVersion }),
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
