import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFinancialInstitution,
  deactivateFinancialInstitution,
  listFinancialInstitutions,
  updateFinancialInstitution,
  type FinancialInstitutionPayload
} from "../services/financial-institutions.service";

export function useFinancialInstitutions(search?: string, active?: string) {
  return useQuery({
    queryKey: ["settings", "financial-institutions", search, active],
    queryFn: () => listFinancialInstitutions({ search, active })
  });
}

function useInvalidateFinancialInstitutions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["settings", "financial-institutions"] });
}

export function useCreateFinancialInstitution() {
  const invalidate = useInvalidateFinancialInstitutions();
  return useMutation({ mutationFn: createFinancialInstitution, onSuccess: invalidate });
}

export function useUpdateFinancialInstitution() {
  const invalidate = useInvalidateFinancialInstitutions();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<FinancialInstitutionPayload> & { isActive?: boolean } }) =>
      updateFinancialInstitution(id, payload),
    onSuccess: invalidate
  });
}

export function useDeactivateFinancialInstitution() {
  const invalidate = useInvalidateFinancialInstitutions();
  return useMutation({ mutationFn: deactivateFinancialInstitution, onSuccess: invalidate });
}
