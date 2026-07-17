import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MinLength, ValidateNested } from "class-validator";

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
  @MinLength(2)
  firstName!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s()-]{7,40}$/)
  phone?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;
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
  @ValidateNested()
  @Type(() => PublicPatientDto)
  patient!: PublicPatientDto;

  @IsOptional()
  @IsString()
  identitySessionId?: string;

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
    @IsNotEmpty() @IsBoolean() privacyNoticeAccepted!: boolean;
}

export class PublicIdentityResolveDto {
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => PublicPatientDto)
  patient!: PublicPatientDto;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class PublicIdentityVerifyDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() documentNumber?: string;
}

export class PublicIdentitySelectDto {
  @IsNotEmpty() @IsString() patientId!: string;
  @IsOptional() @IsString() familyGroupId?: string;
}
