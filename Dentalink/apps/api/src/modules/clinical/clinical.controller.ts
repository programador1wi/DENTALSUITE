import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { ClinicalService } from "./clinical.service";
import {
  CreateAllergyDto,
  CreateMedicalConditionDto,
  CreateMedicationDto,
  UpsertMedicalHistoryDto
} from "./dto/medical-history.dto";
import {
  CreateClinicalEvolutionAddendumDto,
  CreateClinicalEvolutionDto,
  UpdateClinicalEvolutionDto,
  ListEvolutionsQueryDto,
  AnnulClinicalEvolutionDto
} from "./dto/clinical-evolution.dto";
import { CreatePrescriptionDto } from "./dto/prescription.dto";
import {
  CreateClinicalDocumentDto,
  CreateClinicalDocumentFromTemplateDto,
  CreateClinicalDocumentTemplateDto,
  DeleteClinicalDocumentDto
} from "./dto/clinical-document.dto";
import {
  ComparePeriodontalChartsQueryDto,
  CreatePeriodontalChartDto,
  CreateToothConditionDto,
  CreateToothProcedureDto,
  ListOdontogramQueryDto,
  UpdateToothProcedureStatusDto
} from "./dto/odontogram.dto";

@ApiTags("Clinical")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("patients/:patientId/clinical")
export class ClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  @Get("history")
  @RequirePermissions("clinical.read")
  history(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string) {
    return this.clinicalService.getClinicalSummary(user, patientId);
  }

  @Get("appointment-history")
  @RequirePermissions("clinical.read")
  appointmentHistory(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string) {
    return this.clinicalService.listAppointmentHistory(user, patientId);
  }

  @Put("history")
  @RequirePermissions("clinical.history.update")
  upsertHistory(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: UpsertMedicalHistoryDto) {
    return this.clinicalService.upsertHistory(user, patientId, dto);
  }

  @Post("conditions")
  @RequirePermissions("clinical.history.update")
  createCondition(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateMedicalConditionDto) {
    return this.clinicalService.createCondition(user, patientId, dto);
  }

  @Post("allergies")
  @RequirePermissions("clinical.history.update")
  createAllergy(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateAllergyDto) {
    return this.clinicalService.createAllergy(user, patientId, dto);
  }

  @Post("medications")
  @RequirePermissions("clinical.history.update")
  createMedication(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateMedicationDto) {
    return this.clinicalService.createMedication(user, patientId, dto);
  }

  @Get("evolutions")
  @RequirePermissions("clinical.read")
  evolutions(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Query() query: ListEvolutionsQueryDto) {
    return this.clinicalService.listEvolutions(user, patientId, query);
  }

  @Post("evolutions")
  @RequirePermissions("clinical.evolutions.create")
  createEvolution(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateClinicalEvolutionDto) {
    return this.clinicalService.createEvolution(user, patientId, dto);
  }

  @Patch("evolutions/:evolutionId")
  @RequirePermissions("clinical.evolutions.create")
  updateEvolution(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Param("evolutionId") evolutionId: string,
    @Body() dto: UpdateClinicalEvolutionDto
  ) {
    return this.clinicalService.updateEvolution(user, patientId, evolutionId, dto);
  }

  @Post("evolutions/:evolutionId/sign")
  @RequirePermissions("clinical.evolutions.sign")
  signEvolution(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Param("evolutionId") evolutionId: string) {
    return this.clinicalService.signEvolution(user, patientId, evolutionId);
  }

  @Post("evolutions/:evolutionId/annul")
  @RequirePermissions("clinical.evolutions.sign")
  annulEvolution(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Param("evolutionId") evolutionId: string, @Body() dto: AnnulClinicalEvolutionDto) {
    return this.clinicalService.annulEvolution(user, patientId, evolutionId, dto);
  }

  @Post("evolutions/:evolutionId/addendum")
  @RequirePermissions("clinical.evolutions.create")
  createAddendum(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Param("evolutionId") evolutionId: string,
    @Body() dto: CreateClinicalEvolutionAddendumDto
  ) {
    return this.clinicalService.createEvolutionAddendum(user, patientId, evolutionId, dto);
  }

  @Get("prescriptions")
  @RequirePermissions("clinical.read")
  prescriptions(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string) {
    return this.clinicalService.listPrescriptions(user, patientId);
  }

  @Post("prescriptions")
  @RequirePermissions("clinical.prescriptions.create")
  createPrescription(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreatePrescriptionDto) {
    return this.clinicalService.createPrescription(user, patientId, dto);
  }

  @Get("prescriptions/:prescriptionId/print")
  @RequirePermissions("clinical.read")
  printPrescription(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Param("prescriptionId") prescriptionId: string) {
    return this.clinicalService.printPrescription(user, patientId, prescriptionId);
  }

  @Patch("prescriptions/:prescriptionId/status")
  @RequirePermissions("clinical.prescriptions.create")
  updatePrescriptionStatus(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Param("prescriptionId") prescriptionId: string,
    @Body("status") status: string
  ) {
    return this.clinicalService.updatePrescriptionStatus(user, patientId, prescriptionId, status);
  }

  @Get("documents")
  @RequirePermissions("clinical.read")
  documents(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string) {
    return this.clinicalService.listDocuments(user, patientId);
  }

  @Post("documents")
  @RequirePermissions("clinical.documents.create")
  createDocument(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateClinicalDocumentDto) {
    return this.clinicalService.createDocument(user, patientId, dto);
  }

  @Delete("documents/:documentId")
  @RequirePermissions("clinical.documents.manage")
  deleteDocument(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Param("documentId") documentId: string,
    @Body() dto: DeleteClinicalDocumentDto
  ) {
    return this.clinicalService.deleteClinicalDocument(user, patientId, documentId, dto.reason);
  }

  @Post("documents/from-template")
  @RequirePermissions("clinical.documents.create")
  createDocumentFromTemplate(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Body() dto: CreateClinicalDocumentFromTemplateDto
  ) {
    return this.clinicalService.createDocumentFromTemplate(user, patientId, dto);
  }

  @Get("document-templates")
  @RequirePermissions("clinical.read")
  templates(@CurrentUser() user: AuthUser) {
    return this.clinicalService.listTemplates(user);
  }

  @Post("document-templates")
  @RequirePermissions("clinical.templates.manage")
  createTemplate(@CurrentUser() user: AuthUser, @Body() dto: CreateClinicalDocumentTemplateDto) {
    return this.clinicalService.createTemplate(user, dto);
  }

  @Get("odontogram")
  @RequirePermissions("clinical.odontogram.read")
  odontogram(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Query() query: ListOdontogramQueryDto
  ) {
    return this.clinicalService.listOdontogram(user, patientId, query);
  }

  @Get("odontogram/history/:toothNumber")
  @RequirePermissions("clinical.odontogram.read")
  toothHistory(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Param("toothNumber") toothNumber: string) {
    return this.clinicalService.getToothHistory(user, patientId, toothNumber);
  }

  @Post("odontogram/conditions")
  @RequirePermissions("clinical.odontogram.write")
  createToothCondition(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateToothConditionDto) {
    return this.clinicalService.createToothCondition(user, patientId, dto);
  }

  @Patch("odontogram/records/:odontogramRecordId/cancel")
  @RequirePermissions("clinical.odontogram.write")
  cancelOdontogramRecord(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Param("odontogramRecordId") odontogramRecordId: string
  ) {
    return this.clinicalService.cancelOdontogramRecord(user, patientId, odontogramRecordId);
  }

  @Post("odontogram/procedures")
  @RequirePermissions("clinical.odontogram.write")
  createToothProcedure(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreateToothProcedureDto) {
    return this.clinicalService.createToothProcedure(user, patientId, dto);
  }

  @Patch("odontogram/procedures/:toothProcedureId/status")
  @RequirePermissions("clinical.odontogram.write")
  updateToothProcedureStatus(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Param("toothProcedureId") toothProcedureId: string,
    @Body() dto: UpdateToothProcedureStatusDto
  ) {
    return this.clinicalService.updateToothProcedureStatus(user, patientId, toothProcedureId, dto);
  }

  @Get("periodontogram")
  @RequirePermissions("clinical.periodontogram.read")
  periodontogram(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string) {
    return this.clinicalService.listPeriodontalCharts(user, patientId);
  }

  @Post("periodontogram")
  @RequirePermissions("clinical.periodontogram.write")
  createPeriodontogram(@CurrentUser() user: AuthUser, @Param("patientId") patientId: string, @Body() dto: CreatePeriodontalChartDto) {
    return this.clinicalService.createPeriodontalChart(user, patientId, dto);
  }

  @Get("periodontogram/compare")
  @RequirePermissions("clinical.periodontogram.read")
  comparePeriodontograms(
    @CurrentUser() user: AuthUser,
    @Param("patientId") patientId: string,
    @Query() query: ComparePeriodontalChartsQueryDto
  ) {
    return this.clinicalService.comparePeriodontalCharts(user, patientId, query);
  }
}
