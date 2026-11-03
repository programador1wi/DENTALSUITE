import { AttendanceMode } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CancelAppointmentDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  cancelledBy?: "patient" | "clinic" | "conflict" | "rescheduled";
}

export class RescheduleAppointmentDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  chairIndex?: number;

  @IsOptional()
  @IsEnum(AttendanceMode)
  attendanceMode?: AttendanceMode;

  @IsOptional()
  @IsString()
  specialtyId?: string;

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
  reason?: string;

  @IsOptional()
  @IsBoolean()
  allowOverbooking?: boolean;
}

export class AppointmentStatusReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AvailabilityQueryDto {
  @IsString()
  branchId!: string;

  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @IsString()
  chairIndex?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  durationMinutes?: string;

  @IsOptional()
  @IsString()
  excludeAppointmentId?: string;
}
