import { http } from "@/lib/api/http-client";

export type CashDiscountStatus = "DRAFT" | "ENABLED" | "DISABLED";

export type CashDiscountRule = {
  id: string;
  publicCode: string;
  name: string;
  description?: string | null;
  campaign?: string | null;
  discountPercent: string;
  appliesToClinicalActions: boolean;
  appliesToLaboratoryActions: boolean;
  availableToAllUsers: boolean;
  availableToAllBranches: boolean;
  stackableWithAgreements: boolean;
  stackableWithOtherDiscounts: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  status: CashDiscountStatus;
  version: number;
  updatedAt: string;
  users: Array<{ userId: string; user: { id: string; firstName: string; lastName: string; email: string } }>;
  branches: Array<{ branchId: string; branch: { id: string; name: string; status?: string } }>;
  _count?: { applications: number };
};

export type CashDiscountPayload = {
  name: string;
  description?: string;
  campaign?: string;
  discountPercent: number;
  appliesToClinicalActions: boolean;
  appliesToLaboratoryActions: boolean;
  availableToAllUsers: boolean;
  userIds?: string[];
  availableToAllBranches: boolean;
  branchIds?: string[];
  stackableWithAgreements: boolean;
  stackableWithOtherDiscounts: boolean;
  startsAt?: string;
  endsAt?: string;
  status: CashDiscountStatus;
  expectedVersion?: number;
};

export type CashDiscountConfigurationOptions = {
  branches: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string; maximumDiscountPercent: string }>;
};

export type AvailableCashDiscount = Pick<
  CashDiscountRule,
  | "id"
  | "publicCode"
  | "name"
  | "description"
  | "campaign"
  | "discountPercent"
  | "appliesToClinicalActions"
  | "appliesToLaboratoryActions"
  | "stackableWithAgreements"
  | "stackableWithOtherDiscounts"
  | "startsAt"
  | "endsAt"
  | "version"
>;

export type CashDiscountPreview = {
  rule: {
    id: string;
    publicCode: string;
    name: string;
    campaign?: string | null;
    version: number;
    discountPercent: string;
  };
  treatmentPlanId: string;
  originalAmount: string;
  discountAmount: string;
  finalAmount: string;
  items: Array<{
    treatmentPlanItemId: string;
    procedureCode: string;
    procedureName: string;
    itemType: string;
    originalBalance: string;
    discountPercent: string;
    discountAmount: string;
    finalAmount: string;
    userMaximum: string;
    procedureMaximum: string;
    effectiveMaximum: string;
    eligibilityResult: "ELIGIBLE";
  }>;
};

export async function listCashDiscounts(params: {
  search?: string;
  status?: CashDiscountStatus;
  branchId?: string;
  type?: string;
  validity?: string;
}) {
  const { data } = await http.get<CashDiscountRule[]>("/payment-options/cash-discounts", { params });
  return data;
}

export async function getCashDiscountConfigurationOptions() {
  const { data } = await http.get<CashDiscountConfigurationOptions>(
    "/payment-options/cash-discounts-configuration-options"
  );
  return data;
}

export async function createCashDiscount(payload: CashDiscountPayload) {
  const { data } = await http.post<CashDiscountRule>("/payment-options/cash-discounts", payload);
  return data;
}

export async function updateCashDiscount(id: string, payload: CashDiscountPayload) {
  const { data } = await http.patch<CashDiscountRule>(`/payment-options/cash-discounts/${id}`, payload);
  return data;
}

export async function duplicateCashDiscount(id: string) {
  const { data } = await http.post<CashDiscountRule>(`/payment-options/cash-discounts/${id}/duplicate`);
  return data;
}

export async function disableCashDiscount(id: string, payload: { expectedVersion: number; reason?: string }) {
  const { data } = await http.post<CashDiscountRule>(
    `/payment-options/cash-discounts/${id}/disable`,
    payload
  );
  return data;
}

export async function reactivateCashDiscount(id: string, expectedVersion: number) {
  const { data } = await http.post<CashDiscountRule>(`/payment-options/cash-discounts/${id}/reactivate`, {
    expectedVersion
  });
  return data;
}

export async function getCashDiscountAudit(id: string) {
  const { data } = await http.get<
    Array<{
      id: string;
      action: string;
      reason?: string | null;
      after?: Record<string, unknown> | null;
      createdAt: string;
    }>
  >(`/payment-options/cash-discounts/${id}/audit`);
  return data;
}

export async function listAvailableCashDiscounts(patientId: string, branchId: string) {
  const { data } = await http.get<AvailableCashDiscount[]>(
    `/patients/${patientId}/payments/available-cash-discounts`,
    { params: { branchId } }
  );
  return data;
}

export async function previewCashDiscount(
  patientId: string,
  payload: {
    branchId: string;
    treatmentPlanId: string;
    cashDiscountRuleId: string;
    items: Array<{ treatmentPlanItemId: string; outstandingAmount: number; expectedVersion?: number }>;
  }
) {
  const { data } = await http.post<CashDiscountPreview>(
    `/patients/${patientId}/payments/cash-discount-preview`,
    payload
  );
  return data;
}
