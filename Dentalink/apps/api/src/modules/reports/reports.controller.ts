import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { BaseReportQueryDto, ProfessionalsReportQueryDto } from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("reports.read")
@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

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
