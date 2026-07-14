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
  listPatientPayments,
  listPaymentLinks,
  listPayments,
  listRefunds,
  openCashRegister,
  payInstallment,
  removePaymentAllocation,
  updatePayment,
  voidPayment,
  type CancelledPendingPaymentLinkStatus,
  type CashReportQuery,
  type CashRegisterStatus,
  type PaymentStatus,
  type RefundStatus
} from "../services/payments.service";

export function usePayments(params?: { patientId?: string; branchId?: string; search?: string; status?: PaymentStatus }) {
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

export function usePatientPayments(patientId: string) {
  return useQuery({
    queryKey: ["patient-payments", patientId],
    queryFn: () => listPatientPayments(patientId),
    enabled: Boolean(patientId)
  });
}

export function useRefunds(params?: { patientId?: string; treatmentPlanId?: string; status?: RefundStatus }, enabled = true) {
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

export function usePaymentLinks(params?: { patientId?: string; status?: "CREATED" | "PAID" | "EXPIRED" | "CANCELLED" }) {
  return useQuery({
    queryKey: ["payment-links", params],
    queryFn: () => listPaymentLinks(params)
  });
}

export function useInstallments(params?: { patientId?: string; installmentPlanId?: string; status?: string; dueBefore?: string }) {
  return useQuery({
    queryKey: ["installments", params],
    queryFn: () => listInstallments(params)
  });
}

export function useCashRegisters(params?: { branchId?: string; status?: CashRegisterStatus | ""; search?: string }) {
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
      mutationFn: ({ paymentId, allocations }: { paymentId: string; allocations: Array<{ treatmentPlanItemId: string; amount: number }> }) =>
        addPaymentAllocations(paymentId, allocations),
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
      mutationFn: ({ paymentId, amount, reason }: { paymentId: string; amount: number; reason?: string }) =>
        createRefund(paymentId, { amount, reason }),
      onSuccess: () => {
        toast.success("Devolucion registrada");
        invalidate();
      },
      onError
    }),
    voidPayment: useMutation({
      mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => voidPayment(paymentId, { reason }),
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
      mutationFn: ({ registerId, closingAmount, notes }: { registerId: string; closingAmount: number; notes?: string }) =>
        closeCashRegister(registerId, { closingAmount, notes }),
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
    enabled: enabled && Boolean(params?.branchId && params?.professionalId && params?.dateFrom && params?.dateTo)
  });
}
