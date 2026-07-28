import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CashDiscountsModule } from "../cash-discounts/cash-discounts.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [PrismaModule, NotificationsModule, CashDiscountsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
