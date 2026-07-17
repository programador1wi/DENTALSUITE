import { http } from "@/lib/api/http-client";

export type ContactPoint = {
  id: string;
  type: string;
  rawValue: string;
  normalizedValue: string;
  countryCode?: string | null;
  status: string;
  verifiedAt?: string | null;
};

export type PatientContactLink = {
  id: string;
  role: string;
  isPrimary: boolean;
  canReceiveReminders: boolean;
  consentStatus: string;
  validUntil?: string | null;
  contactPoint: ContactPoint;
};

export type FamilyMember = {
  id: string;
  patientId: string;
  role: string;
  relationship?: string | null;
  consentStatus: string;
  version: number;
  patient: { id: string; firstName: string; lastName: string; birthDate?: string | null; status: string };
};

export type FamilyGroup = {
  id: string;
  familyCode: string;
  name: string;
  status: string;
  version: number;
  members: FamilyMember[];
  contacts: Array<{ id: string; isPrimary: boolean; contactPoint: ContactPoint }>;
  bookingGrants: Array<{
    id: string;
    actorContactPointId: string;
    patientId: string;
    canBook: boolean;
    canReschedule: boolean;
    canCancel: boolean;
    canReceiveReminders: boolean;
    canViewAppointmentSummary: boolean;
    canViewFinancialInformation: boolean;
    canViewClinicalInformation: boolean;
    canSignConsents: boolean;
    consentStatus: string;
  }>;
};

export type PatientIdentity = {
  contacts: PatientContactLink[];
  memberships: Array<FamilyMember & { familyGroup: FamilyGroup }>;
};

export type PatientIdentityConfig = {
  shadowMode: boolean;
  adminResolutionEnabled: boolean;
  publicBookingResolutionEnabled: boolean;
  whatsappResolutionEnabled: boolean;
  familyGroupsEnabled: boolean;
  safeMergeEnabled: boolean;
  legacyPhoneReadDisabled: boolean;
  defaultCountry: string;
};

export type DuplicateCheckResult = {
  decision: "NO_MATCH" | "REVIEW_REQUIRED" | "BLOCK_VERIFIED_IDENTITY" | "PHONE_REQUIRES_FAMILY_FLOW";
  matches: Array<{
    id: string;
    firstName: string;
    lastName: string;
    birthDate?: string | null;
    phone?: string | null;
    email?: string | null;
    documentNumber?: string | null;
    confidence: number;
    classification: string;
    reasons: string[];
  }>;
};

export type PatientMergePreview = {
  id: string;
  version: number;
  reason: string;
  status: string;
  preview: {
    target: {
      id: string;
      firstName: string;
      lastName: string;
      documentNumber?: string | null;
      email?: string | null;
      phone?: string | null;
    };
    source: {
      id: string;
      firstName: string;
      lastName: string;
      documentNumber?: string | null;
      email?: string | null;
      phone?: string | null;
    };
    counts: Record<string, number>;
    warnings: string[];
  };
};

export type PatientIdentityDataQuality = {
  summary: {
    invalidLegacyPhones: number;
    activeLinks: number;
    sharedContactPoints: number;
    patientsOnSharedContacts: number;
    familyGroups: number;
    openDuplicates: number;
    openIdentitySessions: number;
    openIdentityIncidents: number;
  };
  invalidLegacyPhones: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    alternatePhone?: string | null;
    validationFailure?: { field?: string; reason?: string } | null;
    branch: { name: string };
  }>;
  config: PatientIdentityConfig;
};

export async function getPatientIdentity(patientId: string) {
  const { data } = await http.get<PatientIdentity>(`/patient-identity/patients/${patientId}`);
  return data;
}

export async function getPatientIdentityConfig() {
  const { data } = await http.get<PatientIdentityConfig>("/patient-identity/config");
  return data;
}

export async function updatePatientIdentityConfig(payload: Partial<PatientIdentityConfig>) {
  const { data } = await http.patch<PatientIdentityConfig>("/patient-identity/config", payload);
  return data;
}

export async function getPatientIdentityDataQuality() {
  const { data } = await http.get<PatientIdentityDataQuality>("/patient-identity/data-quality");
  return data;
}

export async function linkPatientPhone(payload: {
  patientId: string;
  phone: string;
  country?: string;
  role?: string;
  isPrimary?: boolean;
  canReceiveReminders?: boolean;
  consentStatus?: string;
  familyGroupId?: string;
}) {
  const { data } = await http.post("/patient-identity/contact-points/link", payload);
  return data;
}

export async function createFamilyGroup(payload: {
  name: string;
  ownerPatientId: string;
  primaryContact?: { phone: string; country?: string };
}) {
  const { data } = await http.post<FamilyGroup>("/patient-identity/family-groups", payload);
  return data;
}

export async function addFamilyMember(
  groupId: string,
  payload: { patientId: string; role: string; relationship?: string; consentStatus?: string }
) {
  const { data } = await http.post(`/patient-identity/family-groups/${groupId}/members`, payload);
  return data;
}

export async function createFamilyMemberPatient(
  groupId: string,
  payload: {
    branchId: string;
    existingPatientId?: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender?: string;
    relationship: string;
    role?: string;
    consentStatus?: string;
  }
) {
  const { data } = await http.post(
    `/patient-identity/family-groups/${groupId}/members/create-patient`,
    payload
  );
  return data;
}

export async function updateFamilyMember(
  groupId: string,
  memberId: string,
  payload: {
    role?: string;
    relationship?: string;
    consentStatus?: string;
    validUntil?: string;
    expectedVersion: number;
  }
) {
  const { data } = await http.patch(
    `/patient-identity/family-groups/${groupId}/members/${memberId}`,
    payload
  );
  return data;
}

export async function addFamilyContact(
  groupId: string,
  payload: { phone: string; country?: string; isPrimary?: boolean }
) {
  const { data } = await http.post(`/patient-identity/family-groups/${groupId}/contacts`, payload);
  return data;
}

export async function createFamilyGrant(
  groupId: string,
  payload: {
    actorContactPointId: string;
    patientId: string;
    canBook?: boolean;
    canReschedule?: boolean;
    canCancel?: boolean;
    canReceiveReminders?: boolean;
    canViewAppointmentSummary?: boolean;
    canViewFinancialInformation?: boolean;
    canViewClinicalInformation?: boolean;
    canSignConsents?: boolean;
    consentStatus?: string;
  }
) {
  const { data } = await http.post(`/patient-identity/family-groups/${groupId}/grants`, payload);
  return data;
}

export async function duplicateCheck(payload: Record<string, unknown>) {
  const { data } = await http.post<DuplicateCheckResult>("/patient-identity/duplicate-check", payload);
  return data;
}

export async function createMergePreview(payload: {
  targetPatientId: string;
  sourcePatientId: string;
  reason: string;
  correlationId?: string;
}) {
  const { data } = await http.post<PatientMergePreview>("/patient-identity/merges/preview", payload);
  return data;
}

export async function executeMerge(mergeId: string, expectedVersion: number) {
  const { data } = await http.post(`/patient-identity/merges/${mergeId}/execute`, { expectedVersion });
  return data;
}
