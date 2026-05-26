import { Type } from "class-transformer";
import { IsArray, IsEmail, IsHexColor, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateProfessionalDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsArray()
  @IsString({ each: true })
  specialtyIds!: string[];

  @IsArray()
  @IsString({ each: true })
  branchIds!: string[];
}
