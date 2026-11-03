import { AppointmentStatus, AttendanceMode } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class PreviewMassReprogrammingDto {
  @IsString()
  branchId!: string;

  @IsString()
  professionalId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @MaxLength(80)
  reasonCode!: string;

  @IsString()
  @MaxLength(500)
  reasonText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;
}

export class CreateMassReprogrammingBatchDto extends PreviewMassReprogrammingDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedAppointmentIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedAppointmentIds?: string[];
}

export class ListReprogrammingCasesQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["PENDING", "IN_PROGRESS", "RESCHEDULED", "DEFINITIVELY_CANCELLED", "EXCLUDED"])
  status?: "PENDING" | "IN_PROGRESS" | "RESCHEDULED" | "DEFINITIVELY_CANCELLED" | "EXCLUDED";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class RescheduleAppointmentCaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  branchId!: string;

  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chairIndex?: number;

  @IsOptional()
  @IsEnum(AttendanceMode)
  attendanceMode?: AttendanceMode;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  durationMinutes!: number;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  @IsIn([
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.PENDING_CONFIRMATION,
    AppointmentStatus.CONFIRMED
  ])
  initialStatus?: AppointmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  notifyPatient?: boolean;
}

export class DefinitivelyCancelReprogrammingCaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;
}
