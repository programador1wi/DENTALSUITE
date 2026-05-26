import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProcedure,
  createProcedureCategory,
  deactivateProcedure,
  deactivateProcedureCategory,
  listProcedureCategories,
  listProcedures,
  type ProcedureCategoryPayload,
  type ProcedurePayload,
  updateProcedure,
  updateProcedureCategory
} from "../services/procedures.service";

export function useProcedureCategories(search?: string, active?: string) {
  return useQuery({
    queryKey: ["settings", "procedure-categories", search, active],
    queryFn: () => listProcedureCategories({ search, active })
  });
}

export function useProcedures(search?: string, active?: string, categoryId?: string) {
  return useQuery({
    queryKey: ["settings", "procedures", search, active, categoryId],
    queryFn: () => listProcedures({ search, active, categoryId })
  });
}

export function useProcedureMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["settings", "procedure-categories"] });
    queryClient.invalidateQueries({ queryKey: ["settings", "procedures"] });
  };

  return {
    createCategory: useMutation({ mutationFn: createProcedureCategory, onSuccess: invalidate }),
    updateCategory: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: ProcedureCategoryPayload }) => updateProcedureCategory(id, payload),
      onSuccess: invalidate
    }),
    deactivateCategory: useMutation({ mutationFn: deactivateProcedureCategory, onSuccess: invalidate }),
    createProcedure: useMutation({ mutationFn: createProcedure, onSuccess: invalidate }),
    updateProcedure: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: ProcedurePayload }) => updateProcedure(id, payload),
      onSuccess: invalidate
    }),
    deactivateProcedure: useMutation({ mutationFn: deactivateProcedure, onSuccess: invalidate })
  };
}
