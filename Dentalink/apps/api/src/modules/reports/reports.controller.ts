import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("reports.read")
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly analytics: ReportsAnalyticsService
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
  excelCatalog(@CurrentUser() actor: AuthUser) {
    return this.service.getExcelCatalog(actor);
  }

  @Post("excel/requests")
  excelRequest(@CurrentUser() actor: AuthUser, @Body() body: CreateExcelReportRequestDto) {
    return this.service.createExcelRequest(actor, body);
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
