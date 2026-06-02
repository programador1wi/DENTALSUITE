import { http } from "@/lib/api/http-client";

export type FileAttachment = {
  id: string;
  organizationId: string;
  patientId?: string | null;
  userId?: string | null;
  professionalId?: string | null;
  uploadedById: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

export type ConsentTemplate = {
  id: string;
  organizationId: string;
  name: string;
  content: string;
  procedureId?: string | null;
  isActive: boolean;
  procedure?: { id: string; code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type Consent = {
  id: string;
  patientId: string;
  templateId: string;
  treatmentPlanId?: string | null;
  appointmentId?: string | null;
  contentSnapshot: string;
  status: "DRAFT" | "SIGNED" | "CANCELLED";
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; procedureId?: string | null };
  signatures: Array<{
    id: string;
    signerName: string;
    signerType: string;
    signatureData: string;
    ipAddress?: string | null;
    signedAt: string;
  }>;
};

export async function listPatientFiles(patientId: string, params?: { category?: string }) {
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
  }
) {
  const { data } = await http.post<FileAttachment>(`/patients/${patientId}/files`, payload);
  return data;
}

export async function uploadPatientBinaryFile(patientId: string, payload: { file: File; category: string }) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("category", payload.category);
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

function normalizeFilePath(url: string) {
  if (url.startsWith("/api/v1/")) return url.replace("/api/v1", "");
  return url;
}

export async function listConsentTemplates(params?: { search?: string; active?: string }) {
  const { data } = await http.get<ConsentTemplate[]>("/settings/consent-templates", { params });
  return data;
}

export async function createConsentTemplate(payload: { name: string; content: string; procedureId?: string }) {
  const { data } = await http.post<ConsentTemplate>("/settings/consent-templates", payload);
  return data;
}

export async function updateConsentTemplate(
  id: string,
  payload: Partial<{ name: string; content: string; procedureId: string | null; isActive: boolean }>
) {
  const { data } = await http.patch<ConsentTemplate>(`/settings/consent-templates/${id}`, payload);
  return data;
}

export async function deactivateConsentTemplate(id: string) {
  const { data } = await http.patch<ConsentTemplate>(`/settings/consent-templates/${id}/deactivate`);
  return data;
}

export async function listPatientConsents(patientId: string, params?: { status?: "DRAFT" | "SIGNED" | "CANCELLED" }) {
  const { data } = await http.get<Consent[]>(`/patients/${patientId}/consents`, { params });
  return data;
}

export async function createPatientConsent(
  patientId: string,
  payload: { templateId: string; treatmentPlanId?: string; appointmentId?: string }
) {
  const { data } = await http.post<Consent>(`/patients/${patientId}/consents`, payload);
  return data;
}

export async function signConsent(
  consentId: string,
  payload: { signerName: string; signerType: string; signatureData: string; ipAddress?: string }
) {
  const { data } = await http.post<Consent>(`/consents/${consentId}/sign`, payload);
  return data;
}

export async function getConsentPdf(consentId: string) {
  const { data } = await http.get<{
    fileName: string;
    mimeType: string;
    status: string;
    signedAt?: string | null;
    contentSnapshot: string;
    printableContent: string;
  }>(`/consents/${consentId}/pdf`);
  return data;
}
