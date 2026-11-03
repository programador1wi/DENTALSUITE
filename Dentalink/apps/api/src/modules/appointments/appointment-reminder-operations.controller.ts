import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { AppointmentReminderOperationsService } from "./appointment-reminder-operations.service";
import {
  AppointmentReminderOperationsQueryDto,
  ResolveAppointmentReminderDto,
  TestAppointmentReminderEmailDto,
  UpdateAppointmentReminderBranchPolicyDto,
  UpdateAppointmentReminderPolicyDto
} from "./dto/appointment-reminder-operations.dto";

@ApiTags("Appointment reminders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("appointments/reminder-operations")
export class AppointmentReminderOperationsController {
  constructor(private readonly operations: AppointmentReminderOperationsService) {}

  @Get()
  @RequirePermissions("appointments.read")
  list(@CurrentUser() user: AuthUser, @Query() query: AppointmentReminderOperationsQueryDto) {
    return this.operations.list(user, query);
  }

  @Post(":id/retry")
  @RequirePermissions("appointments.reminders.manage")
  retry(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.operations.retry(user, id);
  }

  @Post(":id/resolve")
  @RequirePermissions("appointments.reminders.manage")
  resolve(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ResolveAppointmentReminderDto
  ) {
    return this.operations.resolve(user, id, dto);
  }
}

@ApiTags("Appointment reminder settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("settings/appointment-reminders")
export class AppointmentReminderSettingsController {
  constructor(private readonly operations: AppointmentReminderOperationsService) {}

  @Get()
  @RequirePermissions("appointments.read")
  get(@CurrentUser() user: AuthUser) {
    return this.operations.getSettings(user);
  }

  @Put()
  @RequirePermissions("appointments.reminders.manage")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateAppointmentReminderPolicyDto) {
    return this.operations.updateSettings(user, dto);
  }

  @Put("branches/:branchId")
  @RequirePermissions("appointments.reminders.manage")
  updateBranch(
    @CurrentUser() user: AuthUser,
    @Param("branchId") branchId: string,
    @Body() dto: UpdateAppointmentReminderBranchPolicyDto
  ) {
    return this.operations.updateBranchSettings(user, branchId, dto);
  }

  @Post("test-email")
  @RequirePermissions("appointments.reminders.manage")
  test(@CurrentUser() user: AuthUser, @Body() dto: TestAppointmentReminderEmailDto) {
    return this.operations.testEmail(user, dto.to);
  }
}
