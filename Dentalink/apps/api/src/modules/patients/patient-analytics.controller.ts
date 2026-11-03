import { Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { PatientAnalysisDetailQueryDto, PatientAnalysisQueryDto } from "./dto/patient-analysis-query.dto";
import { PatientAnalyticsService } from "./patient-analytics.service";

@ApiTags("Patient analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("patient-analytics")
export class PatientAnalyticsController {
  constructor(private readonly analytics: PatientAnalyticsService) {}

  @Get("overview")
  @RequirePermissions("patient_analytics.read")
  overview(@CurrentUser() actor: AuthUser, @Query() query: PatientAnalysisQueryDto) {
    return this.analytics.overview(actor, query);
  }

  @Get("details/:metric")
  @RequirePermissions("patient_analytics.read")
  detail(
    @CurrentUser() actor: AuthUser,
    @Param("metric") metric: string,
    @Query() query: PatientAnalysisDetailQueryDto
  ) {
    return this.analytics.detail(actor, metric, query);
  }

  @Get("export/:metric")
  @RequirePermissions("patient_analytics.export")
  async export(
    @CurrentUser() actor: AuthUser,
    @Param("metric") metric: string,
    @Query() query: PatientAnalysisDetailQueryDto,
    @Res() response: Response
  ) {
    const csv = await this.analytics.exportCsv(actor, metric, query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="patient-analytics-${metric}-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    response.send(csv);
  }

  @Post("refresh")
  @RequirePermissions("patient_analytics.refresh")
  refresh(@CurrentUser() actor: AuthUser, @Query() query: PatientAnalysisQueryDto) {
    return this.analytics.refresh(actor, query);
  }
}
