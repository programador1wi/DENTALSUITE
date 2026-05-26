import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  organizationName?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
