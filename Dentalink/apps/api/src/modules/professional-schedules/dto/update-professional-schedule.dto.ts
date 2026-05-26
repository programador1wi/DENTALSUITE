import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class UpdateProfessionalScheduleDto {
  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

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
  @IsString()
  breakStartTime?: string;

  @IsOptional()
  @IsString()
  breakEndTime?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
