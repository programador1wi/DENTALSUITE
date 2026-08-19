import { Body, Controller, Get, Param, Post, Query, UseGuards, StreamableFile, Res } from "@nestjs/common";
import { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { OrthodonticsService } from "./orthodontics.service";

@ApiTags("Orthodontics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("orthodontics")
export class OrthodonticsController {
  constructor(private readonly orthodonticsService: OrthodonticsService) {}

  @Get("patients-report")
  @RequirePermissions("patients.read")
  getPatientsReport(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.orthodonticsService.getPatientsReport(user, query);
  }

  @Get("patients-report/summary")
  @RequirePermissions("patients.read")
  getPatientsReportSummary(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.orthodonticsService.getPatientsReportSummary(user, query);
  }

  @Get("patients-report/export")
  @RequirePermissions("patients.read")
  async exportPatientsReport(@CurrentUser() user: AuthUser, @Query() query: any, @Res({ passthrough: true }) res: Response) {
    const csvStream = await this.orthodonticsService.exportPatientsReportStream(user, query);
    
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="reporte-ortodoncia.csv"',
    });
    
    return new StreamableFile(csvStream);
  }

  @Post("treatments/:id/appointment-draft")
  @RequirePermissions("treatment_plans.update")
  createAppointmentDraft(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: any
  ) {
    return this.orthodonticsService.createAppointmentDraft(user, id, dto);
  }

  @Post("treatments/:id/recalculate-progress")
  @RequirePermissions("treatment_plans.update")
  recalculateProgress(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.orthodonticsService.recalculateProgress(user, id);
  }
}
