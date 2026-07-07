import { http } from "@/lib/api/http-client";

export type PriceListScopeType = "BASE" | "POLIZA" | "ADICIONAL";
export type ProcedureType = "CLINICAL" | "LAB" | "MIXED";

export type PriceListBrand = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type PriceListZone = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type PriceListBranch = {
  id: string;
  code: string;
  name: string;
  brandId?: string | null;
  brand?: PriceListBrand | null;
  zoneId?: string | null;
  zone?: PriceListZone | null;
  priceLists: PriceListBranchAssignment[];
};

export type PriceListBranchAssignment = {
  id: string;
  branchId: string;
  priceListId: string;
  type: PriceListScopeType;
  isDefault: boolean;
  isActive: boolean;
  branch?: PriceListBranch | null;
};

export type PriceListItem = {
  id: string;
  procedureId: string;
  priceListCategoryId?: string | null;
  priceListCategory?: { id: string; name: string; type?: ProcedureType } | null;
  price: string;
  labCost: string;
  allowsDiscount: boolean;
  currency: "MXN" | "USD" | "EUR";
  procedure: {
    id: string;
    categoryId: string;
    displayId: number;
    code: string;
    name: string;
    description?: string | null;
    type: ProcedureType;
    defaultDuration: number;
    requiresTooth: boolean;
    requiresSurface: boolean;
    requiresLab: boolean;
    requiresOdontogramSymbol: boolean;
    defaultOdontogramSymbol?: string | null;
    isActive: boolean;
  };
};

export type PriceListCategory = {
  id: string;
  priceListId: string;
  procedureCategoryId?: string | null;
  procedureCategory?: { id: string; name: string; type: ProcedureType } | null;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  items: PriceListItem[];
};

export type PriceList = {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  branchAssignments: PriceListBranchAssignment[];
  categories: PriceListCategory[];
  items: PriceListItem[];
};

export type PriceListPayload = {
  name: string;
  description?: string;
  isDefault?: boolean;
  items?: {
    procedureId: string;
    priceListCategoryId?: string;
    price: string;
    labCost?: string;
    allowsDiscount?: boolean;
    currency?: "MXN" | "USD" | "EUR";
  }[];
};

export type PriceListCategoryPayload = {
  name?: string;
  description?: string;
  type?: ProcedureType;
  sortOrder?: number;
  isActive?: boolean;
};

export type PriceListAvailabilityMatrix = {
  brands: PriceListBrand[];
  zones: PriceListZone[];
  branches: PriceListBranch[];
  priceLists: PriceList[];
};

export type BranchPriceListAssignmentPayload = {
  branchId: string;
  enabled: boolean;
  type?: PriceListScopeType;
  isDefault?: boolean;
};

export async function listPriceLists(params?: { search?: string; active?: string; branchId?: string }) {
  const { data } = await http.get<PriceList[]>("/price-lists", { params });
  return data;
}

export async function getPriceList(id: string) {
  const { data } = await http.get<PriceList>(`/price-lists/${id}`);
  return data;
}

export async function getPriceListAvailabilityMatrix() {
  const { data } = await http.get<PriceListAvailabilityMatrix>("/price-lists/availability-matrix");
  return data;
}

export async function createPriceList(payload: PriceListPayload) {
  const { data } = await http.post<PriceList>("/price-lists", payload);
  return data;
}

export async function updatePriceList(
  id: string,
  payload: Partial<PriceListPayload> & { isActive?: boolean }
) {
  const { data } = await http.patch<PriceList>(`/price-lists/${id}`, payload);
  return data;
}

export async function updatePriceListBranchAssignments(
  id: string,
  assignments: BranchPriceListAssignmentPayload[]
) {
  const { data } = await http.patch<PriceList>(`/price-lists/${id}/branches`, { assignments });
  return data;
}

export async function deactivatePriceList(id: string) {
  const { data } = await http.patch<PriceList>(`/price-lists/${id}/deactivate`);
  return data;
}

export async function createPriceListCategory(priceListId: string, payload: PriceListCategoryPayload) {
  const { data } = await http.post<PriceListCategory>(`/price-lists/${priceListId}/categories`, payload);
  return data;
}

export async function updatePriceListCategory(
  priceListId: string,
  categoryId: string,
  payload: PriceListCategoryPayload
) {
  const { data } = await http.patch<PriceListCategory>(
    `/price-lists/${priceListId}/categories/${categoryId}`,
    payload
  );
  return data;
}

export async function deactivatePriceListCategory(priceListId: string, categoryId: string) {
  const { data } = await http.patch<PriceListCategory>(
    `/price-lists/${priceListId}/categories/${categoryId}/deactivate`
  );
  return data;
}
