import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";
import { CurrencyCode, PriceListScopeType } from "@prisma/client";

export class PriceScopeDto {
  @IsEnum(PriceListScopeType)
  scopeType!: PriceListScopeType;

  @IsString()
  scopeKey!: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class CreateVersionedPriceListDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsOptional()
  @IsString()
  basePriceListId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceScopeDto)
  scopes!: PriceScopeDto[];
}

export class UpdateVersionedPriceListDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class CreatePriceListVersionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  copyFromVersionId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @IsOptional()
  @IsString()
  changeSummary?: string;
}

export class UpsertVersionItemDto {
  @IsString()
  procedureId!: string;

  @IsOptional()
  @IsString()
  procedureVariantId?: string;

  @IsOptional()
  @IsString()
  displayCategoryId?: string;

  @IsNumberString()
  basePrice!: string;

  @IsOptional()
  @IsNumberString()
  laboratoryCost?: string;

  @IsOptional()
  @IsNumberString()
  internalCost?: string;

  @IsOptional()
  @IsBoolean()
  allowDiscount?: boolean;

  @IsOptional()
  @IsNumberString()
  maxDiscountPercent?: string;

  @IsOptional()
  @IsNumberString()
  authorizationThresholdPercent?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class PublishPriceListVersionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  changeSummary?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class SchedulePriceListVersionDto extends PublishPriceListVersionDto {
  @IsDateString()
  validFrom!: string;
}

export class ResolvePriceDto {
  @IsString()
  branchId!: string;

  @IsString()
  procedureId!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsDateString()
  clinicalDate?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @IsOptional()
  @IsString()
  agreementId?: string;

  @IsOptional()
  @IsString()
  benefitId?: string;

  @IsOptional()
  @IsString()
  promotionId?: string;

  @IsOptional()
  @IsNumberString()
  manualPrice?: string;

  @IsOptional()
  @IsString()
  manualReason?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class CopyPriceItemsDto {
  @IsString()
  sourceVersionId!: string;

  @IsString()
  targetVersionId!: string;

  @IsOptional()
  @IsBoolean()
  updatePrices?: boolean;

  @IsOptional()
  @IsBoolean()
  copyDiscounts?: boolean;

  @IsOptional()
  @IsBoolean()
  copyCosts?: boolean;

  @IsOptional()
  @IsBoolean()
  copyInactive?: boolean;
}

export class PriceTemplateItemDto {
  @IsString()
  procedureId!: string;

  @IsOptional()
  @IsString()
  procedureVariantId?: string;

  @IsOptional()
  @IsNumberString()
  quantity?: string;
}

export class PriceTemplateSectionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceTemplateItemDto)
  items!: PriceTemplateItemDto[];
}

export class CreatePriceTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  basePriceListId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceTemplateSectionDto)
  sections!: PriceTemplateSectionDto[];
}

export class ApplyPriceTemplatePreviewDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  agreementId?: string;

  @IsOptional()
  @IsDateString()
  clinicalDate?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;
}

export class PriceImportRowDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNumberString()
  price!: string;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsOptional()
  @IsNumberString()
  laboratoryCost?: string;

  @IsOptional()
  @IsNumberString()
  internalCost?: string;

  @IsOptional()
  @IsBoolean()
  allowDiscount?: boolean;

  @IsOptional()
  @IsNumberString()
  maxDiscountPercent?: string;
}

export class CreatePriceImportDto {
  @IsString()
  priceListId!: string;

  @IsString()
  priceListVersionId!: string;

  @IsString()
  fileName!: string;

  @IsString()
  idempotencyKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceImportRowDto)
  rows!: PriceImportRowDto[];
}
