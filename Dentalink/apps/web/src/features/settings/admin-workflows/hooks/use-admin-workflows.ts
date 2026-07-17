import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  assignAgreementPatients,
  createAgreement,
  createAgreementVersion,
  cancelAgreement,
  createExpense,
  deactivateAgreement,
  duplicateAgreement,
  getAgreement,
  listAgreements,
  previewAgreementPrice,
  publishAgreement,
  listAgreementDebts,
  payAgreementDebt,
  listExpenses,
  finalizePayroll,
  listFinalizedPayroll,
  listPayroll,
  recalculatePayroll,
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

export function useAgreement(id?: string) {
  return useQuery({
    queryKey: ["settings", "agreements", id],
    queryFn: () => getAgreement(id!),
    enabled: Boolean(id)
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
    mutationFn: ({
      id,
      payload
    }: {
      id: string;
      payload: Partial<AgreementPayload> & { isActive?: boolean };
    }) => updateAgreement(id, payload),
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

function useAgreementAction<T, R>(mutationFn: (input: T) => Promise<R>, success: string) {
  const queryClient = useQueryClient();
  return useMutation<R, Error, T>({
    mutationFn,
    onSuccess: () => {
      toast.success(success);
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useCreateAgreementVersion() {
  return useAgreementAction(
    ({ id, payload }: { id: string; payload: AgreementPayload }) => createAgreementVersion(id, payload),
    "Versión creada"
  );
}

export function usePublishAgreement() {
  return useAgreementAction(
    ({ id, version }: { id: string; version?: number }) => publishAgreement(id, version),
    "Convenio publicado"
  );
}

export function useCancelAgreement() {
  return useAgreementAction(cancelAgreement, "Convenio cancelado");
}

export function useDuplicateAgreement() {
  return useAgreementAction(duplicateAgreement, "Convenio duplicado como borrador");
}

export function useAgreementPreview() {
  return useAgreementAction(
    ({ id, ...params }: { id: string; branchId: string; procedureId: string; quantity?: number }) =>
      previewAgreementPrice(id, params),
    "Previsualización actualizada"
  );
}

export function useAssignAgreementPatients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patientIds }: { id: string; patientIds: string[] }) =>
      assignAgreementPatients(id, patientIds),
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

export function useRecalculatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recalculatePayroll,
    onSuccess: () => {
      toast.success("Liquidacion recalculada");
      queryClient.invalidateQueries({ queryKey: ["settings", "payroll"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}
