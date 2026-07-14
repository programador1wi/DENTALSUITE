import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { AddPatientAlertDto } from "./dto/add-patient-alert.dto";
import { AddPatientNoteDto } from "./dto/add-patient-note.dto";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { MergePatientsDto } from "./dto/merge-patients.dto";
import { PatientAnalysisQueryDto } from "./dto/patient-analysis-query.dto";
import { ListPatientEmailsQueryDto, SendPatientEmailDto } from "./dto/patient-email.dto";
import { PatientQueryDto } from "./dto/patient-query.dto";
import { CreatePatientTaskDto, ListPatientTasksQueryDto, UpdatePatientTaskDto } from "./dto/patient-task.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { PatientsService } from "./patients.service";

@ApiTags("Patients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("patients")
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @RequirePermissions("patients.read")
  findAll(@CurrentUser() user: AuthUser, @Query() query: PatientQueryDto) {
    return this.patientsService.findAll(user, query);
  }

  @Get("search")
  @RequirePermissions("patients.read")
  search(
    @CurrentUser() user: AuthUser,
    @Query("q") q?: string,
    @Query("phone") phone?: string,
    @Query("email") email?: string,
    @Query("documentNumber") documentNumber?: string
  ) {
    return this.patientsService.search(user, q, phone, email, documentNumber);
  }

  @Get("analysis")
  @RequirePermissions("patients.read")
  analysis(@CurrentUser() user: AuthUser, @Query() query: PatientAnalysisQueryDto) {
    return this.patientsService.analysis(user, query);
  }

  @Get(":id/timeline")
  @RequirePermissions("patients.read")
  timeline(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.patientsService.timeline(user, id);
  }

  @Post()
  @RequirePermissions("patients.create")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(user, dto);
  }

  @Get(":id")
  @RequirePermissions("patients.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.patientsService.findOne(user, id);
  }

  @Get(":id/emails")
  @RequirePermissions("integrations.communications.read")
  listEmails(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query() query: ListPatientEmailsQueryDto) {
    return this.patientsService.listEmails(user, id, query);
  }

  @Get(":id/emails/:emailId")
  @RequirePermissions("integrations.communications.read")
  getEmail(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("emailId") emailId: string) {
    return this.patientsService.getEmail(user, id, emailId);
  }

  @Post(":id/emails")
  @RequirePermissions("integrations.communications.send")
  sendEmail(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: SendPatientEmailDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.patientsService.sendEmail(user, id, dto, idempotencyKey);
  }

  @Patch(":id")
  @RequirePermissions("patients.update")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(user, id, dto);
  }

  @Delete(":id")
  @RequirePermissions("patients.deactivate")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.patientsService.softDelete(user, id);
  }

  @Post(":id/notes")
  @RequirePermissions("patients.notes.create")
  addNote(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AddPatientNoteDto) {
    return this.patientsService.addNote(user, id, dto);
  }

  @Get(":id/tasks")
  @RequirePermissions("patients.tasks.read")
  listTasks(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query() query: ListPatientTasksQueryDto) {
    return this.patientsService.listTasks(user, id, query);
  }

  @Post(":id/tasks")
  @RequirePermissions("patients.tasks.create")
  createTask(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreatePatientTaskDto) {
    return this.patientsService.createTask(user, id, dto);
  }

  @Patch(":id/tasks/:taskId")
  @RequirePermissions("patients.tasks.update")
  updateTask(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdatePatientTaskDto
  ) {
    return this.patientsService.updateTask(user, id, taskId, dto);
  }

  @Post(":id/tasks/:taskId/complete")
  @RequirePermissions("patients.tasks.complete")
  completeTask(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("taskId") taskId: string) {
    return this.patientsService.completeTask(user, id, taskId);
  }

  @Post(":id/alerts")
  @RequirePermissions("patients.alerts.create")
  addAlert(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AddPatientAlertDto) {
    return this.patientsService.addAlert(user, id, dto);
  }

  @Post("merge")
  @RequirePermissions("patients.update")
  merge(@CurrentUser() user: AuthUser, @Body() dto: MergePatientsDto) {
    return this.patientsService.merge(user, dto);
  }
}
