import { http } from "@/lib/api/http-client";

import type { Budget, BudgetStatus, ChangeTreatmentPlanBranchResult, CreateTreatmentPlanPayload, OrthodonticCatalogField, OrthodonticDiagnosisCatalogSection, OrthodonticDiagnosisResult, OrthodonticEvolutionsResult, OrthodonticProfilePayload, OrthodonticSummary, SaveOrthodonticDiagnosisPayload, StartOrthodonticTreatmentPayload, TreatmentPlan, TreatmentPlanDetail, TreatmentPlanItemPayload, TreatmentPlanItemStatus, TreatmentPlanKind, TreatmentPlanPrintDocument, TreatmentPlanPrintDocumentType, TreatmentPlanPrintOption, TreatmentPlanProceduresResult, TreatmentPlanRepricePreview, TreatmentPlanStatus, TreatmentPriceCatalog } from "./treatments.types";
export * from "./treatments.types";

type TreatmentPlanListEnvelope = {
  items?: TreatmentPlan[];
  data?: TreatmentPlan[];
  rows?: TreatmentPlan[];
  results?: TreatmentPlan[];
};

type TreatmentPlanListResponse = TreatmentPlan[] | TreatmentPlanListEnvelope;

function normalizeTreatmentPlanList(response: TreatmentPlanListResponse): TreatmentPlan[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.rows)) return response.rows;
  if (Array.isArray(response.results)) return response.results;
  return [];
}
export async function listTreatmentPlans(params?: {
  patientId?: string;
  branchId?: string;
  professionalId?: string;
  status?: TreatmentPlanStatus;
  kind?: TreatmentPlanKind;
}) {
  const { data } = await http.get<TreatmentPlanListResponse>("/treatment-plans", { params });
  return normalizeTreatmentPlanList(data);
}

export async function getTreatmentPlan(id: string) {
  const { data } = await http.get<TreatmentPlanDetail>(`/treatment-plans/${id}`);
  return data;
}

export async function getTreatmentPlanProcedures(id: string) {
  const { data } = await http.get<TreatmentPlanProceduresResult>(`/treatment-plans/${id}/procedures`);
  return data;
}

export async function getTreatmentPlanPriceCatalog(id: string, clinicalDate?: string) {
  const { data } = await http.get<TreatmentPriceCatalog>(`/treatment-plans/${id}/price-catalog`, {
    params: clinicalDate ? { clinicalDate } : undefined
  });
  return data;
}

export async function previewTreatmentPlanReprice(
  id: string,
  payload: { itemIds?: string[]; clinicalDate?: string }
) {
  const { data } = await http.post<TreatmentPlanRepricePreview>(
    `/treatment-plans/${id}/reprice-preview`,
    payload
  );
  return data;
}

export async function applyTreatmentPlanReprice(
  id: string,
  payload: { itemIds?: string[]; clinicalDate?: string; reason: string }
) {
  const { data } = await http.post<TreatmentPlanDetail>(`/treatment-plans/${id}/reprice-apply`, payload);
  return data;
}

export async function createTreatmentPlan(payload: CreateTreatmentPlanPayload) {
  const { data } = await http.post("/treatment-plans", payload);
  return data;
}

export async function updateTreatmentPlan(
  id: string,
  payload: Partial<CreateTreatmentPlanPayload> & { status?: TreatmentPlanStatus }
) {
  const { data } = await http.patch(`/treatment-plans/${id}`, payload);
  return data;
}

export async function updateOrthodonticProfile(id: string, payload: OrthodonticProfilePayload) {
  const { data } = await http.patch<TreatmentPlanDetail>(
    `/treatment-plans/${id}/orthodontics/profile`,
    payload
  );
  return data;
}

export async function listOrthodonticOptionFields() {
  const { data } = await http.get<OrthodonticCatalogField[]>("/orthodontic-option-fields");
  return data;
}

export async function createOrthodonticFieldOption(fieldId: string, payload: { label: string }) {
  const { data } = await http.post<OrthodonticCatalogField[]>(
    `/orthodontic-option-fields/${fieldId}/options`,
    payload
  );
  return data;
}

export async function updateOrthodonticFieldOption(
  optionId: string,
  payload: { label?: string; sortOrder?: number; deactivationReason?: string }
) {
  const { data } = await http.patch<OrthodonticCatalogField[]>(
    `/orthodontic-field-options/${optionId}`,
    payload
  );
  return data;
}

export async function deactivateOrthodonticFieldOption(
  optionId: string,
  payload?: { deactivationReason?: string }
) {
  const { data } = await http.post<OrthodonticCatalogField[]>(
    `/orthodontic-field-options/${optionId}/deactivate`,
    payload ?? {}
  );
  return data;
}

export async function reactivateOrthodonticFieldOption(optionId: string) {
  const { data } = await http.post<OrthodonticCatalogField[]>(
    `/orthodontic-field-options/${optionId}/reactivate`
  );
  return data;
}

export async function sortOrthodonticFieldOptions(fieldId: string, optionIds: string[]) {
  const { data } = await http.put<OrthodonticCatalogField[]>(`/orthodontic-option-fields/${fieldId}/sort`, {
    optionIds
  });
  return data;
}

export async function listOrthodonticDiagnosisCatalog() {
  const { data } = await http.get<OrthodonticDiagnosisCatalogSection[]>("/orthodontic-diagnosis-catalog");
  return data;
}

export async function getOrthodonticDiagnosisStatus(id: string) {
  const { data } = await http.get<OrthodonticDiagnosisResult>(
    `/treatment-plans/${id}/orthodontics/diagnosis/status`
  );
  return data;
}

export async function getOrthodonticDiagnosis(id: string) {
  const { data } = await http.get<OrthodonticDiagnosisResult>(
    `/treatment-plans/${id}/orthodontics/diagnosis`
  );
  return data;
}

export async function saveOrthodonticDiagnosisDraft(id: string, payload: SaveOrthodonticDiagnosisPayload) {
  const { data } = await http.post<OrthodonticDiagnosisResult>(
    `/treatment-plans/${id}/orthodontics/diagnosis/draft`,
    payload
  );
  return data;
}

export async function saveOrthodonticDiagnosisActive(id: string, payload: SaveOrthodonticDiagnosisPayload) {
  const { data } = await http.post<OrthodonticDiagnosisResult>(
    `/treatment-plans/${id}/orthodontics/diagnosis`,
    payload
  );
  return data;
}

export async function createOrthodonticDiagnosisFieldOption(fieldId: string, payload: { label: string }) {
  const { data } = await http.post<OrthodonticDiagnosisCatalogSection[]>(
    `/orthodontic-diagnosis-fields/${fieldId}/options`,
    payload
  );
  return data;
}

export async function updateOrthodonticDiagnosisFieldOption(
  optionId: string,
  payload: { label?: string; sortOrder?: number; deactivationReason?: string }
) {
  const { data } = await http.patch<OrthodonticDiagnosisCatalogSection[]>(
    `/orthodontic-diagnosis-field-options/${optionId}`,
    payload
  );
  return data;
}

export async function deactivateOrthodonticDiagnosisFieldOption(
  optionId: string,
  payload?: { deactivationReason?: string }
) {
  const { data } = await http.post<OrthodonticDiagnosisCatalogSection[]>(
    `/orthodontic-diagnosis-field-options/${optionId}/deactivate`,
    payload ?? {}
  );
  return data;
}

export async function reactivateOrthodonticDiagnosisFieldOption(optionId: string) {
  const { data } = await http.post<OrthodonticDiagnosisCatalogSection[]>(
    `/orthodontic-diagnosis-field-options/${optionId}/reactivate`
  );
  return data;
}

export async function sortOrthodonticDiagnosisFieldOptions(fieldId: string, optionIds: string[]) {
  const { data } = await http.put<OrthodonticDiagnosisCatalogSection[]>(
    `/orthodontic-diagnosis-fields/${fieldId}/sort`,
    { optionIds }
  );
  return data;
}

export async function updateOrthodonticDiagnosis(
  id: string,
  payload: { diagnosis: Record<string, unknown> }
) {
  const { data } = await http.patch<TreatmentPlanDetail>(
    `/treatment-plans/${id}/orthodontics/diagnosis`,
    payload
  );
  return data;
}

export async function getOrthodonticSummary(id: string) {
  const { data } = await http.get<OrthodonticSummary>(`/treatment-plans/${id}/orthodontics/summary`);
  return data;
}

export async function listOrthodonticEvolutions(
  id: string,
  params?: {
    page?: number;
    pageSize?: number;
    dateFrom?: string;
    dateTo?: string;
    professionalId?: string;
    hasHygiene?: boolean;
    search?: string;
  }
) {
  const { data } = await http.get<OrthodonticEvolutionsResult>(
    `/treatment-plans/${id}/orthodontics/evolutions`,
    { params }
  );
  return data;
}
export async function startOrthodonticTreatment(id: string, payload: StartOrthodonticTreatmentPayload) {
  const { data } = await http.post<OrthodonticSummary>(`/treatment-plans/${id}/orthodontics/start`, payload);
  return data;
}

export async function createOrthodonticMonthlyItems(
  id: string,
  payload: {
    procedureId: string;
    months: number;
    unitPrice?: number;
    startDate?: string;
    sectionName?: string;
    notes?: string;
  }
) {
  const { data } = await http.post<TreatmentPlanDetail>(
    `/treatment-plans/${id}/orthodontics/monthly-items`,
    payload
  );
  return data;
}

export async function changeTreatmentPlanBranch(
  id: string,
  payload: { branchId: string; professionalId: string; moveFutureAppointments?: boolean }
) {
  const { data } = await http.post<ChangeTreatmentPlanBranchResult>(
    `/treatment-plans/${id}/change-branch`,
    payload
  );
  return data;
}

export async function addTreatmentPlanSection(
  treatmentPlanId: string,
  payload: { name: string; sortOrder?: number }
) {
  const { data } = await http.post<TreatmentPlanDetail>(
    `/treatment-plans/${treatmentPlanId}/sections`,
    payload
  );
  return data;
}

export async function addTreatmentPlanItem(treatmentPlanId: string, payload: TreatmentPlanItemPayload) {
  const { data } = await http.post<TreatmentPlanDetail>(`/treatment-plans/${treatmentPlanId}/items`, payload);
  return data;
}

export async function updateTreatmentPlanItem(
  treatmentPlanId: string,
  itemId: string,
  payload: TreatmentPlanItemPayload
) {
  const { data } = await http.patch<TreatmentPlanDetail>(
    `/treatment-plans/${treatmentPlanId}/items/${itemId}`,
    payload
  );
  return data;
}

export async function deleteTreatmentPlanItem(treatmentPlanId: string, itemId: string) {
  const { data } = await http.delete<{ success: boolean }>(
    `/treatment-plans/${treatmentPlanId}/items/${itemId}`
  );
  return data;
}

export async function createAlternative(parentId: string, payload: CreateTreatmentPlanPayload) {
  const { data } = await http.post(`/treatment-plans/${parentId}/alternatives`, payload);
  return data;
}

export async function activateAlternative(parentId: string, alternativeId: string) {
  const { data } = await http.post(`/treatment-plans/${parentId}/alternatives/${alternativeId}/activate`, {});
  return data;
}

export async function updateTreatmentPlanItemStatus(
  treatmentPlanId: string,
  itemId: string,
  payload: {
    status: TreatmentPlanItemStatus;
    notes?: string;
    completionPercentage?: number;
    expectedVersion?: number;
  }
) {
  const { data } = await http.patch(`/treatment-plans/${treatmentPlanId}/items/${itemId}/status`, payload);
  return data;
}

export async function applyBulkDiscountToTreatmentPlanItems(
  treatmentPlanId: string,
  payload: {
    itemIds: string[];
    discountType: "PERCENTAGE" | "AMOUNT";
    value: number;
    discountReason?: string;
  }
) {
  const { data } = await http.patch<TreatmentPlanProceduresResult>(
    `/treatment-plans/${treatmentPlanId}/items/bulk-discount`,
    payload
  );
  return data;
}

export async function listBudgets(params?: {
  patientId?: string;
  treatmentPlanId?: string;
  status?: BudgetStatus;
}) {
  const { data } = await http.get<Budget[]>("/budgets", { params });
  return data;
}

export async function getBudget(id: string) {
  const { data } = await http.get(`/budgets/${id}`);
  return data;
}

export async function createBudget(
  treatmentPlanId: string,
  payload: { discountTotal?: number; expiresAt?: string; notes?: string }
) {
  const { data } = await http.post(`/treatment-plans/${treatmentPlanId}/budgets`, payload);
  return data;
}

export async function sendBudget(id: string) {
  const { data } = await http.post(`/budgets/${id}/send`, {});
  return data;
}

export async function acceptBudget(id: string) {
  const { data } = await http.post(`/budgets/${id}/accept`, {});
  return data;
}

export async function rejectBudget(id: string) {
  const { data } = await http.post(`/budgets/${id}/reject`, {});
  return data;
}

export async function printBudget(id: string) {
  const { data } = await http.post(`/budgets/${id}/print`);
  return data;
}

export async function printTreatmentPlanDocument(
  treatmentPlanId: string,
  payload: { type: TreatmentPlanPrintDocumentType; budgetId?: string }
) {
  const { data } = await http.post<TreatmentPlanPrintDocument>(
    `/treatment-plans/${treatmentPlanId}/print`,
    payload
  );
  return data;
}

export async function getTreatmentPlanPrintOptions(treatmentPlanId: string) {
  const { data } = await http.get<TreatmentPlanPrintOption[]>(
    `/treatment-plans/${treatmentPlanId}/print-options`
  );
  return data;
}

export async function previewTreatmentPlanDocument(
  treatmentPlanId: string,
  payload: { type: TreatmentPlanPrintDocumentType; budgetId?: string }
) {
  const { data } = await http.post<TreatmentPlanPrintDocument>(
    `/treatment-plans/${treatmentPlanId}/documents/preview`,
    payload
  );
  return data;
}

export async function generateTreatmentPlanDocument(
  treatmentPlanId: string,
  payload: { type: TreatmentPlanPrintDocumentType; budgetId?: string }
) {
  const { data } = await http.post<TreatmentPlanPrintDocument>(
    `/treatment-plans/${treatmentPlanId}/documents`,
    payload
  );
  return data;
}

export async function reactivateTreatmentPlan(id: string, payload: { reason?: string }) {
  const { data } = await http.post(`/treatment-plans/${id}/reactivate`, payload);
  return data;
}

export async function deactivateTreatmentPlan(id: string, payload: { reason?: string }) {
  const { data } = await http.post(`/treatment-plans/${id}/deactivate`, payload);
  return data;
}

export async function duplicateTreatmentPlan(
  id: string,
  payload: { newBranchId?: string; newProfessionalId?: string; reason?: string }
) {
  const { data } = await http.post(`/treatment-plans/${id}/duplicate`, payload);
  return data;
}

export async function referTreatmentPlan(
  id: string,
  payload: { toBranchId: string; toProfessionalId?: string; reason: string }
) {
  const { data } = await http.post(`/treatment-plans/${id}/refer`, payload);
  return data;
}

export async function pauseTreatmentPlan(id: string, payload: { reason?: string }) {
  const { data } = await http.post(`/treatment-plans/${id}/pause`, payload);
  return data;
}

export async function resumeTreatmentPlan(id: string) {
  const { data } = await http.post(`/treatment-plans/${id}/resume`);
  return data;
}
