import { http } from "@/lib/api/http-client";

export type PatientStatus = "NEW" | "ACTIVE" | "IN_TREATMENT" | "INACTIVE" | "DEBTOR" | "COMPLETED";

export type PatientListItem = {
  id: string;
  branchId: string;
  branchName?: string;
  firstName: string;
  lastName: string;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  status: PatientStatus;
  createdAt: string;
  hasDebt: boolean;
  hasFutureAppointment: boolean;
  isNew: boolean;
  hasCriticalAlert: boolean;
};

export type PatientContactInput = {
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  isEmergencyContact?: boolean;
};

export type PatientAddressInput = {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
};

export type PatientMedicalAlertInput = {
  type: string;
  description: string;
  severity: string;
  isActive?: boolean;
};

export type PatientPayload = {
  branchId: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  occupation?: string;
  referredBy?: string;
  source?: string;
  status?: PatientStatus;
  contacts?: PatientContactInput[];
  address?: PatientAddressInput;
  medicalAlerts?: PatientMedicalAlertInput[];
};

export type PatientDuplicate = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  documentNumber?: string | null;
  createdAt: string;
  status: PatientStatus;
};

export type PatientDetail = {
  id: string;
  organizationId: string;
  branchId: string;
  branch: { id: string; name: string };
  agreement?: {
    id: string;
    name: string;
    discountPercent: string;
    priceList?: { id: string; name: string; isDefault: boolean } | null;
  } | null;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  gender?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  occupation?: string | null;
  referredBy?: string | null;
  source?: string | null;
  status: PatientStatus;
  contacts: Array<{
    id: string;
    name: string;
    relationship?: string | null;
    phone?: string | null;
    email?: string | null;
    isEmergencyContact: boolean;
  }>;
  address?: {
    id: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zipCode?: string | null;
  } | null;
  medicalAlerts: Array<{
    id: string;
    type: string;
    description: string;
    severity: string;
    isActive: boolean;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    note: string;
    isPrivate: boolean;
    createdAt: string;
    user: { id: string; firstName: string; lastName: string };
  }>;
  summary: {
    nextAppointment: string | null;
    lastAppointment: string | null;
    balance: number;
    activeTreatments: number;
    hasCriticalAlert: boolean;
  };
  timeline: PatientTimelineEvent[];
};

export type PatientTimelineEvent = {
  type: "PATIENT_CREATED" | "NOTE" | "ALERT";
  date: string;
  payload: Record<string, unknown>;
};

export type CreatePatientResponse = {
  patient: PatientDetail;
  potentialDuplicates: PatientDuplicate[];
};

export type PatientsQuery = {
  search?: string;
  status?: string;
  branchId?: string;
  hasDebt?: "true" | "false";
  withoutFutureAppointment?: "true" | "false";
  isNew?: "true" | "false";
};

export async function listPatients(params?: PatientsQuery) {
  const { data } = await http.get<PatientListItem[]>("/patients", { params });
  return data;
}

export async function searchPatients(params: { q?: string; phone?: string; email?: string; documentNumber?: string }) {
  const { data } = await http.get<PatientListItem[]>("/patients/search", { params });
  return data;
}

export async function createPatient(payload: PatientPayload) {
  const { data } = await http.post<CreatePatientResponse>("/patients", payload);
  return data;
}

export async function getPatient(id: string) {
  const { data } = await http.get<PatientDetail>(`/patients/${id}`);
  return data;
}

export async function updatePatient(id: string, payload: Partial<PatientPayload>) {
  const { data } = await http.patch<CreatePatientResponse>(`/patients/${id}`, payload);
  return data;
}

export async function deactivatePatient(id: string) {
  const { data } = await http.delete<{ success: boolean }>(`/patients/${id}`);
  return data;
}

export async function getPatientTimeline(id: string) {
  const { data } = await http.get<PatientTimelineEvent[]>(`/patients/${id}/timeline`);
  return data;
}

export async function addPatientNote(id: string, payload: { note: string; isPrivate?: boolean }) {
  const { data } = await http.post(`/patients/${id}/notes`, payload);
  return data;
}

export async function addPatientAlert(id: string, payload: PatientMedicalAlertInput) {
  const { data } = await http.post(`/patients/${id}/alerts`, payload);
  return data;
}

export async function mergePatients(payload: { targetPatientId: string; sourcePatientId: string }) {
  const { data } = await http.post<PatientDetail>("/patients/merge", payload);
  return data;
}
