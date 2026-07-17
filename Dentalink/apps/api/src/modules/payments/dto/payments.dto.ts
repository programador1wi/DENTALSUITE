import { Type } from "class-transformer";
import {
  CashMovementType,
  CurrencyCode,
  AuthorizationStatus,
  CoverageStatus,
  FinancialDocumentStatus,
  FinancialDocumentType,
  InstallmentFrequency,
  PaymentLinkStatus,
  PaymentStatus,
  RefundStatus
} from "@prisma/client";
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PaymentSplitInputDto {
  @IsString()
  paymentMethodId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a valid number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  financialInstitutionId?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class PaymentAllocationInputDto {
  @IsString()
  treatmentPlanItemId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a valid number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class InstallmentPlanItemAllocationDto {
  @IsString()
  treatmentPlanItemId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a valid number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class CreatePaymentDto {
  @IsString()
  branchId!: string;

  @IsString()
  patientId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a valid number with up to 2 decimal places' })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  financialInstitutionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitInputDto)
  splits?: PaymentSplitInputDto[];

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  allocations?: PaymentAllocationInputDto[];
}

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}

export class DailyReceiptQueryDto {
  @IsString()
  @MaxLength(10)
  date!: string;

  @IsString()
  branchId!: string;
}

export class ReceiptEmailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @MaxLength(180)
  subject!: string;

  @IsString()
  @MaxLength(6000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class AddPaymentAllocationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  allocations!: PaymentAllocationInputDto[];
}

export class UpdatePaymentDto {
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  financialInstitutionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class CreatePaymentLinkDto {
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ListPaymentLinksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsEnum(PaymentLinkStatus)
  status?: PaymentLinkStatus;
}

export class ListCancelledPendingPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(PaymentLinkStatus)
  linkStatus?: PaymentLinkStatus;
}

export class CreateInstallmentPlanDto {
  @IsString()
  patientId!: string;

  @IsString()
  treatmentPlanId!: string;

  @Type(() => Number)
  @IsPositive()
  totalAmount!: number;

  @Type(() => Number)
  @Min(0)
  downPayment!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfInstallments!: number;

  @IsOptional()
  @IsEnum(InstallmentFrequency)
  frequency?: InstallmentFrequency;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallmentPlanItemAllocationDto)
  itemAllocations?: InstallmentPlanItemAllocationDto[];
}

export class PayInstallmentDto {
  @IsString()
  branchId!: string;

  @IsString()
  paymentMethodId!: string;

  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListInstallmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  installmentPlanId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dueBefore?: string;
}

export class OpenCashRegisterDto {
  @IsString()
  branchId!: string;

  @Type(() => Number)
  @Min(0)
  openingAmount!: number;
}

export class CloseCashRegisterDto {
  @Type(() => Number)
  @Min(0)
  closingAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListCashRegistersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateCashMovementDto {
  @IsEnum(CashMovementType)
  type!: CashMovementType;

  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  expenseId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateRefundDto {
  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class VoidPaymentDto {
  @IsString()
  reason!: string;
}

export class ListAccountsReceivableQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ListRefundsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  treatmentPlanId?: string;

  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;
}

export class ListPatientFinancialDocumentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(FinancialDocumentType)
  type?: FinancialDocumentType;

  @IsOptional()
  @IsEnum(FinancialDocumentStatus)
  status?: FinancialDocumentStatus;
}

export class ListPatientCoverageCasesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CoverageStatus)
  status?: CoverageStatus;
}

export class ListPatientCoverageAuthorizationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AuthorizationStatus)
  status?: AuthorizationStatus;
}

export class CashReportQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class CashReportByProfessionalQueryDto extends CashReportQueryDto {
  @IsOptional()
  @IsString()
  professionalId?: string;
}
