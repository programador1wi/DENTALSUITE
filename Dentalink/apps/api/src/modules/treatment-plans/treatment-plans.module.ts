import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { TreatmentPlansController } from "./treatment-plans.controller";
import { TreatmentPlansService } from "./treatment-plans.service";
import { PricingModule } from "../pricing/pricing.module";
import { OrthodonticsModule } from "../orthodontics/orthodontics.module";
import { DiscountPoliciesModule } from "../discount-policies/discount-policies.module";
import { TreatmentPlanFinancialSummaryService } from "./treatment-plan-financial-summary.service";
import { TreatmentPlanOrthodonticsService } from "./treatment-plan-orthodontics.service";
import { TreatmentPlanPricingService } from "./treatment-plan-pricing.service";
import { CrmTasksModule } from "../crm-tasks/crm-tasks.module";

@Module({
  imports: [PrismaModule, PricingModule, OrthodonticsModule, DiscountPoliciesModule, CrmTasksModule],
  controllers: [TreatmentPlansController],
  providers: [
    TreatmentPlansService,
    TreatmentPlanFinancialSummaryService,
    TreatmentPlanOrthodonticsService,
    TreatmentPlanPricingService
  ],
  exports: [
    TreatmentPlansService,
    TreatmentPlanFinancialSummaryService,
    TreatmentPlanOrthodonticsService,
    TreatmentPlanPricingService
  ]
})
export class TreatmentPlansModule {}
