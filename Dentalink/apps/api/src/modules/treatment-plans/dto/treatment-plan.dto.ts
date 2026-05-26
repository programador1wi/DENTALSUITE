import { Type } from "class-transformer";
import { BudgetStatus, TreatmentPlanItemStatus, TreatmentPlanStatus } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class TreatmentPlanSectionInputDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class TreatmentPlanItemInputDto {
  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  procedureId!: string;

  @IsOptional()
  @IsString()
  toothNumber?: string;

  @IsOptional()
  @IsString()
  surface?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  plannedAt?: string;

  @IsOptional()
  @IsBoolean()
  syncOdontogram?: boolean;
}

export class CreateTreatmentPlanDto {
  @IsString()
  branchId!: string;

  @IsString()
  patientId!: string;

  @IsString()
  professionalId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @IsOptional()
  @IsBoolean()
  isAlternative?: boolean;

  @IsOptional()
  @IsString()
  parentTreatmentPlanId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentPlanSectionInputDto)
  sections?: TreatmentPlanSectionInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentPlanItemInputDto)
  items?: TreatmentPlanItemInputDto[];
}

export class UpdateTreatmentPlanDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;
}

export class CreateAlternativeDto extends CreateTreatmentPlanDto {}

export class ListTreatmentPlansQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;
}

export class UpdateTreatmentPlanItemDto {
  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  procedureId?: string;

  @IsOptional()
  @IsString()
  toothNumber?: string;

  @IsOptional()
  @IsString()
  surface?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  plannedAt?: string;

  @IsOptional()
  @IsBoolean()
  syncOdontogram?: boolean;
}

export class UpdateTreatmentPlanItemStatusDto {
  @IsEnum(TreatmentPlanItemStatus)
  status!: TreatmentPlanItemStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBudgetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountTotal?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListBudgetsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;
}

export class UpdateBudgetStatusDto {
  @IsEnum(BudgetStatus)
  status!: BudgetStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
