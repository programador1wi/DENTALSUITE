import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/error";
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
  getAgreementDebtDetails,
  createCompanyPayment,
  createPayrollDiscountPlan,
  listExpenses,
  finalizePayroll,
  getExpenseSummary,
  listFinalizedPayroll,
  listPayroll,
  recalculatePayroll,
  updateAgreement,
  updateExpense,
  voidExpense,
  type Expense,
  type AgreementPayload,
  type AgreementDebtReportParams,
  type CompanyPaymentPayload,
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

export function useAgreementDebts(params: AgreementDebtReportParams, enabled = true) {
  return useQuery({
    queryKey: ["settings", "agreements", "debts", params],
    queryFn: () => listAgreementDebts(params),
    enabled
  });
}

export function useAgreementDebtDetails(
  agreementId: string | undefined,
  params: AgreementDebtReportParams & {
    patient?: string;
    dueFrom?: string;
    dueTo?: string;
    status?: string;
    installmentNumber?: number;
    folio?: string;
  },
  enabled = true
) {
  return useQuery({
    queryKey: ["settings", "agreements", "debts", "details", agreementId, params],
    queryFn: () => getAgreementDebtDetails(agreementId!, params),
    enabled: Boolean(agreementId) && enabled
  });
}

export function useCreateCompanyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      agreementId,
      payload,
      idempotencyKey
    }: {
      agreementId: string;
      payload: CompanyPaymentPayload;
      idempotencyKey: string;
    }) => createCompanyPayment(agreementId, payload, idempotencyKey),
    onSuccess: () => {
      toast.success("Pago empresarial registrado y aplicado");
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements", "debts"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useCreatePayrollDiscountPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      agreementId,
      payload
    }: {
      agreementId: string;
      payload: {
        treatmentPlanId: string;
        treatmentPlanItemIds: string[];
        installmentCount: number;
        firstDueDate: string;
        periodicity: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
      };
    }) => createPayrollDiscountPlan(agreementId, payload),
    onSuccess: () => {
      toast.success("Cargos empresariales generados");
      queryClient.invalidateQueries({ queryKey: ["settings", "agreements", "debts"] });
      queryClient.invalidateQueries({ queryKey: ["treatment-plan"] });
    },
    onError: (error: Error) => toast.error(error.message)
  });
}

export function useExpenses(params?: {
  search?: string;
  branchId?: string;
  month?: number;
  year?: number;
  status?: string;
  categoryId?: string;
}) {
  return useQuery({
    queryKey: ["settings", "expenses", params],
    queryFn: () => listExpenses(params)
  });
}

export function useExpenseSummary(params?: { branchId?: string; month?: number; year?: number }) {
  return useQuery({
    queryKey: ["settings", "expenses", "summary", params],
    queryFn: () => getExpenseSummary(params)
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload
    }: {
      id: string;
      payload: Partial<ExpensePayload> & { expectedVersion: number };
    }) => updateExpense(id, payload),
    onSuccess: () => {
      toast.success("Gasto actualizado");
      queryClient.invalidateQueries({ queryKey: ["settings", "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: handleExpenseMutationError
  });
}

export function useVoidExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expense, reason }: { expense: Expense; reason: string }) =>
      voidExpense(expense.id, { reason, expectedVersion: expense.version }),
    onSuccess: () => {
      toast.success("Gasto anulado");
      queryClient.invalidateQueries({ queryKey: ["settings", "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: handleExpenseMutationError
  });
}

function handleExpenseMutationError(error: Error) {
  if (error instanceof ApiError && error.code?.startsWith("EXPENSE_LOCKED_BY_")) return;
  toast.error(error.message);
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
