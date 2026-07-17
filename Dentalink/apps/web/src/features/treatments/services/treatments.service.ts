import { http } from "@/lib/api/http-client";

export type TreatmentPlanStatus =
  | "DRAFT"
  | "PRESENTED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";
export type TreatmentPlanClinicalStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_TO_COMPLETE"
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
  technicalDescription?: string | null;
  startDate?: string | null;
  estimatedMonths?: number | null;
  estimatedControls?: number | null;
  totalAligners?: number | null;
  indicatedExtractions?: string | null;
  performedExtractions?: string | null;
  reevaluationDate?: string | null;
  interconsultations?: string | null;
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
  fieldValues?: Array<{
    fieldId: string;
    optionId?: string | null;
    optionLabelSnapshot?: string | null;
    field?: { id: string; code: string; name: string; allowsMultiple: boolean };
    option?: { id: string; label: string; isActive: boolean } | null;
  }>;
  optionValues?: Array<{
    fieldId: string;
    optionId?: string | null;
    optionLabelSnapshot?: string | null;
    field?: { id: string; code: string; name: string; allowsMultiple: boolean };
    option?: { id: string; label: string; isActive: boolean } | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type OrthodonticSummaryStatus = "NOT_STARTED" | "ACTIVE" | "PAUSED" | "COMPLETED";

export type OrthodonticClinicalFieldSource = {
  value: string | null;
  recordedAt: string | null;
  evolutionId: string | null;
  professionalName: string | null;
};

export type OrthodonticHygienePoint = {
  evolutionId: string | null;
  controlId?: string | null;
  value: number;
  maximumScore?: number | null;
  minimumScore?: number | null;
  recordedAt: string;
  professionalName: string | null;
  label?: string | null;
};

export type OrthodonticCalendarProgress = {
  percentage: number;
  displayPercentage?: number;
  status?: OrthodonticSummaryStatus;
  label?: string;
  startedAt?: string | null;
  estimatedEndAt?: string | null;
  activeDays?: number;
  pausedDays?: number;
  pauseStartDate?: string | null;
  elapsedMonths?: number;
  estimatedMonths?: number | null;
  monthsExceeded?: number;
};

export type OrthodonticControlsProgress = {
  percentage: number;
  displayPercentage?: number;
  completedControls: number;
  plannedControls: number;
  status:
    | "SIN_DATOS_SUFICIENTES"
    | "PLAZO_EXCEDIDO"
    | "POR_DEBAJO_DEL_RITMO"
    | "POR_ENCIMA_DEL_RITMO"
    | "EN_RITMO"
    | "NO_PLAN"
    | "NO_CONTROLS"
    | "ON_TRACK"
    | "DELAYED"
    | "AHEAD";
  label: string;
  calculationMethod?: string;
  additionalControls?: number;
  deviationPercentage?: number;
};

export type OrthodonticEvolutionSummary = {
  id: string;
  createdAt: string;
  professionalName: string | null;
  createdByName: string | null;
  notes?: string | null;
  plainText: string;
  isPrivate: boolean;
  fields: Array<{ label: string; value: string; group?: string | null; sortOrder: number }>;
  hygiene: number | null;
  materials: Array<{ id: string; name: string; quantity: string; unit: string | null }>;
};

export type OrthodonticSummary = {
  treatmentPlanId: string;
  status: OrthodonticSummaryStatus;
  startedAt: string | null;
  completedAt: string | null;
  calendarProgress: number | OrthodonticCalendarProgress;
  calendarProgressPercent?: number;
  calendarProgressLabel: string;
  elapsedActiveDays: number;
  elapsedPausedDays: number;
  elapsedMonths?: number;
  estimatedEndAt?: string | null;
  monthsExceeded?: number;
  realProgress: number | OrthodonticControlsProgress;
  realProgressPercent?: number;
  realProgressLabel: string;
  realProgressStatus:
    | "SIN_DATOS_SUFICIENTES"
    | "PLAZO_EXCEDIDO"
    | "POR_DEBAJO_DEL_RITMO"
    | "POR_ENCIMA_DEL_RITMO"
    | "EN_RITMO"
    | "NO_PLAN"
    | "NO_CONTROLS"
    | "ON_TRACK"
    | "DELAYED"
    | "AHEAD";
  realControlsCount: number;
  estimatedControls: number | null;
  estimatedMonths: number | null;
  isPaused: boolean;
  pauseStartDate: string | null;
  currentClinicalState: {
    upperArchMaterial: OrthodonticClinicalFieldSource | null;
    upperArchSize: OrthodonticClinicalFieldSource | null;
    lowerArchMaterial: OrthodonticClinicalFieldSource | null;
    lowerArchSize: OrthodonticClinicalFieldSource | null;
    upperAligner: OrthodonticClinicalFieldSource | null;
    lowerAligner: OrthodonticClinicalFieldSource | null;
    elasticsType: OrthodonticClinicalFieldSource | null;
    elasticsConfig: OrthodonticClinicalFieldSource | null;
    nextControl: OrthodonticClinicalFieldSource | null;
    alert: OrthodonticClinicalFieldSource | null;
    nextSessionInstructions: OrthodonticClinicalFieldSource | null;
    radiographicControl: OrthodonticClinicalFieldSource | null;
    intraoralPhotos: OrthodonticClinicalFieldSource | null;
    extraoralPhotos: OrthodonticClinicalFieldSource | null;
  };
  hygiene: {
    latestScore: number | null;
    maximumScore?: number | null;
    latestRecordedAt: string | null;
    average?: number | null;
    trend: "NO_DATA" | "STABLE" | "IMPROVING" | "WORSENING" | "DECLINING" | "INSUFFICIENT_DATA";
    series?: Array<Record<string, unknown>>;
    points: OrthodonticHygienePoint[];
  };
  appointment?: {
    id: string;
    startAt: string;
    endAt?: string | null;
    status: string;
    professional?: { id?: string | null; name: string | null } | null;
  } | null;
  milestones?: Array<Record<string, unknown>>;
  finances?: Record<string, unknown>;
  latestEvolution: OrthodonticEvolutionSummary | null;
  recentEvolutions: OrthodonticEvolutionSummary[];
  capabilities: {
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
    canComplete: boolean;
    canEdit: boolean;
    canCreateEvolution: boolean;
    canViewPrivate: boolean;
  };
};

export type OrthodonticEvolutionsResult = {
  items: OrthodonticEvolutionSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

export type TreatmentPlanClinicalProgress = {
  eligibleCount: number;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  percentage: number;
  displayPercentage: number;
  hasStarted: boolean;
  readyToComplete: boolean;
};

export type TreatmentPlan = {
  id: string;
  name: string;
  description?: string | null;
  status: TreatmentPlanStatus;
  clinicalStatus?: TreatmentPlanClinicalStatus;
  clinicalProgress?: TreatmentPlanClinicalProgress;
  kind: TreatmentPlanKind;
  agreementId?: string | null;
  agreementVersionNumber?: number | null;
  agreementSnapshot?: {
    agreementId?: string | null;
    agreementName?: string | null;
    agreementVersion?: number | null;
    version?: number | null;
    priceListId?: string | null;
    priceListName?: string | null;
  } | null;
  agreement?: {
    id: string;
    name: string;
    discountPercent?: string | number | null;
    payrollDiscount?: boolean;
    isActive?: boolean;
    status?: string;
    priceListId?: string | null;
    priceList?: { id: string; name: string; isDefault?: boolean | null } | null;
  } | null;
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
  originalPrice?: string;
  allowsDiscountSnapshot?: boolean;
  discountType?: "PERCENTAGE" | "AMOUNT" | string | null;
  discountValue?: string | null;
  discountAmount?: string;
  finalPrice?: string;
  discountReason?: string | null;
  discountAuthorizedBy?: string | null;
  discountedAt?: string | null;
  status: TreatmentPlanItemStatus;
  priceListId?: string | null;
  priceListItemId?: string | null;
  priceListVersionId?: string | null;
  priceListVersionNumber?: number | null;
  priceListVersionItemId?: string | null;
  priceListNameSnapshot?: string | null;
  priceCurrency?: string | null;
  priceSource?: TreatmentPriceSource;
  priceSnapshotName?: string | null;
  priceSnapshotCode?: string | null;
  priceSnapshotCategory?: string | null;
  priceResolvedAt?: string | null;
  plannedAt?: string | null;
  completedAt?: string | null;
  completionPercentage?: number;
  performedAmount?: string;
  version?: number;
  notes?: string | null;
  paymentAllocations?: Array<{ id: string; amount: string }>;
};

export type TreatmentPriceCatalogItem = {
  id: string;
  procedureId: string;
  priceListCategoryId?: string | null;
  price: string;
  basePrice: string;
  appliedPrice: string;
  labCost: string;
  internalCost: string;
  allowsDiscount: boolean;
  currency: string;
  priceList: { id: string; name: string };
  version: { id: string; number: number; itemId: string };
  procedure: {
    id: string;
    code: string;
    displayId?: string | number | null;
    name: string;
    description?: string | null;
    isActive: boolean;
    requiresTooth?: boolean;
    requiresSurface?: boolean;
    requiresLab?: boolean;
    requiresOdontogramSymbol?: boolean;
    defaultOdontogramSymbol?: string | null;
  };
  category?: { id: string; name: string } | null;
};

export type TreatmentPriceCatalog = {
  context: {
    branchId: string;
    agreementId?: string | null;
    clinicalDate: string;
    pricedAt?: string;
  };
  id: string;
  name: string;
  activeVersion: { id: string; number: number; currency: string } | null;
  categories: Array<{
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    sortOrder: number;
    items: TreatmentPriceCatalogItem[];
  }>;
  items: TreatmentPriceCatalogItem[];
};

export type TreatmentPlanRepricePreview = {
  planId: string;
  status: TreatmentPlanStatus;
  canApply: boolean;
  requiresRevision: boolean;
  items: Array<{
    itemId: string;
    procedureId: string;
    current: {
      unitPrice: string;
      discount: string;
      total: string;
      versionId?: string | null;
      versionNumber?: number | null;
      versionItemId?: string | null;
    };
    proposed: null | {
      basePrice: string;
      finalPrice: string;
      discountAmount: string;
      total: string;
      quantity: string;
      priceList: { id: string; name: string };
      version: { id: string; number: number; itemId: string };
    };
    difference: string | null;
    hasFinancialDependencies: boolean;
    error: string | null;
  }>;
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
  technicalDescription: string | null;
  startDate: string | null;
  estimatedMonths: number | null;
  estimatedControls: number | null;
  totalAligners: number | null;
  indicatedExtractions: string | null;
  performedExtractions: string | null;
  reevaluationDate: string | null;
  interconsultations: string | null;
  catalogSelections: Record<string, string[]>;
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

export type OrthodonticCatalogOption = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  version: number;
};

export type OrthodonticCatalogField = {
  id: string;
  code: string;
  name: string;
  inputType: string;
  allowsMultiple: boolean;
  isConfigurable: boolean;
  isActive: boolean;
  options: OrthodonticCatalogOption[];
};

export type OrthodonticDiagnosisStatus = "EMPTY" | "DRAFT" | "ACTIVE" | "AMENDED" | "VOIDED";

export type OrthodonticDiagnosisCatalogOption = OrthodonticCatalogOption & {
  usageCount?: number;
};

export type OrthodonticDiagnosisCatalogField = {
  id: string;
  sectionId: string;
  code: string;
  name: string;
  inputType: "text" | "textarea" | "number" | "select" | "checkbox";
  allowsMultiple: boolean;
  isRequired: boolean;
  isHighlighted: boolean;
  isFavorite: boolean;
  includeInSummary: boolean;
  unitType?: string | null;
  sortOrder: number;
  isConfigurable: boolean;
  isActive: boolean;
  options: OrthodonticDiagnosisCatalogOption[];
};

export type OrthodonticDiagnosisCatalogSection = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  fields: OrthodonticDiagnosisCatalogField[];
};

export type OrthodonticDiagnosisValuePayload = {
  fieldCode: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBoolean?: boolean | null;
  unitId?: string | null;
  optionId?: string | null;
  optionIds?: string[];
};

export type SaveOrthodonticDiagnosisPayload = {
  clinicalDate?: string | null;
  changeReason?: string | null;
  values: OrthodonticDiagnosisValuePayload[];
};

export type OrthodonticDiagnosisResult = {
  treatmentPlanId: string;
  status: OrthodonticDiagnosisStatus;
  diagnosis: {
    id: string;
    status: Exclude<OrthodonticDiagnosisStatus, "EMPTY">;
    versionNumber: number;
    previousVersionId?: string | null;
    clinicalDate?: string | null;
    activatedAt?: string | null;
    changeReason?: string | null;
    values: Array<
      OrthodonticDiagnosisValuePayload & {
        fieldId?: string;
        optionLabelSnapshot?: string | null;
        optionLabelsSnapshot?: string[];
      }
    >;
  } | null;
  summaryItems: Array<{ fieldCode: string; fieldName: string; sectionName: string; value: string }>;
  sectionsWithData: Array<{ code: string; name: string; count: number }>;
  catalog?: OrthodonticDiagnosisCatalogSection[];
};

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

export type TreatmentPlanProcedurePaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "CREDIT";
export type TreatmentPlanPrintDocumentType =
  | "BUDGET_COMPLETE"
  | "BUDGET_TOTAL_ONLY"
  | "BUDGET_NO_DETAIL"
  | "LAB_ORDER"
  | "CARE_PLAN"
  | "SECTIONS"
  | "ODONTOGRAM"
  | "CLINICAL_HISTORY";

export type TreatmentPlanPrintOption = {
  visible: boolean;
  enabled: boolean;
  disabled_reason: string | null;
  permission: string;
  document_type: TreatmentPlanPrintDocumentType;
  label: string;
  description: string;
  context?: {
    budgetId?: string | null;
    laboratoryOrderId?: string | null;
    odontogramVersionId?: string | null;
  };
};

export type TreatmentPlanPrintDocument = {
  fileName: string;
  mimeType: string;
  base64: string;
};

export type TreatmentPlanProcedureListItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceListName?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  professional: { id: string; name: string };
  dentalScope: {
    type: "GENERAL" | "WHOLE_TOOTH" | "SURFACES";
    toothNumber?: string | null;
    surfaces: string[];
  };
  discount: { type: "AMOUNT" | "PERCENTAGE" | string; value: string; amount: string };
  pricing: { basePrice: string; finalPrice: string; allowsDiscount?: boolean; currency: string };
  payment: { paidAmount: string; balance: string; status: TreatmentPlanProcedurePaymentStatus };
  progress: {
    percentage: number;
    status: TreatmentPlanItemStatus;
    lastEvolutionAt?: string | null;
    performedBy?: { id: string; name: string } | null;
  };
  future: { isFuture: boolean; scheduledAt?: string | null };
  status: TreatmentPlanItemStatus;
  capabilities: {
    canEdit: boolean;
    canEvolve: boolean;
    canUnperform: boolean;
    canCollect: boolean;
    canDelete: boolean;
  };
};

export type TreatmentPlanProceduresResult = {
  planId: string;
  summary: {
    sectionsCount: number;
    proceduresCount: number;
    clinicalProgress?: TreatmentPlanClinicalProgress;
    clinicalStatus?: TreatmentPlanClinicalStatus;
    pendingCount: number;
    inProgressCount: number;
    completedCount: number;
    paidCount: number;
    withDebtCount: number;
  };
  sections: Array<{
    id: string;
    name: string;
    description?: string | null;
    position: number;
    procedures: TreatmentPlanProcedureListItem[];
  }>;
  unsectionedProcedures: TreatmentPlanProcedureListItem[];
  capabilities: {
    canAddSection: boolean;
    canAddProcedure: boolean;
    canApplyBulkDiscount: boolean;
  };
};

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

export type StartOrthodonticTreatmentPayload = {
  startDate?: string;
  durationMonths?: number;
};

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
  payload: { itemIds: string[]; discountType: "PERCENTAGE" | "AMOUNT"; value: number }
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
