import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateProcedureDto {
  @IsString()
  categoryId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(5)
  @Max(600)
  defaultDuration!: number;

  @IsOptional()
  @IsBoolean()
  requiresTooth?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresSurface?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresLab?: boolean;
}
