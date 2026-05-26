import { IsBoolean, IsOptional, IsString } from "class-validator";

export class AddPatientAlertDto {
  @IsString()
  type!: string;

  @IsString()
  description!: string;

  @IsString()
  severity!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
