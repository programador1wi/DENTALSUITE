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
