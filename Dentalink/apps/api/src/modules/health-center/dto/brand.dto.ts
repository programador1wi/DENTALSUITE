import { IsBoolean, IsEmail, IsHexColor, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ListBrandsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["ACTIVE", "ARCHIVED", "ALL"])
  status?: "ACTIVE" | "ARCHIVED" | "ALL";
}

export class CreateBrandDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  publicDomain?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @IsOptional()
  @IsEmail()
  replyToEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  privacyNoticeUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateBrandDto extends CreateBrandDto {
  @IsOptional()
  @IsIn(["ACTIVE", "ARCHIVED"])
  status?: "ACTIVE" | "ARCHIVED";
}
