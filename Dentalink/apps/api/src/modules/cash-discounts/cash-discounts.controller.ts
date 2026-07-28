import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { CashDiscountsService } from "./cash-discounts.service";
import {
  CashDiscountPreviewDto,
  CashDiscountReportQueryDto,
  DisableCashDiscountDto,
  ListCashDiscountsQueryDto,
  ReactivateCashDiscountDto,
  UpsertCashDiscountDto
} from "./dto/cash-discount.dto";

@ApiTags("CashDiscounts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CashDiscountsController {
  constructor(private readonly service: CashDiscountsService) {}

  @Get("payment-options/cash-discounts")
  @RequirePermissions("payment_options.cash_discounts.view")
  list(@CurrentUser() actor: AuthUser, @Query() query: ListCashDiscountsQueryDto) {
    return this.service.listRules(actor, query);
  }

  @Get("payment-options/cash-discounts-configuration-options")
  @RequirePermissions("payment_options.cash_discounts.view")
  configurationOptions(@CurrentUser() actor: AuthUser) {
    return this.service.configurationOptions(actor);
  }

  @Post("payment-options/cash-discounts")
  @RequirePermissions("payment_options.cash_discounts.create")
  create(@CurrentUser() actor: AuthUser, @Body() dto: UpsertCashDiscountDto) {
    return this.service.createRule(actor, dto);
  }

  @Get("payment-options/cash-discounts/:id")
  @RequirePermissions("payment_options.cash_discounts.view")
  get(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getRule(actor, id);
  }

  @Patch("payment-options/cash-discounts/:id")
  @RequirePermissions("payment_options.cash_discounts.update")
  update(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpsertCashDiscountDto) {
    return this.service.updateRule(actor, id, dto);
  }

  @Post("payment-options/cash-discounts/:id/duplicate")
  @RequirePermissions("payment_options.cash_discounts.create")
  duplicate(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.duplicateRule(actor, id);
  }

  @Post("payment-options/cash-discounts/:id/disable")
  @RequirePermissions("payment_options.cash_discounts.disable")
  disable(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: DisableCashDiscountDto) {
    return this.service.disableRule(actor, id, dto);
  }

  @Post("payment-options/cash-discounts/:id/reactivate")
  @RequirePermissions("payment_options.cash_discounts.reactivate")
  reactivate(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReactivateCashDiscountDto
  ) {
    return this.service.reactivateRule(actor, id, dto);
  }

  @Get("payment-options/cash-discounts/:id/audit")
  @RequirePermissions("payments.cash_discounts.view_audit")
  audit(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getAudit(actor, id);
  }

  @Get("patients/:patientId/payments/available-cash-discounts")
  @RequirePermissions("payments.cash_discounts.apply", "treatment_discount.apply")
  available(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Query("branchId") branchId: string
  ) {
    return this.service.listAvailableRules(actor, patientId, branchId);
  }

  @Post("patients/:patientId/payments/cash-discount-preview")
  @RequirePermissions("payments.cash_discounts.apply", "treatment_discount.apply")
  preview(
    @CurrentUser() actor: AuthUser,
    @Param("patientId") patientId: string,
    @Body() dto: CashDiscountPreviewDto
  ) {
    return this.service.preview(actor, patientId, dto);
  }

  @Get("reports/cash-discounts")
  @RequirePermissions("payments.cash_discounts.view_audit")
  report(@CurrentUser() actor: AuthUser, @Query() query: CashDiscountReportQueryDto) {
    return this.service.report(actor, query);
  }
}
