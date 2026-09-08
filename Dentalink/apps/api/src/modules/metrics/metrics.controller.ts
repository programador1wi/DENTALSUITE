import { Controller, Get, Header, Headers, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import { Public } from "../../common/decorators/public.decorator";
import { AppMetricsService } from "./app-metrics.service";

@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metrics: AppMetricsService,
    private readonly config: ConfigService
  ) {}

  @Public()
  @Get()
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  get(@Headers("authorization") authorization?: string) {
    const expected = this.config.get<string>("METRICS_BEARER_TOKEN");
    const received = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!expected || !this.matches(received, expected)) {
      throw new UnauthorizedException("Invalid metrics token");
    }
    return this.metrics.renderPrometheus();
  }

  private matches(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    return (
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  }
}
