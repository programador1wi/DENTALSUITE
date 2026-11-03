import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class PriceListItemInputDto {
  @IsString()
  procedureId!: string;

  @IsOptional()
  @IsString()
  priceListCategoryId?: string;

  @IsNumberString()
  price!: string;

  @IsOptional()
  @IsNumberString()
  labCost?: string;

  @IsOptional()
  @IsBoolean()
  allowsDiscount?: boolean;

  @IsOptional()
  @IsNumberString()
  maxDiscountPercent?: string;

  @IsOptional()
  @IsIn(["MXN", "USD", "EUR"])
  currency?: "MXN" | "USD" | "EUR";
}

export class CreatePriceListDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceListItemInputDto)
  items?: PriceListItemInputDto[];
}
