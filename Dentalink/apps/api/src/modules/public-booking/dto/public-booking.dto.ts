import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested
} from "class-validator";

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

  @IsOptional() @IsString() socialName?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsOptional() @IsString() agreementId?: string;
  @IsOptional() @IsString() internalNumber?: string;

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

  @IsOptional() @IsString() sex?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() employer?: string;
  @IsOptional() @IsString() observations?: string;
  @IsOptional() @IsString() referredBy?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianSocialName?: string;
  @IsOptional() @IsString() guardianDocumentNumber?: string;
  @IsOptional() @IsString() guardianGender?: string;
  @IsOptional() @IsString() guardianRelationship?: string;
  @IsOptional() @IsString() guardianPhone?: string;
  @IsOptional() @IsEmail() guardianEmail?: string;
  @IsOptional() @IsObject() address?: {
    street?: string;
    city?: string;
    state?: string;
  };
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
  socialName?: string | null;
  lastName!: string;
  agreementId?: string | null;
  internalNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  birthDate?: string | null;
  sex?: string | null;
  gender?: string | null;
  alternatePhone?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
}

export class UpdatePublicPatientProfileDto {
  @IsOptional() @IsString() @MinLength(2) firstName?: string;
  @IsOptional() @IsString() socialName?: string;
  @IsOptional() @IsString() @MinLength(2) lastName?: string;
  @IsOptional() @IsString() agreementId?: string;
  @IsOptional() @IsString() internalNumber?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9\s()-]{7,40}$/) phone?: string;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() sex?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() employer?: string;
  @IsOptional() @IsString() observations?: string;
  @IsOptional() @IsString() referredBy?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianSocialName?: string;
  @IsOptional() @IsString() guardianDocumentNumber?: string;
  @IsOptional() @IsString() guardianGender?: string;
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
