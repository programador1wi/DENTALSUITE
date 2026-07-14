import { http } from "@/lib/api/http-client";
import type { Branch, BranchPayload } from "@/features/settings/branches/services/branches.service";

export type BrandStatus = "ACTIVE" | "ARCHIVED";

export type HealthCenterBrand = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  slug: string;
  legalName?: string | null;
  shortName?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  logoStorageKey?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string | null;
  domain?: string | null;
  publicDomain?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  replyToEmail?: string | null;
  phone?: string | null;
  website?: string | null;
  privacyNoticeUrl?: string | null;
  isDefault: boolean;
  status: BrandStatus;
  isActive: boolean;
  archivedAt?: string | null;
  branchCount: number;
  branches: Branch[];
  createdAt: string;
  updatedAt: string;
};

export type BrandPayload = Partial<{
  name: string;
  legalName: string;
  shortName: string;
  slug: string;
  description: string;
  logoUrl: string;
  logoStorageKey: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string;
  publicDomain: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  phone: string;
  website: string;
  privacyNoticeUrl: string;
  isDefault: boolean;
  status: BrandStatus;
}>;

export type HealthCenterOverview = {
  organization: {
    id: string;
    name: string;
    legalName?: string | null;
    logoUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  brands: HealthCenterBrand[];
  permissions: {
    canManage: boolean;
    canCreateBrand: boolean;
    canCreateBranch: boolean;
    canAssignBrand: boolean;
    canViewAllBranches: boolean;
  };
};

export async function getHealthCenter(params?: { search?: string; status?: string }) {
  const { data } = await http.get<HealthCenterOverview>("/health-center", { params });
  return data;
}

export async function listBrands(params?: { search?: string; status?: string }) {
  const { data } = await http.get<HealthCenterBrand[]>("/brands", { params });
  return data;
}

export async function createBrand(payload: BrandPayload) {
  const { data } = await http.post<HealthCenterBrand>("/brands", payload);
  return data;
}

export async function updateBrand(id: string, payload: BrandPayload) {
  const { data } = await http.patch<HealthCenterBrand>(`/brands/${id}`, payload);
  return data;
}

export async function archiveBrand(id: string) {
  const { data } = await http.post<HealthCenterBrand>(`/brands/${id}/archive`);
  return data;
}

export async function restoreBrand(id: string) {
  const { data } = await http.post<HealthCenterBrand>(`/brands/${id}/restore`);
  return data;
}

export async function createBranchForBrand(brandId: string, payload: BranchPayload) {
  const { data } = await http.post<Branch>(`/brands/${brandId}/branches`, payload);
  return data;
}
