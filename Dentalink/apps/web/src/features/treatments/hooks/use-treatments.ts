import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  acceptBudget,
  activateAlternative,
  addTreatmentPlanItem,
  addTreatmentPlanSection,
  changeTreatmentPlanBranch,
  createAlternative,
  createBudget,
  createTreatmentPlan,
  deleteTreatmentPlanItem,
  getBudget,
  getTreatmentPlan,
  listBudgets,
  listTreatmentPlans,
  printBudget,
  rejectBudget,
  sendBudget,
  updateTreatmentPlan,
  updateTreatmentPlanItem,
  updateTreatmentPlanItemStatus,
  type BudgetStatus,
  type CreateTreatmentPlanPayload,
  type TreatmentPlanItemPayload,
  type TreatmentPlanStatus,
  type TreatmentPlanItemStatus
} from "../services/treatments.service";

export function useTreatmentPlans(params?: { patientId?: string; branchId?: string; professionalId?: string; status?: TreatmentPlanStatus }) {
  return useQuery({
    queryKey: ["treatment-plans", params],
    queryFn: () => listTreatmentPlans(params)
  });
}

export function useTreatmentPlan(id: string) {
  return useQuery({
    queryKey: ["treatment-plan", id],
    queryFn: () => getTreatmentPlan(id),
    enabled: Boolean(id)
  });
}

export function useBudgets(params?: { patientId?: string; treatmentPlanId?: string; status?: BudgetStatus }, enabled = true) {
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
  };

  const onError = (error: Error) => toast.error(error.message);

  return {
    createTreatmentPlan: useMutation({
      mutationFn: (payload: CreateTreatmentPlanPayload) => createTreatmentPlan(payload),
      onSuccess: invalidate,
      onError
    }),
    updateTreatmentPlan: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateTreatmentPlanPayload> & { status?: TreatmentPlanStatus } }) =>
        updateTreatmentPlan(id, payload),
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
      mutationFn: ({ treatmentPlanId, name, sortOrder }: { treatmentPlanId: string; name: string; sortOrder?: number }) =>
        addTreatmentPlanSection(treatmentPlanId, { name, sortOrder }),
      onSuccess: invalidate,
      onError
    }),
    addItem: useMutation({
      mutationFn: ({ treatmentPlanId, payload }: { treatmentPlanId: string; payload: TreatmentPlanItemPayload }) =>
        addTreatmentPlanItem(treatmentPlanId, payload),
      onSuccess: invalidate,
      onError
    }),
    updateItem: useMutation({
      mutationFn: ({ treatmentPlanId, itemId, payload }: { treatmentPlanId: string; itemId: string; payload: TreatmentPlanItemPayload }) =>
        updateTreatmentPlanItem(treatmentPlanId, itemId, payload),
      onSuccess: invalidate,
      onError
    }),
    deleteItem: useMutation({
      mutationFn: ({ treatmentPlanId, itemId }: { treatmentPlanId: string; itemId: string }) => deleteTreatmentPlanItem(treatmentPlanId, itemId),
      onSuccess: invalidate,
      onError
    }),
    createAlternative: useMutation({
      mutationFn: ({ parentId, payload }: { parentId: string; payload: CreateTreatmentPlanPayload }) => createAlternative(parentId, payload),
      onSuccess: invalidate,
      onError
    }),
    activateAlternative: useMutation({
      mutationFn: ({ parentId, alternativeId }: { parentId: string; alternativeId: string }) => activateAlternative(parentId, alternativeId),
      onSuccess: invalidate,
      onError
    }),
    updateItemStatus: useMutation({
      mutationFn: ({ treatmentPlanId, itemId, status, notes }: { treatmentPlanId: string; itemId: string; status: TreatmentPlanItemStatus; notes?: string }) =>
        updateTreatmentPlanItemStatus(treatmentPlanId, itemId, { status, notes }),
      onSuccess: invalidate,
      onError
    }),
    createBudget: useMutation({
      mutationFn: ({ treatmentPlanId, discountTotal, expiresAt, notes }: { treatmentPlanId: string; discountTotal?: number; expiresAt?: string; notes?: string }) =>
        createBudget(treatmentPlanId, { discountTotal, expiresAt, notes }),
      onSuccess: invalidate,
      onError
    }),
    sendBudget: useMutation({ mutationFn: (id: string) => sendBudget(id), onSuccess: invalidate, onError }),
    acceptBudget: useMutation({ mutationFn: (id: string) => acceptBudget(id), onSuccess: invalidate, onError }),
    rejectBudget: useMutation({ mutationFn: (id: string) => rejectBudget(id), onSuccess: invalidate, onError }),
    printBudget: useMutation({ mutationFn: (id: string) => printBudget(id), onError })
  };
}
