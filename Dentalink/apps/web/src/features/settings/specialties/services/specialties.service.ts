import { http } from "@/lib/api/http-client";

export type Specialty = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

export type SpecialtyPayload = {
  name: string;
  description?: string;
};

export type SpecialtyClinicalTemplateType = "PRESCRIPTION" | "EVOLUTION";

export type SpecialtyClinicalTemplate = {
  id: string;
  specialtyId: string;
  type: SpecialtyClinicalTemplateType;
  name: string;
  content: string;
  isActive: boolean;
};

export type SpecialtyClinicalTemplatePayload = {
  type: SpecialtyClinicalTemplateType;
  name: string;
  content: string;
};

export type SpecialtyAppointmentReason = {
  id: string;
  specialtyId: string;
  name: string;
  durationMinutes: number;
  color?: string | null;
  isActive: boolean;
};

export type SpecialtyAppointmentReasonPayload = {
  name: string;
  durationMinutes: number;
  color?: string;
};

export async function listSpecialties(params?: { search?: string; active?: string }) {
  const { data } = await http.get<Specialty[]>("/specialties", { params });
  return data;
}

export async function createSpecialty(payload: SpecialtyPayload) {
  const { data } = await http.post<Specialty>("/specialties", payload);
  return data;
}

export async function updateSpecialty(id: string, payload: Partial<SpecialtyPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<Specialty>(`/specialties/${id}`, payload);
  return data;
}

export async function deactivateSpecialty(id: string) {
  const { data } = await http.patch<Specialty>(`/specialties/${id}/deactivate`);
  return data;
}

export async function listSpecialtyClinicalTemplates(
  specialtyId: string,
  params?: { type?: SpecialtyClinicalTemplateType; active?: string }
) {
  const { data } = await http.get<SpecialtyClinicalTemplate[]>(`/specialties/${specialtyId}/clinical-templates`, { params });
  return data;
}

export async function createSpecialtyClinicalTemplate(specialtyId: string, payload: SpecialtyClinicalTemplatePayload) {
  const { data } = await http.post<SpecialtyClinicalTemplate>(`/specialties/${specialtyId}/clinical-templates`, payload);
  return data;
}

export async function updateSpecialtyClinicalTemplate(
  specialtyId: string,
  templateId: string,
  payload: Partial<Omit<SpecialtyClinicalTemplatePayload, "type">> & { isActive?: boolean }
) {
  const { data } = await http.patch<SpecialtyClinicalTemplate>(
    `/specialties/${specialtyId}/clinical-templates/${templateId}`,
    payload
  );
  return data;
}

export async function listSpecialtyAppointmentReasons(specialtyId: string, active?: string) {
  const { data } = await http.get<SpecialtyAppointmentReason[]>(`/specialties/${specialtyId}/appointment-reasons`, {
    params: { active }
  });
  return data;
}

export async function createSpecialtyAppointmentReason(specialtyId: string, payload: SpecialtyAppointmentReasonPayload) {
  const { data } = await http.post<SpecialtyAppointmentReason>(`/specialties/${specialtyId}/appointment-reasons`, payload);
  return data;
}

export async function updateSpecialtyAppointmentReason(
  specialtyId: string,
  reasonId: string,
  payload: Partial<SpecialtyAppointmentReasonPayload> & { isActive?: boolean }
) {
  const { data } = await http.patch<SpecialtyAppointmentReason>(
    `/specialties/${specialtyId}/appointment-reasons/${reasonId}`,
    payload
  );
  return data;
}
