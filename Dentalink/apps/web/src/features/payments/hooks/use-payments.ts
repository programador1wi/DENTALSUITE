import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addPaymentAllocations,
  closeCashRegister,
  createCashMovement,
  createInstallmentPlan,
  createPayment,
  createPaymentLink,
  createRefund,
  cancelPaymentSettlement,
  getPatientBalance,
  getPatientBalanceByPlan,
  getPatientBillingSummary,
  getPatientLedger,
  getPatientPaymentBehavior,
  getPatientPaymentDistribution,
  getCashBoxSummary,
  getCashCollectionSummary,
  getCashPaymentsByPeriod,
  getCashPaymentsByProfessional,
  getCashRegister,
  getCurrentCashRegister,
  listAccountsReceivable,
  listCashRegisters,
  listCancelledPendingPayments,
  listInstallments,
  listPatientFinancialDocuments,
  listPatientOnlineBenefits,
  listPatientPayments,
  listPatientReimbursementRequests,
  listPatientVoidedPayments,
  listPaymentLinks,
  listPaymentSettlements,
  listPayments,
  listRefunds,
  openCashRegister,
  payInstallment,
  removePaymentAllocation,
  receivePaymentSettlement,
  updatePayment,
  voidPayment,
  type CancelledPendingPaymentLinkStatus,
  type CashRegisterListParams,
  type CashReportQuery,
  type PaymentStatus,
  type PaymentSettlementStatus,
  type RefundStatus
} from "../services/payments.service";

export function usePayments(params?: {
  patientId?: string;
  branchId?: string;
  search?: string;
  status?: PaymentStatus;
}) {
  return useQuery({
    queryKey: ["payments", params],
    queryFn: () => listPayments(params)
  });
}

export function useCancelledPendingPayments(params?: {
  branchId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  linkStatus?: CancelledPendingPaymentLinkStatus | "";
}) {
  return useQuery({
    queryKey: ["payments", "cancelled-pending", params],
    queryFn: () => listCancelledPendingPayments(params)
  });
}

export function usePaymentSettlements(params?: {
  branchId?: string;
  paymentMethodId?: string;
  status?: PaymentSettlementStatus;
  dueFrom?: string;
  dueTo?: string;
}) {
  return useQuery({
    queryKey: ["payment-settlements", params],
    queryFn: () => listPaymentSettlements(params)
  });
}

export function usePaymentSettlementMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payment-settlements"] });
  return {
    receive: useMutation({
      mutationFn: ({
        id,
        ...payload
      }: {
        id: string;
        cashRegisterId: string;
        expectedVersion: number;
        receivedAt?: string;
        reference?: string;
        financialInstitutionId?: string;
      }) => receivePaymentSettlement(id, payload),
      onSuccess: invalidate
    }),
    cancel: useMutation({
      mutationFn: ({ id, ...payload }: { id: string; expectedVersion: number; reason: string }) =>
        cancelPaymentSettlement(id, payload),
      onSuccess: invalidate
    })
  };
}

export function usePatientPayments(patientId: string) {
  return useQuery({
    queryKey: ["patient-payments", patientId],
    queryFn: () => listPatientPayments(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePatientBillingSummary(patientId: string) {
  return useQuery({
    queryKey: ["patient-billing-summary", patientId],
    queryFn: () => getPatientBillingSummary(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePatientFinancialDocuments(patientId: string, params?: { type?: string; status?: string }) {
  return useQuery({
    queryKey: ["patient-financial-documents", patientId, params],
    queryFn: () => listPatientFinancialDocuments(patientId, params),
    enabled: Boolean(patientId)
  });
}

export function usePatientReimbursementRequests(patientId: string, params?: { status?: string }) {
  return useQuery({
    queryKey: ["patient-reimbursement-requests", patientId, params],
    queryFn: () => listPatientReimbursementRequests(patientId, params),
    enabled: Boolean(patientId)
  });
}

export function usePatientOnlineBenefits(patientId: string, params?: { status?: string }) {
  return useQuery({
    queryKey: ["patient-online-benefits", patientId, params],
    queryFn: () => listPatientOnlineBenefits(patientId, params),
    enabled: Boolean(patientId)
  });
}

export function usePatientVoidedPayments(patientId: string) {
  return useQuery({
    queryKey: ["patient-voided-payments", patientId],
    queryFn: () => listPatientVoidedPayments(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePatientBalance(patientId: string) {
  return useQuery({
    queryKey: ["patient-balance", patientId],
    queryFn: () => getPatientBalance(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePatientLedger(patientId: string) {
  return useQuery({
    queryKey: ["patient-ledger", patientId],
    queryFn: () => getPatientLedger(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePatientPaymentBehavior(patientId: string) {
  return useQuery({
    queryKey: ["patient-payment-behavior", patientId],
    queryFn: () => getPatientPaymentBehavior(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePatientPaymentDistribution(patientId: string) {
  return useQuery({
    queryKey: ["patient-payment-distribution", patientId],
    queryFn: () => getPatientPaymentDistribution(patientId),
    enabled: Boolean(patientId)
  });
}

export function usePatientBalanceByPlan(patientId: string) {
  return useQuery({
    queryKey: ["patient-balance-by-plan", patientId],
    queryFn: () => getPatientBalanceByPlan(patientId),
    enabled: Boolean(patientId)
  });
}

export function useRefunds(
  params?: { patientId?: string; treatmentPlanId?: string; status?: RefundStatus },
  enabled = true
) {
  return useQuery({
    queryKey: ["refunds", params],
    queryFn: () => listRefunds(params),
    enabled
  });
}

export function useAccountsReceivable(params?: { branchId?: string; patientId?: string; search?: string }) {
  return useQuery({
    queryKey: ["accounts-receivable", params],
    queryFn: () => listAccountsReceivable(params)
  });
}

export function usePaymentLinks(params?: {
  patientId?: string;
  status?: "CREATED" | "PAID" | "EXPIRED" | "CANCELLED";
}) {
  return useQuery({
    queryKey: ["payment-links", params],
    queryFn: () => listPaymentLinks(params)
  });
}

export function useInstallments(params?: {
  patientId?: string;
  installmentPlanId?: string;
  status?: string;
  dueBefore?: string;
}) {
  return useQuery({
    queryKey: ["installments", params],
    queryFn: () => listInstallments(params)
  });
}

export function useCashRegisters(params?: CashRegisterListParams) {
  return useQuery({
    queryKey: ["cash-register", params],
    queryFn: () => listCashRegisters(params)
  });
}

export function useCashRegisterDetail(registerId?: string | null) {
  return useQuery({
    queryKey: ["cash-register", "detail", registerId],
    queryFn: () => getCashRegister(registerId as string),
    enabled: Boolean(registerId)
  });
}

export function useCurrentCashRegister(branchId?: string | null) {
  return useQuery({
    queryKey: ["cash-register", "current", branchId],
    queryFn: () => getCurrentCashRegister(branchId as string),
    enabled: Boolean(branchId)
  });
}

export function usePaymentsMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["payments", "cancelled-pending"] });
    queryClient.invalidateQueries({ queryKey: ["patient-payments"] });
    queryClient.invalidateQueries({ queryKey: ["patient-billing-summary"] });
    queryClient.invalidateQueries({ queryKey: ["patient-financial-documents"] });
    queryClient.invalidateQueries({ queryKey: ["patient-voided-payments"] });
    queryClient.invalidateQueries({ queryKey: ["patient-balance"] });
    queryClient.invalidateQueries({ queryKey: ["patient-ledger"] });
    queryClient.invalidateQueries({ queryKey: ["patient-payment-behavior"] });
    queryClient.invalidateQueries({ queryKey: ["patient-payment-distribution"] });
    queryClient.invalidateQueries({ queryKey: ["patient-balance-by-plan"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
    queryClient.invalidateQueries({ queryKey: ["installments"] });
    queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    queryClient.invalidateQueries({ queryKey: ["patient"] });
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
    queryClient.invalidateQueries({ queryKey: ["treatment-plan"] });
  };
  const onError = (error: Error) => toast.error(error.message);

  return {
    createPayment: useMutation({
      mutationFn: createPayment,
      onSuccess: () => {
        toast.success("Pago registrado");
        invalidate();
      },
      onError
    }),
    updatePayment: useMutation({
      mutationFn: ({
        paymentId,
        payload
      }: {
        paymentId: string;
        payload: {
          paymentMethodId?: string;
          financialInstitutionId?: string;
          reference?: string;
          notes?: string;
          paidAt?: string;
        };
      }) => updatePayment(paymentId, payload),
      onSuccess: () => {
        toast.success("Pago actualizado");
        invalidate();
      },
      onError
    }),
    allocatePayment: useMutation({
      mutationFn: ({
        paymentId,
        allocations
      }: {
        paymentId: string;
        allocations: Array<{ treatmentPlanItemId: string; amount: number }>;
      }) => addPaymentAllocations(paymentId, allocations),
      onSuccess: () => {
        toast.success("Pago aplicado");
        invalidate();
      },
      onError
    }),
    removeAllocation: useMutation({
      mutationFn: (allocationId: string) => removePaymentAllocation(allocationId),
      onSuccess: () => {
        toast.success("Pago desasociado");
        invalidate();
      },
      onError
    }),
    createRefund: useMutation({
      mutationFn: ({
        paymentId,
        ...payload
      }: {
        paymentId: string;
        amount: number;
        reason?: string;
        paymentMethodId?: string;
        financialInstitutionId?: string;
        reference?: string;
      }) => createRefund(paymentId, payload),
      onSuccess: () => {
        toast.success("Devolucion registrada");
        invalidate();
      },
      onError
    }),
    voidPayment: useMutation({
      mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
        voidPayment(paymentId, { reason }),
      onSuccess: () => {
        toast.success("Pago anulado");
        invalidate();
      },
      onError
    }),
    createPaymentLink: useMutation({
      mutationFn: createPaymentLink,
      onSuccess: () => {
        toast.success("Link de pago creado");
        invalidate();
      },
      onError
    }),
    createInstallmentPlan: useMutation({
      mutationFn: createInstallmentPlan,
      onSuccess: () => {
        toast.success("Plan de cuotas creado");
        invalidate();
      },
      onError
    }),
    payInstallment: useMutation({
      mutationFn: payInstallment,
      onSuccess: () => {
        toast.success("Cuota pagada");
        invalidate();
      },
      onError
    }),
    openCashRegister: useMutation({
      mutationFn: openCashRegister,
      onSuccess: () => {
        toast.success("Caja abierta");
        invalidate();
      },
      onError
    }),
    closeCashRegister: useMutation({
      mutationFn: ({
        registerId,
        closingAmount,
        closingCarryover,
        expectedVersion,
        notes
      }: {
        registerId: string;
        closingAmount: number;
        closingCarryover?: number;
        expectedVersion?: number;
        notes?: string;
      }) => closeCashRegister(registerId, { closingAmount, closingCarryover, expectedVersion, notes }),
      onSuccess: () => {
        toast.success("Caja cerrada");
        invalidate();
      },
      onError
    }),
    createCashMovement: useMutation({
      mutationFn: ({
        registerId,
        type,
        amount,
        paymentId,
        description
      }: {
        registerId: string;
        type: "INCOME" | "EXPENSE" | "ADJUSTMENT" | "REFUND";
        amount: number;
        paymentId?: string;
        description?: string;
      }) => createCashMovement(registerId, { type, amount, paymentId, description }),
      onSuccess: () => {
        toast.success("Movimiento registrado");
        invalidate();
      },
      onError
    })
  };
}

// ─── Hooks de reportes de caja ───────────────────────────────────────────────

export function useCashCollectionSummary(params?: CashReportQuery) {
  return useQuery({
    queryKey: ["cash-report", "collection-summary", params],
    queryFn: () => getCashCollectionSummary(params),
    enabled: Boolean(params?.branchId)
  });
}

export function useCashBoxSummary(params?: CashReportQuery, enabled = false) {
  return useQuery({
    queryKey: ["cash-report", "box-summary", params],
    queryFn: () => getCashBoxSummary(params),
    enabled: enabled && Boolean(params?.branchId && params?.dateFrom && params?.dateTo)
  });
}

export function useCashPaymentsByPeriod(params?: CashReportQuery, enabled = false) {
  return useQuery({
    queryKey: ["cash-report", "payments-by-period", params],
    queryFn: () => getCashPaymentsByPeriod(params),
    enabled: enabled && Boolean(params?.branchId && params?.dateFrom && params?.dateTo)
  });
}

export function useCashPaymentsByProfessional(
  params?: CashReportQuery & { professionalId?: string },
  enabled = false
) {
  return useQuery({
    queryKey: ["cash-report", "payments-by-professional", params],
    queryFn: () => getCashPaymentsByProfessional(params),
    enabled:
      enabled && Boolean(params?.branchId && params?.professionalId && params?.dateFrom && params?.dateTo)
  });
}
