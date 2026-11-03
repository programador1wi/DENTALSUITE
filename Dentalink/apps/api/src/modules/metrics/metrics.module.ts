import { Module } from "@nestjs/common";
import { AppMetricsService } from "./app-metrics.service";
import { MetricsController } from "./metrics.controller";

@Module({
  controllers: [MetricsController],
  providers: [AppMetricsService],
  exports: [AppMetricsService]
})
export class MetricsModule {}
