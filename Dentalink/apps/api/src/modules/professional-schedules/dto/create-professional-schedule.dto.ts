import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class CreateProfessionalScheduleDto {
  @IsString()
  professionalId!: string;

  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsInt()
  @IsIn([0, 1, 2, 3, 4, 5, 6])
  dayOfWeek!: number;

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
