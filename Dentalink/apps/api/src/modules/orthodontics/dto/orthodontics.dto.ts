import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { OrthodonticProgressStatus, TreatmentPlanStatus } from "@prisma/client";

export class OrthodonticsReportQueryDto {
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
  limit = 20;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(OrthodonticProgressStatus)
  delayStatus?: OrthodonticProgressStatus;
}

export class ScheduleOrthodonticControlDto {
  @IsString()
  professionalId!: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes = 15;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  chairId?: string;
}
