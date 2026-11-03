import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class UpsertBrandDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
