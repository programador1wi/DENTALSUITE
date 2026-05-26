import { IsIn, IsString } from "class-validator";

export class CreatePaymentMethodDto {
  @IsString()
  name!: string;

  @IsString()
  @IsIn(["CASH", "CARD", "TRANSFER", "DEPOSIT", "ONLINE", "CREDIT", "OTHER"])
  type!: "CASH" | "CARD" | "TRANSFER" | "DEPOSIT" | "ONLINE" | "CREDIT" | "OTHER";
}
