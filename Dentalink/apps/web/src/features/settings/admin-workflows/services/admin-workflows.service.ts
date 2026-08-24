import { http } from "@/lib/api/http-client";

export type Agreement = {
  id: string;
  name: string;
  code?: string | null;
  entityName?: string | null;
  entityTaxId?: string | null;
  type: "CORPORATE" | "INSURANCE" | "MEMBERSHIP" | "PAYROLL" | "OTHER";
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "EXPIRED" | "INACTIVE" | "CANCELLED";
  startsAt?: string | null;
  endsAt?: string | null;
  version: number;
  description?: string | null;
  priceListId?: string | null;
  priceList?: { id: string; name: string; isDefault: boolean } | null;
  discountPercent: string;
  coveragePercent: string;
  copayAmount: string;
  coverageLimitAmount?: string | null;
  coverageRules?: Record<string, unknown> | null;
  appliesToLabs: boolean;
  appliesToOtherCategories: boolean;
  payrollDiscount: boolean;
  isPublic: boolean;
  isDefault?: boolean;
  isActive: boolean;
  _count: { patients: number };
  versions?: AgreementVersion[];
};

export type AgreementProcedureRule = {
  procedureId: string;
  isEligible?: boolean;
  preferredPrice?: number;
  discountPercent?: number;
  coveragePercent?: number;
  copayAmount?: number;
  coverageLimitAmount?: number;
  coverageRules?: Record<string, unknown>;
};

export type AgreementCategoryRule = {
  procedureCategoryId: string;
  isEligible?: boolean;
  preferredPrice?: number;
  discountPercent?: number;
  coveragePercent?: number;
  copayAmount?: number;
  coverageLimitAmount?: number;
  coverageRules?: Record<string, unknown>;
};

export type AgreementVersion = {
  id: string;
  version: number;
  startsAt?: string | null;
  endsAt?: string | null;
  priceListId?: string | null;
  branches: Array<{ branchId: string; branch?: { id: string; name: string } }>;
  categoryRules: Array<
    AgreementCategoryRule & { procedureCategory?: { id: string; name: string; type: string } }
  >;
  procedureRules: Array<
    AgreementProcedureRule & { procedure?: { id: string; code: string; name: string; categoryId?: string } }
  >;
};

export type AgreementDebtState = "NO_CHARGES" | "PAID" | "FUTURE_CHARGES" | "ADJUSTED_ZERO" | "OUTSTANDING";

export type AgreementDebt = {
  id: string;
  organizationId: string;
  companyId: string;
  companyName: string;
  agreementId: string;
  agreementName: string;
  currency: "MXN" | "USD" | "EUR";
  generatedCharges: number;
  totalPaid: number;
  outstandingDebt: number;
  patientCount: number;
  chargeCount: number;
  oldestCharge?: string | null;
  state: AgreementDebtState;
};

export type AgreementBranchDebt = Omit<AgreementDebt, "patientCount" | "oldestCharge"> & {
  branchId: string;
  branchName: string;
};

export type AgreementDebtReportParams = {
  cutoffDate: string;
  companyId?: string;
  agreementId?: string;
  branchId?: string;
  currencyId?: "MXN" | "USD" | "EUR";
  scope?: "AUTHORIZED" | "ALL";
  page?: number;
  pageSize?: number;
};

export type AgreementDebtReport = {
  cutoffDate: string;
  consolidated: AgreementDebt[];
  byBranch: AgreementBranchDebt[];
  totals: { generatedCharges: number; paid: number; debt: number; patients: number; charges: number };
  totalsByCurrency: Array<{
    currency: "MXN" | "USD" | "EUR";
    generatedCharges: number;
    paid: number;
    debt: number;
  }>;
  reconciliation: { consolidatedDebt: number; branchDebt: number; difference: number; matches: boolean };
  diagnostics: { futureChargeCount: number; emptyReason: "FUTURE_CHARGES" | "NO_CHARGES" | null };
  pagination: { page: number; pageSize: number; consolidatedTotal: number; branchTotal: number };
  filters: {
    companies: Array<{ id: string; legalName: string }>;
    agreements: Array<{ id: string; name: string; companyId: string; currency: "MXN" | "USD" | "EUR" }>;
    branches: Array<{ id: string; name: string }>;
    currencies: Array<"MXN" | "USD" | "EUR">;
    canViewAllBranches: boolean;
  };
};

export type AgreementDebtDetail = {
  id: string;
  folio: string;
  patientId: string;
  patient: string;
  expediente: string;
  treatmentPlanId: string;
  treatment: string;
  treatmentPlanItemId: string;
  procedure: string;
  procedureCode: string;
  installmentNumber: number;
  dueDate: string;
  branch: { id: string; name: string };
  originalAmount: number;
  paid: number;
  balance: number;
  currency: "MXN" | "USD" | "EUR";
  status: "SCHEDULED" | "PENDING" | "OVERDUE" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REVERSED";
  overdueDays: number;
  version: number;
};

export type AgreementDebtDetailsResponse = {
  rows: AgreementDebtDetail[];
  pagination: { page: number; pageSize: number; total: number };
};

export type CompanyPaymentPayload = {
  branchId?: string;
  paymentDate: string;
  amount: number;
  currencyId: "MXN" | "USD" | "EUR";
  paymentMethodId?: string;
  financialInstitutionId?: string;
  reference?: string;
  proofUrl?: string;
  cashRegisterId?: string;
  notes?: string;
  allocationStrategy: "AUTO_DUE_DATE" | "MANUAL" | "PROPORTIONAL";
  chargeIds?: string[];
  confirm?: boolean;
};

export type AgreementPayload = {
  name: string;
  entityName?: string;
  entityTaxId?: string;
  type?: Agreement["type"];
  startsAt?: string;
  endsAt?: string;
  description?: string;
  priceListId?: string;
  discountPercent?: number;
  coveragePercent?: number;
  copayAmount?: number;
  coverageLimitAmount?: number;
  coverageRules?: Record<string, unknown>;
  branchIds?: string[];
  categoryRules?: AgreementCategoryRule[];
  procedureRules?: AgreementProcedureRule[];
  appliesToLabs?: boolean;
  appliesToOtherCategories?: boolean;
  payrollDiscount?: boolean;
  isPublic?: boolean;
};

export type Expense = {
  id: string;
  publicNumber: number;
  status: "REGISTERED" | "PAID" | "VOIDED";
  version: number;
  description: string;
  supplierName?: string | null;
  quantity: string;
  unitCost: string;
  total: string;
  paidAt: string;
  invoicedAt?: string | null;
  accountingDate?: string | null;
  notes?: string | null;
  documentUrl?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  branch: { id: string; name: string };
  category: { id: string; name: string; reportGroup: "PROFESSIONALS" | "LABORATORIES" | "COMMISSIONS" | "GENERAL" };
  paymentMethod?: { id: string; name: string; type: string } | null;
  cashMovements: Array<{
    id: string;
    cashRegisterId: string;
    cashRegister: {
      publicNumber: number;
      status: string;
      closedAt?: string | null;
      branch: { id: string; name: string };
      responsibleUser: { id: string; firstName: string; lastName: string };
    };
  }>;
  cashAssociation: {
    associated: boolean;
    cashSessionNumber?: string | null;
    responsibleName?: string | null;
    branchName?: string | null;
    status?: "OPEN" | "CLOSING" | "CLOSED" | "CANCELLED" | null;
    closedAt?: string | null;
    locked: boolean;
    lockReason?: "CLOSING_CASH_SESSION" | "CLOSED_CASH_SESSION" | "CANCELLED_CASH_SESSION" | null;
  };
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canVoid: boolean;
    canCreateCorrection: boolean;
    canViewCashSession: boolean;
  };
  createdBy: { id: string; firstName: string; lastName: string };
};

export type ExpensePayload = {
  branchId: string;
  categoryName: string;
  categoryReportGroup: "PROFESSIONALS" | "LABORATORIES" | "COMMISSIONS" | "GENERAL";
  description: string;
  supplierName?: string;
  quantity: number;
  unitCost: number;
  invoicedAt?: string;
  accountingDate: string;
  paidAt: string;
  notes?: string;
  paymentMethodId?: string;
  documentUrl?: string;
  cashRegisterId?: string;
  assignToOpenCash?: boolean;
};

export type ExpenseSummary = {
  period: { from: string; to: string };
  total: number;
  count: number;
  rows: Array<{
    categoryId: string;
    category: string;
    count: number;
    total: number;
    percentage: number;
    previousTotal: number;
    comparisonPercent: number | null;
  }>;
  trend: Array<{ period: string; amount: number }>;
};

export type PayrollSummary = {
  professionalId: string;
  professionalName: string;
  commissionRate: number;
  completedItems: number;
  pendingItems: number;
  collectedAmount: number;
  payableAmount: number;
  lastCompletedAt?: string | null;
  items: PayrollItem[];
};

export type PayrollContractRule = {
  source: "FIXED_AMOUNT" | "CATEGORY_RATE" | "CONTRACT_RATE" | "PROFESSIONAL_FALLBACK";
  commissionRate: number;
  contractId?: string | null;
  contractType?: string | null;
  commissionBase?: string | null;
  paymentDiscount?: string | null;
  paymentCondition?: string | null;
  priceListId?: string | null;
  priceListName?: string | null;
  procedureCategoryId?: string | null;
  fixedAmount?: number | null;
};

export type FinalizedPayroll = {
  id: string;
  professionalId: string;
  commissionRate: number;
  completedItems: number;
  collectedAmount: number;
  payableAmount: number;
  lastCompletedAt?: string | null;
  finalizedAt: string;
  professional: { id: string; firstName: string; lastName: string };
  branch?: { id: string; name: string } | null;
  finalizedBy: { id: string; firstName: string; lastName: string };
  _count: { items: number };
  items: PayrollItem[];
};

export type PayrollItem = {
  treatmentPlanItemId: string;
  treatmentNumber: string;
  patientId: string;
  patientName: string;
  action: string;
  procedureCode: string;
  priceSource: string;
  priceSnapshotName?: string | null;
  priceSnapshotCode?: string | null;
  priceSnapshotCategory?: string | null;
  completedAt?: string | null;
  firstPaymentAt?: string | null;
  lastPaymentAt?: string | null;
  toothNumber?: string | null;
  surface?: string | null;
  treatmentAmount: number;
  collectedAmount: number;
  rawCollectedAmount: number;
  payableAmount: number;
  commissionRate: number;
  paymentMethods: string;
  paymentIds: string[];
  cashValidated: boolean;
  isReady: boolean;
  status: "VALID" | "PARTIAL_PAYMENT" | "FINALIZED";
  contractRule: PayrollContractRule;
  calculationExplanation: string;
};

export async function listAgreements(params?: { search?: string; active?: string }) {
  const { data } = await http.get<Agreement[]>("/settings/agreements", { params });
  return data;
}

export async function getAgreement(id: string) {
  const { data } = await http.get<Agreement>(`/settings/agreements/${id}`);
  return data;
}

export async function createAgreement(payload: AgreementPayload) {
  const { data } = await http.post<Agreement>("/settings/agreements", payload);
  return data;
}

export async function updateAgreement(
  id: string,
  payload: Partial<AgreementPayload> & { isActive?: boolean }
) {
  const { data } = await http.patch<Agreement>(`/settings/agreements/${id}`, payload);
  return data;
}

export async function deactivateAgreement(id: string) {
  const { data } = await http.patch<Agreement>(`/settings/agreements/${id}/deactivate`);
  return data;
}

export async function createAgreementVersion(id: string, payload: AgreementPayload) {
  const { data } = await http.post<AgreementVersion>(`/settings/agreements/${id}/versions`, payload);
  return data;
}

export async function publishAgreement(id: string, version?: number) {
  const { data } = await http.post<Agreement>(`/settings/agreements/${id}/publish`, { version });
  return data;
}

export async function cancelAgreement(id: string) {
  const { data } = await http.post<Agreement>(`/settings/agreements/${id}/cancel`);
  return data;
}

export async function duplicateAgreement(id: string) {
  const { data } = await http.post<Agreement>(`/settings/agreements/${id}/duplicate`);
  return data;
}

export async function previewAgreementPrice(
  id: string,
  params: { branchId: string; procedureId: string; quantity?: number }
) {
  const { data } = await http.get<{
    normalPrice: number;
    appliedPrice: number;
    discountAmount: number;
    coverageAmount: number;
    patientTotal: number;
    agreementVersion: number;
  }>(`/settings/agreements/${id}/preview`, { params });
  return data;
}

export async function assignAgreementPatients(id: string, patientIds: string[]) {
  const { data } = await http.post<{ updated: number }>(`/settings/agreements/${id}/patients`, {
    patientIds
  });
  return data;
}

export async function listCompanies(search?: string) {
  const { data } = await http.get<Array<{
    id: string;
    legalName: string;
    taxId?: string | null;
    billingEmail?: string | null;
    phone?: string | null;
    contactName?: string | null;
    address?: string | null;
    notes?: string | null;
    status: string;
    agreements?: Array<{ id: string; name: string; status: string; isActive: boolean }>;
    _count?: { agreements: number; charges: number; payments: number };
  }>>("/settings/companies", { params: { search } });
  return data;
}

export async function getCompany(id: string) {
  const { data } = await http.get<{
    id: string;
    legalName: string;
    taxId?: string | null;
    billingEmail?: string | null;
    phone?: string | null;
    contactName?: string | null;
    address?: string | null;
    notes?: string | null;
    status: string;
    agreements?: Array<{ id: string; name: string; status: string; isActive: boolean }>;
    _count?: { agreements: number; charges: number; payments: number };
  }>(`/settings/companies/${id}`);
  return data;
}

export async function createCompany(payload: {
  legalName: string;
  taxId?: string;
  billingEmail?: string;
  phone?: string;
  contactName?: string;
  address?: string;
  notes?: string;
}) {
  const { data } = await http.post("/settings/companies", payload);
  return data;
}

export async function updateCompany(id: string, payload: {
  legalName?: string;
  taxId?: string;
  billingEmail?: string;
  phone?: string;
  contactName?: string;
  address?: string;
  notes?: string;
  status?: string;
}) {
  const { data } = await http.patch(`/settings/companies/${id}`, payload);
  return data;
}

export async function setDefaultAgreement(id: string, isDefault: boolean) {
  const { data } = await http.post<Agreement>(`/settings/agreements/${id}/default`, { isDefault });
  return data;
}

export async function getAgreementDeactivationImpact(id: string) {
  const { data } = await http.get<{
    agreementId: string;
    name: string;
    activeAffiliates: number;
    activePlans: number;
    openChargeCount: number;
    outstandingDebt: number;
  }>(`/settings/agreements/${id}/impact`);
  return data;
}

export async function importAffiliates(
  id: string,
  payload: {
    items: Array<{
      patientId?: string;
      documentNumber?: string;
      email?: string;
      internalNumber?: string;
      name?: string;
    }>;
    dryRun?: boolean;
    replaceExisting?: boolean;
  }
) {
  const { data } = await http.post<{
    dryRun: boolean;
    total: number;
    valid?: number;
    imported?: number;
    notFound: number;
    duplicates: number;
    alreadyAffiliated: number;
    details: Array<{
      rowNumber: number;
      patientId?: string;
      status: "VALID" | "NOT_FOUND" | "DUPLICATE" | "ALREADY_AFFILIATED";
      name: string;
      identifier: string;
      reason: string | null;
    }>;
  }>(`/settings/agreements/${id}/import-affiliates`, payload);
  return data;
}

export async function listAgreementDebts(params: AgreementDebtReportParams) {
  const { data } = await http.get<AgreementDebtReport>("/agreements/debt-report", { params });
  return data;
}

export async function getAgreementDebtDetails(
  agreementId: string,
  params: AgreementDebtReportParams & {
    patient?: string;
    dueFrom?: string;
    dueTo?: string;
    status?: string;
    installmentNumber?: number;
    folio?: string;
  }
) {
  const { data } = await http.get<AgreementDebtDetailsResponse>(
    `/agreements/${agreementId}/debt-details`,
    { params }
  );
  return data;
}

export async function createCompanyPayment(
  agreementId: string,
  payload: CompanyPaymentPayload,
  idempotencyKey: string
) {
  const { data } = await http.post(`/agreements/${agreementId}/payments`, payload, {
    headers: { "Idempotency-Key": idempotencyKey, "Correlation-Id": crypto.randomUUID() }
  });
  return data;
}

export async function exportAgreementDebts(params: AgreementDebtReportParams) {
  const response = await http.get<Blob>("/agreements/debt-report/export", {
    params,
    responseType: "blob",
    headers: { "Correlation-Id": crypto.randomUUID() }
  });
  return response.data;
}

export async function createPayrollDiscountPlan(
  agreementId: string,
  payload: {
    treatmentPlanId: string;
    treatmentPlanItemIds: string[];
    installmentCount: number;
    firstDueDate: string;
    periodicity: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  }
) {
  const { data } = await http.post(`/agreements/${agreementId}/payroll-discount-plans`, payload, {
    headers: { "Correlation-Id": crypto.randomUUID() }
  });
  return data;
}

export async function listExpenses(params?: {
  search?: string;
  branchId?: string;
  month?: number;
  year?: number;
  status?: string;
  categoryId?: string;
}) {
  const { data } = await http.get<Expense[]>("/settings/expenses", { params });
  return data;
}

export async function getExpenseSummary(params?: { branchId?: string; month?: number; year?: number }) {
  const { data } = await http.get<ExpenseSummary>("/settings/expenses/summary", { params });
  return data;
}

export async function createExpense(payload: ExpensePayload) {
  const { data } = await http.post<Expense>("/settings/expenses", payload);
  return data;
}

export async function updateExpense(
  id: string,
  payload: Partial<ExpensePayload> & { expectedVersion: number }
) {
  const { data } = await http.patch<Expense>(`/settings/expenses/${id}`, payload);
  return data;
}

export async function voidExpense(id: string, payload: { reason: string; expectedVersion: number }) {
  const { data } = await http.post<Expense>(`/settings/expenses/${id}/void`, payload);
  return data;
}

export async function listPayroll(branchId?: string) {
  const { data } = await http.get<PayrollSummary[]>("/settings/payroll", { params: { branchId } });
  return data;
}

export async function listFinalizedPayroll(branchId?: string) {
  const { data } = await http.get<FinalizedPayroll[]>("/settings/payroll/finalized", {
    params: { branchId }
  });
  return data;
}

export async function finalizePayroll(payload: { professionalId: string; branchId?: string }) {
  const { data } = await http.post<FinalizedPayroll>("/settings/payroll/finalize", payload);
  return data;
}

export async function recalculatePayroll(payload: { professionalId?: string; branchId?: string }) {
  const { data } = await http.post<PayrollSummary[]>("/settings/payroll/recalculate", payload);
  return data;
}
