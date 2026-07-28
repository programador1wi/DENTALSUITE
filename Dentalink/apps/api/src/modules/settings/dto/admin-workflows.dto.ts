import { Type } from "class-transformer";
import { AgreementStatus, AgreementType } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  IsEnum,
  IsObject,
  ValidateNested
} from "class-validator";

export class AgreementProcedureRuleDto {
  @IsString()
  procedureId!: string;

  @IsOptional()
  @IsBoolean()
  isEligible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preferredPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  coveragePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  copayAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  coverageLimitAmount?: number;

  @IsOptional()
  @IsObject()
  coverageRules?: Record<string, unknown>;
}

export class AgreementCategoryRuleDto {
  @IsString()
  procedureCategoryId!: string;

  @IsOptional()
  @IsBoolean()
  isEligible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  preferredPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  coveragePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  copayAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  coverageLimitAmount?: number;

  @IsOptional()
  @IsObject()
  coverageRules?: Record<string, unknown>;
}

export class CreateAgreementDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  entityTaxId?: string;

  @IsOptional()
  @IsEnum(AgreementType)
  type?: AgreementType;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  coveragePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  copayAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  coverageLimitAmount?: number;

  @IsOptional()
  @IsObject()
  coverageRules?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgreementProcedureRuleDto)
  procedureRules?: AgreementProcedureRuleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgreementCategoryRuleDto)
  categoryRules?: AgreementCategoryRuleDto[];

  @IsOptional()
  @IsBoolean()
  appliesToLabs?: boolean;

  @IsOptional()
  @IsBoolean()
  appliesToOtherCategories?: boolean;

  @IsOptional()
  @IsBoolean()
  payrollDiscount?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateAgreementDto extends CreateAgreementDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PublishAgreementDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;
}

export class AssignAgreementTreatmentPlanDto {
  @IsString()
  treatmentPlanId!: string;
}

export class PreviewAgreementPriceDto {
  @IsString()
  branchId!: string;

  @IsString()
  procedureId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity?: number;
}

export class AssignAgreementPatientsDto {
  @IsArray()
  @IsString({ each: true })
  patientIds!: string[];
}

export class CreateExpenseDto {
  @IsString()
  branchId!: string;

  @IsString()
  categoryName!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @Type(() => Number)
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsPositive()
  unitCost!: number;

  @IsOptional()
  @IsDateString()
  invoicedAt?: string;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  documentUrl?: string;

  @IsOptional()
  @IsString()
  cashRegisterId?: string;

  @IsOptional()
  @IsBoolean()
  assignToOpenCash?: boolean;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  unitCost?: number;

  @IsOptional()
  @IsDateString()
  invoicedAt?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  documentUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @Type(() => Number)
  @Min(1)
  expectedVersion!: number;
}

export class VoidExpenseDto {
  @IsString()
  @MaxLength(500)
  reason!: string;

  @Type(() => Number)
  @Min(1)
  expectedVersion!: number;
}

export class FinalizePayrollDto {
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class RecalculatePayrollDto {
  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
