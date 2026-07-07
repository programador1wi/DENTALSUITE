import { http } from "@/lib/api/http-client";
import type { ClinicalDocumentContent } from "@/features/clinical-documents/clinical-document-content";

export type ClinicalDocumentTemplateSettings = {
  id: string;
  name: string;
  description?: string | null;
  content: ClinicalDocumentContent;
  isActive: boolean;
};

export type ClinicalDocumentTemplatePayload = {
  name: string;
  description?: string;
  content: ClinicalDocumentContent;
};

export type ClinicalDocumentTemplateAsset = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};

export async function listClinicalDocumentTemplates(params?: { search?: string; active?: string }) {
  const { data } = await http.get<ClinicalDocumentTemplateSettings[]>("/settings/clinical-document-templates", { params });
  return data;
}

export async function createClinicalDocumentTemplate(payload: ClinicalDocumentTemplatePayload) {
  const { data } = await http.post<ClinicalDocumentTemplateSettings>("/settings/clinical-document-templates", payload);
  return data;
}

export async function updateClinicalDocumentTemplate(
  id: string,
  payload: Partial<ClinicalDocumentTemplatePayload> & { isActive?: boolean }
) {
  const { data } = await http.patch<ClinicalDocumentTemplateSettings>(`/settings/clinical-document-templates/${id}`, payload);
  return data;
}

export async function duplicateClinicalDocumentTemplate(id: string) {
  const { data } = await http.post<ClinicalDocumentTemplateSettings>(`/settings/clinical-document-templates/${id}/duplicate`);
  return data;
}

export async function deactivateClinicalDocumentTemplate(id: string) {
  const { data } = await http.patch<ClinicalDocumentTemplateSettings>(`/settings/clinical-document-templates/${id}/deactivate`);
  return data;
}

export async function uploadClinicalDocumentTemplateAsset(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await http.post<ClinicalDocumentTemplateAsset>("/settings/clinical-document-templates/assets/upload", formData);
  return data;
}
