import { Type } from "class-transformer";
import { CurrencyCode, InstallmentFrequency } from "@prisma/client";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class DebtReportQueryDto {
  @IsDateString()
  cutoffDate!: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  agreementId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currencyId?: CurrencyCode;

  @IsOptional()
  @IsIn(["AUTHORIZED", "ALL"])
  scope?: "AUTHORIZED" | "ALL";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class DebtDetailsQueryDto extends DebtReportQueryDto {
  @IsOptional()
  @IsString()
  patient?: string;

  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installmentNumber?: number;

  @IsOptional()
  @IsString()
  folio?: string;
}

export class CreatePayrollDiscountPlanDto {
  @IsString()
  treatmentPlanId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  treatmentPlanItemIds!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  installmentCount!: number;

  @IsDateString()
  firstDueDate!: string;

  @IsEnum(InstallmentFrequency)
  periodicity!: InstallmentFrequency;
}

export class CreateCompanyPaymentDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsDateString()
  paymentDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsEnum(CurrencyCode)
  currencyId!: CurrencyCode;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  financialInstitutionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  reference?: string;

  @IsOptional()
  @IsUrl({ require_protocol: false })
  proofUrl?: string;

  @IsOptional()
  @IsString()
  cashRegisterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsIn(["AUTO_DUE_DATE", "MANUAL", "PROPORTIONAL"])
  allocationStrategy!: "AUTO_DUE_DATE" | "MANUAL" | "PROPORTIONAL";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chargeIds?: string[];

  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class AllocateCompanyPaymentDto {
  @IsIn(["AUTO_DUE_DATE", "MANUAL", "PROPORTIONAL"])
  strategy!: "AUTO_DUE_DATE" | "MANUAL" | "PROPORTIONAL";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chargeIds?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ApproveCompanyPaymentDto extends AllocateCompanyPaymentDto {}

export class VoidCompanyPaymentDto {
  @IsString()
  @MaxLength(500)
  reason!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
