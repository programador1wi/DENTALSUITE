import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class EvolutionFieldDto {
  @IsString()
  label!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  group?: string;
}

export class EvolutionMaterialDto {
  @IsString()
  inventoryItemId!: string;

  @IsNumber()
  quantity!: number;
}

export class CreateClinicalEvolutionDto {
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanItemId?: string;

  @IsOptional()
  @IsInt()
  @IsIn([0, 25, 50, 75, 100])
  completionPercentage?: number;

  @IsOptional()
  @IsInt()
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  subjective?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  assessment?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvolutionFieldDto)
  fields?: EvolutionFieldDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvolutionMaterialDto)
  materials?: EvolutionMaterialDto[];
}

export class UpdateClinicalEvolutionDto extends CreateClinicalEvolutionDto {}

export class CreateClinicalEvolutionAddendumDto {
  @IsString()
  professionalId!: string;

  @IsString()
  notes!: string;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}

export class AnnulClinicalEvolutionDto {
  @IsString()
  reason!: string;
}

export class ListEvolutionsQueryDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeAnnulled?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  mineOnly?: boolean;
}
