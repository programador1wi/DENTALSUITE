import { http } from "@/lib/api/http-client";

export type PolicyStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID_PENDING_ACTIVATION"
  | "ACTIVE"
  | "WAITING_PERIOD"
  | "SUSPENDED"
  | "EXPIRED"
  | "CANCELLED"
  | "REPLACED";

export type PolicyProduct = {
  id: string;
  productCode: string;
  name: string;
  description?: string | null;
  modality: "INDIVIDUAL" | "DUAL" | "FAMILY";
  minimumMembers: number;
  maximumMembers: number;
  durationMonths: number;
  waitingPeriodDays: number;
  basePrice: number | string;
  currency: "MXN" | "USD" | "EUR";
  status: string;
};

export type FamilyPolicySummary = {
  policyNumber: string;
  familyNumber?: string | null;
  product: {
    code: string;
    name: string;
    type: PolicyProduct["modality"];
    maximumMembers: number;
  };
  status: PolicyStatus;
  patientParticipation: {
    role: string;
    relationship?: string | null;
    memberStatus: string;
  };
  holder: { name: string };
  period: {
    purchasedAt: string;
    startsAt: string;
    expiresAt: string;
    coverageAvailableAt?: string | null;
  };
  origin: { brandName?: string | null; branchName: string };
  members: { current: number; maximum: number; availableSlots: number };
  financial: {
    status: "PENDING" | "PARTIAL" | "PAID" | "REFUNDED";
    paidAmount: number | string;
    balance: number | string;
    currency: string;
  };
  coverageSummary: {
    available: boolean;
    waitingPeriod: boolean;
    activeRules: number;
    coveredAmountUsed: number | string;
    copayAmount: number | string;
  };
};

export type FamilyPolicyDetail = {
  policyNumber: string;
  familyNumber?: string | null;
  product: {
    code: string;
    name: string;
    description?: string | null;
    type: PolicyProduct["modality"];
    maximumMembers: number;
    renewable: boolean;
    terms?: string | null;
  };
  status: PolicyStatus;
  patientParticipation?: FamilyPolicySummary["patientParticipation"] | null;
  period: FamilyPolicySummary["period"] & {
    paidAt?: string | null;
    activatedAt?: string | null;
    cancelledAt?: string | null;
  };
  origin: FamilyPolicySummary["origin"];
  holder: {
    name: string;
    documentType?: string | null;
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  members: Array<{
    name: string;
    role: string;
    relationship?: string | null;
    status: string;
    addedAt: string;
    removedAt?: string | null;
    removalReason?: string | null;
  }>;
  financial: {
    status: FamilyPolicySummary["financial"]["status"];
    contractedPrice: number | string;
    paidAmount: number | string;
    balance: number | string;
    currency: string;
    payments: Array<{
      paymentNumber?: number | null;
      status: string;
      amount: number | string;
      paidAt: string;
      reference?: string | null;
    }>;
  };
  coverages: Array<{
    name: string;
    procedure?: { code: string; name: string } | null;
    category?: string | null;
    type: "PERCENTAGE" | "FIXED_AMOUNT" | "FULL";
    value: number | string;
    copayAmount?: number | string | null;
    annualAmountLimit?: number | string | null;
    annualUseLimit?: number | null;
    usedAmount: number | string;
    usedCount: number;
    remainingAmount?: number | string | null;
    remainingUses?: number | null;
    waitingPeriodDays: number;
    requiresAuthorization: boolean;
    exclusions?: string | null;
  }>;
  usages: Array<{
    patientName: string;
    procedure: string;
    treatmentPlan?: string | null;
    normalAmount: number | string;
    coveredAmount: number | string;
    copayAmount: number | string;
    status: string;
    appliedAt: string;
    appliedBy: string;
    reversedAt?: string | null;
    reversalReason?: string | null;
  }>;
  documents: Array<{
    type: string;
    name: string;
    url: string;
    mimeType: string;
    createdAt: string;
  }>;
  history: Array<{
    action: string;
    reason?: string | null;
    createdAt: string;
  }>;
  cancellationReason?: string | null;
  suspensionReason?: string | null;
};

export type PatientPoliciesResponse = {
  items: FamilyPolicySummary[];
  summary: { active: number; pending: number; history: number };
};

export type PolicyCoverageSimulation = {
  canApply: boolean;
  blockingReasons: string[];
  procedure: { code: string; name: string };
  treatmentPlanName?: string;
  coverage?: {
    name: string;
    type: string;
    value: number | string;
    availableAt: string;
  };
  normalAmount: number | string;
  coveredAmount: number | string;
  copayAmount: number | string;
  configuredCopayAmount?: number | string | null;
  requiresAuthorization: boolean;
  remainingUses?: number | null;
  remainingAmount?: number | string | null;
  currency: string;
};

export async function listPolicyProducts() {
  const { data } = await http.get<PolicyProduct[]>("/family-policies/products");
  return data;
}

export async function listPatientPolicies(
  patientId: string,
  includeHistory = true,
) {
  const { data } = await http.get<PatientPoliciesResponse>(
    `/family-policies/patients/${patientId}`,
    {
      params: { includeHistory },
    },
  );
  return data;
}

export async function getPatientPolicyDetail(
  patientId: string,
  policyNumber: string,
) {
  const { data } = await http.get<FamilyPolicyDetail>(
    `/family-policies/patients/${patientId}/${encodeURIComponent(policyNumber)}`,
  );
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
  const { data } = await http.post<FamilyPolicyDetail>(
    "/family-policies",
    payload,
  );
  return data;
}

export async function registerFamilyPolicyPayment(
  policyNumber: string,
  payload: {
    paymentMethodId: string;
    amount: number;
    reference?: string;
    idempotencyKey: string;
  },
) {
  const { data } = await http.post<FamilyPolicyDetail>(
    `/family-policies/${encodeURIComponent(policyNumber)}/payments`,
    payload,
  );
  return data;
}

export async function simulateFamilyPolicyCoverage(
  policyNumber: string,
  payload: { patientId: string; treatmentPlanItemId: string },
) {
  const { data } = await http.post<PolicyCoverageSimulation>(
    `/family-policies/${encodeURIComponent(policyNumber)}/simulations`,
    payload,
  );
  return data;
}

export async function applyFamilyPolicyCoverage(
  policyNumber: string,
  payload: {
    patientId: string;
    treatmentPlanItemId: string;
    idempotencyKey: string;
    authorizationCode?: string;
  },
) {
  const { data } = await http.post<{
    appliedAt: string;
    status: string;
    coveredAmount: number | string;
    copayAmount: number | string;
    currency: string;
  }>(`/family-policies/${encodeURIComponent(policyNumber)}/apply`, payload);
  return data;
}
