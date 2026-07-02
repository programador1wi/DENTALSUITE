import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";

export class BulkProfessionalContractTargetDto {
  @IsString()
  professionalId!: string;

  @IsArray()
  @IsString({ each: true })
  branchIds!: string[];
}

export class BulkProfessionalContractCategoryRateDto {
  @IsString()
  procedureCategoryId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;
}

export class BulkProfessionalContractDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkProfessionalContractTargetDto)
  targets!: BulkProfessionalContractTargetDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate!: number;

  @IsIn(["clinical", "lab", "all"])
  commissionBase!: "clinical" | "lab" | "all";

  @IsIn(["no", "yes", "fixed"])
  paymentDiscount!: "no" | "yes" | "fixed";

  @IsIn(["no_due_date", "on_due", "thirty_days"])
  paymentCondition!: "no_due_date" | "on_due" | "thirty_days";

  @IsIn(["performed_and_paid", "performed"])
  contractType!: "performed_and_paid" | "performed";

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkProfessionalContractCategoryRateDto)
  categoryRates?: BulkProfessionalContractCategoryRateDto[];

  @IsOptional()
  @IsBoolean()
  removeOtherBranches?: boolean;

  @IsOptional()
  @IsBoolean()
  keepPrevious?: boolean;
}
