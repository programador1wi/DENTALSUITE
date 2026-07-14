import { IsDateString, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class PublicAvailabilityQueryDto {
  @IsNotEmpty()
  @IsString()
  branchId!: string;

  @IsNotEmpty()
  @IsString()
  professionalId!: string;

  @IsNotEmpty()
  @IsDateString()
  date!: string;
}

export class PublicPatientDto {
  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @IsNotEmpty()
  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}

export class PublicCreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  branchId!: string;

  @IsNotEmpty()
  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsString()
  motive?: string;

  @IsNotEmpty()
  @IsDateString()
  startAt!: string;

  @IsNotEmpty()
  @IsObject()
  patient!: PublicPatientDto;

  @IsOptional()
  @IsString()
  campaignCode?: string;
}

export class PublicPatientProfileDto {
    firstName!: string;
    lastName!: string;
    email?: string | null;
    phone?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    alternatePhone?: string | null;
    address?: {
        street?: string | null;
        city?: string | null;
        state?: string | null;
    } | null;
}

export class UpdatePublicPatientProfileDto {
    @IsOptional() @IsString() firstName?: string;
    @IsOptional() @IsString() lastName?: string;
    @IsOptional() @IsString() email?: string;
    @IsOptional() @IsString() phone?: string;
    @IsOptional() @IsString() documentType?: string;
    @IsOptional() @IsString() documentNumber?: string;
    @IsOptional() @IsDateString() birthDate?: string;
    @IsOptional() @IsString() gender?: string;
    @IsOptional() @IsString() alternatePhone?: string;
    @IsOptional() @IsObject() address?: {
        street?: string;
        city?: string;
        state?: string;
    };
    @IsNotEmpty() privacyNoticeAccepted!: boolean;
}