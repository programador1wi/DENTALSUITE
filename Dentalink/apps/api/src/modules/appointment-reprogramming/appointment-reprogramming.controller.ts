import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { AvailabilityQueryDto } from "../appointments/dto/appointment-actions.dto";
import { AppointmentReprogrammingService } from "./appointment-reprogramming.service";
import {
  CreateMassReprogrammingBatchDto,
  DefinitivelyCancelReprogrammingCaseDto,
  ListReprogrammingCasesQueryDto,
  PreviewMassReprogrammingDto,
  RescheduleAppointmentCaseDto
} from "./dto/appointment-reprogramming.dto";

@ApiTags("Agenda reprogramming")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("agenda/reprogramming")
export class AppointmentReprogrammingController {
  constructor(private readonly service: AppointmentReprogrammingService) {}

  @Post("batches/preview")
  @RequirePermissions("agenda.reprogramming.mass_cancel")
  preview(@CurrentUser() actor: AuthUser, @Body() dto: PreviewMassReprogrammingDto) {
    return this.service.preview(actor, dto);
  }

  @Post("batches")
  @RequirePermissions("agenda.reprogramming.mass_cancel")
  createBatch(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateMassReprogrammingBatchDto,
    @Headers("idempotency-key") idempotencyKey: string
  ) {
    return this.service.createBatch(actor, dto, idempotencyKey);
  }

  @Get("batches/:batchId")
  @RequirePermissions("agenda.reprogramming.view")
  getBatch(@CurrentUser() actor: AuthUser, @Param("batchId") batchId: string) {
    return this.service.getBatch(actor, batchId);
  }

  @Post("batches/:batchId/retry")
  @RequirePermissions("agenda.reprogramming.mass_cancel")
  retryBatch(@CurrentUser() actor: AuthUser, @Param("batchId") batchId: string) {
    return this.service.retryFailedBatchItems(actor, batchId);
  }

  @Get("cases")
  @RequirePermissions("agenda.reprogramming.view")
  listCases(@CurrentUser() actor: AuthUser, @Query() query: ListReprogrammingCasesQueryDto) {
    return this.service.listCases(actor, query);
  }

  @Get("cases/:caseId")
  @RequirePermissions("agenda.reprogramming.view")
  getCase(@CurrentUser() actor: AuthUser, @Param("caseId") caseId: string) {
    return this.service.getCase(actor, caseId);
  }

  @Get("availability")
  @RequirePermissions("agenda.reprogramming.reschedule")
  availability(@CurrentUser() actor: AuthUser, @Query() query: AvailabilityQueryDto) {
    return this.service.availability(actor, query);
  }

  @Post("cases/:caseId/reschedule")
  @RequirePermissions("agenda.reprogramming.reschedule")
  rescheduleCase(
    @CurrentUser() actor: AuthUser,
    @Param("caseId") caseId: string,
    @Body() dto: RescheduleAppointmentCaseDto
  ) {
    return this.service.rescheduleCase(actor, caseId, dto);
  }

  @Post("cases/:caseId/cancel-definitively")
  @RequirePermissions("agenda.reprogramming.definitive_cancel")
  definitivelyCancelCase(
    @CurrentUser() actor: AuthUser,
    @Param("caseId") caseId: string,
    @Body() dto: DefinitivelyCancelReprogrammingCaseDto
  ) {
    return this.service.definitivelyCancelCase(actor, caseId, dto);
  }
}
