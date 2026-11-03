import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { DiscountPoliciesModule } from "../discount-policies/discount-policies.module";
import { CashDiscountsController } from "./cash-discounts.controller";
import { CashDiscountsService } from "./cash-discounts.service";

@Module({
  imports: [PrismaModule, DiscountPoliciesModule],
  controllers: [CashDiscountsController],
  providers: [CashDiscountsService],
  exports: [CashDiscountsService]
})
export class CashDiscountsModule {}
