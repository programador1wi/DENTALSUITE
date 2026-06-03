import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import {
  AddPaymentAllocationsDto,
  CloseCashRegisterDto,
  CreateCashMovementDto,
  CreateInstallmentPlanDto,
  CreatePaymentDto,
  CreatePaymentLinkDto,
  CreateRefundDto,
  ListAccountsReceivableQueryDto,
  ListCashRegistersQueryDto,
  ListInstallmentsQueryDto,
  ListPaymentLinksQueryDto,
  ListPaymentsQueryDto,
  ListRefundsQueryDto,
  OpenCashRegisterDto,
  PayInstallmentDto
  ,
  VoidPaymentDto
} from "./dto/payments.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get("payments")
  @RequirePermissions("payments.read")
  listPayments(@CurrentUser() actor: AuthUser, @Query() query: ListPaymentsQueryDto) {
    return this.service.listPayments(actor, query);
  }

  @Post("payments")
  @RequirePermissions("payments.create")
  createPayment(@CurrentUser() actor: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.service.createPayment(actor, dto);
  }

  @Post("payments/:id/allocations")
  @RequirePermissions("payments.allocate")
  addAllocations(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: AddPaymentAllocationsDto) {
    return this.service.addAllocations(actor, id, dto);
  }

  @Post("payments/:id/refund")
  @RequirePermissions("payments.refund")
  createRefund(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateRefundDto) {
    return this.service.createRefund(actor, id, dto);
  }

  @Post("payments/:id/void")
  @RequirePermissions("payments.refund")
  voidPayment(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: VoidPaymentDto) {
    return this.service.voidPayment(actor, id, dto);
  }

  @Get("refunds")
  @RequirePermissions("payments.read")
  listRefunds(@CurrentUser() actor: AuthUser, @Query() query: ListRefundsQueryDto) {
    return this.service.listRefunds(actor, query);
  }

  @Get("patients/:id/payments")
  @RequirePermissions("payments.read")
  getPatientPayments(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientPayments(actor, id);
  }

  @Get("patients/:id/balance")
  @RequirePermissions("accounts_receivable.read")
  getPatientBalance(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientBalance(actor, id);
  }

  @Get("accounts-receivable")
  @RequirePermissions("accounts_receivable.read")
  listAccountsReceivable(@CurrentUser() actor: AuthUser, @Query() query: ListAccountsReceivableQueryDto) {
    return this.service.listAccountsReceivable(actor, query);
  }

  @Post("payment-links")
  @RequirePermissions("payment_links.create")
  createPaymentLink(@CurrentUser() actor: AuthUser, @Body() dto: CreatePaymentLinkDto) {
    return this.service.createPaymentLink(actor, dto);
  }

  @Get("payment-links")
  @RequirePermissions("payments.read")
  listPaymentLinks(@CurrentUser() actor: AuthUser, @Query() query: ListPaymentLinksQueryDto) {
    return this.service.listPaymentLinks(actor, query);
  }

  @Post("installment-plans")
  @RequirePermissions("installments.create")
  createInstallmentPlan(@CurrentUser() actor: AuthUser, @Body() dto: CreateInstallmentPlanDto) {
    return this.service.createInstallmentPlan(actor, dto);
  }

  @Get("installments")
  @RequirePermissions("installments.read")
  listInstallments(@CurrentUser() actor: AuthUser, @Query() query: ListInstallmentsQueryDto) {
    return this.service.listInstallments(actor, query);
  }

  @Post("installments/:id/pay")
  @RequirePermissions("installments.pay")
  payInstallment(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: PayInstallmentDto) {
    return this.service.payInstallment(actor, id, dto);
  }

  @Get("cash-register")
  @RequirePermissions("cash_register.read")
  listCashRegisters(@CurrentUser() actor: AuthUser, @Query() query: ListCashRegistersQueryDto) {
    return this.service.listCashRegisters(actor, query);
  }

  @Get("cash-register/:id")
  @RequirePermissions("cash_register.read")
  getCashRegisterDetail(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getCashRegisterDetail(actor, id);
  }

  @Post("cash-register/open")
  @RequirePermissions("cash_register.open")
  openCashRegister(@CurrentUser() actor: AuthUser, @Body() dto: OpenCashRegisterDto) {
    return this.service.openCashRegister(actor, dto);
  }

  @Post("cash-register/:id/close")
  @RequirePermissions("cash_register.close")
  closeCashRegister(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CloseCashRegisterDto) {
    return this.service.closeCashRegister(actor, id, dto);
  }

  @Post("cash-register/:id/movements")
  @RequirePermissions("cash_register.move")
  createCashMovement(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: CreateCashMovementDto) {
    return this.service.createCashMovement(actor, id, dto);
  }
}
