import {
  CurrencyCode,
  FamilyPolicyStatus,
  PolicyCoverageType,
  PolicyModality,
} from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsBoolean,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class ListPatientPoliciesQueryDto {
  @IsOptional()
  @IsEnum(FamilyPolicyStatus)
  status?: FamilyPolicyStatus;

  @IsOptional()
  @IsEnum(PolicyModality)
  type?: PolicyModality;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  includeHistory?: boolean;
}

export class CreatePolicyProductCoverageDto {
  @IsOptional()
  @IsString()
  procedureId?: string;

  @IsOptional()
  @IsString()
  procedureCategoryId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEnum(PolicyCoverageType)
  coverageType!: PolicyCoverageType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  coverageValue!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  copayAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  annualAmountLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  annualUseLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  waitingPeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  exclusions?: string;
}

export class CreateFamilyPolicyDto {
  @IsString()
  policyProductId!: string;

  @IsOptional()
  @IsString()
  familyGroupId?: string;

  @IsString()
  holderPatientId!: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  memberPatientIds!: string[];

  @IsDateString()
  effectiveFrom!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  contractedPrice!: number;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;
}

export class ReplaceFamilyPolicyMembersDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  memberPatientIds!: string[];
}

export class AddFamilyPolicyMemberDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relationship?: string;
}

export class RemoveFamilyPolicyMemberDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class RegisterFamilyPolicyPaymentDto {
  @IsString()
  paymentMethodId!: string;

  @IsOptional()
  @IsString()
  financialInstitutionId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;
}

export class CancelFamilyPolicyDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class SimulateFamilyPolicyCoverageDto {
  @IsString()
  patientId!: string;

  @IsString()
  treatmentPlanItemId!: string;
}

export class ApplyFamilyPolicyCoverageDto extends SimulateFamilyPolicyCoverageDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizationCode?: string;
}

export class ReverseFamilyPolicyUsageDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
