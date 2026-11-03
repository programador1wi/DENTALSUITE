import { http } from "@/lib/api/http-client";

export type PriceListStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "SUPERSEDED" | "INACTIVE" | "ARCHIVED";
export type Currency = "MXN" | "USD" | "EUR";
export type VersionedScope = { id: string; scopeType: "ORGANIZATION" | "BRANCH" | "SEGMENT" | "AGREEMENT" | "CHANNEL" | "SPECIALTY"; scopeKey: string; priority: number };

export type PriceListVersionItemV2 = {
  id: string;
  procedureId: string;
  procedureVariantId?: string | null;
  basePrice: string;
  laboratoryCost: string;
  internalCost: string;
  allowDiscount: boolean;
  maxDiscountPercent: string;
  status: "ACTIVE" | "INACTIVE";
  version: number;
  procedure: {
    id: string;
    displayId: number;
    code: string;
    name: string;
    requiresLab: boolean;
    category: { id: string; name: string };
  };
};

export type PriceListVersionItemPayload = {
  procedureId: string;
  basePrice: string;
  laboratoryCost: string;
  internalCost: string;
  allowDiscount: boolean;
  maxDiscountPercent: string;
  expectedVersion?: number;
};

export type PriceListVersionV2 = {
  id: string;
  versionNumber: number;
  version: number;
  status: PriceListStatus;
  validFrom?: string | null;
  validTo?: string | null;
  currency: Currency;
  publishedAt?: string | null;
  publishedById?: string | null;
  publishedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  changeSummary?: string | null;
  previousVersionId?: string | null;
  checksum?: string | null;
  createdAt?: string;
  isLatest?: boolean;
  isActive?: boolean;
  scopes: VersionedScope[];
  _count: { items: number; treatmentItems: number };
};

export type PriceListAuditEvent = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  reason?: string | null;
  correlationId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  createdAt: string;
  actor?: { id: string; firstName: string; lastName: string; email: string } | null;
};

export type PriceListHistory = {
  priceList: { id: string; code: string; name: string };
  latestVersion: PriceListVersionV2 | null;
  activeVersion: PriceListVersionV2 | null;
  publicationPreview: { newItemsCount: number };
  versions: PriceListVersionV2[];
  events: PriceListAuditEvent[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type VersionedPriceList = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  currency: Currency;
  status: PriceListStatus;
  priority: number;
  version: number;
  currentVersion: number;
  validFrom?: string | null;
  validTo?: string | null;
  versionsV2: PriceListVersionV2[];
};

export type CreateVersionedPriceListPayload = {
  code: string;
  name: string;
  description?: string;
  currency: Currency;
  validFrom?: string;
  validTo?: string;
  priority?: number;
  basePriceListId?: string;
  scopes: Array<{ scopeType: "ORGANIZATION" | "BRANCH"; scopeKey: string; priority?: number }>;
};

export async function listVersionedPriceLists(search = "", includeInactive = false) {
  const { data } = await http.get<VersionedPriceList[]>("/admin/price-lists", { params: { search, includeInactive } });
  return data;
}

export async function createVersionedPriceList(payload: CreateVersionedPriceListPayload) {
  const { data } = await http.post<VersionedPriceList>("/admin/price-lists", payload);
  return data;
}

export async function listVersionItems(versionId: string) {
  const { data } = await http.get<PriceListVersionItemV2[]>(`/admin/price-list-versions/${versionId}/items`);
  return data;
}

export async function getPriceListHistory(
  priceListId: string,
  page = 1,
  pageSize = 50,
  action?: string
) {
  const { data } = await http.get<PriceListHistory>(`/admin/price-lists/${priceListId}/history`, {
    params: { page, pageSize, action: action || undefined }
  });
  return data;
}

export async function createDraftVersion(list: VersionedPriceList) {
  const { data } = await http.post<PriceListVersionV2>(`/admin/price-lists/${list.id}/versions`, {
    expectedVersion: list.version,
    copyFromVersionId: list.versionsV2[0]?.id,
    changeSummary: `Borrador desde version ${list.versionsV2[0]?.versionNumber ?? 0}`
  });
  return data;
}

export async function saveVersionItem(versionId: string, payload: PriceListVersionItemPayload) {
  const { data } = await http.post<PriceListVersionItemV2>(`/admin/price-list-versions/${versionId}/items`, payload);
  return data;
}

export async function updateVersionItem(itemId: string, payload: PriceListVersionItemPayload) {
  const { data } = await http.patch<PriceListVersionItemV2>(`/admin/price-list-items/${itemId}`, payload);
  return data;
}

export async function deactivateVersionItem(itemId: string, expectedVersion: number) {
  const { data } = await http.post<PriceListVersionItemV2>(`/admin/price-list-items/${itemId}/deactivate`, { expectedVersion });
  return data;
}

export async function validateVersion(versionId: string) {
  const { data } = await http.post<{ valid: boolean; errors: Array<{ code: string; message: string }>; warnings: Array<{ code: string; message: string }> }>(`/admin/price-list-versions/${versionId}/validate`);
  return data;
}

export async function publishVersion(version: PriceListVersionV2, changeSummary: string) {
  const { data } = await http.post<PriceListVersionV2>(`/admin/price-list-versions/${version.id}/publish`, {
    expectedVersion: version.version,
    changeSummary
  });
  return data;
}

export type PriceTemplateV2 = {
  id: string;
  name: string;
  description?: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  version: number;
  sections: Array<{ id: string; name: string; items: Array<{ id: string; procedureId: string; procedure: { code: string; name: string } }> }>;
};

export async function listPriceTemplates() {
  const { data } = await http.get<PriceTemplateV2[]>("/admin/price-templates");
  return data;
}

export async function createPriceTemplateFromItems(payload: {
  name: string;
  description?: string;
  branchIds: string[];
  sections: Array<{ name: string; items: Array<{ procedureId: string; quantity: string }> }>;
}) {
  const { data } = await http.post<PriceTemplateV2>("/admin/price-templates", payload);
  return data;
}

export type PriceImportV2 = {
  id: string;
  status: "UPLOADED" | "VALIDATING" | "WITH_ERRORS" | "READY" | "APPLYING" | "APPLIED" | "PARTIALLY_APPLIED" | "REVERTED" | "FAILED";
  summary?: { total?: number; errors?: number; applied?: number };
  errors: Array<{ id: string; code: string; message: string; field?: string | null }>;
};

export async function createPriceImport(payload: {
  priceListId: string;
  priceListVersionId: string;
  fileName: string;
  idempotencyKey: string;
  rows: Array<{ code: string; name?: string; price: string; currency: Currency; laboratoryCost?: string; internalCost?: string; allowDiscount?: boolean; maxDiscountPercent?: string }>;
}) {
  const { data } = await http.post<PriceImportV2>("/admin/price-imports", payload);
  return data;
}

export async function applyPriceImport(id: string) {
  const { data } = await http.post<PriceImportV2>(`/admin/price-imports/${id}/apply`);
  return data;
}

export async function copyPriceItems(payload: {
  targetListId: string;
  sourceVersionId: string;
  targetVersionId: string;
  updatePrices: boolean;
  copyDiscounts: boolean;
  copyCosts: boolean;
}) {
  const idempotencyKey = crypto.randomUUID();
  const { data } = await http.post(
    `/admin/price-lists/${payload.targetListId}/copy-apply`,
    payload,
    { headers: { "idempotency-key": idempotencyKey } }
  );
  return data as { created: number; updated: number; skipped: number };
}
