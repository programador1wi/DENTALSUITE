import { http } from "@/lib/api/http-client";

export type PatientStatus =
  | "NEW"
  | "PROVISIONAL"
  | "ACTIVE"
  | "IN_TREATMENT"
  | "INACTIVE"
  | "DEBTOR"
  | "COMPLETED"
  | "MERGED";

export type PatientListItem = {
  id: string;
  patientNumber?: number | null;
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
  socialName?: string;
  documentNumber?: string;
  gender?: string;
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
  socialName?: string;
  lastName: string;
  internalNumber?: string;
  birthDate?: string;
  sex?: string;
  gender?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  occupation?: string;
  employer?: string;
  observations?: string;
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
export type PatientBenefitCoverageType =
  | "INSURANCE"
  | "AGREEMENT"
  | "PAYROLL_BENEFIT"
  | "CORPORATE_BENEFIT"
  | "MEMBERSHIP"
  | "OTHER";
export type PatientBenefitCoverageStatus =
  | "DRAFT"
  | "PENDING_VALIDATION"
  | "VALIDATING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "EXPIRED"
  | "REJECTED"
  | "REQUIRES_DOCUMENTS"
  | "INTEGRATION_ERROR"
  | "CANCELLED";
export type CoverageValidationMode = "AUTOMATIC" | "MANUAL" | "DOCUMENTAL" | "MIXED";

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
  patientNumber?: number | null;
  organizationId: string;
  branchId: string;
  branch: { id: string; name: string };
  agreement?: {
    id: string;
    name: string;
    discountPercent: string;
    payrollDiscount?: boolean;
    isActive?: boolean;
    priceList?: { id: string; name: string; isDefault: boolean } | null;
  } | null;
  firstName: string;
  socialName?: string | null;
  lastName: string;
  internalNumber?: string | null;
  birthDate?: string | null;
  sex?: string | null;
  gender?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  occupation?: string | null;
  employer?: string | null;
  observations?: string | null;
  referredBy?: string | null;
  source?: string | null;
  status: PatientStatus;
  contacts: Array<{
    id: string;
    name: string;
    socialName?: string | null;
    documentNumber?: string | null;
    gender?: string | null;
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
    activeBenefits?: number;
    coverageExpiringSoon?: { providerName: string; endsAt: string } | null;
    hasCriticalAlert: boolean;
  };
  timeline: PatientTimelineEvent[];
};

export type PatientBenefitCoveragePayload = {
  type: PatientBenefitCoverageType;
  providerName: string;
  branchId?: string;
  agreementId?: string | null;
  planName?: string;
  policyNumber?: string;
  affiliateNumber?: string;
  certificateNumber?: string;
  employeeNumber?: string;
  holderName?: string;
  holderDocument?: string;
  relationshipToPatient?: string;
  startsAt?: string;
  endsAt?: string;
  coveragePercent?: number;
  copayAmount?: number;
  deductibleAmount?: number;
  annualLimitAmount?: number;
  requiresAuthorization?: boolean;
  notes?: string;
  externalReference?: string;
  status?: PatientBenefitCoverageStatus;
};

export type PatientBenefitCoverage = {
  id: string;
  organizationId: string;
  branchId: string;
  patientId: string;
  type: PatientBenefitCoverageType;
  status: PatientBenefitCoverageStatus;
  providerName: string;
  agreementId?: string | null;
  agreement?: {
    id: string;
    name: string;
    discountPercent: string;
    payrollDiscount?: boolean;
    isActive?: boolean;
    priceList?: { id: string; name: string; isDefault: boolean } | null;
  } | null;
  branch: { id: string; name: string; timezone?: string | null };
  planName?: string | null;
  policyNumber?: string | null;
  affiliateNumber?: string | null;
  certificateNumber?: string | null;
  employeeNumber?: string | null;
  holderName?: string | null;
  holderDocument?: string | null;
  relationshipToPatient?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  coveragePercent?: number | null;
  copayAmount?: number | null;
  deductibleAmount?: number | null;
  annualLimitAmount?: number | null;
  requiresAuthorization: boolean;
  notes?: string | null;
  externalReference?: string | null;
  lastValidatedAt?: string | null;
  lastValidationStatus?: PatientBenefitCoverageStatus | null;
  lastValidationSummary?: string | null;
  version: number;
  validations: Array<{
    id: string;
    mode: CoverageValidationMode;
    status: PatientBenefitCoverageStatus;
    providerName?: string | null;
    externalIdentifier?: string | null;
    normalizedResult?: Record<string, unknown> | null;
    errorMessage?: string | null;
    retryCount: number;
    validatedAt?: string | null;
    createdAt: string;
  }>;
  documents: Array<{
    id: string;
    category: string;
    notes?: string | null;
    createdAt: string;
    fileAttachment: {
      id: string;
      originalName: string;
      mimeType: string;
      size: number;
      url: string;
      category: string;
      createdAt: string;
    };
  }>;
  audits: Array<{
    id: string;
    action: string;
    reason?: string | null;
    actorUserId?: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type PatientBenefitsCoveragesResponse = {
  summary: {
    total: number;
    active: number;
    pendingValidation: number;
    documents: number;
    nextExpiration?: { providerName: string; endsAt: string } | null;
  };
  items: PatientBenefitCoverage[];
};

export type ValidateInsurancePayload = {
  coverageId: string;
  mode?: CoverageValidationMode;
  status?: PatientBenefitCoverageStatus;
  providerName?: string;
  externalIdentifier?: string;
  requestSnapshot?: Record<string, unknown>;
  responseSnapshot?: Record<string, unknown>;
  normalizedResult?: {
    active?: boolean;
    holderName?: string;
    beneficiaryName?: string;
    coveragePercent?: number;
    copayAmount?: number;
    deductibleAmount?: number;
    annualLimitAmount?: number;
    requiresAuthorization?: boolean;
    exclusions?: string;
    validUntil?: string;
  };
  errorMessage?: string;
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
  branchIds?: string[];
  timezone?: string;
  granularity?: "auto" | "day" | "month" | "year";
  currency?: string;
  metricVersion?: string;
};

export type PatientAnalysisDistribution = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

export type PatientAnalysisTrendPoint = {
  period: string;
  label: string;
  scheduledAppointments: number;
  confirmedAppointments: number;
  acceptedBudgets: number;
  newPatients: number;
  attendedAppointments: number;
  attendanceEligibleAppointments: number;
  confirmedRate: number;
  acceptedRate: number;
  attendanceRate: number;
};

export type PatientAnalysisResponse = {
  metadata: {
    organizationId: string;
    branchIds: string[];
    branches: Array<{ id: string; name: string }>;
    from: string;
    to: string;
    timezone: string;
    cutoffAt: string;
    lastUpdatedAt: string;
    metricVersion: string;
    granularity: "day" | "month" | "year";
    source: "live" | "snapshot";
    currencies: string[];
    durationMs: number;
  };
  capabilities: {
    canReadFinancial: boolean;
    canViewAllBranches: boolean;
    canExport: boolean;
    canRefresh: boolean;
    canViewPatientDetails: boolean;
  };
  conversion: {
    totals: {
      scheduledAppointments: number;
      confirmedAppointments: number;
      acceptedBudgets: number;
      scheduledRate: number;
      confirmedRate: number;
      acceptedRate: number;
      confirmedToAcceptedRate: number;
    };
    funnel: Array<{
      key: string;
      label: string;
      value: number;
      percent: number;
    }>;
    trend: PatientAnalysisTrendPoint[];
    definition: Record<string, { formula: string; denominator: string }>;
  };
  demographics: Array<{
    key: string;
    label: string;
    universe: string;
    formula: string;
    denominator: number;
    omitted: number;
    period: { from: string; to: string };
    cutoffAt: string;
    branchIds: string[];
    data: PatientAnalysisDistribution[];
  }>;
  globalMetrics: Array<{
    key: string;
    label: string;
    value?: number;
    values?: Array<{ currency: string; value: number }>;
    breakdown?: Array<{ stage: string; values: Array<{ currency: string; value: number }> }>;
    format: "number" | "money" | "percent";
    formula: string;
    denominator: string;
    trend: number[];
  }>;
};

export type PatientAnalysisDetailQuery = PatientAnalysisQuery & {
  page?: number;
  pageSize?: number;
  search?: string;
  order?: "asc" | "desc";
  sortBy?: string;
};

export type PatientAnalysisDetailResponse = {
  metric: string;
  metadata: {
    branchIds: string[];
    from: string;
    to: string;
    timezone: string;
    cutoffAt: string;
    metricVersion: string;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  rows: Array<Record<string, unknown>>;
};

export async function listPatients(params?: PatientsQuery) {
  const { data } = await http.get<PatientListItem[]>("/patients", { params });
  return data;
}

export async function getPatientsAnalysis(params?: PatientAnalysisQuery) {
  const { data } = await http.get<PatientAnalysisResponse>("/patient-analytics/overview", { params });
  return data;
}

export async function getPatientAnalysisDetail(metric: string, params?: PatientAnalysisDetailQuery) {
  const { data } = await http.get<PatientAnalysisDetailResponse>(`/patient-analytics/details/${metric}`, {
    params
  });
  return data;
}

export async function refreshPatientsAnalysis(params?: PatientAnalysisQuery) {
  const { data } = await http.post<PatientAnalysisResponse>("/patient-analytics/refresh", undefined, {
    params
  });
  return data;
}

export async function exportPatientAnalysis(metric: string, params?: PatientAnalysisDetailQuery) {
  const response = await http.get<Blob>(`/patient-analytics/export/${metric}`, {
    params,
    responseType: "blob"
  });
  return response.data;
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

export async function createPatient(
  payload: PatientPayload,
  context: "newPatient" | "appointment" = "newPatient"
) {
  const { data } = await http.post<CreatePatientResponse>("/patients", payload, {
    headers: { "x-patient-field-context": context }
  });
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

export async function listPatientBenefitsCoverages(id: string) {
  const { data } = await http.get<PatientBenefitsCoveragesResponse>(`/patients/${id}/benefits-coverages`);
  return data;
}

export async function createPatientBenefitCoverage(
  id: string,
  payload: PatientBenefitCoveragePayload,
  idempotencyKey: string
) {
  const { data } = await http.post<PatientBenefitCoverage>(`/patients/${id}/benefits-coverages`, payload, {
    headers: { "Idempotency-Key": idempotencyKey }
  });
  return data;
}

export async function updatePatientBenefitCoverage(
  id: string,
  coverageId: string,
  payload: Partial<PatientBenefitCoveragePayload> & { expectedVersion?: number }
) {
  const { data } = await http.patch<PatientBenefitCoverage>(
    `/patients/${id}/benefits-coverages/${coverageId}`,
    payload
  );
  return data;
}

export async function changePatientBenefitCoverageStatus(
  id: string,
  coverageId: string,
  action: "activate" | "deactivate" | "cancel",
  reason?: string
) {
  const { data } = await http.post<PatientBenefitCoverage>(
    `/patients/${id}/benefits-coverages/${coverageId}/${action}`,
    { reason }
  );
  return data;
}

export async function validatePatientInsurance(id: string, payload: ValidateInsurancePayload) {
  const { data } = await http.post(`/patients/${id}/insurance-validations`, payload);
  return data;
}

export async function listEligiblePatientCoverages(id: string, params?: { treatmentPlanId?: string }) {
  const { data } = await http.get<PatientBenefitsCoveragesResponse>(`/patients/${id}/eligible-coverages`, {
    params
  });
  return data;
}

export async function addPatientNote(
  id: string,
  payload: { note: string; isPrivate?: boolean; fileAttachmentIds?: string[] }
) {
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
