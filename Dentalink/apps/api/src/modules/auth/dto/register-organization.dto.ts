import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  organizationPhone?: string;

  @IsOptional()
  @IsEmail()
  organizationEmail?: string;

  @IsOptional()
  @IsString()
  organizationAddress?: string;

  @IsString()
  @MinLength(2)
  branchName!: string;

  @IsOptional()
  @IsString()
  branchPhone?: string;

  @IsOptional()
  @IsEmail()
  branchEmail?: string;

  @IsOptional()
  @IsString()
  branchAddress?: string;

  @IsOptional()
  @IsString()
  branchCity?: string;

  @IsOptional()
  @IsString()
  branchState?: string;

  @IsOptional()
  @IsString()
  branchCountry?: string;

  @IsOptional()
  @IsString()
  branchTimezone?: string;

  @IsString()
  @MinLength(2)
  adminFirstName!: string;

  @IsString()
  @MinLength(2)
  adminLastName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsOptional()
  @IsString()
  adminPhone?: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
