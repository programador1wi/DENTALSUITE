import { http } from "@/lib/api/http-client";

export type FileAttachment = {
  id: string;
  organizationId: string;
  patientId?: string | null;
  userId?: string | null;
  professionalId?: string | null;
  treatmentPlanId?: string | null;
  uploadedById: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deleteReason?: string | null;
};

export type RadiographyFinding = {
  id: string;
  tooth: string;
  label: string;
  bbox: { x: number; y: number; width: number; height: number };
  visible: boolean;
  source: "MANUAL" | "AI";
};

export type RadiographyAnalysis = {
  id: string;
  organizationId: string;
  patientId: string;
  fileAttachmentId: string;
  provider: "MANUAL" | "AI";
  status: "DRAFT" | "CONFIRMED";
  findings: RadiographyFinding[];
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsentTemplate = {
  id: string;
  organizationId: string;
  name: string;
  internalDescription?: string | null;
  content: string;
  procedureId?: string | null;
  scopeType: "ORGANIZATION" | "BRANCHES" | "SPECIALTY" | "TREATMENTS";
  specialtyId?: string | null;
  treatmentTypeIds: string[];
  status: "DRAFT" | "PUBLISHED" | "INACTIVE" | "ARCHIVED";
  isActive: boolean;
  currentPublishedVersionId?: string | null;
  version: number;
  createdById?: string | null;
  updatedById?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
  generatedCount: number;
  branchIds: string[];
  branches: Array<{ branchId: string; branch: { id: string; name: string } }>;
  currentPublishedVersion?: ConsentTemplateVersion | null;
  draftVersion?: ConsentTemplateVersion | null;
  editableVersion?: ConsentTemplateVersion | null;
  versions: ConsentTemplateVersion[];
  validation: ConsentValidation;
  procedure?: { id: string; code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsentTemplateVersion = {
  id: string;
  templateId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  editorSchemaJson: Record<string, unknown>;
  sanitizedHtmlSnapshot: string;
  requiredSignersJson: RequiredSigners;
  requiredSigners?: RequiredSigners;
  variablesManifestJson: ConsentVariableDefinition[];
  contentHash: string;
  createdById?: string | null;
  publishedById?: string | null;
  createdAt: string;
  publishedAt?: string | null;
};

export type RequiredSigners = {
  patient: { enabled: boolean; required: boolean };
  professional: {
    enabled: boolean;
    required: boolean;
    mode: "TREATMENT_PROFESSIONAL" | "MANUAL" | "ANY_AUTHORIZED";
  };
  representative: { enabled: boolean; required: boolean; replacesPatient: boolean };
};

export type ConsentVariableDefinition = {
  key: string;
  label: string;
  category: string;
  dataType: "text" | "date" | "number";
  sensitive: boolean;
  source: string;
  format?: string;
  fallback: string;
};

export type ConsentValidation = {
  errors: string[];
  warnings: string[];
  manifest: ConsentVariableDefinition[];
  fieldKeys: string[];
};

export type ConsentTemplateDraft = {
  name: string;
  internalDescription?: string;
  scopeType: ConsentTemplate["scopeType"];
  branchIds?: string[];
  specialtyId?: string;
  treatmentTypeIds?: string[];
  editorSchemaJson: Record<string, unknown>;
  requiredSigners: RequiredSigners;
};

export type Consent = {
  id: string;
  organizationId: string;
  branchId: string;
  patientId: string;
  templateId: string;
  templateVersionId: string;
  treatmentPlanId?: string | null;
  appointmentId?: string | null;
  professionalId?: string | null;
  representativeId?: string | null;
  contentSnapshot: string;
  renderedHtmlSnapshot: string;
  mergedValuesJson: Record<string, unknown>;
  documentHash: string;
  status: "DRAFT" | "READY_FOR_SIGNATURE" | "PARTIALLY_SIGNED" | "SIGNED" | "VOIDED" | "EXPIRED" | "CANCELLED";
  version: number;
  signedAt?: string | null;
  completedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  pdfChecksum?: string | null;
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; status: ConsentTemplate["status"] };
  templateVersion: ConsentTemplateVersion;
  requiredSigners: RequiredSigners;
  missingRequiredSigners: string[];
  manualFields: Array<{
    key: string;
    kind: "PREFILLED_TEXT" | "FREE_TEXT" | "DATE" | "DOCUMENT_ID" | "REPRESENTATIVE";
    label: string;
    required: boolean;
    config: Record<string, unknown>;
  }>;
  signatures: Array<{
    id: string;
    signerName: string;
    signerType: string;
    signatureMethod: string;
    documentHash: string;
    signatureChecksum: string;
    signedAt: string;
  }>;
};

export async function listPatientFiles(patientId: string, params?: { category?: string; treatmentPlanId?: string }) {
  const { data } = await http.get<FileAttachment[]>(`/patients/${patientId}/files`, { params });
  return data;
}

export async function uploadPatientFile(
  patientId: string,
  payload: {
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    category: string;
    treatmentPlanId?: string;
  }
) {
  const { data } = await http.post<FileAttachment>(`/patients/${patientId}/files`, payload);
  return data;
}

export async function uploadPatientBinaryFile(patientId: string, payload: { file: File; category: string; treatmentPlanId?: string }) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("category", payload.category);
  if (payload.treatmentPlanId) formData.append("treatmentPlanId", payload.treatmentPlanId);
  const { data } = await http.post<FileAttachment>(`/patients/${patientId}/files/upload`, formData);
  return data;
}

export async function listUserFiles(userId: string, params?: { category?: string }) {
  const { data } = await http.get<FileAttachment[]>(`/users/${userId}/files`, { params });
  return data;
}

export async function uploadUserBinaryFile(
  userId: string,
  payload: { file: File; category: string; professionalId?: string }
) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("category", payload.category);
  if (payload.professionalId) formData.append("professionalId", payload.professionalId);
  const { data } = await http.post<FileAttachment>(`/users/${userId}/files/upload`, formData);
  return data;
}

export async function getPatientFileBlob(file: FileAttachment) {
  const path = normalizeFilePath(file.url);
  const { data } = await http.get<Blob>(path, { responseType: "blob" });
  return data;
}

export async function getPatientRadiographyAnalysis(patientId: string, fileId: string) {
  const { data } = await http.get<RadiographyAnalysis | null>(`/patients/${patientId}/files/${fileId}/radiography-analysis`);
  return data;
}

export async function savePatientRadiographyAnalysis(
  patientId: string,
  fileId: string,
  payload: { status?: "DRAFT" | "CONFIRMED"; findings: RadiographyFinding[] }
) {
  const { data } = await http.put<RadiographyAnalysis>(`/patients/${patientId}/files/${fileId}/radiography-analysis`, payload);
  return data;
}

function normalizeFilePath(url: string) {
  if (url.startsWith("/api/v1/")) return url.replace("/api/v1", "");
  return url;
}

export async function listConsentTemplates(params?: {
  search?: string;
  status?: ConsentTemplate["status"];
  branchId?: string;
  scopeType?: ConsentTemplate["scopeType"];
}) {
  const { data } = await http.get<{ items: ConsentTemplate[]; total: number; skip: number; take: number }>(
    "/consent-templates",
    { params }
  );
  return data;
}

export async function getConsentTemplate(id: string) {
  const { data } = await http.get<ConsentTemplate>(`/consent-templates/${id}`);
  return data;
}

export async function listConsentVariables() {
  const { data } = await http.get<ConsentVariableDefinition[]>("/consent-templates/variables");
  return data;
}

export async function createConsentTemplate(payload: ConsentTemplateDraft) {
  const { data } = await http.post<ConsentTemplate & { validation: ConsentValidation }>("/consent-templates", payload, {
    headers: { "correlation-id": crypto.randomUUID() }
  });
  return data;
}

export async function updateConsentTemplate(
  id: string,
  payload: ConsentTemplateDraft & { expectedVersion: number }
) {
  const { data } = await http.patch<ConsentTemplate & { validation: ConsentValidation }>(`/consent-templates/${id}`, payload, {
    headers: { "correlation-id": crypto.randomUUID() }
  });
  return data;
}

export async function previewConsentTemplate(payload: Pick<ConsentTemplateDraft, "editorSchemaJson" | "requiredSigners">) {
  const { data } = await http.post<{
    html: string;
    validation: ConsentValidation;
    sampleValues: Record<string, unknown>;
    documentHash: string;
  }>("/consent-templates/preview", payload);
  return data;
}

export async function publishConsentTemplate(id: string, expectedVersion: number) {
  const { data } = await http.post<ConsentTemplate>(
    `/consent-templates/${id}/publish`,
    { expectedVersion },
    { headers: { "correlation-id": crypto.randomUUID() } }
  );
  return data;
}

export async function createConsentTemplateVersion(id: string, expectedVersion: number) {
  const { data } = await http.post<ConsentTemplate>(
    `/consent-templates/${id}/new-version`,
    { expectedVersion },
    { headers: { "correlation-id": crypto.randomUUID() } }
  );
  return data;
}

export async function duplicateConsentTemplate(id: string) {
  const { data } = await http.post<ConsentTemplate>(
    `/consent-templates/${id}/duplicate`,
    {},
    { headers: { "correlation-id": crypto.randomUUID() } }
  );
  return data;
}

export async function deactivateConsentTemplate(id: string, expectedVersion: number) {
  const { data } = await http.post<ConsentTemplate>(
    `/consent-templates/${id}/deactivate`,
    { expectedVersion },
    { headers: { "correlation-id": crypto.randomUUID() } }
  );
  return data;
}

export async function listConsentTemplateVersions(id: string) {
  const { data } = await http.get<ConsentTemplateVersion[]>(`/consent-templates/${id}/versions`);
  return data;
}

export async function listConsentTemplateAudit(id: string) {
  const { data } = await http.get<ConsentAuditEntry[]>(`/consent-templates/${id}/audit`);
  return data;
}

export async function listPatientConsents(patientId: string, params?: { status?: Consent["status"] }) {
  const { data } = await http.get<Consent[]>(`/patients/${patientId}/consents`, { params });
  return data;
}

export async function createPatientConsent(
  patientId: string,
  payload: {
    templateId: string;
    treatmentPlanId?: string;
    appointmentId?: string;
    professionalId?: string;
    representativeId?: string;
    supersedesConsentId?: string;
    values?: Record<string, unknown>;
  }
) {
  const { data } = await http.post<Consent>(`/patients/${patientId}/consents`, payload, {
    headers: {
      "idempotency-key": crypto.randomUUID(),
      "correlation-id": crypto.randomUUID()
    }
  });
  return data;
}

export async function getConsent(id: string) {
  const { data } = await http.get<Consent>(`/consents/${id}`);
  return data;
}

export async function updateConsentFields(consentId: string, values: Record<string, unknown>, expectedVersion: number) {
  const { data } = await http.patch<Consent>(
    `/consents/${consentId}/fields`,
    { values, expectedVersion },
    { headers: { "correlation-id": crypto.randomUUID() } }
  );
  return data;
}

export async function prepareConsentSignature(consentId: string) {
  const { data } = await http.post<{
    consentId: string;
    documentHash: string;
    renderedHtmlSnapshot: string;
    enabledSigners: string[];
    requiredSigners: string[];
    missingRequiredSigners: string[];
    acceptanceText: string;
    acceptanceTextVersion: string;
  }>(`/consents/${consentId}/prepare-signature`);
  return data;
}

export async function addConsentSignature(
  consentId: string,
  payload: {
    signerName: string;
    signerType: "PATIENT" | "PROFESSIONAL" | "REPRESENTATIVE";
    signerReferenceId?: string;
    signatureMethod: "DRAWN" | "EXPLICIT_ACCEPTANCE" | "SAVED_PROFESSIONAL_SIGNATURE";
    signatureDataUrl: string;
    documentHash: string;
    acceptanceText: string;
    acceptanceTextVersion: string;
    timezone?: string;
  }
) {
  const { data } = await http.post<Consent>(`/consents/${consentId}/signatures`, payload, {
    headers: { "correlation-id": crypto.randomUUID() }
  });
  return data;
}

export async function finalizeConsent(consentId: string, expectedVersion: number, documentHash: string) {
  const { data } = await http.post<Consent>(
    `/consents/${consentId}/finalize`,
    { expectedVersion, documentHash },
    { headers: { "correlation-id": crypto.randomUUID() } }
  );
  return data;
}

export async function voidConsent(consentId: string, expectedVersion: number, reason: string, currentPassword: string) {
  const { data } = await http.post<Consent>(
    `/consents/${consentId}/void`,
    { expectedVersion, reason, currentPassword },
    { headers: { "correlation-id": crypto.randomUUID() } }
  );
  return data;
}

export async function getConsentEvidence(consentId: string) {
  const { data } = await http.get<{
    consentId: string;
    status: Consent["status"];
    templateVersionId: string;
    templateVersionNumber: number;
    documentHash: string;
    pdfChecksum?: string | null;
    completedAt?: string | null;
    voidedAt?: string | null;
    voidReason?: string | null;
    signatures: Array<Record<string, unknown>>;
  }>(`/consents/${consentId}/evidence`);
  return data;
}

export async function getConsentAudit(consentId: string) {
  const { data } = await http.get<ConsentAuditEntry[]>(`/consents/${consentId}/audit`);
  return data;
}

export async function downloadConsentPdf(consentId: string) {
  const { data } = await http.get<Blob>(`/consents/${consentId}/pdf`, {
    responseType: "blob",
    headers: { "correlation-id": crypto.randomUUID() }
  });
  return data;
}

export type ConsentAuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  actorUserId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  correlationId?: string | null;
  createdAt: string;
};

export async function deletePatientFile(patientId: string, fileId: string, payload: { reason: string }) {
  const { data } = await http.delete(`/patients/${patientId}/files/${fileId}`, { data: payload });
  return data;
}
