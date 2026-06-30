import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "PENDING_CONFIRMATION",
  "ARRIVED",
  "WAITING_ROOM",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "NO_SHOW",
  "RESCHEDULED",
  "BLOCKED"
] as const;

export class CreateAppointmentDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(APPOINTMENT_STATUSES)
  status?: (typeof APPOINTMENT_STATUSES)[number];

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAppointmentsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAppointmentDto)
  appointments!: CreateAppointmentDto[];

  @IsOptional()
  @IsBoolean()
  autoCreateInitialTreatmentPlan?: boolean;
}
