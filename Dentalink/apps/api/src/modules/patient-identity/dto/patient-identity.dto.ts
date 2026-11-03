import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { AppointmentStatus, AttendanceMode } from "@prisma/client";

export const CONTACT_ROLES = [
  "PERSONAL",
  "SHARED_FAMILY",
  "GUARDIAN",
  "AUTHORIZED_BOOKER",
  "NOTIFICATION_ONLY"
] as const;
export const FAMILY_ROLES = [
  "GROUP_OWNER",
  "GROUP_MANAGER",
  "GUARDIAN",
  "ADULT_MEMBER",
  "DEPENDENT_ADULT",
  "MINOR",
  "AUTHORIZED_BOOKER"
] as const;
export const CONSENT_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "REVOKED"] as const;

export class NormalizePhoneDto {
  @IsString()
  @MinLength(7)
  @MaxLength(40)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}

export class LinkPatientPhoneDto extends NormalizePhoneDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsIn(CONTACT_ROLES)
  role?: (typeof CONTACT_ROLES)[number];

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveReminders?: boolean;

  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  consentStatus?: (typeof CONSENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  familyGroupId?: string;
}

export class VerifyContactPointDto {
  @IsIn(["OTP", "PROVIDER_CALLBACK", "MANUAL_REVIEW"])
  method!: "OTP" | "PROVIDER_CALLBACK" | "MANUAL_REVIEW";

  @IsIn(["VERIFIED", "FAILED", "EXPIRED"])
  outcome!: "VERIFIED" | "FAILED" | "EXPIRED";

  @IsOptional() @IsString() @MaxLength(80) provider?: string;
  @IsOptional() @IsString() @MaxLength(160) providerEventId?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class EndContactLinkDto {
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class TransferContactLinkDto extends EndContactLinkDto {
  @IsString() toPatientId!: string;
  @IsOptional() @IsIn(CONTACT_ROLES) role?: (typeof CONTACT_ROLES)[number];
}

export class CreateFamilyGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  ownerPatientId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NormalizePhoneDto)
  primaryContact?: NormalizePhoneDto;
}

export class AddFamilyMemberDto {
  @IsString()
  patientId!: string;

  @IsIn(FAMILY_ROLES)
  role!: (typeof FAMILY_ROLES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  relationship?: string;

  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  consentStatus?: (typeof CONSENT_STATUSES)[number];
}

export class CreateFamilyMemberPatientDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  existingPatientId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  relationship!: string;

  @IsOptional()
  @IsIn(FAMILY_ROLES)
  role?: (typeof FAMILY_ROLES)[number];

  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  consentStatus?: (typeof CONSENT_STATUSES)[number];
}

export class UpdateFamilyMemberDto {
  @IsOptional()
  @IsIn(FAMILY_ROLES)
  role?: (typeof FAMILY_ROLES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  relationship?: string;

  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  consentStatus?: (typeof CONSENT_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class AddFamilyContactDto extends NormalizePhoneDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  actorPatientId?: string;
}

export class CreateFamilyGrantDto {
  @IsString()
  actorContactPointId!: string;

  @IsString()
  patientId!: string;

  @IsOptional()
  @IsBoolean()
  canBook?: boolean;

  @IsOptional()
  @IsBoolean()
  canReschedule?: boolean;

  @IsOptional()
  @IsBoolean()
  canCancel?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewAppointmentSummary?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewFinancialInformation?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewClinicalInformation?: boolean;

  @IsOptional()
  @IsBoolean()
  canSignConsents?: boolean;

  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  consentStatus?: (typeof CONSENT_STATUSES)[number];
}

export class DuplicateCheckDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  excludePatientId?: string;

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
  country?: string;
}

export class ReviewDuplicateCandidateDto {
  @IsIn(["CONFIRMED_DUPLICATE", "NOT_DUPLICATE", "DISMISSED"])
  status!: "CONFIRMED_DUPLICATE" | "NOT_DUPLICATE" | "DISMISSED";

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CreateBookingIdentitySessionDto extends NormalizePhoneDto {
  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  channelMessageId?: string;

  @IsOptional()
  @IsBoolean()
  channelVerified?: boolean;

  @IsOptional()
  @IsIn(["WHATSAPP_SESSION", "OTP", "PROVIDER_CALLBACK"])
  verificationMethod?: "WHATSAPP_SESSION" | "OTP" | "PROVIDER_CALLBACK";

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerEventId?: string;
}

export class VerifyBookingContactDto {
  @IsBoolean()
  verified!: boolean;

  @IsIn(["WHATSAPP_SESSION", "OTP", "PROVIDER_CALLBACK"])
  method!: "WHATSAPP_SESSION" | "OTP" | "PROVIDER_CALLBACK";

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  providerEventId?: string;
}

export class LookupBookingFamilyMemberDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;

  @IsDateString()
  birthDate!: string;
}

export class AddBookingFamilyMemberDto extends LookupBookingFamilyMemberDto {
  @IsOptional()
  @IsString()
  existingPatientId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  relationship!: string;
}

class BookingFamilyPersonDto {
  @IsOptional()
  @IsString()
  existingPatientId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  gender?: string;
}

export class BookingFamilyMemberInputDto extends BookingFamilyPersonDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  relationship!: string;
}

export class CreateBookingFamilyDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  groupName?: string;

  @ValidateNested()
  @Type(() => BookingFamilyPersonDto)
  responsible!: BookingFamilyPersonDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BookingFamilyMemberInputDto)
  members?: BookingFamilyMemberInputDto[];

  @IsOptional()
  @IsString()
  selectPatientId?: string;
}

export class VerifyBookingIdentityDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;
}

export class SelectBookingPatientDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  familyGroupId?: string;

  @IsOptional()
  @IsString()
  resolutionMethod?: string;
}

export class BookResolvedAppointmentDto {
  @IsString()
  branchId!: string;

  @IsString()
  professionalId!: string;

  @IsOptional()
  @IsString()
  chairId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  chairIndex?: number;

  @IsOptional()
  @IsEnum(AttendanceMode)
  attendanceMode?: AttendanceMode;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateIdentityConfigDto {
  @IsOptional() @IsBoolean() shadowMode?: boolean;
  @IsOptional() @IsBoolean() adminResolutionEnabled?: boolean;
  @IsOptional() @IsBoolean() publicBookingResolutionEnabled?: boolean;
  @IsOptional() @IsBoolean() whatsappResolutionEnabled?: boolean;
  @IsOptional() @IsBoolean() familyGroupsEnabled?: boolean;
  @IsOptional() @IsBoolean() safeMergeEnabled?: boolean;
  @IsOptional() @IsBoolean() legacyPhoneReadDisabled?: boolean;
  @IsOptional() @IsString() @MaxLength(2) defaultCountry?: string;
}

export class MergePreviewDto {
  @IsString()
  targetPatientId!: string;

  @IsString()
  sourcePatientId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class ExecuteMergeDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
