import { Inject, Injectable } from "@nestjs/common";
import type { InventoryMovementType } from "@prisma/client";
import type { AuthUser } from "../../../common/types/auth-user";
import {
  INVENTORY_PROVIDER,
  type InventoryCommandContext,
  type InventoryProviderPort
} from "./inventory-provider.port";
import type {
  CompensateInventoryMovementDto,
  CreateInventoryCategoryDto,
  CreateInventoryItemDto,
  CreateInventoryStockCountDto,
  CreateInventoryUnitDto,
  CreateInventoryWarehouseDto,
  ListInventoryCatalogQueryDto,
  ListInventoryItemsQueryDto,
  ListInventoryMovementsQueryDto,
  ListInventoryWarehousesQueryDto,
  PostInventoryMovementDto,
  ReconcileInventoryStockCountDto,
  UpdateInventoryCategoryDto,
  UpdateInventoryItemDto,
  UpdateInventoryStockDto,
  UpdateInventoryUnitDto,
  UpdateInventoryWarehouseDto
} from "../dto/labs-inventory.dto";

@Injectable()
export class InventoryApplicationService {
  constructor(@Inject(INVENTORY_PROVIDER) private readonly provider: InventoryProviderPort) {}

  listProducts(actor: AuthUser, query: ListInventoryItemsQueryDto) {
    return this.provider.listInventoryItems(actor, query);
  }

  getProduct(actor: AuthUser, id: string) {
    return this.provider.getInventoryProductDetails(actor, id);
  }

  createProduct(actor: AuthUser, dto: CreateInventoryItemDto) {
    return this.provider.createInventoryItem(actor, dto);
  }

  updateProduct(actor: AuthUser, id: string, dto: UpdateInventoryItemDto) {
    return this.provider.updateInventoryItem(actor, id, dto);
  }

  deactivateProduct(actor: AuthUser, id: string) {
    return this.provider.deactivateInventoryItem(actor, id);
  }

  reactivateProduct(actor: AuthUser, id: string) {
    return this.provider.reactivateInventoryItem(actor, id);
  }

  listCategories(actor: AuthUser, query: ListInventoryCatalogQueryDto) {
    return this.provider.listInventoryCategories(actor, query);
  }

  createCategory(actor: AuthUser, dto: CreateInventoryCategoryDto) {
    return this.provider.createInventoryCategory(actor, dto);
  }

  updateCategory(actor: AuthUser, id: string, dto: UpdateInventoryCategoryDto) {
    return this.provider.updateInventoryCategory(actor, id, dto);
  }

  listUnits(actor: AuthUser, query: ListInventoryCatalogQueryDto) {
    return this.provider.listInventoryUnits(actor, query);
  }

  createUnit(actor: AuthUser, dto: CreateInventoryUnitDto) {
    return this.provider.createInventoryUnit(actor, dto);
  }

  updateUnit(actor: AuthUser, id: string, dto: UpdateInventoryUnitDto) {
    return this.provider.updateInventoryUnit(actor, id, dto);
  }

  listWarehouses(actor: AuthUser, query: ListInventoryWarehousesQueryDto) {
    return this.provider.listInventoryWarehouses(actor, query);
  }

  createWarehouse(actor: AuthUser, dto: CreateInventoryWarehouseDto) {
    return this.provider.createInventoryWarehouse(actor, dto);
  }

  updateWarehouse(actor: AuthUser, id: string, dto: UpdateInventoryWarehouseDto) {
    return this.provider.updateInventoryWarehouse(actor, id, dto);
  }

  listMovements(actor: AuthUser, query: ListInventoryMovementsQueryDto) {
    return this.provider.listInventoryMovements(actor, query);
  }

  postMovement(
    actor: AuthUser,
    type: InventoryMovementType,
    dto: PostInventoryMovementDto,
    context: InventoryCommandContext
  ) {
    return this.provider.postInventoryMovement(actor, type, dto, context);
  }

  compensateMovement(
    actor: AuthUser,
    id: string,
    dto: CompensateInventoryMovementDto,
    context: InventoryCommandContext
  ) {
    return this.provider.compensateInventoryMovement(actor, id, dto, context);
  }

  updateSafetyStock(
    actor: AuthUser,
    inventoryItemId: string,
    warehouseId: string,
    dto: UpdateInventoryStockDto
  ) {
    return this.provider.updateInventoryStock(actor, inventoryItemId, warehouseId, dto);
  }

  listCriticalStock(actor: AuthUser, branchId?: string, warehouseId?: string) {
    return this.provider.listMinStockAlerts(actor, branchId, warehouseId);
  }

  getKardex(actor: AuthUser, inventoryItemId: string, warehouseId?: string) {
    return this.provider.getInventoryKardex(actor, inventoryItemId, warehouseId);
  }

  createStockCount(actor: AuthUser, dto: CreateInventoryStockCountDto) {
    return this.provider.createInventoryStockCount(actor, dto);
  }

  reconcileStockCount(
    actor: AuthUser,
    id: string,
    dto: ReconcileInventoryStockCountDto,
    context: InventoryCommandContext
  ) {
    return this.provider.reconcileInventoryStockCount(actor, id, dto, context);
  }

  exportCurrent(actor: AuthUser, query: ListInventoryItemsQueryDto) {
    return this.provider.exportInventoryCsv(actor, query);
  }

  exportMovements(actor: AuthUser, query: ListInventoryMovementsQueryDto) {
    return this.provider.exportInventoryMovementsCsv(actor, query);
  }

  exportSpecial(
    actor: AuthUser,
    kind: "critical" | "valuation" | "waste" | "expiring",
    query: ListInventoryItemsQueryDto
  ) {
    return this.provider.exportInventorySpecialReport(actor, kind, query);
  }
}
