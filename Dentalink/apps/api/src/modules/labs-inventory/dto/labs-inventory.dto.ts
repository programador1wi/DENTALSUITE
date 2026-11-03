import { Type } from "class-transformer";
import { InventoryMovementType, LabOrderStatus } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListLabProvidersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  active?: string;
}

export class CreateLabProviderDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class UpdateLabProviderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LabProcedureAssignmentInputDto {
  @IsString()
  @IsNotEmpty()
  labProviderId!: string;

  @IsBoolean()
  isAssigned!: boolean;

  @IsOptional()
  @IsNumberString()
  patientPrice?: string;

  @IsOptional()
  @IsIn(["MXN", "USD", "EUR"])
  currency?: "MXN" | "USD" | "EUR";
}

export class UpdateLabProcedureAssignmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabProcedureAssignmentInputDto)
  assignments!: LabProcedureAssignmentInputDto[];
}

export class LabOrderItemInputDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  toothNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListLabOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  labProviderId?: string;

  @IsOptional()
  @IsEnum(LabOrderStatus)
  status?: LabOrderStatus;
}

export class CreateLabOrderDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsString()
  professionalId!: string;

  @IsString()
  labProviderId!: string;

  @IsOptional()
  @IsEnum(LabOrderStatus)
  status?: LabOrderStatus;

  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabOrderItemInputDto)
  items?: LabOrderItemInputDto[];
}

export class CreateLabOrderFromTreatmentDto {
  @IsString()
  professionalId!: string;

  @IsString()
  labProviderId!: string;

  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLabOrderStatusDto {
  @IsEnum(LabOrderStatus)
  status!: LabOrderStatus;
}

export class UpdateLabOrderCostDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost!: number;
}

export class ListSuppliersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  active?: string;
}

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListInventoryItemsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  active?: string;

  @IsOptional()
  @IsString()
  stock?: "low" | "zero";
}

export class ListInventoryWarehousesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  active?: string;
}

export class CreateInventoryWarehouseDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateInventoryWarehouseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  @IsNotEmpty()
  unit!: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  presentation?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  averageCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsBoolean()
  isSellable?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksLots?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksExpiration?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFractionalQuantity?: boolean;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  unitId?: string | null;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  presentation?: string | null;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  manufacturer?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number | null;

  @IsOptional()
  @IsBoolean()
  isSellable?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksLots?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksExpiration?: boolean;

  @IsOptional()
  @IsBoolean()
  allowFractionalQuantity?: boolean;

  @IsOptional()
  @IsString()
  supplierId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ListInventoryMovementsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  inventoryItemId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(InventoryMovementType)
  type?: InventoryMovementType;
}

export class CreateInventoryMovementDto {
  @IsString()
  inventoryItemId!: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateInventoryStockDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  averageCost?: number;
}

export class CreateInventoryProductSaleDto {
  @IsString()
  inventoryItemId!: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListInventoryCatalogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  active?: string;
}

export class CreateInventoryCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateInventoryCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version!: number;
}

export class CreateInventoryUnitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  abbreviation!: string;

  @IsOptional()
  @IsBoolean()
  decimalAllowed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  precision?: number;
}

export class UpdateInventoryUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  abbreviation?: string;

  @IsOptional()
  @IsBoolean()
  decimalAllowed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  precision?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version!: number;
}

export class InventoryMovementLineInputDto {
  @IsString()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PostInventoryMovementDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  sourceWarehouseId?: string;

  @IsOptional()
  @IsString()
  destinationWarehouseId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryMovementLineInputDto)
  lines!: InventoryMovementLineInputDto[];
}

export class CompensateInventoryMovementDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class CreateInventoryStockCountLineDto {
  @IsString()
  inventoryItemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQuantity?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInventoryStockCountDto {
  @IsString()
  branchId!: string;

  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryStockCountLineDto)
  lines!: CreateInventoryStockCountLineDto[];
}

export class ReconcileInventoryStockCountDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryStockCountLineDto)
  lines?: CreateInventoryStockCountLineDto[];
}
