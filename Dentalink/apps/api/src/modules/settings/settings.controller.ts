import { Body, Controller, Get, GoneException, Param, ParseIntPipe, Patch, Post, Put, Delete, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  AssignAgreementPatientsDto,
  AssignAgreementTreatmentPlanDto,
  CreateAgreementDto,
  CreateExpenseDto,
  FinalizePayrollDto,
  RecalculatePayrollDto,
  UpdateExpenseDto,
  UpdateAgreementDto,
  VoidExpenseDto,
  PublishAgreementDto,
  PreviewAgreementPriceDto
} from "./dto/admin-workflows.dto";
import {
  CreateFinancialInstitutionDto,
  UpdateFinancialInstitutionDto
} from "./dto/financial-institution.dto";
import { UpdateGeneralSettingsDto } from "./dto/update-general-settings.dto";
import { UpsertBrandDto } from "./dto/upsert-brand.dto";
import { SettingsService } from "./settings.service";

@ApiTags("Settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("general")
  @RequirePermissions("settings.read")
  getGeneral(@CurrentUser() user: AuthUser) {
    return this.settingsService.getGeneral(user);
  }

  @Get("organization")
  @RequirePermissions("settings.read")
  getOrganization(@CurrentUser() user: AuthUser) {
    return this.settingsService.getGeneral(user);
  }

  @Patch("general")
  @RequirePermissions("settings.update")
  updateGeneral(@CurrentUser() user: AuthUser, @Body() dto: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneral(user, dto);
  }

  @Patch("organization")
  @RequirePermissions("settings.update")
  updateOrganization(@CurrentUser() user: AuthUser, @Body() dto: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneral(user, dto);
  }

  @Get("financial-institutions")
  @RequirePermissions("settings.read")
  listFinancialInstitutions(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.settingsService.listFinancialInstitutions(user, search, active, page, pageSize);
  }

  @Post("financial-institutions")
  @RequirePermissions("settings.update")
  createFinancialInstitution(@CurrentUser() user: AuthUser, @Body() dto: CreateFinancialInstitutionDto) {
    return this.settingsService.createFinancialInstitution(user, dto);
  }

  @Patch("financial-institutions/:id")
  @RequirePermissions("settings.update")
  updateFinancialInstitution(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateFinancialInstitutionDto
  ) {
    return this.settingsService.updateFinancialInstitution(user, id, dto);
  }

  @Patch("financial-institutions/:id/deactivate")
  @RequirePermissions("settings.update")
  deactivateFinancialInstitution(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.deactivateFinancialInstitution(user, id);
  }

  @Delete("financial-institutions/:id")
  @RequirePermissions("settings.update")
  deleteFinancialInstitution(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.deleteFinancialInstitution(user, id);
  }

  @Get("brands")
  @RequirePermissions("settings.read")
  listBrands(@CurrentUser() user: AuthUser) {
    return this.settingsService.listBrands(user);
  }

  @Post("brands")
  @RequirePermissions("settings.update")
  createBrand(@CurrentUser() user: AuthUser, @Body() dto: UpsertBrandDto) {
    return this.settingsService.upsertBrand(user, undefined, dto);
  }

  @Put("brands/:id")
  @RequirePermissions("settings.update")
  updateBrand(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpsertBrandDto) {
    return this.settingsService.upsertBrand(user, id, dto);
  }

  @Delete("brands/:id")
  @RequirePermissions("settings.update")
  deleteBrand(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.deleteBrand(user, id);
  }

  @Get("agreements")
  @RequirePermissions("settings.read")
  listAgreements(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("active") active?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.settingsService.listAgreements(user, search, active, page, pageSize);
  }

  @Get("agreements/debts")
  @RequirePermissions("settings.read")
  listAgreementDebts(@CurrentUser() user: AuthUser) {
    return this.settingsService.listAgreementDebts(user);
  }

  @Get("agreements/:id")
  @RequirePermissions("agreements.read")
  getAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.getAgreement(user, id);
  }

  @Post("agreements")
  @RequirePermissions("agreements.manage")
  createAgreement(@CurrentUser() user: AuthUser, @Body() dto: CreateAgreementDto) {
    return this.settingsService.createAgreement(user, dto);
  }

  @Patch("agreements/:id")
  @RequirePermissions("agreements.manage")
  updateAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAgreementDto) {
    return this.settingsService.updateAgreement(user, id, dto);
  }

  @Patch("agreements/:id/deactivate")
  @RequirePermissions("agreements.manage")
  deactivateAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.deactivateAgreement(user, id);
  }

  @Post("agreements/:id/versions")
  @RequirePermissions("agreements.manage")
  createAgreementVersion(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateAgreementDto
  ) {
    return this.settingsService.createAgreementVersion(user, id, dto);
  }

  @Post("agreements/:id/publish")
  @RequirePermissions("agreements.publish")
  publishAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PublishAgreementDto) {
    return this.settingsService.publishAgreement(user, id, dto.version);
  }

  @Post("agreements/:id/cancel")
  @RequirePermissions("agreements.manage")
  cancelAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.cancelAgreement(user, id);
  }

  @Get("agreements/:id/preview")
  @RequirePermissions("agreements.read")
  previewAgreementPrice(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query() dto: PreviewAgreementPriceDto
  ) {
    return this.settingsService.previewAgreementPrice(user, id, dto);
  }

  @Post("agreements/:id/duplicate")
  @RequirePermissions("agreements.manage")
  duplicateAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.duplicateAgreement(user, id);
  }

  @Post("agreements/:id/pay-debt")
  @RequirePermissions("settings.update")
  payAgreementDebt() {
    throw new GoneException(
      "Usa POST /agreements/:agreementId/payments para registrar y aplicar pagos empresariales"
    );
  }

  @Post("agreements/:id/patients")
  @RequirePermissions("agreements.assign")
  assignAgreementPatients(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AssignAgreementPatientsDto
  ) {
    return this.settingsService.assignAgreementPatients(user, id, dto);
  }

  @Post("agreements/:id/treatment-plans")
  @RequirePermissions("agreements.assign")
  assignAgreementTreatmentPlan(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AssignAgreementTreatmentPlanDto
  ) {
    return this.settingsService.assignAgreementTreatmentPlan(user, id, dto.treatmentPlanId);
  }

  @Get("expenses")
  @RequirePermissions("expenses.read")
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("branchId") branchId?: string,
    @Query("month", new ParseIntPipe({ optional: true })) month?: number,
    @Query("year", new ParseIntPipe({ optional: true })) year?: number,
    @Query("status") status?: string,
    @Query("categoryId") categoryId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.settingsService.listExpenses(
      user,
      search,
      branchId,
      month,
      year,
      page,
      pageSize,
      status,
      categoryId
    );
  }

  @Get("expenses/summary")
  @RequirePermissions("expenses.read")
  getExpenseSummary(
    @CurrentUser() user: AuthUser,
    @Query("branchId") branchId?: string,
    @Query("month", new ParseIntPipe({ optional: true })) month?: number,
    @Query("year", new ParseIntPipe({ optional: true })) year?: number
  ) {
    return this.settingsService.getExpenseSummary(user, branchId, month, year);
  }

  @Get("expenses/:id")
  @RequirePermissions("expenses.read")
  getExpense(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.getExpense(user, id);
  }

  @Post("expenses")
  @RequirePermissions("expenses.create")
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.settingsService.createExpense(user, dto);
  }

  @Patch("expenses/:id")
  @RequirePermissions("expenses.update")
  updateExpense(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateExpenseDto) {
    return this.settingsService.updateExpense(user, id, dto);
  }

  @Post("expenses/:id/void")
  @RequirePermissions("expenses.void")
  voidExpense(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: VoidExpenseDto) {
    return this.settingsService.voidExpense(user, id, dto);
  }

  @Get("payroll")
  @RequirePermissions("settings.read")
  listPayroll(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return this.settingsService.listPayroll(user, branchId);
  }

  @Get("payroll/finalized")
  @RequirePermissions("settings.read")
  listFinalizedPayroll(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    return this.settingsService.listFinalizedPayroll(user, branchId);
  }

  @Post("payroll/finalize")
  @RequirePermissions("settings.update")
  finalizePayroll(@CurrentUser() user: AuthUser, @Body() dto: FinalizePayrollDto) {
    return this.settingsService.finalizePayroll(user, dto);
  }

  @Post("payroll/recalculate")
  @RequirePermissions("settings.update")
  recalculatePayroll(@CurrentUser() user: AuthUser, @Body() dto: RecalculatePayrollDto) {
    return this.settingsService.recalculatePayroll(user, dto.branchId, dto.professionalId);
  }
}
