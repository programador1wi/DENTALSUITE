import { IsBoolean, IsString, IsArray, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';

export class UpdateOnlineSchedulingDto {
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsEnum(['ONLINE', 'EXPRESS'])
  @IsOptional()
  mode?: 'ONLINE' | 'EXPRESS';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedBranches?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedProfessionals?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedSpecialties?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedMotives?: string[];

  @IsEnum(['EMAIL', 'PHONE', 'DOCUMENT'])
  @IsOptional()
  identificationMethod?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredPatientFields?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  securityMarginHours?: number;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  blocksPerAppointment?: number;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  maxDaysInAdvance?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUnvalidatedAppointmentsPerPatient?: number;

  @IsString()
  @IsOptional()
  brandColor?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  footerText?: string;

  @IsString()
  @IsOptional()
  googleAnalyticsId?: string;

  @IsString()
  @IsOptional()
  redirectUrl?: string;

  @IsString()
  @IsOptional()
  confirmationMessage?: string;

  @IsBoolean()
  @IsOptional()
  patientBlockEnabled?: boolean;

  @IsString()
  @IsOptional()
  chairScope?: string;

  @IsString()
  @IsOptional()
  facebookPixel?: string;

  @IsBoolean()
  @IsOptional()
  menuByProfessional?: boolean;

  @IsBoolean()
  @IsOptional()
  menuBySpecialty?: boolean;

  @IsBoolean()
  @IsOptional()
  menuByBranch?: boolean;

  @IsString()
  @IsOptional()
  patientDataMoment?: string;

  @IsBoolean()
  @IsOptional()
  askSpecialtyReason?: boolean;

  @IsBoolean()
  @IsOptional()
  showAppointmentDuration?: boolean;
}
