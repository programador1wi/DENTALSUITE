import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createInventoryItem,
  createInventoryCategory,
  createInventoryMovement,
  createInventoryProductSale,
  createInventoryUnit,
  createInventoryWarehouse,
  createLabOrder,
  createLabProvider,
  createSupplier,
  deactivateInventoryItem,
  deactivateLabProvider,
  deactivateSupplier,
  listInventoryItems,
  listInventoryCategories,
  listInventoryKardex,
  listInventoryMovements,
  listInventoryUnits,
  listInventoryWarehouses,
  listLabProcedureAssignments,
  listLabOrders,
  listLabProviders,
  listMinStockAlerts,
  listSuppliers,
  postInventoryMovement,
  reactivateInventoryItem,
  updateInventoryItem,
  updateInventoryCategory,
  updateInventoryStock,
  updateInventoryUnit,
  updateInventoryWarehouse,
  updateLabProcedureAssignments,
  updateLabOrderCost,
  updateLabOrderStatus,
  updateLabProvider,
  updateSupplier,
  type CreateLabOrderPayload,
  type InventoryItemPayload,
  type PostedInventoryMovementPayload,
  type InventoryMovementPayload,
  type InventoryProductSalePayload,
  type InventoryWarehousePayload,
  type LabProcedureAssignmentPayload,
  type LabOrderStatus,
  type LabProviderPayload,
  type SupplierPayload
} from "../services/labs-inventory.service";

export function useLabProviders(search?: string, active?: string) {
  return useQuery({
    queryKey: ["labs", "providers", search, active],
    queryFn: () => listLabProviders({ search, active })
  });
}

export function useLabOrders(params?: { patientId?: string; professionalId?: string; labProviderId?: string; status?: LabOrderStatus }) {
  return useQuery({
    queryKey: ["labs", "orders", params],
    queryFn: () => listLabOrders(params)
  });
}

export function useLabProcedureAssignments() {
  return useQuery({
    queryKey: ["labs", "procedure-assignments"],
    queryFn: listLabProcedureAssignments
  });
}

export function useSuppliers(search?: string, active?: string) {
  return useQuery({
    queryKey: ["inventory", "suppliers", search, active],
    queryFn: () => listSuppliers({ search, active })
  });
}

export function useInventoryItems(params?: { search?: string; branchId?: string; warehouseId?: string; category?: string; active?: string; stock?: string }) {
  return useQuery({
    queryKey: ["inventory", "items", params],
    queryFn: () => listInventoryItems(params)
  });
}

export function useInventoryCategories(search?: string, active?: string) {
  return useQuery({
    queryKey: ["inventory", "categories", search, active],
    queryFn: () => listInventoryCategories({ search, active })
  });
}

export function useInventoryUnits(search?: string, active?: string) {
  return useQuery({
    queryKey: ["inventory", "units", search, active],
    queryFn: () => listInventoryUnits({ search, active })
  });
}

export function useInventoryWarehouses(params?: { branchId?: string; active?: string }) {
  return useQuery({
    queryKey: ["inventory", "warehouses", params],
    queryFn: () => listInventoryWarehouses(params)
  });
}

export function useInventoryMovements(params?: {
  inventoryItemId?: string;
  branchId?: string;
  warehouseId?: string;
  supplierId?: string;
  type?: InventoryMovementPayload["type"];
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["inventory", "movements", params],
    queryFn: () => listInventoryMovements(params)
  });
}

export function useInventoryKardex(inventoryItemId?: string, warehouseId?: string) {
  return useQuery({
    queryKey: ["inventory", "kardex", inventoryItemId, warehouseId],
    queryFn: () => listInventoryKardex(inventoryItemId ?? "", warehouseId),
    enabled: Boolean(inventoryItemId)
  });
}

export function useMinStockAlerts(branchId?: string, warehouseId?: string) {
  return useQuery({
    queryKey: ["inventory", "alerts", "min-stock", branchId, warehouseId],
    queryFn: () => listMinStockAlerts({ branchId, warehouseId })
  });
}

export function useLabsInventoryMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["labs"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };
  const onError = (error: Error) => toast.error(error.message);

  return {
    createLabProvider: useMutation({
      mutationFn: (payload: LabProviderPayload) => createLabProvider(payload),
      onSuccess: invalidate,
      onError
    }),
    updateLabProvider: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<LabProviderPayload> & { isActive?: boolean } }) =>
        updateLabProvider(id, payload),
      onSuccess: invalidate,
      onError
    }),
    deactivateLabProvider: useMutation({
      mutationFn: (id: string) => deactivateLabProvider(id),
      onSuccess: invalidate,
      onError
    }),
    updateLabProcedureAssignments: useMutation({
      mutationFn: ({ procedureId, assignments }: { procedureId: string; assignments: LabProcedureAssignmentPayload[] }) =>
        updateLabProcedureAssignments(procedureId, assignments),
      onSuccess: invalidate,
      onError
    }),
    createLabOrder: useMutation({
      mutationFn: (payload: CreateLabOrderPayload) => createLabOrder(payload),
      onSuccess: invalidate,
      onError
    }),
    updateLabOrderStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: LabOrderStatus }) => updateLabOrderStatus(id, status),
      onSuccess: invalidate,
      onError
    }),
    updateLabOrderCost: useMutation({
      mutationFn: ({ id, cost }: { id: string; cost: number }) => updateLabOrderCost(id, cost),
      onSuccess: invalidate,
      onError
    }),
    createSupplier: useMutation({
      mutationFn: (payload: SupplierPayload) => createSupplier(payload),
      onSuccess: invalidate,
      onError
    }),
    updateSupplier: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<SupplierPayload> & { isActive?: boolean } }) =>
        updateSupplier(id, payload),
      onSuccess: invalidate,
      onError
    }),
    deactivateSupplier: useMutation({
      mutationFn: (id: string) => deactivateSupplier(id),
      onSuccess: invalidate,
      onError
    }),
    createInventoryItem: useMutation({
      mutationFn: (payload: InventoryItemPayload) => createInventoryItem(payload),
      onSuccess: invalidate,
      onError
    }),
    createInventoryWarehouse: useMutation({
      mutationFn: (payload: InventoryWarehousePayload) => createInventoryWarehouse(payload),
      onSuccess: invalidate,
      onError
    }),
    updateInventoryWarehouse: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Partial<InventoryWarehousePayload> & { isActive?: boolean } }) =>
        updateInventoryWarehouse(id, payload),
      onSuccess: invalidate,
      onError
    }),
    updateInventoryItem: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateInventoryItem(id, payload as never),
      onSuccess: invalidate,
      onError
    }),
    updateInventoryStock: useMutation({
      mutationFn: ({ inventoryItemId, warehouseId, payload }: { inventoryItemId: string; warehouseId: string; payload: { minStock: number; averageCost?: number } }) =>
        updateInventoryStock(inventoryItemId, warehouseId, payload),
      onSuccess: invalidate,
      onError
    }),
    deactivateInventoryItem: useMutation({
      mutationFn: (id: string) => deactivateInventoryItem(id),
      onSuccess: invalidate,
      onError
    }),
    reactivateInventoryItem: useMutation({
      mutationFn: (id: string) => reactivateInventoryItem(id),
      onSuccess: invalidate,
      onError
    }),
    createInventoryCategory: useMutation({
      mutationFn: (payload: { name: string; description?: string }) => createInventoryCategory(payload),
      onSuccess: invalidate,
      onError
    }),
    updateInventoryCategory: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: { name?: string; description?: string; isActive?: boolean; version: number } }) =>
        updateInventoryCategory(id, payload),
      onSuccess: invalidate,
      onError
    }),
    createInventoryUnit: useMutation({
      mutationFn: (payload: { code: string; name: string; abbreviation: string; decimalAllowed?: boolean; precision?: number }) =>
        createInventoryUnit(payload),
      onSuccess: invalidate,
      onError
    }),
    updateInventoryUnit: useMutation({
      mutationFn: ({
        id,
        payload
      }: {
        id: string;
        payload: { code?: string; name?: string; abbreviation?: string; decimalAllowed?: boolean; precision?: number; isActive?: boolean; version: number };
      }) => updateInventoryUnit(id, payload),
      onSuccess: invalidate,
      onError
    }),
    createInventoryMovement: useMutation({
      mutationFn: (payload: InventoryMovementPayload) => createInventoryMovement(payload),
      onSuccess: invalidate,
      onError
    }),
    postInventoryMovement: useMutation({
      mutationFn: ({
        kind,
        payload
      }: {
        kind: "entries" | "exits" | "transfers" | "adjustments/positive" | "adjustments/negative" | "waste";
        payload: PostedInventoryMovementPayload;
      }) => postInventoryMovement(kind, payload),
      onSuccess: invalidate,
      onError
    }),
    createInventoryProductSale: useMutation({
      mutationFn: (payload: InventoryProductSalePayload) => createInventoryProductSale(payload),
      onSuccess: invalidate,
      onError
    })
  };
}
