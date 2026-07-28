import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { DiscountAuthorizationService } from "./discount-authorization.service";
import { DiscountPoliciesController } from "./discount-policies.controller";
import { DiscountPoliciesService } from "./discount-policies.service";

@Module({
  imports: [PrismaModule],
  controllers: [DiscountPoliciesController],
  providers: [DiscountPoliciesService, DiscountAuthorizationService],
  exports: [DiscountAuthorizationService]
})
export class DiscountPoliciesModule {}
