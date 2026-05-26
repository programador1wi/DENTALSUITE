import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpsertMedicalHistoryDto {
  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsBoolean()
  hasDiabetes?: boolean;

  @IsOptional()
  @IsBoolean()
  hasHypertension?: boolean;

  @IsOptional()
  @IsBoolean()
  hasHeartDisease?: boolean;

  @IsOptional()
  @IsBoolean()
  isPregnant?: boolean;

  @IsOptional()
  @IsBoolean()
  smokes?: boolean;

  @IsOptional()
  @IsBoolean()
  drinksAlcohol?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMedicalConditionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateAllergyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  reaction?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMedicationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
