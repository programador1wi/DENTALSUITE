import { AttendanceMode } from "@prisma/client";
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator";

export class UpdateProfessionalScheduleDto {
  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  chairId?: string | null;

  @IsOptional()
  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5, 6])
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  breakStartTime?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  breakEndTime?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  simultaneousChairs?: number;

  @IsOptional()
  @IsEnum(AttendanceMode)
  attendanceMode?: AttendanceMode;
}
