import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { AppointmentQueryDto } from "./dto/appointment-query.dto";
import {
  AppointmentStatusReasonDto,
  AvailabilityQueryDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto
} from "./dto/appointment-actions.dto";
import { CreateAppointmentNoteDto } from "./dto/appointment-note.dto";
import { CreateAppointmentReminderDto, UpdateAppointmentReminderDto } from "./dto/appointment-reminder.dto";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto, CreateAppointmentsBatchDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { AttendanceAnalyticsService } from "./domain/services/attendance-analytics.service";

@ApiTags("Appointments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("appointments")
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly attendanceAnalyticsService: AttendanceAnalyticsService
  ) {}

  @Get("patient/:patientId/attendance-stats")
  @RequirePermissions("appointments.read")
  getPatientAttendanceStats(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string) {
    return this.attendanceAnalyticsService.getPatientAttendanceStats(patientId, user.organizationId);
  }

  @Get()
  @RequirePermissions("appointments.read")
  findAll(@CurrentUser() user: AuthUser, @Query() query: AppointmentQueryDto) {
    return this.appointmentsService.findAll(user, query);
  }

  @Get("availability")
  @RequirePermissions("appointments.read")
  availability(@CurrentUser() user: AuthUser, @Query() query: AvailabilityQueryDto) {
    return this.appointmentsService.availability(user, query);
  }

  @Get("reasons")
  @RequirePermissions("appointments.read")
  listReasonSuggestions(@CurrentUser() user: AuthUser, @Query("specialtyId") specialtyId?: string) {
    return this.appointmentsService.listReasonSuggestions(user, specialtyId);
  }

  @Post()
  @RequirePermissions("appointments.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user, dto);
  }

  @Post("batch")
  @RequirePermissions("appointments.create")
  createBatch(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentsBatchDto) {
    return this.appointmentsService.createBatch(user, dto);
  }

  @Get(":id/notes")
  @RequirePermissions("appointments.read")
  listNotes(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.listNotes(user, id);
  }

  @Post(":id/notes")
  @RequirePermissions("appointments.update")
  addNote(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateAppointmentNoteDto) {
    return this.appointmentsService.addNote(user, id, dto);
  }

  @Get(":id/reminders")
  @RequirePermissions("appointments.read")
  listReminders(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.listReminders(user, id);
  }

  @Post(":id/reminders")
  @RequirePermissions("appointments.update")
  createReminder(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateAppointmentReminderDto) {
    return this.appointmentsService.createReminder(user, id, dto);
  }

  @Patch(":id/reminders/:reminderId")
  @RequirePermissions("appointments.update")
  updateReminder(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("reminderId") reminderId: string,
    @Body() dto: UpdateAppointmentReminderDto
  ) {
    return this.appointmentsService.updateReminder(user, id, reminderId, dto);
  }

  @Get(":id")
  @RequirePermissions("appointments.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.findOne(user, id);
  }

  @Patch(":id")
  @RequirePermissions("appointments.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.update(user, id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions("appointments.status.update")
  updateStatus(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.appointmentsService.changeAppointmentStatus(user, id, dto.status, dto.reason);
  }

  @Delete(":id")
  @RequirePermissions("appointments.cancel")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.remove(user, id);
  }

  @Post(":id/confirm")
  @RequirePermissions("appointments.status.update")
  confirm(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointmentsService.confirm(user, id);
  }

  @Post(":id/cancel")
  @RequirePermissions("appointments.cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CancelAppointmentDto) {
    return this.appointmentsService.cancel(user, id, dto);
  }

  @Post(":id/reschedule")
  @RequirePermissions("appointments.update")
  reschedule(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(user, id, dto);
  }

  @Post(":id/arrive")
  @RequirePermissions("appointments.status.update")
  arrive(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AppointmentStatusReasonDto) {
    return this.appointmentsService.arrive(user, id, dto);
  }

  @Post(":id/waiting-room")
  @RequirePermissions("appointments.status.update")
  waitingRoom(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AppointmentStatusReasonDto) {
    return this.appointmentsService.waitingRoom(user, id, dto);
  }

  @Post(":id/start")
  @RequirePermissions("appointments.status.update")
  start(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AppointmentStatusReasonDto) {
    return this.appointmentsService.start(user, id, dto);
  }

  @Post(":id/complete")
  @RequirePermissions("appointments.status.update")
  complete(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AppointmentStatusReasonDto) {
    return this.appointmentsService.complete(user, id, dto);
  }

  @Post(":id/no-show")
  @RequirePermissions("appointments.status.update")
  noShow(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AppointmentStatusReasonDto) {
    return this.appointmentsService.noShow(user, id, dto);
  }
}
