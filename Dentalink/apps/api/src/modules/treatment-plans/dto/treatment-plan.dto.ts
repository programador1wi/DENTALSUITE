import { Type } from "class-transformer";
import {
  BudgetStatus,
  CurrencyCode,
  OrthodonticDiagnosisStatus,
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
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { TREATMENT_PLAN_DOCUMENT_TYPES, type TreatmentPlanDocumentType } from "../treatment-plan-documents";

export class TreatmentPlanPricePreviewDto {
  @IsString()
  procedureId!: string;

  @IsOptional()
  @IsDateString()
  clinicalDate?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;
}

export class RepriceTreatmentPlanDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @IsOptional()
  @IsDateString()
  clinicalDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

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

  @IsOptional()
  @IsString()
  agreementId?: string;

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
  @IsString()
  technicalDescription?: string | null;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalAligners?: number | null;

  @IsOptional()
  @IsString()
  indicatedExtractions?: string | null;

  @IsOptional()
  @IsString()
  performedExtractions?: string | null;

  @IsOptional()
  @IsDateString()
  reevaluationDate?: string | null;

  @IsOptional()
  @IsString()
  interconsultations?: string | null;

  @IsOptional()
  @IsObject()
  catalogSelections?: Record<string, string[]>;

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

export class OrthodonticDiagnosisFieldValueDto {
  @IsString()
  fieldCode!: string;

  @IsOptional()
  @IsString()
  valueText?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valueNumber?: number | null;

  @IsOptional()
  @IsDateString()
  valueDate?: string | null;

  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean | null;

  @IsOptional()
  @IsString()
  unitId?: string | null;

  @IsOptional()
  @IsString()
  optionId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionIds?: string[];
}

export class SaveOrthodonticDiagnosisDto {
  @IsOptional()
  @IsEnum(OrthodonticDiagnosisStatus)
  status?: OrthodonticDiagnosisStatus;

  @IsOptional()
  @IsDateString()
  clinicalDate?: string | null;

  @IsOptional()
  @IsString()
  changeReason?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrthodonticDiagnosisFieldValueDto)
  values!: OrthodonticDiagnosisFieldValueDto[];
}

export class CreateOrthodonticDiagnosisOptionDto {
  @IsString()
  label!: string;
}

export class UpdateOrthodonticDiagnosisOptionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  deactivationReason?: string;
}

export class SortOrthodonticDiagnosisOptionsDto {
  @IsArray()
  @IsString({ each: true })
  optionIds!: string[];
}

export class CreateOrthodonticOptionDto {
  @IsString()
  label!: string;
}

export class UpdateOrthodonticOptionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  deactivationReason?: string;
}

export class SortOrthodonticOptionsDto {
  @IsArray()
  @IsString({ each: true })
  optionIds!: string[];
}

export class StartOrthodonticTreatmentDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(36)
  durationMonths?: number;
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
