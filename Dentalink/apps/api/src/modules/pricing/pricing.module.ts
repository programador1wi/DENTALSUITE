import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AdminPriceListsController, PricingController } from "./pricing.controller";
import { PricingService } from "./pricing.service";

@Module({
  imports: [PrismaModule],
  controllers: [PricingController, AdminPriceListsController],
  providers: [PricingService],
  exports: [PricingService]
})
export class PricingModule {}
