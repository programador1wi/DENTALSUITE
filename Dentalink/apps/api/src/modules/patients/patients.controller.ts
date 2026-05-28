import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
import { PatientQueryDto } from "./dto/patient-query.dto";
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
