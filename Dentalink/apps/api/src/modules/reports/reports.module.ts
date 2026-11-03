import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ReportsAnalyticsService } from "./reports-analytics.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { ReportRequestsService } from "./report-requests.service";
import { ReportStorageService } from "./report-storage.service";
import { ReportWorkerService } from "./report-worker.service";
import { PeriodReportProviderService } from "./period-report-provider.service";
import { PriceListReportService } from "./price-list-report.service";
import { StorageModule } from "../storage/storage.module";
import { StreamingReportExportService } from "./streaming-report-export.service";

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ReportsController],
  providers: [ReportsAnalyticsService, ReportsService, ReportRequestsService, ReportStorageService, ReportWorkerService, PeriodReportProviderService, PriceListReportService, StreamingReportExportService],
  exports: [ReportsAnalyticsService, ReportsService, ReportRequestsService]
})
export class ReportsModule {}
