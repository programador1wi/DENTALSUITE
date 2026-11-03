import { http } from "@/lib/api/http-client";

import type { AccountsReceivableRow, BalanceByPlanRow, BoxSummaryResponse, CancelledPendingPaymentLinkStatus, CancelledPendingPaymentsResponse, CashRegister, CashRegisterDetail, CashRegisterListParams, CashReportQuery, CollectionSummaryResponse, DailyPaymentReceipt, FinancialDocument, Installment, InstallmentFrequency, OnlineBenefit, PatientBalance, PatientBillingSummary, PatientLedgerEntry, PatientPaymentsResponse, Payment, PaymentBehaviorPoint, PaymentDistributionRow, PaymentLink, PaymentsByPeriodResponse, PaymentsByProfessionalResponse, PaymentSettlement, PaymentSettlementsResponse, PaymentSettlementStatus, PaymentStatus, ReceiptEmailResponse, Refund, RefundStatus, ReimbursementRequest } from "./payments.types";
export * from "./payments.types";

export async function listPayments(params?: {
  patientId?: string;
  branchId?: string;
  search?: string;
  status?: PaymentStatus;
}) {
  const { data } = await http.get<Payment[]>("/payments", { params });
  return data;
}
export async function listPaymentSettlements(params?: {
  branchId?: string;
  paymentMethodId?: string;
  status?: PaymentSettlementStatus;
  dueFrom?: string;
  dueTo?: string;
}) {
  const { data } = await http.get<PaymentSettlementsResponse>("/payment-settlements", { params });
  return data;
}

export async function receivePaymentSettlement(
  id: string,
  payload: {
    cashRegisterId: string;
    expectedVersion: number;
    receivedAt?: string;
    reference?: string;
    financialInstitutionId?: string;
  }
) {
  const { data } = await http.post<PaymentSettlement>(`/payment-settlements/${id}/receive`, payload);
  return data;
}

export async function cancelPaymentSettlement(
  id: string,
  payload: { expectedVersion: number; reason: string }
) {
  const { data } = await http.post<PaymentSettlement>(`/payment-settlements/${id}/cancel`, payload);
  return data;
}

export async function listCancelledPendingPayments(params?: {
  branchId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  linkStatus?: CancelledPendingPaymentLinkStatus | "";
}) {
  const { data } = await http.get<CancelledPendingPaymentsResponse>("/payments/cancelled-pending", {
    params
  });
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
  allocations?: Array<{ treatmentPlanItemId: string; amount: number; expectedVersion?: number }>;
  splits?: Array<{
    paymentMethodId: string;
    amount: number;
    financialInstitutionId?: string;
    reference?: string;
    scheduledSettlements?: Array<{
      sequence: number;
      amount: number;
      dueAt: string;
      reference?: string;
      financialInstitutionId?: string;
      notes?: string;
    }>;
  }>;
  idempotencyKey?: string;
  cashDiscountRuleId?: string;
  cashDiscountTreatmentPlanId?: string;
}) {
  const { data } = await http.post<Payment>("/payments", payload);
  return data;
}

export async function updatePayment(
  paymentId: string,
  payload: {
    paymentMethodId?: string;
    financialInstitutionId?: string;
    reference?: string;
    notes?: string;
    paidAt?: string;
  }
) {
  const { data } = await http.patch<Payment>(`/payments/${paymentId}`, payload);
  return data;
}

export async function addPaymentAllocations(
  paymentId: string,
  allocations: Array<{ treatmentPlanItemId: string; amount: number }>
) {
  const { data } = await http.post<Payment>(`/payments/${paymentId}/allocations`, { allocations });
  return data;
}

export async function removePaymentAllocation(allocationId: string) {
  const { data } = await http.delete<Payment>(`/payments/allocations/${allocationId}`);
  return data;
}

export async function createRefund(
  paymentId: string,
  payload: {
    amount: number;
    reason?: string;
    paymentMethodId?: string;
    financialInstitutionId?: string;
    reference?: string;
  }
) {
  const { data } = await http.post(`/payments/${paymentId}/refund`, payload);
  return data;
}

export async function listRefunds(params?: {
  patientId?: string;
  treatmentPlanId?: string;
  status?: RefundStatus;
}) {
  const { data } = await http.get<Refund[]>("/refunds", { params });
  return data;
}

export async function voidPayment(paymentId: string, payload: { reason: string }) {
  const { data } = await http.post<Payment>(`/payments/${paymentId}/void`, payload);
  return data;
}

export async function getPaymentReceipt(paymentId: string) {
  const { data } = await http.get<{ payment: Payment; printableText: string }>(
    `/payments/${paymentId}/receipt`
  );
  return data;
}

export async function getDailyPaymentReceipt(patientId: string, params: { date: string; branchId: string }) {
  const { data } = await http.get<DailyPaymentReceipt>(`/patients/${patientId}/payments/daily-receipt`, {
    params
  });
  return data;
}

export async function downloadPaymentReceiptPdf(paymentNumber: string) {
  const { data, headers } = await http.get<Blob>(`/payments/${paymentNumber}/receipt.pdf`, {
    responseType: "blob"
  });
  const disposition = headers["content-disposition"];
  const fileNameMatch = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
  return {
    blob: data,
    fileName: fileNameMatch?.[1] ?? `Comprobante_Pago_${paymentNumber}.pdf`
  };
}

export async function downloadDailyReceiptPdf(patientId: string, params: { date: string; branchId: string }) {
  const { data, headers } = await http.get<Blob>(`/patients/${patientId}/payments/daily-receipt.pdf`, {
    params,
    responseType: "blob"
  });
  const disposition = headers["content-disposition"];
  const fileNameMatch = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
  return {
    blob: data,
    fileName: fileNameMatch?.[1] ?? `Comprobante_Diario_${params.date}.pdf`
  };
}

export async function sendPaymentReceiptEmail(
  paymentNumber: string,
  payload: { to: string; subject: string; message: string; idempotencyKey: string }
) {
  const { data } = await http.post<ReceiptEmailResponse>(`/payments/${paymentNumber}/receipt/email`, payload);
  return data;
}

export async function sendDailyReceiptEmail(
  patientId: string,
  params: { date: string; branchId: string },
  payload: { to: string; subject: string; message: string; idempotencyKey: string }
) {
  const { data } = await http.post<ReceiptEmailResponse>(
    `/patients/${patientId}/payments/daily-receipt/email`,
    payload,
    { params }
  );
  return data;
}

export async function listPatientPayments(patientId: string) {
  const { data } = await http.get<PatientPaymentsResponse>(`/patients/${patientId}/payments`);
  return data;
}

export async function getPatientBillingSummary(patientId: string) {
  const { data } = await http.get<PatientBillingSummary>(`/patients/${patientId}/billing/summary`);
  return data;
}

export async function listPatientFinancialDocuments(
  patientId: string,
  params?: { type?: string; status?: string }
) {
  const { data } = await http.get<FinancialDocument[]>(`/patients/${patientId}/financial-documents`, {
    params
  });
  return data;
}

export async function listPatientReimbursementRequests(patientId: string, params?: { status?: string }) {
  const { data } = await http.get<ReimbursementRequest[]>(`/patients/${patientId}/reimbursement-requests`, {
    params
  });
  return data;
}

export async function listPatientOnlineBenefits(patientId: string, params?: { status?: string }) {
  const { data } = await http.get<OnlineBenefit[]>(`/patients/${patientId}/online-benefits`, { params });
  return data;
}

export async function listPatientVoidedPayments(patientId: string) {
  const { data } = await http.get<Payment[]>(`/patients/${patientId}/voided-payments`);
  return data;
}

export async function getPatientBalance(patientId: string) {
  const { data } = await http.get<PatientBalance>(`/patients/${patientId}/balance`);
  return data;
}

export async function getPatientBalanceByPlan(patientId: string) {
  const { data } = await http.get<BalanceByPlanRow[]>(`/patients/${patientId}/balance/by-plan`);
  return data;
}

export async function getPatientLedger(patientId: string) {
  const { data } = await http.get<PatientLedgerEntry[]>(`/patients/${patientId}/ledger`);
  return data;
}

export async function getPatientPaymentDistribution(patientId: string) {
  const { data } = await http.get<PaymentDistributionRow[]>(`/patients/${patientId}/payment-distribution`);
  return data;
}

export async function getPatientPaymentBehavior(patientId: string) {
  const { data } = await http.get<PaymentBehaviorPoint[]>(`/patients/${patientId}/payment-behavior`);
  return data;
}

export async function listAccountsReceivable(params?: {
  branchId?: string;
  patientId?: string;
  search?: string;
}) {
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
  itemAllocations?: Array<{ treatmentPlanItemId: string; amount: number; expectedVersion?: number }>;
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

export async function payInstallment(payload: {
  installmentId: string;
  branchId: string;
  paymentMethodId?: string;
  amount: number;
  reference?: string;
  notes?: string;
  splits?: Array<{
    paymentMethodId: string;
    amount: number;
    financialInstitutionId?: string;
    reference?: string;
  }>;
  idempotencyKey?: string;
}) {
  const { data } = await http.post(`/installments/${payload.installmentId}/pay`, payload);
  return data;
}
export async function listCashRegisters(params?: CashRegisterListParams) {
  const { status, ...filters } = params ?? {};
  const normalizedParams = status ? { ...filters, status } : filters;
  const { data } = await http.get<CashRegister[]>("/cash-register", { params: normalizedParams });
  return data;
}

export async function getCashRegister(registerId: string) {
  const { data } = await http.get<CashRegisterDetail>(`/cash-register/${registerId}`);
  return data;
}

export async function downloadCashRegisterReport(registerId: string, format: "pdf" | "csv" | "xlsx") {
  const response = await http.get<Blob>(`/cash-register/${registerId}/report.${format}`, {
    responseType: "blob"
  });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${format === "csv" ? "movimientos" : "detalle"}-${registerId}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function getCurrentCashRegister(branchId: string) {
  const { data } = await http.get<CashRegister | null>("/cash-register/current", { params: { branchId } });
  return data;
}

export async function openCashRegister(payload: {
  branchId: string;
  openingAmount: number;
  responsibleUserId?: string;
  notes?: string;
}) {
  const { data } = await http.post<CashRegister>("/cash-register/open", payload);
  return data;
}

export async function closeCashRegister(
  registerId: string,
  payload: { closingAmount: number; closingCarryover?: number; expectedVersion?: number; notes?: string }
) {
  const { data } = await http.post<{ register: CashRegister; expectedClosing: number; difference: number }>(
    `/cash-register/${registerId}/close`,
    payload
  );
  return data;
}

export async function createCashMovement(
  registerId: string,
  payload: {
    type: "INCOME" | "EXPENSE" | "ADJUSTMENT" | "REFUND";
    amount: number;
    paymentId?: string;
    description?: string;
  }
) {
  const { data } = await http.post(`/cash-register/${registerId}/movements`, payload);
  return data;
}
export async function getCashCollectionSummary(params?: CashReportQuery) {
  const { data } = await http.get<CollectionSummaryResponse>("/cash-register/reports/collection-summary", {
    params
  });
  return data;
}

export async function getCashBoxSummary(params?: CashReportQuery) {
  const { data } = await http.get<BoxSummaryResponse>("/cash-register/reports/box-summary", { params });
  return data;
}

export async function getCashPaymentsByPeriod(params?: CashReportQuery) {
  const { data } = await http.get<PaymentsByPeriodResponse>("/cash-register/reports/payments-by-period", {
    params
  });
  return data;
}

export async function getCashPaymentsByProfessional(params?: CashReportQuery & { professionalId?: string }) {
  const { data } = await http.get<PaymentsByProfessionalResponse>(
    "/cash-register/reports/payments-by-professional",
    { params }
  );
  return data;
}
