import { CurrencyCode } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

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
