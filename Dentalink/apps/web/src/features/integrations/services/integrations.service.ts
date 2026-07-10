import { http } from "@/lib/api/http-client";

export type PageEnvelope<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type CommunicationChannel = "EMAIL" | "WHATSAPP" | "SMS" | "PHONE" | "INTERNAL";
export type CommunicationJobStatus = "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
export type MessageDeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "RESPONDED" | "FAILED";
export type SurveyType = "SATISFACTION" | "NPS" | "CUSTOM";
export type SurveyStatus = "DRAFT" | "SCHEDULED" | "SENT" | "COMPLETED" | "CANCELLED";
export type TelemedicineSessionStatus = "SCHEDULED" | "STARTED" | "COMPLETED" | "CANCELLED";
export type ImportJobType = "PATIENTS" | "PROCEDURES" | "INVENTORY" | "PAYMENTS" | "CUSTOM";
export type ImportJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type DocumentRequirementStatus = "PENDING" | "SATISFIED" | "WAIVED" | "CANCELLED";
export type DocumentRequirementScope = "PATIENT" | "TREATMENT_PLAN" | "PROCEDURE";
export type PaymentWebhookEventStatus = "RECEIVED" | "PROCESSED" | "IGNORED" | "FAILED";
export type AiUseCase = "RADIOGRAPHY" | "CLINICAL_NOTE" | "REPORT" | "CRM" | "CONTROL" | "SMILE_SIMULATOR";
export type AiRequestStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type PatientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  branchId?: string | null;
};

export type CommunicationJob = {
  id: string;
  channel: CommunicationChannel;
  recipient: string;
  subject?: string | null;
  body: string;
  status: CommunicationJobStatus;
  provider: string;
  scheduledAt?: string | null;
  queuedAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  patient?: PatientSummary | null;
  deliveries: { id: string; status: MessageDeliveryStatus; createdAt: string }[];
  createdAt: string;
};

export type Survey = {
  id: string;
  type: SurveyType;
  channel: CommunicationChannel;
  title: string;
  token: string;
  status: SurveyStatus;
  score?: number | null;
  comment?: string | null;
  patient?: PatientSummary | null;
  npsResponse?: { score: number; category: string; comment?: string | null } | null;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  body: string;
  threadKey?: string | null;
  patient?: PatientSummary | null;
  senderUser: { id: string; firstName: string; lastName: string; email: string };
  createdAt: string;
};

export type TelemedicineSession = {
  id: string;
  patient: PatientSummary;
  professional?: { id: string; firstName: string; lastName: string } | null;
  provider: string;
  joinUrl?: string | null;
  status: TelemedicineSessionStatus;
  startsAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

export type ImportJob = {
  id: string;
  type: ImportJobType;
  status: ImportJobStatus;
  fileName?: string | null;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
  completedAt?: string | null;
};

export type DocumentRequirement = {
  id: string;
  name: string;
  scope: DocumentRequirementScope;
  status: DocumentRequirementStatus;
  patient?: PatientSummary | null;
  treatmentPlan?: { id: string; name: string; status: string } | null;
  procedure?: { id: string; code: string; name: string } | null;
  dueAt?: string | null;
  requiredBefore?: string | null;
  waiverReason?: string | null;
  createdAt: string;
};

export type PaymentWebhookEvent = {
  id: string;
  provider: string;
  eventType: string;
  idempotencyKey: string;
  status: PaymentWebhookEventStatus;
  paymentLinkId?: string | null;
  paymentId?: string | null;
  receivedAt: string;
  processedAt?: string | null;
};

export type AiRequest = {
  id: string;
  useCase: AiUseCase;
  provider: string;
  status: AiRequestStatus;
  patient?: PatientSummary | null;
  summary?: string | null;
  result?: { id: string; summary?: string | null; confidence?: number | null } | null;
  createdAt: string;
};

export type CreateCommunicationJobPayload = {
  channel: CommunicationChannel;
  recipient: string;
  subject?: string;
  body: string;
  templateKey?: string;
  patientId?: string;
  appointmentId?: string;
  paymentId?: string;
  scheduledAt?: string;
};

export type CreateSurveyPayload = {
  type: SurveyType;
  channel: CommunicationChannel;
  title: string;
  patientId?: string;
  appointmentId?: string;
  scheduledAt?: string;
};

export type CreateChatMessagePayload = {
  body: string;
  patientId?: string;
  threadKey?: string;
};

export type CreateTelemedicineSessionPayload = {
  patientId: string;
  appointmentId?: string;
  professionalId?: string;
  startsAt: string;
  provider?: string;
  joinUrl?: string;
  notes?: string;
};

export type CreateImportJobPayload = {
  type: ImportJobType;
  fileName?: string;
  summary?: Record<string, unknown>;
};

export type UpdateImportJobPayload = {
  status?: ImportJobStatus;
  totalRows?: number;
  successRows?: number;
  errorRows?: number;
  summary?: Record<string, unknown>;
  errors?: Record<string, unknown>;
};

export type CreateDocumentRequirementPayload = {
  name: string;
  description?: string;
  scope?: DocumentRequirementScope;
  patientId?: string;
  treatmentPlanId?: string;
  procedureId?: string;
  requiredBefore?: string;
  dueAt?: string;
};

export type CreateAiRequestPayload = {
  useCase: AiUseCase;
  patientId?: string;
  provider?: string;
  prompt?: string;
  input?: Record<string, unknown>;
};

export async function listCommunicationJobs(params?: { status?: CommunicationJobStatus; channel?: CommunicationChannel; patientId?: string }) {
  const { data } = await http.get<PageEnvelope<CommunicationJob>>("/integrations/communication-jobs", { params });
  return data;
}

export async function createCommunicationJob(payload: CreateCommunicationJobPayload) {
  const { data } = await http.post<CommunicationJob>("/integrations/communication-jobs", payload);
  return data;
}

export async function queueCommunicationJob(id: string) {
  const { data } = await http.post<CommunicationJob>(`/integrations/communication-jobs/${id}/queue`);
  return data;
}

export async function recordMessageDelivery(id: string, status: MessageDeliveryStatus) {
  const { data } = await http.post(`/integrations/communication-jobs/${id}/deliveries`, { status });
  return data;
}

export async function listSurveys(params?: { status?: SurveyStatus; type?: SurveyType; patientId?: string }) {
  const { data } = await http.get<PageEnvelope<Survey>>("/integrations/surveys", { params });
  return data;
}

export async function createSurvey(payload: CreateSurveyPayload) {
  const { data } = await http.post<Survey>("/integrations/surveys", payload);
  return data;
}

export async function sendSurvey(id: string) {
  const { data } = await http.post(`/integrations/surveys/${id}/send`);
  return data;
}

export async function listChatMessages(params?: { patientId?: string; threadKey?: string }) {
  const { data } = await http.get<PageEnvelope<ChatMessage>>("/integrations/chat/messages", { params });
  return data;
}

export async function createChatMessage(payload: CreateChatMessagePayload) {
  const { data } = await http.post<ChatMessage>("/integrations/chat/messages", payload);
  return data;
}

export async function listTelemedicineSessions(params?: { status?: TelemedicineSessionStatus; patientId?: string }) {
  const { data } = await http.get<PageEnvelope<TelemedicineSession>>("/integrations/telemedicine/sessions", { params });
  return data;
}

export async function createTelemedicineSession(payload: CreateTelemedicineSessionPayload) {
  const { data } = await http.post<TelemedicineSession>("/integrations/telemedicine/sessions", payload);
  return data;
}

export async function updateTelemedicineStatus(id: string, status: TelemedicineSessionStatus) {
  const { data } = await http.patch<TelemedicineSession>(`/integrations/telemedicine/sessions/${id}/status`, { status });
  return data;
}

export async function listImportJobs(params?: { type?: ImportJobType; status?: ImportJobStatus }) {
  const { data } = await http.get<PageEnvelope<ImportJob>>("/integrations/import-jobs", { params });
  return data;
}

export async function createImportJob(payload: CreateImportJobPayload) {
  const { data } = await http.post<ImportJob>("/integrations/import-jobs", payload);
  return data;
}

export async function updateImportJob(id: string, payload: UpdateImportJobPayload) {
  const { data } = await http.patch<ImportJob>(`/integrations/import-jobs/${id}`, payload);
  return data;
}

export async function listDocumentRequirements(params?: {
  status?: DocumentRequirementStatus;
  patientId?: string;
  treatmentPlanId?: string;
}) {
  const { data } = await http.get<PageEnvelope<DocumentRequirement>>("/integrations/document-requirements", { params });
  return data;
}

export async function createDocumentRequirement(payload: CreateDocumentRequirementPayload) {
  const { data } = await http.post<DocumentRequirement>("/integrations/document-requirements", payload);
  return data;
}

export async function satisfyDocumentRequirement(id: string, payload: { clinicalDocumentId?: string; consentId?: string; fileAttachmentId?: string }) {
  const { data } = await http.patch<DocumentRequirement>(`/integrations/document-requirements/${id}/satisfy`, payload);
  return data;
}

export async function waiveDocumentRequirement(id: string, reason: string) {
  const { data } = await http.patch<DocumentRequirement>(`/integrations/document-requirements/${id}/waive`, { reason });
  return data;
}

export async function listPaymentWebhookEvents(params?: { provider?: string; paymentLinkId?: string }) {
  const { data } = await http.get<PageEnvelope<PaymentWebhookEvent>>("/integrations/payment-webhook-events", { params });
  return data;
}

export async function listAiRequests(params?: { useCase?: AiUseCase; status?: AiRequestStatus; patientId?: string }) {
  const { data } = await http.get<PageEnvelope<AiRequest>>("/integrations/ai/requests", { params });
  return data;
}

export async function createAiRequest(payload: CreateAiRequestPayload) {
  const { data } = await http.post<AiRequest>("/integrations/ai/requests", payload);
  return data;
}
