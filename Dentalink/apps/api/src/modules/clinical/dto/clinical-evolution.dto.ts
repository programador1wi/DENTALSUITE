import { IsOptional, IsString } from "class-validator";

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
}

export class UpdateClinicalEvolutionDto extends CreateClinicalEvolutionDto {}

export class CreateClinicalEvolutionAddendumDto {
  @IsString()
  professionalId!: string;

  @IsString()
  notes!: string;
}
