import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(["CASH", "CARD", "TRANSFER", "DEPOSIT", "ONLINE", "CREDIT", "OTHER"])
  type?: "CASH" | "CARD" | "TRANSFER" | "DEPOSIT" | "ONLINE" | "CREDIT" | "OTHER";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
