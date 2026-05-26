import { http } from "@/lib/api/http-client";

export type LabProvider = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
};

export type LabOrderStatus = "REQUESTED" | "SENT" | "IN_PROCESS" | "RECEIVED" | "DELIVERED" | "CANCELLED";
export type InventoryMovementType = "IN" | "OUT" | "ADJUSTMENT";

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
  category: string;
  unit: string;
  stock: string;
  minStock: string;
  branchId: string;
  supplierId?: string | null;
  isActive: boolean;
  branch?: { id: string; name: string };
  supplier?: { id: string; name: string } | null;
};

export type InventoryMovement = {
  id: string;
  inventoryItemId: string;
  branchId: string;
  type: InventoryMovementType;
  quantity: string;
  reason?: string | null;
  createdAt: string;
  inventoryItem?: { id: string; name: string; sku: string };
  branch?: { id: string; name: string };
  createdBy?: { id: string; firstName: string; lastName: string };
};

export type LabProviderPayload = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
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
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  branchId: string;
  supplierId?: string;
};

export type InventoryMovementPayload = {
  inventoryItemId: string;
  branchId: string;
  type: InventoryMovementType;
  quantity: number;
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

export async function listInventoryItems(params?: { search?: string; branchId?: string; category?: string; active?: string }) {
  const { data } = await http.get<InventoryItem[]>("/inventory/items", { params });
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

export async function listInventoryMovements(params?: { inventoryItemId?: string; branchId?: string; type?: InventoryMovementType }) {
  const { data } = await http.get<InventoryMovement[]>("/inventory/movements", { params });
  return data;
}

export async function createInventoryMovement(payload: InventoryMovementPayload) {
  const { data } = await http.post<InventoryMovement>("/inventory/movements", payload);
  return data;
}

export async function listMinStockAlerts(params?: { branchId?: string }) {
  const { data } = await http.get<InventoryItem[]>("/inventory/alerts/min-stock", { params });
  return data;
}
