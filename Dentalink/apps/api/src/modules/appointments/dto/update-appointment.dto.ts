import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

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

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(APPOINTMENT_STATUSES)
  status?: (typeof APPOINTMENT_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
