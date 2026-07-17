import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export const PATIENT_BENEFIT_COVERAGE_TYPES = [
  "INSURANCE",
  "AGREEMENT",
  "PAYROLL_BENEFIT",
  "CORPORATE_BENEFIT",
  "MEMBERSHIP",
  "OTHER"
] as const;

export const PATIENT_BENEFIT_COVERAGE_STATUSES = [
  "DRAFT",
  "PENDING_VALIDATION",
  "VALIDATING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "EXPIRED",
  "REJECTED",
  "REQUIRES_DOCUMENTS",
  "INTEGRATION_ERROR",
  "CANCELLED"
] as const;

export const COVERAGE_VALIDATION_MODES = ["AUTOMATIC", "MANUAL", "DOCUMENTAL", "MIXED"] as const;

export type PatientBenefitCoverageTypeDto = (typeof PATIENT_BENEFIT_COVERAGE_TYPES)[number];
export type PatientBenefitCoverageStatusDto = (typeof PATIENT_BENEFIT_COVERAGE_STATUSES)[number];
export type CoverageValidationModeDto = (typeof COVERAGE_VALIDATION_MODES)[number];

export class CreatePatientBenefitCoverageDto {
  @IsEnum(PATIENT_BENEFIT_COVERAGE_TYPES)
  type!: PatientBenefitCoverageTypeDto;

  @IsString()
  @MinLength(2)
  providerName!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  agreementId?: string | null;

  @IsOptional()
  @IsString()
  planName?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  affiliateNumber?: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsString()
  holderDocument?: string;

  @IsOptional()
  @IsString()
  relationshipToPatient?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coveragePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  copayAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductibleAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualLimitAmount?: number;

  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsEnum(PATIENT_BENEFIT_COVERAGE_STATUSES)
  status?: PatientBenefitCoverageStatusDto;
}

export class UpdatePatientBenefitCoverageDto {
  @IsOptional()
  @IsEnum(PATIENT_BENEFIT_COVERAGE_TYPES)
  type?: PatientBenefitCoverageTypeDto;

  @IsOptional()
  @IsString()
  @MinLength(2)
  providerName?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  agreementId?: string | null;

  @IsOptional()
  @IsString()
  planName?: string;

  @IsOptional()
  @IsString()
  policyNumber?: string;

  @IsOptional()
  @IsString()
  affiliateNumber?: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsString()
  holderDocument?: string;

  @IsOptional()
  @IsString()
  relationshipToPatient?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coveragePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  copayAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductibleAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualLimitAmount?: number;

  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsEnum(PATIENT_BENEFIT_COVERAGE_STATUSES)
  status?: PatientBenefitCoverageStatusDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedVersion?: number;
}

export class CoverageNormalizedResultDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsString()
  beneficiaryName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coveragePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  copayAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductibleAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualLimitAmount?: number;

  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @IsOptional()
  @IsString()
  exclusions?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class ValidatePatientInsuranceDto {
  @IsString()
  coverageId!: string;

  @IsOptional()
  @IsEnum(COVERAGE_VALIDATION_MODES)
  mode?: CoverageValidationModeDto;

  @IsOptional()
  @IsEnum(PATIENT_BENEFIT_COVERAGE_STATUSES)
  status?: PatientBenefitCoverageStatusDto;

  @IsOptional()
  @IsString()
  providerName?: string;

  @IsOptional()
  @IsString()
  externalIdentifier?: string;

  @IsOptional()
  @IsObject()
  requestSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  responseSnapshot?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoverageNormalizedResultDto)
  normalizedResult?: CoverageNormalizedResultDto;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class AttachPatientCoverageDocumentDto {
  @IsString()
  fileAttachmentId!: string;

  @IsString()
  @MinLength(2)
  category!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PatientCoverageStatusReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PatientEligibleCoveragesQueryDto {
  @IsOptional()
  @IsString()
  treatmentPlanId?: string;
}
