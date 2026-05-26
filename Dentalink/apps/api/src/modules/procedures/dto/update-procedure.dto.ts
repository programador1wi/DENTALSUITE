import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateProcedureDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  defaultDuration?: number;

  @IsOptional()
  @IsBoolean()
  requiresTooth?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresSurface?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresLab?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
