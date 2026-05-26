import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateFinancialInstitutionDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

export class UpdateFinancialInstitutionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
