import { http } from "@/lib/api/http-client";

export type OrganizationSettings = {
  organizationId: string;
  organizationName: string;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  organizationSlug?: string | null;
  status: string;
  updatedAt: string;
};

export async function getOrganizationSettings() {
  const { data } = await http.get<OrganizationSettings>("/settings/organization");
  return data;
}

export async function updateOrganizationSettings(payload: {
  organizationName?: string;
  legalName?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
}) {
  const { data } = await http.patch<OrganizationSettings>("/settings/organization", payload);
  return data;
}
