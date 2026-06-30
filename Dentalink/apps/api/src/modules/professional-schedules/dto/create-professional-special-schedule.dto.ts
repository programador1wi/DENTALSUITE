import { IsOptional, IsString, Matches } from "class-validator";

export class CreateProfessionalSpecialScheduleDto {
  @IsString()
  professionalId!: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be in YYYY-MM-DD format" })
  date!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsString()
  breakStartTime?: string;

  @IsOptional()
  @IsString()
  breakEndTime?: string;
}
