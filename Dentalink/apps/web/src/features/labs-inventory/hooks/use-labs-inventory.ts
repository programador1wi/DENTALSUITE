import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createInventoryItem,
  createInventoryMovement,
  createLabOrder,
  createLabProvider,
  createSupplier,
  deactivateInventoryItem,
  deactivateLabProvider,
  deactivateSupplier,
  listInventoryItems,
  listInventoryMovements,
  listLabOrders,
  listLabProviders,
  listMinStockAlerts,
  listSuppliers,
  updateInventoryItem,
  updateLabOrderCost,
  updateLabOrderStatus,
  updateLabProvider,
  updateSupplier,
  type CreateLabOrderPayload,
  type InventoryItemPayload,
  type InventoryMovementPayload,
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

export function useSuppliers(search?: string, active?: string) {
  return useQuery({
    queryKey: ["inventory", "suppliers", search, active],
    queryFn: () => listSuppliers({ search, active })
  });
}

export function useInventoryItems(params?: { search?: string; branchId?: string; category?: string; active?: string }) {
  return useQuery({
    queryKey: ["inventory", "items", params],
    queryFn: () => listInventoryItems(params)
  });
}

export function useInventoryMovements(params?: { inventoryItemId?: string; branchId?: string; type?: InventoryMovementPayload["type"] }) {
  return useQuery({
    queryKey: ["inventory", "movements", params],
    queryFn: () => listInventoryMovements(params)
  });
}

export function useMinStockAlerts(branchId?: string) {
  return useQuery({
    queryKey: ["inventory", "alerts", "min-stock", branchId],
    queryFn: () => listMinStockAlerts({ branchId })
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
    updateInventoryItem: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => updateInventoryItem(id, payload as never),
      onSuccess: invalidate,
      onError
    }),
    deactivateInventoryItem: useMutation({
      mutationFn: (id: string) => deactivateInventoryItem(id),
      onSuccess: invalidate,
      onError
    }),
    createInventoryMovement: useMutation({
      mutationFn: (payload: InventoryMovementPayload) => createInventoryMovement(payload),
      onSuccess: invalidate,
      onError
    })
  };
}
