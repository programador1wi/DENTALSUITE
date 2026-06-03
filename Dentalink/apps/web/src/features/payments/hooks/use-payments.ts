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
  getCashRegister,
  listPaymentLinks,
  listAccountsReceivable,
  listCashRegisters,
  listInstallments,
  listPatientPayments,
  listPayments,
  openCashRegister,
  payInstallment,
  voidPayment,
  type CashRegisterStatus,
  type PaymentStatus
} from "../services/payments.service";

export function usePayments(params?: { patientId?: string; branchId?: string; search?: string; status?: PaymentStatus }) {
  return useQuery({
    queryKey: ["payments", params],
    queryFn: () => listPayments(params)
  });
}

export function usePatientPayments(patientId: string) {
  return useQuery({
    queryKey: ["patient-payments", patientId],
    queryFn: () => listPatientPayments(patientId),
    enabled: Boolean(patientId)
  });
}

export function useAccountsReceivable(params?: { branchId?: string; search?: string }) {
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

export function useCashRegisters(params?: { branchId?: string; status?: CashRegisterStatus | "" }) {
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

export function usePaymentsMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["patient-payments"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-receivable"] });
    queryClient.invalidateQueries({ queryKey: ["installments"] });
    queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    queryClient.invalidateQueries({ queryKey: ["patient"] });
    queryClient.invalidateQueries({ queryKey: ["patients"] });
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
    allocatePayment: useMutation({
      mutationFn: ({ paymentId, allocations }: { paymentId: string; allocations: Array<{ treatmentPlanItemId: string; amount: number }> }) =>
        addPaymentAllocations(paymentId, allocations),
      onSuccess: () => {
        toast.success("Pago aplicado");
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
      mutationFn: ({
        installmentId,
        branchId,
        paymentMethodId,
        amount,
        reference,
        notes
      }: {
        installmentId: string;
        branchId: string;
        paymentMethodId: string;
        amount: number;
        reference?: string;
        notes?: string;
      }) => payInstallment(installmentId, { branchId, paymentMethodId, amount, reference, notes }),
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
