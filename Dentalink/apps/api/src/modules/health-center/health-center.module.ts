import { Module } from "@nestjs/common";
import { BranchesModule } from "../branches/branches.module";
import { PrismaModule } from "../../database/prisma.module";
import { BrandsController, HealthCenterController } from "./health-center.controller";
import { HealthCenterService } from "./health-center.service";

@Module({
  imports: [PrismaModule, BranchesModule],
  controllers: [HealthCenterController, BrandsController],
  providers: [HealthCenterService]
})
export class HealthCenterModule {}
