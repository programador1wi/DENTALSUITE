import { http } from "@/lib/api/http-client";

export type PublicAvailabilityQuery = {
  branchId: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
};

export type PublicPatient = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
};

export type PublicCreateAppointmentDto = {
  branchId: string;
  professionalId: string;
  specialtyId?: string;
  motive?: string;
  startAt: string;
  patient: PublicPatient;
  campaignCode?: string;
};

export type AvailabilitySlot = {
  startAt: string;
  endAt: string;
  available: boolean;
};

export type PublicConfig = {
  id: string;
  isEnabled: boolean;
  slug: string;
  brandColor?: string;
  logoUrl?: string;
  footerText?: string;
  confirmationMessage?: string;
  requiredPatientFields: string[];
  identificationMethod: string;
  branches: Array<{ id: string; name: string }>;
  professionals: Array<{ id: string; firstName: string; lastName: string }>;
  specialties: Array<{ id: string; name: string }>;
  mode: string;
  menuByProfessional: boolean;
  menuBySpecialty: boolean;
  menuByBranch: boolean;
  redirectUrl?: string;
};

export async function getPublicConfig(slug: string) {
  const { data } = await http.get<PublicConfig>(`/public/booking/${slug}/config`);
  return data;
}

export async function getPublicAvailability(slug: string, query: PublicAvailabilityQuery) {
  const params = new URLSearchParams(query as any).toString();
  const { data } = await http.get<{ slots: AvailabilitySlot[] }>(`/public/booking/${slug}/availability?${params}`);
  return data;
}

export async function createPublicAppointment(slug: string, dto: PublicCreateAppointmentDto) {
  const { data } = await http.post(`/public/booking/${slug}/appointments`, dto);
  return data;
}

export async function trackPublicEvent(slug: string, eventType: 'VISIT' | 'CONVERSION', campaignCode?: string) {
  const { data } = await http.post(`/public/booking/${slug}/track`, { eventType, campaignCode });
  return data;
}

export type PublicPatientProfile = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  alternatePhone?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
};

export type UpdatePublicPatientProfileDto = Partial<PublicPatientProfile> & {
  privacyNoticeAccepted: boolean;
};

export async function getPublicPatientProfile(id: string, token: string) {
  const { data } = await http.get<PublicPatientProfile>(`/public/booking/appointments/${id}/patient-profile?token=${token}`);
  return data;
}

export async function updatePublicPatientProfile(id: string, token: string, dto: UpdatePublicPatientProfileDto) {
  const { data } = await http.patch(`/public/booking/appointments/${id}/patient-profile?token=${token}`, dto);
  return data;
}
