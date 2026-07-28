import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import { AgreementDebtsService } from "./agreement-debts.service";
import {
  AllocateCompanyPaymentDto,
  ApproveCompanyPaymentDto,
  CreateCompanyPaymentDto,
  CreatePayrollDiscountPlanDto,
  DebtDetailsQueryDto,
  DebtReportQueryDto,
  VoidCompanyPaymentDto
} from "./dto/agreement-debts.dto";

@ApiTags("Agreement debts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("agreements")
export class AgreementDebtsController {
  constructor(private readonly service: AgreementDebtsService) {}

  @Get("debt-report/export")
  @RequirePermissions("agreements.reports.export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="reporte-deudas-convenios.csv"')
  exportDebtReport(
    @CurrentUser() actor: AuthUser,
    @Query() query: DebtReportQueryDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.exportDebtReport(actor, query, { correlationId, userAgent, ipAddress });
  }

  @Get("debt-report")
  @RequirePermissions("agreements.debt_report.read")
  debtReport(@CurrentUser() actor: AuthUser, @Query() query: DebtReportQueryDto) {
    return this.service.getDebtReport(actor, query);
  }

  @Get(":agreementId/debt-details")
  @RequirePermissions("agreements.debt_report.read")
  debtDetails(
    @CurrentUser() actor: AuthUser,
    @Param("agreementId") agreementId: string,
    @Query() query: DebtDetailsQueryDto
  ) {
    return this.service.getDebtDetails(actor, agreementId, query);
  }

  @Post(":agreementId/payroll-discount-plans")
  @RequirePermissions("agreements.payments.create")
  createPayrollDiscountPlan(
    @CurrentUser() actor: AuthUser,
    @Param("agreementId") agreementId: string,
    @Body() dto: CreatePayrollDiscountPlanDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.createPayrollDiscountPlan(actor, agreementId, dto, {
      correlationId,
      userAgent,
      ipAddress
    });
  }

  @Post(":agreementId/payments")
  @RequirePermissions("agreements.payments.create")
  createPayment(
    @CurrentUser() actor: AuthUser,
    @Param("agreementId") agreementId: string,
    @Body() dto: CreateCompanyPaymentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.createPayment(actor, agreementId, dto, idempotencyKey, {
      correlationId,
      userAgent,
      ipAddress
    });
  }
}

@ApiTags("Company payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("company-payments")
export class CompanyPaymentsController {
  constructor(private readonly service: AgreementDebtsService) {}

  @Post(":paymentId/approve")
  @RequirePermissions("agreements.payments.approve")
  approve(
    @CurrentUser() actor: AuthUser,
    @Param("paymentId") paymentId: string,
    @Body() dto: ApproveCompanyPaymentDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.approvePayment(actor, paymentId, dto, { correlationId, userAgent, ipAddress });
  }

  @Post(":paymentId/allocate")
  @RequirePermissions("agreements.payments.approve")
  allocate(
    @CurrentUser() actor: AuthUser,
    @Param("paymentId") paymentId: string,
    @Body() dto: AllocateCompanyPaymentDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.allocatePayment(actor, paymentId, dto, { correlationId, userAgent, ipAddress });
  }

  @Post(":paymentId/void")
  @RequirePermissions("agreements.payments.void")
  void(
    @CurrentUser() actor: AuthUser,
    @Param("paymentId") paymentId: string,
    @Body() dto: VoidCompanyPaymentDto,
    @Headers("correlation-id") correlationId?: string,
    @Headers("user-agent") userAgent?: string,
    @Ip() ipAddress?: string
  ) {
    return this.service.voidPayment(actor, paymentId, dto, { correlationId, userAgent, ipAddress });
  }

  @Get(":paymentId/audit")
  @RequirePermissions("agreements.debt_report.read")
  audit(@CurrentUser() actor: AuthUser, @Param("paymentId") paymentId: string) {
    return this.service.paymentAudit(actor, paymentId);
  }
}
