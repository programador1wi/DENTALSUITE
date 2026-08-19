import { http } from "@/lib/api/http-client";

export type PaymentStatus = "RECEIVED" | "PARTIALLY_ALLOCATED" | "ALLOCATED" | "REFUNDED" | "VOIDED";
export type CashRegisterStatus = "OPEN" | "CLOSING" | "CLOSED" | "CANCELLED";
export type InstallmentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
export type InstallmentFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export type PaymentSettlementStatus = "PENDING" | "RECEIVED" | "OVERDUE" | "CANCELLED" | "REVERSED";

export type PaymentSettlement = {
  id: string;
  sequence: number;
  amount: string;
  grossAmount: number;
  retentionAmount: number;
  netAmount: number;
  dueAt: string;
  receivedAt?: string | null;
  status: PaymentSettlementStatus;
  reference?: string | null;
  version: number;
  payment: {
    id: string;
    paymentNumber: string;
    currency: string;
    patient: { id: string; firstName: string; lastName: string };
  };
  paymentMethod: { id: string; publicCode: string; name: string; type: string };
  financialInstitution?: { id: string; name: string } | null;
};

export type PaymentSettlementsResponse = {
  data: PaymentSettlement[];
  meta: { page: number; pageSize: number; total: number };
  totals: {
    grossAmount: number;
    byStatus: Partial<Record<PaymentSettlementStatus, { count: number; amount: number }>>;
  };
};

export type Payment = {
  id: string;
  paymentNumber: string;
  ticketId?: string | null;
  branchId: string;
  patientId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  reference?: string | null;
  notes?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedById?: string | null;
  paidAt: string;
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    documentNumber?: string | null;
    birthDate?: string | null;
    email?: string | null;
    agreement?: { id: string; name: string } | null;
  };
  branch: {
    id: string;
    name: string;
    timezone?: string | null;
    phone?: string | null;
    countryCode?: string | null;
    email?: string | null;
    replyToEmail?: string | null;
    website?: string | null;
    address?: string | null;
    exteriorNumber?: string | null;
    interiorNumber?: string | null;
    neighborhood?: string | null;
    postalCode?: string | null;
    municipality?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    brand?: ReceiptBrandingSource | null;
  };
  paymentMethod: { id: string; name: string; type: string };
  financialInstitution?: { id: string; name: string } | null;
  receivedBy: { id: string; firstName: string; lastName: string };
  voidedBy?: { id: string; firstName: string; lastName: string } | null;
  splits?: Array<{
    id: string;
    paymentMethodId: string;
    amount: string;
    reference?: string | null;
    paymentMethod: { id: string; name: string; type: string };
    financialInstitution?: { id: string; name: string } | null;
  }>;
  paymentMethods?: Array<{
    name: string;
    amount: number;
    reference?: string | null;
    financialInstitution?: string | null;
  }>;
  treatments?: Array<{ id: string; number: string; name: string; procedures: string[] }>;
  treatmentRefs?: Array<{ id: string; number: string; name: string; procedures: string[] }>;
  cashRegister?: {
    id: string;
    movementId: string;
    displayName?: string | null;
    status: CashRegisterStatus;
    openedAt: string;
    closedAt?: string | null;
    branch: { id: string; name: string };
    openedBy: { id: string; firstName: string; lastName: string };
  } | null;
  dueDate?: string | null;
  allocatedAmount: number;
  unallocatedAmount: number;
  remainingPlanBalance?: number;
  receipt?: {
    available: boolean;
    previewUrl: string;
    pdfUrl: string;
  };
  breakdown: Array<{
    id: string;
    kind: "TREATMENT" | "INSTALLMENT";
    treatmentPlanId?: string | null;
    treatmentNumber: string;
    treatmentName: string;
    detail: string;
    baseAmount: number;
    paidAmount: number;
    discountAmount?: number;
    remainingAmount: number;
    dueDate?: string | null;
  }>;
  allocations: Array<{
    id: string;
    treatmentPlanItemId: string;
    amount: string;
    settlementDiscountAmount?: string;
    treatmentPlanItem?: {
      id: string;
      treatmentPlanId: string;
      treatmentPlan?: { id: string; name: string } | null;
      procedure?: { id: string; code: string; name: string } | null;
      toothNumber?: string | null;
      surface?: string | null;
    };
  }>;
  refunds: Array<{ id: string; amount: string; status: string; createdAt: string }>;
  cashDiscountApplication?: {
    id: string;
    ruleCodeSnapshot: string;
    ruleNameSnapshot: string;
    campaignSnapshot?: string | null;
    discountPercentSnapshot: string;
    originalAmount: string;
    discountAmount: string;
    finalAmount: string;
    status: string;
  } | null;
  receiptBranding?: ReceiptBranding;
};

export type ReceiptBrandingSource = {
  name?: string | null;
  shortName?: string | null;
  legalName?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  senderEmail?: string | null;
  replyToEmail?: string | null;
  website?: string | null;
  privacyNoticeUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export type ReceiptBranding = {
  logoUrl?: string | null;
  businessName: string;
  legalName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  privacyNoticeUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export type DailyPaymentReceipt = {
  receiptType: "DAILY";
  date: string;
  printedAt: string;
  patient: Payment["patient"];
  branch: Payment["branch"] & {
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    brand?: ReceiptBrandingSource | null;
  };
  receiptBranding: ReceiptBranding;
  payments: Payment[];
  paymentNumbers: string[];
  totalAmount: number;
  paymentMethods: Array<{
    paymentNumber: string;
    name: string;
    amount: number;
    reference?: string | null;
    financialInstitution?: string | null;
  }>;
  breakdown: Array<Payment["breakdown"][number] & { paymentNumber: string }>;
  treatments: Array<{ id: string; number: string; name: string; procedures: string[] }>;
};

export type ReceiptEmailResponse = {
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  documentType: "PAYMENT_RECEIPT" | "DAILY_PAYMENT_RECEIPT";
  paymentNumber?: string | number | null;
  documentDate?: string | null;
  paymentCount?: number | null;
  totalAmount?: number | string | null;
  recipient: string;
  attachmentName: string;
  sentAt?: string | null;
  messageId?: string | null;
  communicationJobId: string;
};

export type RefundStatus = "PENDING" | "PROCESSED" | "REJECTED";

export type Refund = {
  id: string;
  branchId: string;
  paymentId: string;
  patientId: string;
  amount: string;
  reason?: string | null;
  status: RefundStatus;
  processedAt?: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string };
  payment: {
    id: string;
    paymentNumber?: number | string | null;
    amount: string;
    status: PaymentStatus;
    allocations: Array<{
      id: string;
      amount: string;
      treatmentPlanItem: {
        id: string;
        treatmentPlanId: string;
        toothNumber?: string | null;
        surface?: string | null;
        procedure?: { id: string; code: string; name: string } | null;
      };
    }>;
  };
  processedBy?: { id: string; firstName: string; lastName: string } | null;
};

export type PaymentLink = {
  id: string;
  amount: string;
  url: string;
  status: "CREATED" | "PAID" | "EXPIRED" | "CANCELLED";
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    documentNumber?: string | null;
    branch?: { id: string; name: string };
  };
  treatmentPlan?: { id: string; name: string } | null;
};

export type CancelledPendingPaymentLinkStatus = Exclude<PaymentLink["status"], "PAID">;

export type CancelledPendingPaymentsResponse = {
  summary: {
    voidedPayments: { count: number; amount: number };
    pendingLinks: { count: number; amount: number };
    linkStatusTotals: Record<PaymentLink["status"], { count: number; amount: number }>;
  };
  voidedPayments: Payment[];
  pendingLinks: PaymentLink[];
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
  installmentPlan?: { id: string; treatmentPlanId: string; treatmentPlan?: { id: string; name: string } };
};

export type PayableTreatmentItem = {
  id: string;
  version: number;
  treatmentPlanId: string;
  treatmentPlanNumber?: string;
  treatmentPlanName: string;
  treatmentPlanStatus: string;
  procedure: { id: string; code: string; name: string };
  section?: { id: string; name: string } | null;
  toothNumber?: string | null;
  surface?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  paidAmount: number;
  discountAmount?: number;
  outstandingAmount: number;
  financedAmount?: number;
  financeableAmount?: number;
  status: string;
  plannedAt?: string | null;
  completedAt?: string | null;
};

export type PayableTreatmentPlan = {
  id: string;
  number?: string;
  name: string;
  status: string;
  branch: { id: string; name: string };
  professional: { id: string; firstName: string; lastName: string };
  createdAt: string;
  totalBudget: number;
  paidAmount: number;
  realizedAmount: number;
  outstandingAmount: number;
  items: PayableTreatmentItem[];
};

export type PatientPaymentsResponse = {
  payments: Payment[];
  links: Array<{
    id: string;
    amount: string;
    status: string;
    url: string;
    expiresAt?: string | null;
    paidAt?: string | null;
  }>;
  installments: Installment[];
  balance: {
    plannedAmount: number;
    allocatedPaidAmount: number;
    totalPaidAmount: number;
    outstandingAmount: number;
    unallocatedCredit: number;
    overdueInstallments: number;
  };
  payablePlans: PayableTreatmentPlan[];
  payableItems: PayableTreatmentItem[];
};

export type CashRegister = {
  id: string;
  publicNumber: number;
  branchId: string;
  previousClosingBalance: string;
  initialDeposit: string;
  openingAmount: string;
  expectedCashBalance?: string | null;
  declaredCashBalance?: string | null;
  closingCarryover?: string | null;
  withdrawnAmount?: string | null;
  differenceAmount?: string | null;
  closingAmount?: string | null;
  closingNotes?: string | null;
  version: number;
  currency: string;
  status: CashRegisterStatus;
  openedAt: string;
  closedAt?: string | null;
  branch: { id: string; name: string };
  openedBy: { id: string; firstName: string; lastName: string };
  responsibleUser: { id: string; firstName: string; lastName: string };
  closedBy?: { id: string; firstName: string; lastName: string } | null;
  expectedClosing?: number;
  movementCount?: number;
  previousBalance?: number;
  openingTotal?: number;
  incomeTotal?: number;
  expenseTotal?: number;
  refundTotal?: number;
  voidTotal?: number;
  withdrawalTotal?: number;
  adjustmentTotal?: number;
  paymentMethodTotals?: CashRegisterPaymentMethodTotal[];
};

export type CashRegisterPaymentMethodTotal = {
  name: string;
  type: string;
  count: number;
  amount: number;
};

export type CashRegisterMovement = {
  id: string;
  type:
    | "OPENING"
    | "INITIAL_DEPOSIT"
    | "INCOME"
    | "EXPENSE"
    | "ADJUSTMENT"
    | "REFUND"
    | "PAYMENT_VOID"
    | "MANUAL_INCOME"
    | "MANUAL_EXPENSE"
    | "WITHDRAWAL"
    | "CLOSING_CARRYOVER"
    | "CLOSING";
  direction: "IN" | "OUT";
  amount: string;
  description?: string | null;
  reference?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
  paymentMethod?: { id: string; name: string; type: string; includeInPhysicalCashBalance: boolean } | null;
  expense?: {
    id: string;
    publicNumber: number;
    description: string;
    total: string;
    paidAt: string;
    status: string;
    category: { id: string; name: string };
  } | null;
  refund?: {
    id: string;
    amount: string;
    reason?: string | null;
    status: string;
    processedAt?: string | null;
  } | null;
  payment?: {
    id: string;
    paymentNumber?: number | string | null;
    amount: string;
    reference?: string | null;
    paidAt: string;
    status: PaymentStatus;
    voidReason?: string | null;
    voidedAt?: string | null;
    voidedBy?: { id: string; firstName: string; lastName: string } | null;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      documentNumber?: string | null;
      agreement?: { id: string; name: string } | null;
    };
    paymentMethod: { id: string; name: string; type: string };
    financialInstitution?: { id: string; name: string } | null;
    allocations: Array<{
      amount: string;
      treatmentPlanItem: {
        agreement?: { id: string; name: string } | null;
        treatmentPlan: { id: string; name: string };
      };
    }>;
  } | null;
};

export type CashRegisterDetail = CashRegister & {
  movements: CashRegisterMovement[];
  previousBalance: number;
  openingTotal: number;
  incomeTotal: number;
  expenseTotal: number;
  refundTotal: number;
  adjustmentTotal: number;
  expectedClosing: number;
  movementCount: number;
  paymentMethodTotals: CashRegisterPaymentMethodTotal[];
  audit: Array<{
    id: string;
    action: string;
    entity: string;
    entityId?: string | null;
    reason?: string | null;
    actorName: string;
    createdAt: string;
  }>;
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

export type PatientBalance = {
  patientId: string;
  plannedAmount: number;
  allocatedPaidAmount: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  unallocatedCredit: number;
  overdueInstallments: number;
  confirmedBalance: number;
  currentDueBalance: number;
  futureBalance: number;
  freeCreditBalance: number;
  refundedAmount: number;
  projectedCoverage: number;
  projectedBalance: number;
};

export type PatientBillingSummary = {
  patientId: string;
  balance: PatientBalance;
  counts: {
    documents: number;
    reimbursements: number;
    onlineBenefits: number;
    refunds: number;
    voidedPayments: number;
    ledgerEntries: number;
  };
};

export type FinancialDocument = {
  id: string;
  type: string;
  folio?: string | null;
  status: string;
  subtotal: string;
  taxes: string;
  total: string;
  issuedAt?: string | null;
  createdAt: string;
  branch: { id: string; name: string };
  payment?: {
    id: string;
    paymentNumber?: number | string | null;
    amount: string;
    status: PaymentStatus;
    paidAt: string;
  } | null;
  refund?: { id: string; amount: string; status: string; createdAt: string } | null;
  treatmentPlan?: { id: string; name: string } | null;
  files: Array<{ id: string; url: string; type: string; createdAt: string }>;
};

export type ReimbursementRequest = {
  id: string;
  policyNumber?: string | null;
  status: string;
  requestedAmount: number;
  approvedAmount: number;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
  agreement?: { id: string; name: string } | null;
  authorizations: Array<{
    id: string;
    status: string;
    requestedAmount: string;
    authorizedAmount: string;
    consumedAmount: string;
    authorizationCode?: string | null;
    validUntil?: string | null;
    treatmentPlan?: { id: string; name: string } | null;
  }>;
};

export type OnlineBenefit = {
  id: string;
  status: string;
  authorizationCode?: string | null;
  requestedAmount: string;
  authorizedAmount: string;
  consumedAmount: string;
  validUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  treatmentPlan?: { id: string; name: string } | null;
  coverageCase: {
    id: string;
    policyNumber?: string | null;
    status: string;
    agreement?: { id: string; name: string } | null;
  };
};

export type PatientLedgerEntry = {
  id: string;
  occurredAt: string;
  entryType: string;
  sourceType: string;
  sourceId: string;
  debitAmount: string;
  creditAmount: string;
  currency: string;
  descriptionSnapshot?: string | null;
  status: string;
  branch: { id: string; name: string };
  treatmentPlan?: { id: string; name: string } | null;
};

export type PaymentBehaviorPoint = {
  date: string;
  charges: number;
  payments: number;
  runningBalance: number;
};

export type PaymentDistributionRow = {
  key: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
};

export type BalanceByPlanRow = {
  planId: string;
  planName: string;
  subtotal: number;
  discount: number;
  totalNet: number;
  realized: number;
  paid: number;
  coverage: number;
  refunded: number;
  currentDueBalance: number;
  futureBalance: number;
  totalBalance: number;
};

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

export type CashRegisterListParams = {
  branchId?: string;
  status?: CashRegisterStatus;
  search?: string;
  responsibleUserId?: string;
  openedFrom?: string;
  openedTo?: string;
  closedFrom?: string;
  closedTo?: string;
  withDifference?: string;
};

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

// ─── Tipos de reportes de caja ───────────────────────────────────────────────

export type CashReportQuery = {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type CollectionSummaryResponse = {
  dateFrom: string;
  dateTo: string;
  total: number;
  totalPayments?: number;
  averageTicket?: number;
  byDay: Array<{ date: string; amount: number; paymentsCount?: number }>;
};

export type BoxSummaryResponse = {
  total: number;
  patientsCount: number;
  rows: Array<{ type: string; method: string; count: number; amount: number }>;
};

export type PaymentsByPeriodResponse = {
  dateFrom: string;
  dateTo: string;
  total: number;
  byDay: Array<{ date: string; amount: number }>;
  payments: Array<{
    id: string;
    number: number;
    date: string;
    patient: string;
    responsible: string;
    documentNumber: string;
    paymentType: string;
    paymentMethod: string;
    total: number;
  }>;
};

export type PaymentsByProfessionalResponse = {
  dateFrom: string;
  dateTo: string;
  total: number;
  payments: Array<{
    number: number;
    treatmentNumber: string;
    paymentMethod: string;
    patientName: string;
    reception: string;
    amount: number;
  }>;
};

// ─── Funciones HTTP de reportes ──────────────────────────────────────────────

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
