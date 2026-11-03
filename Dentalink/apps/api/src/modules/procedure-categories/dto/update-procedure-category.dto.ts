import { ProcedureType } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";

export class UpdateProcedureCategoryDto {
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
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
