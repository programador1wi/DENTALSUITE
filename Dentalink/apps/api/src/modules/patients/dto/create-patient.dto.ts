import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested
} from "class-validator";

const PATIENT_STATUSES = ["NEW", "ACTIVE", "IN_TREATMENT", "INACTIVE", "DEBTOR", "COMPLETED"] as const;

type PatientStatus = (typeof PATIENT_STATUSES)[number];

export class PatientContactInputDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;
}

export class PatientAddressInputDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;
}

export class PatientMedicalAlertInputDto {
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

export class CreatePatientDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  referredBy?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(PATIENT_STATUSES)
  status?: PatientStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientContactInputDto)
  contacts?: PatientContactInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PatientAddressInputDto)
  address?: PatientAddressInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatientMedicalAlertInputDto)
  medicalAlerts?: PatientMedicalAlertInputDto[];
}
