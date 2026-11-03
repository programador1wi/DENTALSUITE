import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  BulkDiscountTreatmentPlanItemsDto,
  ChangeTreatmentPlanBranchDto,
  CreateOrthodonticDiagnosisOptionDto,
  CreateOrthodonticOptionDto,
  CreateAlternativeDto,
  PauseTreatmentPlanDto,
  PrintTreatmentPlanDocumentDto,
  OrthodonticEvolutionsQueryDto,
  CreateBudgetDto,
  CreateOrthodonticMonthlyItemsDto,
  CreateTreatmentPlanDto,
  ListBudgetsQueryDto,
  ListTreatmentPlansQueryDto,
  SaveOrthodonticDiagnosisDto,
  SortOrthodonticDiagnosisOptionsDto,
  TreatmentPlanSectionInputDto,
  UpdateOrthodonticDiagnosisOptionDto,
  UpdateOrthodonticDiagnosisDto,
  SortOrthodonticOptionsDto,
  UpdateOrthodonticProfileDto,
  UpdateOrthodonticOptionDto,
  UpdateTreatmentPlanDto,
  UpdateTreatmentPlanItemDto,
  UpdateTreatmentPlanItemStatusDto,
  StartOrthodonticTreatmentDto,
  ReactivateTreatmentPlanDto,
  DeactivateTreatmentPlanDto,
  DuplicateTreatmentPlanDto,
  ReferTreatmentPlanDto,
  RepriceTreatmentPlanDto,
  TreatmentPlanPricePreviewDto
} from "./dto/treatment-plan.dto";
import { TreatmentPlansService } from "./treatment-plans.service";

@ApiTags("Treatment Plans")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Get("treatment-plans")
  @RequirePermissions("treatment_plans.read")
  listTreatmentPlans(@CurrentUser() actor: AuthUser, @Query() query: ListTreatmentPlansQueryDto) {
    return this.service.listTreatmentPlans(actor, query);
  }

  @Post("treatment-plans")
  @RequirePermissions("treatment_plans.create")
  createTreatmentPlan(@CurrentUser() actor: AuthUser, @Body() dto: CreateTreatmentPlanDto) {
    return this.service.createTreatmentPlan(actor, dto);
  }

  @Get("orthodontic-option-fields")
  @RequirePermissions("treatment_plans.read")
  listOrthodonticOptionFields(@CurrentUser() actor: AuthUser) {
    return this.service.listOrthodonticOptionFields(actor);
  }

  @Post("orthodontic-option-fields/:fieldId/options")
  @RequirePermissions("orthodontic_catalogs.manage")
  createOrthodonticFieldOption(
    @CurrentUser() actor: AuthUser,
    @Param("fieldId") fieldId: string,
    @Body() dto: CreateOrthodonticOptionDto
  ) {
    return this.service.createOrthodonticFieldOption(actor, fieldId, dto);
  }

  @Patch("orthodontic-field-options/:optionId")
  @RequirePermissions("orthodontic_catalogs.manage")
  updateOrthodonticFieldOption(
    @CurrentUser() actor: AuthUser,
    @Param("optionId") optionId: string,
    @Body() dto: UpdateOrthodonticOptionDto
  ) {
    return this.service.updateOrthodonticFieldOption(actor, optionId, dto);
  }

  @Post("orthodontic-field-options/:optionId/deactivate")
  @RequirePermissions("orthodontic_catalogs.manage")
  deactivateOrthodonticFieldOption(
    @CurrentUser() actor: AuthUser,
    @Param("optionId") optionId: string,
    @Body() dto: UpdateOrthodonticOptionDto
  ) {
    return this.service.deactivateOrthodonticFieldOption(actor, optionId, dto.deactivationReason);
  }

  @Post("orthodontic-field-options/:optionId/reactivate")
  @RequirePermissions("orthodontic_catalogs.manage")
  reactivateOrthodonticFieldOption(@CurrentUser() actor: AuthUser, @Param("optionId") optionId: string) {
    return this.service.reactivateOrthodonticFieldOption(actor, optionId);
  }

  @Put("orthodontic-option-fields/:fieldId/sort")
  @RequirePermissions("orthodontic_catalogs.manage")
  sortOrthodonticFieldOptions(
    @CurrentUser() actor: AuthUser,
    @Param("fieldId") fieldId: string,
    @Body() dto: SortOrthodonticOptionsDto
  ) {
    return this.service.sortOrthodonticFieldOptions(actor, fieldId, dto);
  }

  @Get("orthodontic-diagnosis-catalog")
  @RequirePermissions("orthodontic_diagnosis.read")
  listOrthodonticDiagnosisCatalog(@CurrentUser() actor: AuthUser) {
    return this.service.listOrthodonticDiagnosisCatalog(actor);
  }

  @Post("orthodontic-diagnosis-fields/:fieldId/options")
  @RequirePermissions("orthodontic_diagnosis.catalogs.manage")
  createOrthodonticDiagnosisFieldOption(
    @CurrentUser() actor: AuthUser,
    @Param("fieldId") fieldId: string,
    @Body() dto: CreateOrthodonticDiagnosisOptionDto
  ) {
    return this.service.createOrthodonticDiagnosisFieldOption(actor, fieldId, dto);
  }

  @Patch("orthodontic-diagnosis-field-options/:optionId")
  @RequirePermissions("orthodontic_diagnosis.catalogs.manage")
  updateOrthodonticDiagnosisFieldOption(
    @CurrentUser() actor: AuthUser,
    @Param("optionId") optionId: string,
    @Body() dto: UpdateOrthodonticDiagnosisOptionDto
  ) {
    return this.service.updateOrthodonticDiagnosisFieldOption(actor, optionId, dto);
  }

  @Post("orthodontic-diagnosis-field-options/:optionId/deactivate")
  @RequirePermissions("orthodontic_diagnosis.catalogs.manage")
  deactivateOrthodonticDiagnosisFieldOption(
    @CurrentUser() actor: AuthUser,
    @Param("optionId") optionId: string,
    @Body() dto: UpdateOrthodonticDiagnosisOptionDto
  ) {
    return this.service.deactivateOrthodonticDiagnosisFieldOption(actor, optionId, dto.deactivationReason);
  }

  @Post("orthodontic-diagnosis-field-options/:optionId/reactivate")
  @RequirePermissions("orthodontic_diagnosis.catalogs.manage")
  reactivateOrthodonticDiagnosisFieldOption(
    @CurrentUser() actor: AuthUser,
    @Param("optionId") optionId: string
  ) {
    return this.service.reactivateOrthodonticDiagnosisFieldOption(actor, optionId);
  }

  @Put("orthodontic-diagnosis-fields/:fieldId/sort")
  @RequirePermissions("orthodontic_diagnosis.catalogs.manage")
  sortOrthodonticDiagnosisFieldOptions(
    @CurrentUser() actor: AuthUser,
    @Param("fieldId") fieldId: string,
    @Body() dto: SortOrthodonticDiagnosisOptionsDto
  ) {
    return this.service.sortOrthodonticDiagnosisFieldOptions(actor, fieldId, dto);
  }

  @Get("treatment-plans/:id")
  @RequirePermissions("treatment_plans.read")
  getTreatmentPlan(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getTreatmentPlan(actor, id);
  }

  @Get("treatment-plans/:id/financial-summary")
  @RequirePermissions("treatment_plans.read")
  getFinancialSummary(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getFinancialSummary(actor, id);
  }

  @Patch("treatment-plans/:id")
  @RequirePermissions("treatment_plans.update")
  updateTreatmentPlan(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateTreatmentPlanDto
  ) {
    return this.service.updateTreatmentPlan(actor, id, dto);
  }

  @Patch("treatment-plans/:id/orthodontics/profile")
  @RequirePermissions("treatment_plans.update")
  updateOrthodonticProfile(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateOrthodonticProfileDto
  ) {
    return this.service.updateOrthodonticProfile(actor, id, dto);
  }

  @Get("treatment-plans/:id/orthodontics/diagnosis/status")
  @RequirePermissions("orthodontic_diagnosis.read")
  getOrthodonticDiagnosisStatus(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getOrthodonticDiagnosisStatus(actor, id);
  }

  @Get("treatment-plans/:id/orthodontics/diagnosis")
  @RequirePermissions("orthodontic_diagnosis.read")
  getOrthodonticDiagnosis(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getOrthodonticDiagnosis(actor, id);
  }

  @Post("treatment-plans/:id/orthodontics/diagnosis/draft")
  @RequirePermissions("orthodontic_diagnosis.draft")
  saveOrthodonticDiagnosisDraft(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: SaveOrthodonticDiagnosisDto
  ) {
    return this.service.saveOrthodonticDiagnosisDraft(actor, id, dto);
  }

  @Post("treatment-plans/:id/orthodontics/diagnosis")
  @RequirePermissions("orthodontic_diagnosis.create")
  saveOrthodonticDiagnosisActive(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: SaveOrthodonticDiagnosisDto
  ) {
    return this.service.saveOrthodonticDiagnosisActive(actor, id, dto);
  }

  @Patch("treatment-plans/:id/orthodontics/diagnosis")
  @RequirePermissions("treatment_plans.update")
  updateOrthodonticDiagnosis(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateOrthodonticDiagnosisDto
  ) {
    return this.service.updateOrthodonticDiagnosis(actor, id, dto);
  }

  @Get("treatment-plans/:id/orthodontics/summary")
  @RequirePermissions("treatment_plans.read")
  getOrthodonticSummary(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getOrthodonticSummary(actor, id);
  }

  @Get("treatment-plans/:id/orthodontics/evolutions")
  @RequirePermissions("clinical.read")
  listOrthodonticEvolutions(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query() query: OrthodonticEvolutionsQueryDto
  ) {
    return this.service.listOrthodonticEvolutions(actor, id, query);
  }

  @Post("treatment-plans/:id/orthodontics/start")
  @RequirePermissions("treatment_plans.status.update")
  startOrthodonticTreatment(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: StartOrthodonticTreatmentDto
  ) {
    return this.service.startOrthodonticTreatment(actor, id, dto);
  }

  @Post("treatment-plans/:id/orthodontics/monthly-items")
  @RequirePermissions("treatment_plans.update")
  createOrthodonticMonthlyItems(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateOrthodonticMonthlyItemsDto
  ) {
    return this.service.createOrthodonticMonthlyItems(actor, id, dto);
  }

  @Post("treatment-plans/:id/change-branch")
  @RequirePermissions("patients.update", "treatment_plans.update")
  changeBranch(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ChangeTreatmentPlanBranchDto
  ) {
    return this.service.changeBranch(actor, id, dto);
  }

  @Post("treatment-plans/:id/sections")
  @RequirePermissions("treatment_plans.update")
  addSection(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: TreatmentPlanSectionInputDto
  ) {
    return this.service.addSection(actor, id, dto);
  }

  @Post("treatment-plans/:id/alternatives")
  @RequirePermissions("treatment_plans.alternatives.manage")
  createAlternative(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateAlternativeDto
  ) {
    return this.service.createAlternative(actor, id, dto);
  }

  @Post("treatment-plans/:id/alternatives/:alternativeId/activate")
  @RequirePermissions("treatment_plans.alternatives.manage")
  activateAlternative(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Param("alternativeId") alternativeId: string
  ) {
    return this.service.activateAlternative(actor, id, alternativeId);
  }

  @Post("treatment-plans/:id/items")
  @RequirePermissions("treatment_plans.update")
  addItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdateTreatmentPlanItemDto) {
    return this.service.addItem(actor, id, dto);
  }

  @Post("treatment-plans/:id/price-preview")
  @RequirePermissions("treatment_plans.read")
  pricePreview(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: TreatmentPlanPricePreviewDto
  ) {
    return this.service.pricePreview(actor, id, dto);
  }

  @Get("treatment-plans/:id/price-catalog")
  @RequirePermissions("treatment_plans.read")
  priceCatalog(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query("clinicalDate") clinicalDate?: string
  ) {
    return this.service.priceCatalog(actor, id, clinicalDate);
  }

  @Post("treatment-plans/:id/reprice-preview")
  @RequirePermissions("treatment_plans.read")
  repricePreview(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: RepriceTreatmentPlanDto
  ) {
    return this.service.repricePreview(actor, id, dto);
  }

  @Post("treatment-plans/:id/reprice-apply")
  @RequirePermissions("treatment_plans.update")
  repriceApply(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: RepriceTreatmentPlanDto
  ) {
    return this.service.repriceApply(actor, id, dto);
  }

  @Get("treatment-plans/:id/procedures")
  @RequirePermissions("treatment_plans.read")
  getProcedures(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getProcedures(actor, id);
  }

  @Patch("treatment-plans/:id/items/bulk-discount")
  @RequirePermissions("treatment_plans.update", "treatment_discount.apply")
  applyBulkDiscount(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: BulkDiscountTreatmentPlanItemsDto
  ) {
    return this.service.applyBulkDiscount(actor, id, dto);
  }

  @Post("treatment-plans/:id/print")
  @RequirePermissions("budgets.print")
  printTreatmentPlanDocument(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: PrintTreatmentPlanDocumentDto
  ) {
    return this.service.printTreatmentPlanDocument(actor, id, dto);
  }

  @Get("treatment-plans/:id/print-options")
  @RequirePermissions("treatment_plans.read")
  getTreatmentPlanPrintOptions(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getTreatmentPlanPrintOptions(actor, id);
  }

  @Post("treatment-plans/:id/documents/preview")
  @RequirePermissions("treatment_plans.read")
  previewTreatmentPlanDocument(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: PrintTreatmentPlanDocumentDto
  ) {
    return this.service.previewTreatmentPlanDocument(actor, id, dto);
  }

  @Post("treatment-plans/:id/documents")
  @RequirePermissions("treatment_plans.read")
  generateTreatmentPlanDocument(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: PrintTreatmentPlanDocumentDto
  ) {
    return this.service.printTreatmentPlanDocument(actor, id, dto);
  }

  @Patch("treatment-plans/:id/items/:itemId")
  @RequirePermissions("treatment_plans.update")
  updateItem(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateTreatmentPlanItemDto
  ) {
    return this.service.updateItem(actor, id, itemId, dto);
  }

  @Patch("treatment-plans/:id/items/:itemId/status")
  @RequirePermissions("treatment_plans.status.update")
  updateItemStatus(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateTreatmentPlanItemStatusDto
  ) {
    return this.service.updateItemStatus(actor, id, itemId, dto);
  }

  @Delete("treatment-plans/:id/items/:itemId")
  @RequirePermissions("treatment_plans.update")
  deleteItem(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.service.deleteItem(actor, id, itemId);
  }

  @Post("treatment-plans/:id/budgets")
  @RequirePermissions("budgets.create")
  createBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateBudgetDto) {
    return this.service.createBudget(actor, id, dto);
  }

  @Get("budgets")
  @RequirePermissions("budgets.read")
  listBudgets(@CurrentUser() actor: AuthUser, @Query() query: ListBudgetsQueryDto) {
    return this.service.listBudgets(actor, query);
  }

  @Get("budgets/:id")
  @RequirePermissions("budgets.read")
  getBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getBudget(actor, id);
  }

  @Post("budgets/:id/send")
  @RequirePermissions("budgets.send")
  sendBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.sendBudget(actor, id);
  }

  @Post("budgets/:id/accept")
  @RequirePermissions("budgets.accept")
  acceptBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.acceptBudget(actor, id);
  }

  @Post("budgets/:id/reject")
  @RequirePermissions("budgets.reject")
  rejectBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.rejectBudget(actor, id);
  }

  @Post("budgets/:id/print")
  @RequirePermissions("budgets.print")
  printBudget(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.printBudget(actor, id);
  }

  @Post("treatment-plans/:id/reactivate")
  @RequirePermissions("treatment_plans.status.update")
  reactivateTreatmentPlan(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReactivateTreatmentPlanDto
  ) {
    return this.service.reactivateTreatmentPlan(actor, id, dto);
  }

  @Post("treatment-plans/:id/deactivate")
  @RequirePermissions("treatment_plans.status.update")
  deactivateTreatmentPlan(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: DeactivateTreatmentPlanDto
  ) {
    return this.service.deactivateTreatmentPlan(actor, id, dto);
  }

  @Post("treatment-plans/:id/duplicate")
  @RequirePermissions("treatment_plans.create")
  duplicateTreatmentPlan(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: DuplicateTreatmentPlanDto
  ) {
    return this.service.duplicateTreatmentPlan(actor, id, dto);
  }

  @Post("treatment-plans/:id/refer")
  @RequirePermissions("treatment_plans.update")
  referTreatmentPlan(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReferTreatmentPlanDto
  ) {
    return this.service.referTreatmentPlan(actor, id, dto);
  }

  @Post("treatment-plans/:id/pause")
  @RequirePermissions("treatment_plans.update")
  pauseTreatmentPlan(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: PauseTreatmentPlanDto
  ) {
    return this.service.pauseTreatment(actor, id, dto);
  }

  @Post("treatment-plans/:id/resume")
  @RequirePermissions("treatment_plans.update")
  resumeTreatmentPlan(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.resumeTreatment(actor, id);
  }
}
