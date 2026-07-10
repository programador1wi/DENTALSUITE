import { http } from "@/lib/api/http-client";

export type TreatmentPlanStatus =
  | "DRAFT"
  | "PRESENTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";
export type TreatmentPlanItemStatus =
  | "PLANNED"
  | "ACCEPTED"
  | "PAID"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type BudgetStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type TreatmentPriceSource = "PRICE_LIST" | "MANUAL" | "UNPRICED";
export type TreatmentPlanKind = "GENERAL" | "ORTHODONTICS";

export type OrthodonticTreatmentProfile = {
  id: string;
  treatmentPlanId: string;
  startDate?: string | null;
  estimatedMonths?: number | null;
  estimatedControls?: number | null;
  lastUpperArch?: string | null;
  lastLowerArch?: string | null;
  nextControlAt?: string | null;
  nextRadiographyAt?: string | null;
  hygieneStatus?: string | null;
  alert?: string | null;
  indications?: string | null;
  elastics?: string | null;
  diagnosis?: Record<string, unknown> | null;
  planNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TreatmentPlan = {
  id: string;
  name: string;
  description?: string | null;
  status: TreatmentPlanStatus;
  kind: TreatmentPlanKind;
  specialtyId?: string | null;
  specialty?: { id: string; name: string } | null;
  specialtySnapshotName?: string | null;
  isAlternative: boolean;
  acceptedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  patient: { id: string; firstName: string; lastName: string };
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    specialties?: Array<{ specialty: { id: string; name: string } }>;
  };
  branch: { id: string; name: string };
  orthodonticProfile?: OrthodonticTreatmentProfile | null;
  orthodonticSummary?: {
    calendarProgress: number;
    realProgress: number;
    realControlsCount: number;
    estimatedControls: number;
    isPaused: boolean;
    pauseStartDate: string | null;
    latestEvolution?: {
      id: string;
      createdAt: string;
      notes?: string | null;
      objective?: string | null;
      assessment?: string | null;
      plan?: string | null;
    } | null;
  } | null;
  itemsCount?: number;
  budgetCount?: number;
};

export type TreatmentPlanSection = {
  id: string;
  treatmentPlanId: string;
  name: string;
  sortOrder: number;
};

export type TreatmentPlanItem = {
  id: string;
  treatmentPlanId: string;
  sectionId?: string | null;
  procedureId: string;
  procedure?: { id: string; code: string; name: string };
  section?: TreatmentPlanSection | null;
  toothNumber?: string | null;
  surface?: string | null;
  odontogramSymbol?: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  total: string;
  status: TreatmentPlanItemStatus;
  priceListId?: string | null;
  priceListItemId?: string | null;
  priceSource?: TreatmentPriceSource;
  priceSnapshotName?: string | null;
  priceSnapshotCode?: string | null;
  priceSnapshotCategory?: string | null;
  priceResolvedAt?: string | null;
  plannedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  paymentAllocations?: Array<{ id: string; amount: string }>;
};

export type Budget = {
  id: string;
  treatmentPlanId: string;
  patient: { id: string; firstName: string; lastName: string };
  professional: { id: string; firstName: string; lastName: string };
  subtotal: string;
  discountTotal: string;
  total: string;
  status: BudgetStatus;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  expiresAt?: string | null;
  items?: Array<{
    id: string;
    treatmentPlanItemId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    total: string;
  }>;
};

export type TreatmentPlanDetail = TreatmentPlan & {
  sections: TreatmentPlanSection[];
  items: TreatmentPlanItem[];
  budgets: Budget[];
  clinicalEvolutions?: Array<{
    id: string;
    createdAt: string;
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
    notes?: string | null;
  }>;
};

export type ChangeTreatmentPlanBranchResult = TreatmentPlanDetail & {
  futureAppointmentsCount: number;
  movedFutureAppointmentsCount: number;
};

export type CreateTreatmentPlanPayload = {
  branchId: string;
  patientId: string;
  professionalId: string;
  name: string;
  description?: string;
  status?: TreatmentPlanStatus;
  kind?: TreatmentPlanKind;
  isAlternative?: boolean;
  parentTreatmentPlanId?: string;
  items?: Array<{
    sectionId?: string;
    procedureId: string;
    toothNumber?: string;
    surface?: string;
    odontogramSymbol?: string;
    quantity: number;
    unitPrice?: number;
    discount?: number;
    notes?: string;
  }>;
};

export type OrthodonticProfilePayload = Partial<{
  startDate: string | null;
  estimatedMonths: number | null;
  estimatedControls: number | null;
  lastUpperArch: string | null;
  lastLowerArch: string | null;
  nextControlAt: string | null;
  nextRadiographyAt: string | null;
  hygieneStatus: string | null;
  alert: string | null;
  indications: string | null;
  elastics: string | null;
  planNotes: string | null;
}>;

export type TreatmentPlanItemPayload = {
  sectionId?: string;
  procedureId?: string;
  toothNumber?: string;
  surface?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  notes?: string;
  plannedAt?: string | null;
  syncOdontogram?: boolean;
  odontogramSymbol?: string;
};

export async function listTreatmentPlans(params?: {
  patientId?: string;
  branchId?: string;
  professionalId?: string;
  status?: TreatmentPlanStatus;
  kind?: TreatmentPlanKind;
}) {
  const { data } = await http.get<TreatmentPlan[]>("/treatment-plans", { params });
  return data;
}

export async function getTreatmentPlan(id: string) {
  const { data } = await http.get<TreatmentPlanDetail>(`/treatment-plans/${id}`);
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
  payload: { status: TreatmentPlanItemStatus; notes?: string }
) {
  const { data } = await http.patch(`/treatment-plans/${treatmentPlanId}/items/${itemId}/status`, payload);
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
