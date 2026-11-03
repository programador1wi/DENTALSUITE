import type { InventoryMovementType } from "@prisma/client";
import type { AuthUser } from "../../../common/types/auth-user";
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

export const INVENTORY_PROVIDER = Symbol("INVENTORY_PROVIDER");
export const LOCAL_INVENTORY_PROVIDER = "LOCAL_DATABASE" as const;
export const EXTERNAL_INVENTORY_PROVIDER = "EXTERNAL_API" as const;

export type InventoryProviderMode =
  | typeof LOCAL_INVENTORY_PROVIDER
  | typeof EXTERNAL_INVENTORY_PROVIDER;

export type InventoryCommandContext = {
  idempotencyKey?: string;
  correlationId?: string;
};

export interface ProductCatalogQueryPort {
  listInventoryItems(actor: AuthUser, query: ListInventoryItemsQueryDto): Promise<unknown>;
  getInventoryProductDetails(actor: AuthUser, id: string): Promise<unknown>;
  listInventoryCategories(actor: AuthUser, query: ListInventoryCatalogQueryDto): Promise<unknown>;
  listInventoryUnits(actor: AuthUser, query: ListInventoryCatalogQueryDto): Promise<unknown>;
}

export interface ProductCatalogCommandPort {
  createInventoryItem(actor: AuthUser, dto: CreateInventoryItemDto): Promise<unknown>;
  updateInventoryItem(actor: AuthUser, id: string, dto: UpdateInventoryItemDto): Promise<unknown>;
  deactivateInventoryItem(actor: AuthUser, id: string): Promise<unknown>;
  reactivateInventoryItem(actor: AuthUser, id: string): Promise<unknown>;
  createInventoryCategory(actor: AuthUser, dto: CreateInventoryCategoryDto): Promise<unknown>;
  updateInventoryCategory(actor: AuthUser, id: string, dto: UpdateInventoryCategoryDto): Promise<unknown>;
  createInventoryUnit(actor: AuthUser, dto: CreateInventoryUnitDto): Promise<unknown>;
  updateInventoryUnit(actor: AuthUser, id: string, dto: UpdateInventoryUnitDto): Promise<unknown>;
}

export interface WarehouseQueryPort {
  listInventoryWarehouses(actor: AuthUser, query: ListInventoryWarehousesQueryDto): Promise<unknown>;
}

export interface WarehouseCommandPort {
  createInventoryWarehouse(actor: AuthUser, dto: CreateInventoryWarehouseDto): Promise<unknown>;
  updateInventoryWarehouse(actor: AuthUser, id: string, dto: UpdateInventoryWarehouseDto): Promise<unknown>;
}

export interface StockQueryPort {
  listMinStockAlerts(actor: AuthUser, branchId?: string, warehouseId?: string): Promise<unknown>;
  getInventoryKardex(actor: AuthUser, inventoryItemId: string, warehouseId?: string): Promise<unknown>;
}

export interface StockCommandPort {
  updateInventoryStock(
    actor: AuthUser,
    inventoryItemId: string,
    warehouseId: string,
    dto: UpdateInventoryStockDto
  ): Promise<unknown>;
  createInventoryStockCount(actor: AuthUser, dto: CreateInventoryStockCountDto): Promise<unknown>;
  reconcileInventoryStockCount(
    actor: AuthUser,
    id: string,
    dto: ReconcileInventoryStockCountDto,
    context: InventoryCommandContext
  ): Promise<unknown>;
}

export interface MovementQueryPort {
  listInventoryMovements(actor: AuthUser, query: ListInventoryMovementsQueryDto): Promise<unknown>;
}

export interface MovementCommandPort {
  postInventoryMovement(
    actor: AuthUser,
    type: InventoryMovementType,
    dto: PostInventoryMovementDto,
    context: InventoryCommandContext
  ): Promise<unknown>;
  compensateInventoryMovement(
    actor: AuthUser,
    id: string,
    dto: CompensateInventoryMovementDto,
    context: InventoryCommandContext
  ): Promise<unknown>;
}

export interface InventoryReportPort {
  exportInventoryCsv(actor: AuthUser, query: ListInventoryItemsQueryDto): Promise<string>;
  exportInventoryMovementsCsv(actor: AuthUser, query: ListInventoryMovementsQueryDto): Promise<string>;
  exportInventorySpecialReport(
    actor: AuthUser,
    kind: "critical" | "valuation" | "waste" | "expiring",
    query: ListInventoryItemsQueryDto
  ): Promise<string>;
}

export interface ExternalInventoryApiClient {
  searchProducts(input: unknown): Promise<unknown>;
  getProduct(id: string): Promise<unknown>;
  getWarehouses(input: unknown): Promise<unknown>;
  getStock(input: unknown): Promise<unknown>;
  createEntry(input: unknown, context: InventoryCommandContext): Promise<unknown>;
  createExit(input: unknown, context: InventoryCommandContext): Promise<unknown>;
  createTransfer(input: unknown, context: InventoryCommandContext): Promise<unknown>;
  getMovements(input: unknown): Promise<unknown>;
  getCriticalStock(input: unknown): Promise<unknown>;
}

export interface InventoryProviderPort
  extends ProductCatalogQueryPort,
    ProductCatalogCommandPort,
    WarehouseQueryPort,
    WarehouseCommandPort,
    StockQueryPort,
    StockCommandPort,
    MovementQueryPort,
    MovementCommandPort,
    InventoryReportPort {}
