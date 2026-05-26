import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { PaymentMethodsController } from "./payment-methods.controller";
import { PaymentMethodsService } from "./payment-methods.service";

@Module({
  imports: [PrismaModule],
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService]
})
export class PaymentMethodsModule {}
