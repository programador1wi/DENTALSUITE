import { PaymentMethodType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreatePaymentMethodDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsEnum(PaymentMethodType)
  type!: PaymentMethodType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  retentionPercent?: number;

  @IsOptional() @IsBoolean() allowsRefund?: boolean;
  @IsOptional() @IsBoolean() acceptsMultipleSettlements?: boolean;
  @IsOptional() @IsBoolean() requiresReference?: boolean;
  @IsOptional() @IsBoolean() requiresFinancialInstitution?: boolean;
  @IsOptional() @IsString() @MaxLength(20) fiscalCode?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() includeInCollectionReports?: boolean;
  @IsOptional() @IsBoolean() includeInPhysicalCashBalance?: boolean;
  @IsOptional() @IsBoolean() includeInCashFlowReports?: boolean;
  @IsOptional() @IsBoolean() includeInClosingSummary?: boolean;
  @IsOptional() @IsBoolean() includeInGraphicalReports?: boolean;
}
