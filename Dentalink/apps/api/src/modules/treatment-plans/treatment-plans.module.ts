import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { TreatmentPlansController } from "./treatment-plans.controller";
import { TreatmentPlansService } from "./treatment-plans.service";
import { PricingModule } from "../pricing/pricing.module";

@Module({
  imports: [PrismaModule, PricingModule],
  controllers: [TreatmentPlansController],
  providers: [TreatmentPlansService],
  exports: [TreatmentPlansService]
})
export class TreatmentPlansModule {}
