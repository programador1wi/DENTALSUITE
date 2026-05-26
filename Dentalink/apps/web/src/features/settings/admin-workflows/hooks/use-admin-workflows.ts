import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  assignAgreementPatients,
  createAgreement,
  createExpense,
  deactivateAgreement,
  listAgreements,
  listAgreementDebts,
  payAgreementDebt,
  listExpenses,
  finalizePayroll,
  listFinalizedPayroll,
  listPayroll,
  updateAgreement,
  type AgreementPayload,
  type ExpensePayload
} from "../services/admin-workflows.service";

export function useAgreements(search?: string, active?: string) {
  return useQuery({
    queryKey: ["settings", "agreements", search, active],
    queryFn: () => listAgreements({ search, active })
  });
}

export function useCreateAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgreementPayload) => createAgreement(payload),
    onSuccess: () => {
      toast.success("Convenio creado");
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useUpdateAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AgreementPayload> & { isActive?: boolean } }) =>
      updateAgreement(id, payload),
    onSuccess: () => {
      toast.success("Convenio actualizado");
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useDeactivateAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateAgreement,
    onSuccess: () => {
      toast.success("Convenio desactivado");
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useAssignAgreementPatients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patientIds }: { id: string; patientIds: string[] }) => assignAgreementPatients(id, patientIds),
    onSuccess: () => {
      toast.success("Pacientes asignados al convenio");
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useAgreementDebts() {
  return useQuery({
    queryKey: ["settings", "agreements", "debts"],
    queryFn: listAgreementDebts
  });
}

export function usePayAgreementDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payAgreementDebt,
    onSuccess: (data) => {
      toast.success(`Deuda de $${data.amountPaid} pagada correctamente`);
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements", "debts"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useExpenses(params?: { search?: string; branchId?: string; month?: number; year?: number }) {
  return useQuery({
    queryKey: ["settings", "expenses", params],
    queryFn: () => listExpenses(params)
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExpensePayload) => createExpense(payload),
    onSuccess: () => {
      toast.success("Gasto registrado");
      queryClient.invalidateQueries({ queryKey: ["settings", "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function usePayroll(branchId?: string) {
  return useQuery({
    queryKey: ["settings", "payroll", "active", branchId],
    queryFn: () => listPayroll(branchId)
  });
}

export function useFinalizedPayroll(branchId?: string) {
  return useQuery({
    queryKey: ["settings", "payroll", "finalized", branchId],
    queryFn: () => listFinalizedPayroll(branchId)
  });
}

export function useFinalizePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: finalizePayroll,
    onSuccess: () => {
      toast.success("Liquidacion finalizada");
      queryClient.invalidateQueries({ queryKey: ["settings", "payroll"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}
