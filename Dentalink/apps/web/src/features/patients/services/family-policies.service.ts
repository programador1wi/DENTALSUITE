import { http } from "@/lib/api/http-client";

export type PolicyProduct = {
  id: string;
  productCode: string;
  name: string;
  modality: "INDIVIDUAL" | "DUAL" | "FAMILY";
  minimumMembers: number;
  maximumMembers: number;
  durationMonths: number;
  basePrice: number | string;
  currency: "MXN" | "USD" | "EUR";
  status: string;
};

export type FamilyPolicy = {
  id: string;
  policyNumber: string;
  status: "DRAFT" | "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "CANCELLED";
  paymentStatus: "PENDING" | "PARTIAL" | "PAID" | "REFUNDED";
  effectiveFrom: string;
  effectiveUntil: string;
  contractedPrice: number | string;
  currency: string;
  holderPatientId: string;
  policyProduct: PolicyProduct;
  familyGroup?: { id: string; familyCode: string; name: string; status: string } | null;
  holderPatient: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate?: string | null;
    status: string;
  };
  members: Array<{
    id: string;
    patientId: string;
    memberRole: string;
    relationshipSnapshot?: string | null;
    coverageStatus: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      birthDate?: string | null;
      status: string;
    };
  }>;
  payments: Array<{ id: string; amount: number | string; paidAt: string; paymentStatus: string }>;
};

export async function listPolicyProducts() {
  const { data } = await http.get<PolicyProduct[]>("/family-policies/products");
  return data;
}

export async function listPatientPolicies(patientId: string) {
  const { data } = await http.get<FamilyPolicy[]>(`/family-policies/patients/${patientId}`);
  return data;
}

export async function createFamilyPolicy(payload: {
  policyProductId: string;
  familyGroupId?: string;
  holderPatientId: string;
  memberPatientIds: string[];
  effectiveFrom: string;
  contractedPrice: number;
  currency?: string;
}) {
  const { data } = await http.post<FamilyPolicy>("/family-policies", payload);
  return data;
}

export async function registerFamilyPolicyPayment(
  policyId: string,
  payload: {
    paymentMethodId: string;
    amount: number;
    reference?: string;
    idempotencyKey: string;
  }
) {
  const { data } = await http.post<FamilyPolicy>(`/family-policies/${policyId}/payments`, payload);
  return data;
}
