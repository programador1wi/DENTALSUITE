import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  AnalyticsReportQueryDto,
  BaseReportQueryDto,
  CreateExcelReportRequestDto,
  GenerateChartReportDto,
  ProfessionalsReportQueryDto,
  chartReportTypes
} from "./dto/reports.dto";
import { ReportsAnalyticsService } from "./reports-analytics.service";
import { ReportsService } from "./reports.service";
import { ReportRequestsService } from "./report-requests.service";
import { PriceListReportService } from "./price-list-report.service";

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("reports.read")
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly analytics: ReportsAnalyticsService,
    private readonly requests: ReportRequestsService,
    private readonly priceListReport: PriceListReportService
  ) {}

  @Get("performance")
  performance(@CurrentUser() actor: AuthUser, @Query() query: AnalyticsReportQueryDto) {
    return this.analytics.getPerformanceDashboard(actor, query);
  }

  @Get("charts/catalog")
  chartsCatalog() {
    return this.analytics.getChartsCatalog();
  }

  @Post("charts/:type/generate")
  generateChart(@CurrentUser() actor: AuthUser, @Param("type") type: string, @Body() body: GenerateChartReportDto) {
    if (!chartReportTypes.includes(type as (typeof chartReportTypes)[number])) {
      throw new BadRequestException("Unsupported chart report");
    }
    return this.analytics.generateChartReport(actor, type as (typeof chartReportTypes)[number], body);
  }

  @Get("excel/catalog")
  excelCatalog(@CurrentUser() actor: AuthUser, @Query("surface") surface?: "REQUEST" | "PERIOD") {
    return this.service.getExcelCatalog(actor, surface);
  }

  @Post("excel/requests")
  @HttpCode(202)
  @RequirePermissions("reports.read", "reports.export")
  excelRequest(@CurrentUser() actor: AuthUser, @Body() body: CreateExcelReportRequestDto) {
    return this.requests.create(actor, body);
  }

  @Get("excel/options/price-lists")
  @RequirePermissions("reports.read", "reports.export", "price_list.export")
  priceListOptions(@CurrentUser() actor: AuthUser, @Query("branchId") branchId: string) {
    return this.priceListReport.options(actor, branchId);
  }

  @Get("excel/requests")
  excelRequests(
    @CurrentUser() actor: AuthUser,
    @Query() query: { status?: string; category?: string; search?: string; page?: number; pageSize?: number }
  ) {
    return this.requests.list(actor, query);
  }

  @Get("excel/requests/:id")
  excelRequestDetail(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.requests.get(actor, id);
  }

  @Get("excel/reports/:code/latest")
  latestExcelRequest(@CurrentUser() actor: AuthUser, @Param("code") code: string) {
    return this.requests.latest(actor, code);
  }

  @Get("excel/requests/:id/download")
  @RequirePermissions("reports.read", "reports.export")
  async downloadExcelRequest(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const file = await this.requests.download(actor, id);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    return new StreamableFile(file.bytes);
  }

  @Get("dashboard")
  dashboard(@CurrentUser() actor: AuthUser, @Query() query: BaseReportQueryDto) {
    return this.service.getDashboard(actor, query);
  }

  @Get("appointments")
  appointments(@CurrentUser() actor: AuthUser, @Query() query: BaseReportQueryDto) {
    return this.service.getAppointmentsReport(actor, query);
  }

  @Get("patients")
  patients(@CurrentUser() actor: AuthUser, @Query() query: BaseReportQueryDto) {
    return this.service.getPatientsReport(actor, query);
  }

  @Get("treatments")
  treatments(@CurrentUser() actor: AuthUser, @Query() query: BaseReportQueryDto) {
    return this.service.getTreatmentsReport(actor, query);
  }

  @Get("financial")
  financial(@CurrentUser() actor: AuthUser, @Query() query: BaseReportQueryDto) {
    return this.service.getFinancialReport(actor, query);
  }

  @Get("professionals")
  professionals(@CurrentUser() actor: AuthUser, @Query() query: ProfessionalsReportQueryDto) {
    return this.service.getProfessionalsReport(actor, query);
  }
}
