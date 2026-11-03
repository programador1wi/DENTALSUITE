import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { CashDiscountStatus } from "@prisma/client";

export class ListCashDiscountsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(CashDiscountStatus) status?: CashDiscountStatus;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() type?: "CLINICAL" | "LABORATORY" | "BOTH";
  @IsOptional() @IsString() validity?: "CURRENT" | "UPCOMING" | "EXPIRED" | "ALL";
}

export class UpsertCashDiscountDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(120) campaign?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100) discountPercent!: number;
  @IsBoolean() appliesToClinicalActions!: boolean;
  @IsBoolean() appliesToLaboratoryActions!: boolean;
  @IsBoolean() availableToAllUsers!: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
  @IsBoolean() availableToAllBranches!: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsBoolean() stackableWithAgreements?: boolean;
  @IsOptional() @IsBoolean() stackableWithOtherDiscounts?: boolean;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsEnum(CashDiscountStatus) status!: CashDiscountStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) expectedVersion?: number;
}

export class DisableCashDiscountDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

export class ReactivateCashDiscountDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

export class CashDiscountPreviewItemDto {
  @IsString() treatmentPlanItemId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) outstandingAmount!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) expectedVersion?: number;
}

export class CashDiscountPreviewDto {
  @IsString() branchId!: string;
  @IsString() treatmentPlanId!: string;
  @IsString() cashDiscountRuleId!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CashDiscountPreviewItemDto)
  items!: CashDiscountPreviewItemDto[];
}

export class CashDiscountReportQueryDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() cashDiscountRuleId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}
