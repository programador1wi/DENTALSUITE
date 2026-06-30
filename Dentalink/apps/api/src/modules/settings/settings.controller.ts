import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  AssignAgreementPatientsDto,
  CreateAgreementDto,
  CreateExpenseDto,
  FinalizePayrollDto,
  RecalculatePayrollDto,
  UpdateAgreementDto
} from "./dto/admin-workflows.dto";
import { CreateFinancialInstitutionDto, UpdateFinancialInstitutionDto } from "./dto/financial-institution.dto";
import { UpdateGeneralSettingsDto } from "./dto/update-general-settings.dto";
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

  @Post("agreements")
  @RequirePermissions("settings.update")
  createAgreement(@CurrentUser() user: AuthUser, @Body() dto: CreateAgreementDto) {
    return this.settingsService.createAgreement(user, dto);
  }

  @Patch("agreements/:id")
  @RequirePermissions("settings.update")
  updateAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAgreementDto) {
    return this.settingsService.updateAgreement(user, id, dto);
  }

  @Patch("agreements/:id/deactivate")
  @RequirePermissions("settings.update")
  deactivateAgreement(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.deactivateAgreement(user, id);
  }

  @Post("agreements/:id/pay-debt")
  @RequirePermissions("settings.update")
  payAgreementDebt(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.settingsService.payAgreementDebt(user, id);
  }

  @Post("agreements/:id/patients")
  @RequirePermissions("settings.update")
  assignAgreementPatients(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: AssignAgreementPatientsDto
  ) {
    return this.settingsService.assignAgreementPatients(user, id, dto);
  }

  @Get("expenses")
  @RequirePermissions("settings.read")
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Query("search") search?: string,
    @Query("branchId") branchId?: string,
    @Query("month", new ParseIntPipe({ optional: true })) month?: number,
    @Query("year", new ParseIntPipe({ optional: true })) year?: number,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number
  ) {
    return this.settingsService.listExpenses(user, search, branchId, month, year, page, pageSize);
  }

  @Post("expenses")
  @RequirePermissions("settings.update")
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.settingsService.createExpense(user, dto);
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
