import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class BranchPriceListAssignmentDto {
  @IsString()
  branchId!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsIn(["BASE", "POLIZA", "ADICIONAL"])
  type?: "BASE" | "POLIZA" | "ADICIONAL";

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateBranchPriceListsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchPriceListAssignmentDto)
  assignments!: BranchPriceListAssignmentDto[];
}
