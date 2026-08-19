import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested
} from "class-validator";
import { CrmTaskDelayUnit, CrmTaskOrigin, CrmTaskPriority, PatientTaskStatus } from "@prisma/client";

export const CRM_TASK_TYPES = ["COBRANZA", "CAPTURA", "CONTROL", "CITA", "PERSONALIZADA"] as const;
export const AUTOMATIC_CRM_TASK_TYPES = ["COBRANZA", "CAPTURA", "CONTROL", "CITA"] as const;

export class ListCrmTasksQueryDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  overdue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(Object.values(PatientTaskStatus))
  status?: PatientTaskStatus;

  @IsOptional()
  @IsIn(CRM_TASK_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsIn(Object.values(CrmTaskOrigin))
  origin?: CrmTaskOrigin;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @IsOptional()
  @IsIn(["dueDate", "createdAt", "updatedAt", "title", "priority"])
  sortBy = "dueDate";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "asc";
}

export class CreateCrmTaskDto {
  @IsString()
  branchId!: string;

  @IsString()
  patientId!: string;

  @IsIn(CRM_TASK_TYPES)
  type!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  detail!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsIn(Object.values(CrmTaskPriority))
  priority: CrmTaskPriority = CrmTaskPriority.NORMAL;
}

export class UpdateCrmTaskDto {
  @IsOptional()
  @IsIn(CRM_TASK_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  detail?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @IsOptional()
  @IsIn(Object.values(CrmTaskPriority))
  priority?: CrmTaskPriority;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class CrmTaskVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class CancelCrmTaskDto extends CrmTaskVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class CrmTaskStatisticsQueryDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}

export class CrmTaskConfigurationQueryDto {
  @IsString()
  branchId!: string;
}

export class CrmTaskConfigurationItemDto {
  @IsIn(AUTOMATIC_CRM_TASK_TYPES)
  type!: string;

  @IsBoolean()
  enabled!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  delayValue!: number;

  @IsIn(Object.values(CrmTaskDelayUnit))
  delayUnit!: CrmTaskDelayUnit;

  @IsOptional()
  @IsString()
  defaultAssignedToId?: string | null;
}

export class UpdateCrmTaskConfigurationDto {
  @IsString()
  branchId!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CrmTaskConfigurationItemDto)
  items!: CrmTaskConfigurationItemDto[];
}
