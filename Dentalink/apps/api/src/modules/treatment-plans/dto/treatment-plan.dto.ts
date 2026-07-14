import { Type } from "class-transformer";
import {
  BudgetStatus,
  TreatmentPlanItemStatus,
  TreatmentPlanKind,
  TreatmentPlanStatus
} from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { TREATMENT_PLAN_DOCUMENT_TYPES, type TreatmentPlanDocumentType } from "../treatment-plan-documents";

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

  @IsOptional()
  @IsString()
  odontogramSymbol?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

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
  plannedAt?: string | null;

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
  @IsEnum(TreatmentPlanKind)
  kind?: TreatmentPlanKind;

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

export class UpdateOrthodonticProfileDto {
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedMonths?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedControls?: number | null;

  @IsOptional()
  @IsString()
  lastUpperArch?: string | null;

  @IsOptional()
  @IsString()
  lastLowerArch?: string | null;

  @IsOptional()
  @IsDateString()
  nextControlAt?: string | null;

  @IsOptional()
  @IsDateString()
  nextRadiographyAt?: string | null;

  @IsOptional()
  @IsString()
  hygieneStatus?: string | null;

  @IsOptional()
  @IsString()
  alert?: string | null;

  @IsOptional()
  @IsString()
  indications?: string | null;

  @IsOptional()
  @IsString()
  elastics?: string | null;

  @IsOptional()
  @IsString()
  planNotes?: string | null;
}

export class UpdateOrthodonticDiagnosisDto {
  @IsObject()
  diagnosis!: Record<string, unknown>;
}

export class StartOrthodonticTreatmentDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class OrthodonticEvolutionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasHygiene?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateOrthodonticMonthlyItemsDto {
  @IsString()
  procedureId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  months!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  sectionName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ChangeTreatmentPlanBranchDto {
  @IsString()
  branchId!: string;

  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsBoolean()
  moveFutureAppointments?: boolean;
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

  @IsOptional()
  @IsEnum(TreatmentPlanKind)
  kind?: TreatmentPlanKind;
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
  plannedAt?: string | null;

  @IsOptional()
  @IsBoolean()
  syncOdontogram?: boolean;

  @IsOptional()
  @IsString()
  odontogramSymbol?: string;
}

export class UpdateTreatmentPlanItemStatusDto {
  @IsEnum(TreatmentPlanItemStatus)
  status!: TreatmentPlanItemStatus;

  @IsOptional()
  @IsInt()
  @IsIn([0, 25, 50, 75, 100])
  completionPercentage?: number;

  @IsOptional()
  @IsInt()
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkDiscountTreatmentPlanItemsDto {
  @IsArray()
  @IsString({ each: true })
  itemIds!: string[];

  @IsIn(["PERCENTAGE", "AMOUNT"])
  discountType!: "PERCENTAGE" | "AMOUNT";

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;
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

export class PrintTreatmentPlanDocumentDto {
  @IsIn(TREATMENT_PLAN_DOCUMENT_TYPES)
  type!: TreatmentPlanDocumentType;

  @IsOptional()
  @IsString()
  budgetId?: string;
}

export class UpdateBudgetStatusDto {
  @IsEnum(BudgetStatus)
  status!: BudgetStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DuplicateTreatmentPlanDto {
  @IsOptional()
  @IsString()
  newBranchId?: string;

  @IsOptional()
  @IsString()
  newProfessionalId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReferTreatmentPlanDto {
  @IsString()
  toBranchId!: string;

  @IsOptional()
  @IsString()
  toProfessionalId?: string;

  @IsString()
  reason!: string;
}

export class ReactivateTreatmentPlanDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeactivateTreatmentPlanDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PauseTreatmentPlanDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
