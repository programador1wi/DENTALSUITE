import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class PatientFieldConfigItemDto {
  @IsString()
  fieldKey!: string;

  @IsBoolean()
  newPatientPresent!: boolean;

  @IsBoolean()
  newPatientRequired!: boolean;

  @IsBoolean()
  appointmentPresent!: boolean;

  @IsBoolean()
  appointmentRequired!: boolean;

  @IsBoolean()
  onlineAgendaPresent!: boolean;

  @IsBoolean()
  onlineAgendaRequired!: boolean;

  @IsBoolean()
  checkInPresent!: boolean;

  @IsBoolean()
  checkInRequired!: boolean;

  @IsOptional()
  @IsBoolean()
  isSystemRequired?: boolean;
}

export class UpdatePatientFieldConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientFieldConfigItemDto)
  fields!: PatientFieldConfigItemDto[];
}
