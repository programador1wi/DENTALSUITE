import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ReportsAnalyticsService } from "./reports-analytics.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsAnalyticsService, ReportsService],
  exports: [ReportsAnalyticsService, ReportsService]
})
export class ReportsModule {}
