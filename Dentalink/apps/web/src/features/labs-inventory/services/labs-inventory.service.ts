import { http } from "@/lib/api/http-client";

export type LabProvider = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  details?: string | null;
  isActive: boolean;
};

export type LabProcedureAssignment = {
  id: string;
  procedureId: string;
  labProviderId: string;
  patientPrice?: string | null;
  currency: "MXN" | "USD" | "EUR";
  isActive: boolean;
  labProvider?: { id: string; name: string; isActive: boolean };
  procedure?: { id: string; code: string; name: string; requiresLab: boolean; isActive: boolean };
};

export type LabOrderStatus = "REQUESTED" | "SENT" | "IN_PROCESS" | "RECEIVED" | "DELIVERED" | "CANCELLED";
export type InventoryMovementType =
  | "IN"
  | "OUT"
  | "ADJUSTMENT"
  | "ENTRY"
  | "EXIT"
  | "TRANSFER"
  | "POSITIVE_ADJUSTMENT"
  | "NEGATIVE_ADJUSTMENT"
  | "WASTE"
  | "SUPPLIER_RETURN"
  | "RETURN_IN"
  | "INITIAL_BALANCE"
  | "PHYSICAL_COUNT_ADJUSTMENT"
  | "COMPENSATION";

export type LabOrder = {
  id: string;
  patientId: string;
  treatmentPlanId?: string | null;
  professionalId: string;
  labProviderId: string;
  status: LabOrderStatus;
  sentAt?: string | null;
  expectedAt?: string | null;
  receivedAt?: string | null;
  cost?: string | null;
  notes?: string | null;
  patient?: { id: string; firstName: string; lastName: string };
  professional?: { id: string; firstName: string; lastName: string };
  labProvider?: { id: string; name: string };
};

export type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category: string;
  categoryId?: string | null;
  unit: string;
  unitId?: string | null;
  description?: string | null;
  presentation?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  stock: string;
  minStock: string;
  salePrice?: string | null;
  isSellable: boolean;
  tracksLots: boolean;
  tracksExpiration: boolean;
  allowFractionalQuantity: boolean;
  version: number;
  branchId: string;
  supplierId?: string | null;
  isActive: boolean;
  branch?: { id: string; name: string };
  supplier?: { id: string; name: string } | null;
  stocks?: InventoryStock[];
};

export type InventoryWarehouse = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  branch?: { id: string; name: string };
};

export type InventoryStock = {
  id: string;
  inventoryItemId: string;
  warehouseId: string;
  stock: string;
  minStock: string;
  averageCost: string;
  reservedStock: string;
  version: number;
  lastMovementAt?: string | null;
  warehouse?: { id: string; name: string; branchId: string; isDefault?: boolean; branch?: { id: string; name: string } };
  inventoryItem?: InventoryItem;
};

export type InventoryMovement = {
  id: string;
  inventoryItemId: string;
  branchId: string;
  type: InventoryMovementType;
  quantity: string;
  unitCost?: string | null;
  source?: string | null;
  warehouseId?: string | null;
  sourceWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
  status?: "DRAFT" | "POSTED" | "VOIDED" | "FAILED";
  occurredAt?: string;
  correlationId?: string | null;
  stockBefore?: string | null;
  stockAfter?: string | null;
  reason?: string | null;
  createdAt: string;
  inventoryItem?: { id: string; name: string; sku: string; supplier?: { id: string; name: string } | null };
  branch?: { id: string; name: string };
  warehouse?: { id: string; name: string };
  sourceWarehouse?: { id: string; name: string };
  destinationWarehouse?: { id: string; name: string };
  createdBy?: { id: string; firstName: string; lastName: string };
};

export type LabProviderPayload = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  details?: string;
};

export type LabProcedureAssignmentPayload = {
  labProviderId: string;
  isAssigned: boolean;
  patientPrice?: string;
  currency?: "MXN" | "USD" | "EUR";
};

export type CreateLabOrderPayload = {
  patientId: string;
  treatmentPlanId?: string;
  professionalId: string;
  labProviderId: string;
  status?: LabOrderStatus;
  expectedAt?: string;
  cost?: number;
  notes?: string;
};

export type SupplierPayload = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
};

export type InventoryItemPayload = {
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  categoryId?: string;
  unit: string;
  unitId?: string;
  description?: string;
  presentation?: string;
  brand?: string;
  manufacturer?: string;
  stock: number;
  minStock: number;
  averageCost?: number;
  salePrice?: number;
  isSellable?: boolean;
  branchId: string;
  warehouseId?: string;
  supplierId?: string;
  tracksLots?: boolean;
  tracksExpiration?: boolean;
  allowFractionalQuantity?: boolean;
};

export type InventoryMovementPayload = {
  inventoryItemId: string;
  branchId: string;
  warehouseId?: string;
  type: InventoryMovementType;
  quantity: number;
  unitCost?: number;
  reason?: string;
};

export type InventoryWarehousePayload = {
  branchId: string;
  code?: string;
  name: string;
  description?: string;
  isDefault?: boolean;
};

export type PostedInventoryMovementPayload = {
  branchId: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  supplierId?: string;
  occurredAt?: string;
  documentDate?: string;
  documentType?: string;
  documentNumber?: string;
  reference?: string;
  reason: string;
  notes?: string;
  lines: Array<{
    inventoryItemId: string;
    quantity: number;
    unitCost?: number;
    lotNumber?: string;
    expirationDate?: string;
    notes?: string;
  }>;
};

export type InventoryCategory = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  version: number;
};

export type InventoryUnit = {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  decimalAllowed: boolean;
  precision: number;
  isActive: boolean;
  version: number;
};

export type InventoryProductSalePayload = {
  inventoryItemId: string;
  branchId: string;
  warehouseId?: string;
  patientId?: string;
  quantity: number;
  unitPrice: number;
  reason?: string;
};

export async function listLabProviders(params?: { search?: string; active?: string }) {
  const { data } = await http.get<LabProvider[]>("/labs/providers", { params });
  return data;
}

export async function createLabProvider(payload: LabProviderPayload) {
  const { data } = await http.post<LabProvider>("/labs/providers", payload);
  return data;
}

export async function updateLabProvider(id: string, payload: Partial<LabProviderPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<LabProvider>(`/labs/providers/${id}`, payload);
  return data;
}

export async function deactivateLabProvider(id: string) {
  const { data } = await http.patch<LabProvider>(`/labs/providers/${id}/deactivate`);
  return data;
}

export async function listLabProcedureAssignments() {
  const { data } = await http.get<LabProcedureAssignment[]>("/labs/procedure-assignments");
  return data;
}

export async function updateLabProcedureAssignments(procedureId: string, assignments: LabProcedureAssignmentPayload[]) {
  const { data } = await http.patch<LabProcedureAssignment[]>(`/labs/procedures/${procedureId}/assignments`, { assignments });
  return data;
}

export async function listLabOrders(params?: { patientId?: string; professionalId?: string; labProviderId?: string; status?: LabOrderStatus }) {
  const { data } = await http.get<LabOrder[]>("/labs/orders", { params });
  return data;
}

export async function createLabOrder(payload: CreateLabOrderPayload) {
  const { data } = await http.post<LabOrder>("/labs/orders", payload);
  return data;
}

export async function updateLabOrderStatus(id: string, status: LabOrderStatus) {
  const { data } = await http.patch<LabOrder>(`/labs/orders/${id}/status`, { status });
  return data;
}

export async function updateLabOrderCost(id: string, cost: number) {
  const { data } = await http.patch<LabOrder>(`/labs/orders/${id}/cost`, { cost });
  return data;
}

export async function listSuppliers(params?: { search?: string; active?: string }) {
  const { data } = await http.get<Supplier[]>("/suppliers", { params });
  return data;
}

export async function createSupplier(payload: SupplierPayload) {
  const { data } = await http.post<Supplier>("/suppliers", payload);
  return data;
}

export async function updateSupplier(id: string, payload: Partial<SupplierPayload> & { isActive?: boolean }) {
  const { data } = await http.patch<Supplier>(`/suppliers/${id}`, payload);
  return data;
}

export async function deactivateSupplier(id: string) {
  const { data } = await http.patch<Supplier>(`/suppliers/${id}/deactivate`);
  return data;
}

export async function listInventoryItems(params?: { search?: string; branchId?: string; warehouseId?: string; category?: string; active?: string; stock?: string }) {
  const { data } = await http.get<InventoryItem[]>("/inventory/items", { params });
  return data;
}

export async function listInventoryWarehouses(params?: { branchId?: string; active?: string }) {
  const { data } = await http.get<InventoryWarehouse[]>("/inventory/warehouses", { params });
  return data;
}

export async function createInventoryWarehouse(payload: InventoryWarehousePayload) {
  const { data } = await http.post<InventoryWarehouse>("/inventory/warehouses", payload);
  return data;
}

export async function updateInventoryWarehouse(id: string, payload: Partial<InventoryWarehousePayload> & { isActive?: boolean }) {
  const { data } = await http.patch<InventoryWarehouse>(`/inventory/warehouses/${id}`, payload);
  return data;
}

export async function createInventoryItem(payload: InventoryItemPayload) {
  const { data } = await http.post<InventoryItem>("/inventory/items", payload);
  return data;
}

export async function updateInventoryItem(
  id: string,
  payload: Partial<Omit<InventoryItemPayload, "stock" | "branchId">> & { isActive?: boolean; supplierId?: string | null }
) {
  const { data } = await http.patch<InventoryItem>(`/inventory/items/${id}`, payload);
  return data;
}

export async function deactivateInventoryItem(id: string) {
  const { data } = await http.patch<InventoryItem>(`/inventory/items/${id}/deactivate`);
  return data;
}

export async function reactivateInventoryItem(id: string) {
  const { data } = await http.post<InventoryItem>(`/inventory/items/${id}/reactivate`);
  return data;
}

export async function listInventoryCategories(params?: { search?: string; active?: string }) {
  const { data } = await http.get<InventoryCategory[]>("/inventory/categories", { params });
  return data;
}

export async function createInventoryCategory(payload: { name: string; description?: string }) {
  const { data } = await http.post<InventoryCategory>("/inventory/categories", payload);
  return data;
}

export async function updateInventoryCategory(
  id: string,
  payload: Partial<Pick<InventoryCategory, "name" | "description" | "isActive">> & { version: number }
) {
  const { data } = await http.patch<InventoryCategory>(`/inventory/categories/${id}`, payload);
  return data;
}

export async function listInventoryUnits(params?: { search?: string; active?: string }) {
  const { data } = await http.get<InventoryUnit[]>("/inventory/units", { params });
  return data;
}

export async function createInventoryUnit(payload: {
  code: string;
  name: string;
  abbreviation: string;
  decimalAllowed?: boolean;
  precision?: number;
}) {
  const { data } = await http.post<InventoryUnit>("/inventory/units", payload);
  return data;
}

export async function updateInventoryUnit(
  id: string,
  payload: Partial<Pick<InventoryUnit, "code" | "name" | "abbreviation" | "decimalAllowed" | "precision" | "isActive">> & { version: number }
) {
  const { data } = await http.patch<InventoryUnit>(`/inventory/units/${id}`, payload);
  return data;
}

export async function listInventoryMovements(params?: {
  inventoryItemId?: string;
  branchId?: string;
  warehouseId?: string;
  supplierId?: string;
  type?: InventoryMovementType;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { data } = await http.get<InventoryMovement[]>("/inventory/movements", { params });
  return data;
}

export async function createInventoryMovement(payload: InventoryMovementPayload) {
  const { data } = await http.post<InventoryMovement>("/inventory/movements", payload);
  return data;
}

export async function postInventoryMovement(
  kind: "entries" | "exits" | "transfers" | "adjustments/positive" | "adjustments/negative" | "waste",
  payload: PostedInventoryMovementPayload
) {
  const { data } = await http.post<InventoryMovement>(`/inventory/movements/${kind}`, payload, {
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
      "Correlation-Id": crypto.randomUUID()
    }
  });
  return data;
}

export async function updateInventoryStock(inventoryItemId: string, warehouseId: string, payload: { minStock: number; averageCost?: number }) {
  const { data } = await http.patch<InventoryStock>(`/inventory/items/${inventoryItemId}/stocks/${warehouseId}`, payload);
  return data;
}

export async function createInventoryProductSale(payload: InventoryProductSalePayload) {
  const { data } = await http.post("/inventory/sales", payload);
  return data;
}

export async function listMinStockAlerts(params?: { branchId?: string; warehouseId?: string }) {
  const { data } = await http.get<InventoryStock[]>("/inventory/alerts/min-stock", { params });
  return data;
}

export async function listInventoryKardex(inventoryItemId: string, warehouseId?: string) {
  const { data } = await http.get<InventoryMovement[]>(`/inventory/kardex/${inventoryItemId}`, { params: { warehouseId } });
  return data;
}

export async function downloadInventoryReport(
  kind: "current" | "movements" | "critical" | "valuation" | "waste" | "expiring",
  params?: Record<string, string | undefined>
) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const { data } = await http.get<Blob>(`/inventory/reports/${kind}.csv${suffix}`, {
    responseType: "blob"
  });
  return data;
}
