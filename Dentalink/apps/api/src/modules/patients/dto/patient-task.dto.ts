import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class ListPatientTasksQueryDto {
  @IsOptional()
  @IsString()
  includeCompleted?: string;
}

export class CreatePatientTaskDto {
  @IsString()
  @MaxLength(80)
  type!: string;

  @IsString()
  @MaxLength(500)
  detail!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdatePatientTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detail?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
