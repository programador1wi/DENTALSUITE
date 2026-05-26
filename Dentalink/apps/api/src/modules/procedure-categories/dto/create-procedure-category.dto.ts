import { IsInt, IsOptional, IsString } from "class-validator";

export class CreateProcedureCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
