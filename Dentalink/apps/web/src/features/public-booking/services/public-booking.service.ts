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
};

export type AvailabilitySlot = {
  startAt: string;
  endAt: string;
  available: boolean;
};

export async function getPublicConfig(slug: string) {
  const { data } = await http.get(`/online-scheduling/preview/${slug}`);
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
