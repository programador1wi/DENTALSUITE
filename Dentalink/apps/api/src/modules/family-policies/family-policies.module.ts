import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { FamilyPoliciesController } from "./family-policies.controller";
import { FamilyPoliciesService } from "./family-policies.service";

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [FamilyPoliciesController],
  providers: [FamilyPoliciesService],
  exports: [FamilyPoliciesService]
})
export class FamilyPoliciesModule {}
