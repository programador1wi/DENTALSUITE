import { http } from "@/lib/api/http-client";

export type PaymentMethod = {
  id: string;
  publicCode: string;
  name: string;
  type:
    | "CASH"
    | "CARD"
    | "TRANSFER"
    | "DEPOSIT"
    | "ONLINE"
    | "CREDIT"
    | "CHECK"
    | "BONUS"
    | "INSURANCE"
    | "OTHER";
  source: "SYSTEM" | "CUSTOM";
  isActive: boolean;
  retentionPercent: string;
  allowsRefund: boolean;
  acceptsMultipleSettlements: boolean;
  requiresReference: boolean;
  requiresFinancialInstitution: boolean;
  fiscalCode: string | null;
  version: number;
  disabledAt: string | null;
  disableReason: string | null;
  includeInCollectionReports: boolean;
  includeInPhysicalCashBalance: boolean;
  includeInCashFlowReports: boolean;
  includeInClosingSummary: boolean;
  includeInGraphicalReports: boolean;
};

export type PaymentMethodPayload = {
  name: string;
  type: PaymentMethod["type"];
  retentionPercent: number;
  allowsRefund: boolean;
  acceptsMultipleSettlements: boolean;
  requiresReference: boolean;
  requiresFinancialInstitution: boolean;
  fiscalCode?: string;
  includeInCollectionReports: boolean;
  includeInPhysicalCashBalance: boolean;
  includeInCashFlowReports: boolean;
  includeInClosingSummary: boolean;
  includeInGraphicalReports: boolean;
};

export type PaymentMethodAudit = {
  id: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: string;
};

export async function listPaymentMethods(params?: {
  search?: string;
  active?: string;
  type?: PaymentMethod["type"];
  allowsRefund?: string;
  acceptsMultipleSettlements?: string;
}) {
  const { data } = await http.get<PaymentMethod[]>("/payment-methods", { params });
  return data;
}

export async function createPaymentMethod(payload: PaymentMethodPayload) {
  const { data } = await http.post<PaymentMethod>("/payment-methods", payload);
  return data;
}

export async function updatePaymentMethod(
  id: string,
  payload: Partial<PaymentMethodPayload> & { expectedVersion: number }
) {
  const { data } = await http.patch<PaymentMethod>(`/payment-methods/${id}`, payload);
  return data;
}

export async function deactivatePaymentMethod(id: string, expectedVersion: number, reason?: string) {
  const { data } = await http.patch<PaymentMethod>(`/payment-methods/${id}/deactivate`, {
    expectedVersion,
    reason
  });
  return data;
}

export async function reactivatePaymentMethod(id: string, expectedVersion: number) {
  const { data } = await http.patch<PaymentMethod>(`/payment-methods/${id}/reactivate`, { expectedVersion });
  return data;
}

export async function listPaymentMethodAudit(id: string) {
  const { data } = await http.get<PaymentMethodAudit[]>(`/payment-methods/${id}/audit`);
  return data;
}
