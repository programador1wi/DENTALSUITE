import { ProcedureType } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

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
  @IsEnum(ProcedureType)
  type?: ProcedureType;

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
  requiresOdontogramSymbol?: boolean;

  @IsOptional()
  @IsString()
  defaultOdontogramSymbol?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
