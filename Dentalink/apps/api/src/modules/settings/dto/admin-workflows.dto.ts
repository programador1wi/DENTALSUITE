import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min
} from "class-validator";

export class CreateAgreementDto {
  @IsString()
  name!: string;

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
  @IsBoolean()
  assignToOpenCash?: boolean;
}

export class FinalizePayrollDto {
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
