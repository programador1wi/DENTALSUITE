import { http } from "@/lib/api/http-client";

export type Agreement = {
  id: string;
  name: string;
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

export type AgreementDebt = {
  id: string;
  companyName: string;
  agreementName: string;
  debt: number;
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
  description: string;
  quantity: string;
  unitCost: string;
  total: string;
  paidAt: string;
  invoicedAt?: string | null;
  notes?: string | null;
  branch: { id: string; name: string };
  category: { id: string; name: string };
  cashMovements: Array<{ id: string; cashRegisterId: string }>;
  createdBy: { id: string; firstName: string; lastName: string };
};

export type ExpensePayload = {
  branchId: string;
  categoryName: string;
  description: string;
  quantity: number;
  unitCost: number;
  invoicedAt?: string;
  paidAt: string;
  notes?: string;
  assignToOpenCash?: boolean;
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

export async function listAgreementDebts() {
  const { data } = await http.get<AgreementDebt[]>("/settings/agreements/debts");
  return data;
}

export async function payAgreementDebt(id: string) {
  const { data } = await http.post<{ success: boolean; amountPaid: number }>(
    `/settings/agreements/${id}/pay-debt`
  );
  return data;
}

export async function listExpenses(params?: {
  search?: string;
  branchId?: string;
  month?: number;
  year?: number;
}) {
  const { data } = await http.get<Expense[]>("/settings/expenses", { params });
  return data;
}

export async function createExpense(payload: ExpensePayload) {
  const { data } = await http.post<Expense>("/settings/expenses", payload);
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
