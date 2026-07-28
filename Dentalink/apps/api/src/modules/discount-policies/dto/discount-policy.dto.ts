import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

export class ListUserDiscountPoliciesQueryDto {
  @IsOptional()
  search?: string;

  @IsOptional()
  @IsIn(["WITH_PERMISSION", "WITHOUT_PERMISSION", "ALL"])
  permission?: "WITH_PERMISSION" | "WITHOUT_PERMISSION" | "ALL";

  @IsOptional()
  @IsIn(["true", "false", "all"])
  active?: "true" | "false" | "all";
}

export class UpsertUserDiscountPolicyDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maximumDiscountPercent!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
