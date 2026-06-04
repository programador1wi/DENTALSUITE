import { Type } from "class-transformer";
import {
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class CreateSpecialtyClinicalTemplateDto {
  @IsIn(["PRESCRIPTION", "EVOLUTION"])
  type!: "PRESCRIPTION" | "EVOLUTION";

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateSpecialtyClinicalTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSpecialtyAppointmentReasonDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  durationMinutes!: number;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class UpdateSpecialtyAppointmentReasonDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  durationMinutes?: number;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
