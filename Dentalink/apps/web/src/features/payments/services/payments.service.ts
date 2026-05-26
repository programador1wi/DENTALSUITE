import { http } from "@/lib/api/http-client";

export type PaymentStatus = "RECEIVED" | "PARTIALLY_ALLOCATED" | "ALLOCATED" | "REFUNDED" | "VOIDED";
export type CashRegisterStatus = "OPEN" | "CLOSED";
export type InstallmentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
export type InstallmentFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type Payment = {
  id: string;
  branchId: string;
  patientId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  reference?: string | null;
  notes?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  paidAt: string;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string };
  branch: { id: string; name: string };
  paymentMethod: { id: string; name: string; type: string };
  financialInstitution?: { id: string; name: string } | null;
  receivedBy: { id: string; firstName: string; lastName: string };
  allocations: Array<{ id: string; treatmentPlanItemId: string; amount: string }>;
  refunds: Array<{ id: string; amount: string; status: string; createdAt: string }>;
};

export type PaymentLink = {
  id: string;
  amount: string;
  url: string;
  status: "CREATED" | "PAID" | "EXPIRED" | "CANCELLED";
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string };
  treatmentPlan?: { id: string; name: string } | null;
};

export type Installment = {
  id: string;
  installmentPlanId: string;
  patientId: string;
  number: number;
  dueDate: string;
  amount: string;
  paidAmount: string;
  status: InstallmentStatus;
  paidAt?: string | null;
  isOverdue?: boolean;
  patient?: { id: string; firstName: string; lastName: string };
  installmentPlan?: { id: string; treatmentPlanId: string };
};

export type CashRegister = {
  id: string;
  branchId: string;
  openingAmount: string;
  closingAmount?: string | null;
  status: CashRegisterStatus;
  openedAt: string;
  closedAt?: string | null;
  branch: { id: string; name: string };
  openedBy: { id: string; firstName: string; lastName: string };
  closedBy?: { id: string; firstName: string; lastName: string } | null;
  expectedClosing?: number;
  movementCount?: number;
};

export type AccountsReceivableRow = {
  patientId: string;
  fullName: string;
  branchName: string;
  plannedAmount: number;
  allocatedPaidAmount: number;
  outstandingAmount: number;
  overdueInstallments: number;
};

export async function listPayments(params?: { patientId?: string; branchId?: string; search?: string; status?: PaymentStatus }) {
  const { data } = await http.get<Payment[]>("/payments", { params });
  return data;
}

export async function createPayment(payload: {
  branchId: string;
  patientId: string;
  amount: number;
  paymentMethodId: string;
  financialInstitutionId?: string;
  currency?: "MXN" | "USD" | "EUR";
  reference?: string;
  notes?: string;
  paidAt?: string;
  allocations?: Array<{ treatmentPlanItemId: string; amount: number }>;
}) {
  const { data } = await http.post<Payment>("/payments", payload);
  return data;
}

export async function addPaymentAllocations(paymentId: string, allocations: Array<{ treatmentPlanItemId: string; amount: number }>) {
  const { data } = await http.post<Payment>(`/payments/${paymentId}/allocations`, { allocations });
  return data;
}

export async function createRefund(paymentId: string, payload: { amount: number; reason?: string }) {
  const { data } = await http.post(`/payments/${paymentId}/refund`, payload);
  return data;
}

export async function voidPayment(paymentId: string, payload: { reason: string }) {
  const { data } = await http.post<Payment>(`/payments/${paymentId}/void`, payload);
  return data;
}

export async function listPatientPayments(patientId: string) {
  const { data } = await http.get<{
    payments: Payment[];
    links: Array<{ id: string; amount: string; status: string; url: string; expiresAt?: string | null; paidAt?: string | null }>;
    installments: Installment[];
    balance: {
      plannedAmount: number;
      allocatedPaidAmount: number;
      totalPaidAmount: number;
      outstandingAmount: number;
      unallocatedCredit: number;
      overdueInstallments: number;
    };
  }>(`/patients/${patientId}/payments`);
  return data;
}

export async function getPatientBalance(patientId: string) {
  const { data } = await http.get(`/patients/${patientId}/balance`);
  return data;
}

export async function listAccountsReceivable(params?: { branchId?: string; search?: string }) {
  const { data } = await http.get<AccountsReceivableRow[]>("/accounts-receivable", { params });
  return data;
}

export async function createPaymentLink(payload: {
  patientId: string;
  treatmentPlanId?: string;
  amount: number;
  expiresAt?: string;
}) {
  const { data } = await http.post("/payment-links", payload);
  return data;
}

export async function listPaymentLinks(params?: { patientId?: string; status?: PaymentLink["status"] }) {
  const { data } = await http.get<PaymentLink[]>("/payment-links", { params });
  return data;
}

export async function createInstallmentPlan(payload: {
  patientId: string;
  treatmentPlanId: string;
  totalAmount: number;
  downPayment: number;
  numberOfInstallments: number;
  frequency?: InstallmentFrequency;
  startDate: string;
}) {
  const { data } = await http.post("/installment-plans", payload);
  return data;
}

export async function listInstallments(params?: {
  patientId?: string;
  installmentPlanId?: string;
  status?: string;
  dueBefore?: string;
}) {
  const { data } = await http.get<Installment[]>("/installments", { params });
  return data;
}

export async function payInstallment(
  installmentId: string,
  payload: { branchId: string; paymentMethodId: string; amount: number; reference?: string; notes?: string }
) {
  const { data } = await http.post(`/installments/${installmentId}/pay`, payload);
  return data;
}

export async function listCashRegisters(params?: { branchId?: string; status?: CashRegisterStatus | "" }) {
  const { data } = await http.get<CashRegister[]>("/cash-register", { params });
  return data;
}

export async function openCashRegister(payload: { branchId: string; openingAmount: number }) {
  const { data } = await http.post<CashRegister>("/cash-register/open", payload);
  return data;
}

export async function closeCashRegister(registerId: string, payload: { closingAmount: number; notes?: string }) {
  const { data } = await http.post<{ register: CashRegister; expectedClosing: number; difference: number }>(
    `/cash-register/${registerId}/close`,
    payload
  );
  return data;
}

export async function createCashMovement(
  registerId: string,
  payload: { type: "INCOME" | "EXPENSE" | "ADJUSTMENT" | "REFUND"; amount: number; paymentId?: string; description?: string }
) {
  const { data } = await http.post(`/cash-register/${registerId}/movements`, payload);
  return data;
}
