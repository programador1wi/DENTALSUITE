import { http } from "@/lib/api/http-client";

export type ClinicalDocumentTemplateSettings = {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  isActive: boolean;
};

export type ClinicalDocumentTemplatePayload = {
  name: string;
  description?: string;
  content: string;
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

export async function deactivateClinicalDocumentTemplate(id: string) {
  const { data } = await http.patch<ClinicalDocumentTemplateSettings>(`/settings/clinical-document-templates/${id}/deactivate`);
  return data;
}
