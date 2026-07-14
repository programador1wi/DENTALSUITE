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
  agreementId?: string | null;
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

export type PatientNoteAttachment = {
  id: string;
  fileAttachmentId: string;
  createdAt: string;
  fileAttachment: {
    id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    category: string;
    createdAt: string;
  };
};

export type PatientNote = {
  id: string;
  note: string;
  isPrivate: boolean;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
  attachments?: PatientNoteAttachment[];
};

export type PatientTaskStatus = "PENDING" | "COMPLETED";

export type PatientTask = {
  id: string;
  patientId: string;
  type: string;
  detail: string;
  dueDate?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  createdBy: { id: string; firstName: string; lastName: string; email?: string | null };
  status: PatientTaskStatus;
  completedAt?: string | null;
  completedBy?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type PatientTaskPayload = {
  type: string;
  detail: string;
  dueDate?: string;
  assignedToId?: string;
};

export type PatientEmailStatus = "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";

export type PatientEmail = {
  id: string;
  patientId: string;
  subject: string;
  status: PatientEmailStatus;
  provider: string;
  providerMessageId?: string | null;
  fromAddress?: string | null;
  fromName?: string | null;
  toAddress: string;
  toName?: string | null;
  ccAddress?: string | null;
  senderUser?: { id: string; firstName: string; lastName: string; email: string } | null;
  preview: string;
  attachmentCount: number;
  attachmentIds: string[];
  queuedAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  failureMessage?: string | null;
  htmlBody?: string | null;
  textBody?: string | null;
};

export type PatientEmailsQuery = {
  search?: string;
  month?: string;
  status?: PatientEmailStatus;
  filter?: "all" | "sent" | "queued" | "failed" | "cancelled" | "draft" | "withFiles";
  page?: number;
  pageSize?: number;
};

export type PatientEmailsResponse = {
  items: PatientEmail[];
  total: number;
  page: number;
  pageSize: number;
};

export type SendPatientEmailPayload = {
  subject: string;
  bodyHtmlBase64: string;
  copyToSender?: boolean;
  fileAttachmentIds?: string[];
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
  notes: PatientNote[];
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
  page?: number;
  pageSize?: number;
};

export type PatientAnalysisQuery = {
  from?: string;
  to?: string;
  branchId?: string;
};

export type PatientAnalysisDistribution = {
  label: string;
  value: number;
  percent: number;
  amount?: number;
};

export type PatientAnalysisMonthlyPoint = {
  month: string;
  scheduledAppointments: number;
  confirmedAppointments: number;
  acceptedBudgets: number;
  newPatients: number;
};

export type PatientAnalysisResponse = {
  filters: {
    from: string;
    to: string;
    branchId: string | null;
    branchName: string;
    updatedAt: string;
  };
  branchContext: {
    name: string;
    userCount: number;
    users: Array<{ id: string; name: string; email: string; branchName: string }>;
  };
  conversion: {
    totals: {
      scheduledAppointments: number;
      confirmedAppointments: number;
      acceptedBudgets: number;
      acceptedBudgetAmount: number;
      confirmedRate: number;
      acceptedRate: number;
    };
    funnel: Array<{
      key: string;
      label: string;
      value: number;
      percent: number;
      color: string;
    }>;
    monthly: PatientAnalysisMonthlyPoint[];
  };
  patientData: {
    totalPatients: number;
    distributions: {
      age: PatientAnalysisDistribution[];
      gender: PatientAnalysisDistribution[];
      delegation: PatientAnalysisDistribution[];
      paymentMethods: PatientAnalysisDistribution[];
      actionCategories: PatientAnalysisDistribution[];
      appointmentStatus: PatientAnalysisDistribution[];
      sources: PatientAnalysisDistribution[];
      patientStatus: PatientAnalysisDistribution[];
    };
  };
  globalStats: Array<{
    key: string;
    label: string;
    value: number;
    format?: "money" | "percent";
    tone: "green" | "red" | "blue" | "amber";
    trend: number[];
  }>;
};

export async function listPatients(params?: PatientsQuery) {
  const { data } = await http.get<PatientListItem[]>("/patients", { params });
  return data;
}

export async function getPatientsAnalysis(params?: PatientAnalysisQuery) {
  const { data } = await http.get<PatientAnalysisResponse>("/patients/analysis", { params });
  return data;
}

export async function searchPatients(params: {
  q?: string;
  phone?: string;
  email?: string;
  documentNumber?: string;
}) {
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

export async function addPatientNote(id: string, payload: { note: string; isPrivate?: boolean; fileAttachmentIds?: string[] }) {
  const { data } = await http.post<PatientNote>(`/patients/${id}/notes`, payload);
  return data;
}

export async function listPatientEmails(id: string, params?: PatientEmailsQuery) {
  const { data } = await http.get<PatientEmailsResponse>(`/patients/${id}/emails`, { params });
  return data;
}

export async function getPatientEmail(id: string, emailId: string) {
  const { data } = await http.get<PatientEmail>(`/patients/${id}/emails/${emailId}`);
  return data;
}

export async function sendPatientEmail(id: string, payload: SendPatientEmailPayload, idempotencyKey: string) {
  const { data } = await http.post<PatientEmail>(`/patients/${id}/emails`, payload, {
    headers: { "Idempotency-Key": idempotencyKey }
  });
  return data;
}

export async function listPatientTasks(id: string, includeCompleted = false) {
  const { data } = await http.get<PatientTask[]>(`/patients/${id}/tasks`, {
    params: { includeCompleted: includeCompleted ? "true" : "false" }
  });
  return data;
}

export async function createPatientTask(id: string, payload: PatientTaskPayload) {
  const { data } = await http.post<PatientTask>(`/patients/${id}/tasks`, payload);
  return data;
}

export async function updatePatientTask(id: string, taskId: string, payload: Partial<PatientTaskPayload>) {
  const { data } = await http.patch<PatientTask>(`/patients/${id}/tasks/${taskId}`, payload);
  return data;
}

export async function completePatientTask(id: string, taskId: string) {
  const { data } = await http.post<PatientTask>(`/patients/${id}/tasks/${taskId}/complete`);
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
