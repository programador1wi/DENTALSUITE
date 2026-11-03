import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CashDiscountsModule } from "../cash-discounts/cash-discounts.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

import { PaymentCashRegisterService } from "./payment-cash-register.service";

@Module({
  imports: [PrismaModule, NotificationsModule, CashDiscountsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentCashRegisterService],
  exports: [PaymentsService, PaymentCashRegisterService]
})
export class PaymentsModule {}
