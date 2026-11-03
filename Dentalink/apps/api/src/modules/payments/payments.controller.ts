import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuthUser } from "../../common/types/auth-user";
import {
  AddPaymentAllocationsDto,
  CashReportByProfessionalQueryDto,
  CashReportQueryDto,
  CloseCashRegisterDto,
  CreateCashMovementDto,
  CreateInstallmentPlanDto,
  CreatePaymentDto,
  CreatePaymentLinkDto,
  CreateRefundDto,
  DailyReceiptQueryDto,
  ListAccountsReceivableQueryDto,
  ListCashRegistersQueryDto,
  ListCancelledPendingPaymentsQueryDto,
  ListPatientCoverageAuthorizationsQueryDto,
  ListPatientCoverageCasesQueryDto,
  ListPatientFinancialDocumentsQueryDto,
  ListInstallmentsQueryDto,
  ListPaymentLinksQueryDto,
  ListPaymentsQueryDto,
  ListPaymentSettlementsQueryDto,
  ListRefundsQueryDto,
  OpenCashRegisterDto,
  PayInstallmentDto,
  ReceiptEmailDto,
  ReceivePaymentSettlementDto,
  CancelPaymentSettlementDto,
  UpdatePaymentDto,
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

  @Get("payments/cancelled-pending")
  @RequirePermissions("payments.read")
  listCancelledPendingPayments(
    @CurrentUser() actor: AuthUser,
    @Query() query: ListCancelledPendingPaymentsQueryDto
  ) {
    return this.service.listCancelledPendingPayments(actor, query);
  }

  @Post("payments")
  @RequirePermissions("payments.create")
  createPayment(@CurrentUser() actor: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.service.createPayment(actor, dto);
  }

  @Get("payments/:id/receipt")
  @RequirePermissions("payments.read")
  getPaymentReceipt(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPaymentReceipt(actor, id);
  }

  @Get("payments/:id/receipt.pdf")
  @RequirePermissions("payments.read")
  async getPaymentReceiptPdf(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const receipt = await this.service.getPaymentReceiptPdf(actor, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${receipt.fileName}"`);
    res.send(Buffer.from(receipt.bytes));
  }

  @Post("payments/:id/receipt/email")
  @RequirePermissions("integrations.communications.send")
  sendPaymentReceiptEmail(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReceiptEmailDto
  ) {
    return this.service.sendPaymentReceiptEmail(actor, id, dto);
  }

  @Get("payments/:id/daily-receipt.pdf")
  @RequirePermissions("payments.read")
  async getDailyReceiptPdf(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Res() res: Response) {
    const receipt = await this.service.getDailyReceiptPdf(actor, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${receipt.fileName}"`);
    res.send(Buffer.from(receipt.bytes));
  }

  @Get("patients/:id/payments/daily-receipt")
  @RequirePermissions("payments.read")
  getPatientDailyReceipt(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query() query: DailyReceiptQueryDto
  ) {
    return this.service.getPatientDailyReceipt(actor, id, query);
  }

  @Get("patients/:id/payments/daily-receipt.pdf")
  @RequirePermissions("payments.read")
  async getPatientDailyReceiptPdf(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query() query: DailyReceiptQueryDto,
    @Res() res: Response
  ) {
    const receipt = await this.service.getPatientDailyReceiptPdf(actor, id, query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${receipt.fileName}"`);
    res.send(Buffer.from(receipt.bytes));
  }

  @Post("patients/:id/payments/daily-receipt/email")
  @RequirePermissions("integrations.communications.send")
  sendPatientDailyReceiptEmail(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query() query: DailyReceiptQueryDto,
    @Body() dto: ReceiptEmailDto
  ) {
    return this.service.sendPatientDailyReceiptEmail(actor, id, query, dto);
  }

  @Patch("payments/:id")
  @RequirePermissions("payments.update")
  updatePayment(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Body() dto: UpdatePaymentDto) {
    return this.service.updatePayment(actor, id, dto);
  }

  @Post("payments/:id/allocations")
  @RequirePermissions("payments.allocate")
  addAllocations(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: AddPaymentAllocationsDto
  ) {
    return this.service.addAllocations(actor, id, dto);
  }

  @Delete("payments/allocations/:allocationId")
  @RequirePermissions("payments.allocate")
  removeAllocation(@CurrentUser() actor: AuthUser, @Param("allocationId") allocationId: string) {
    return this.service.removeAllocation(actor, allocationId);
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

  @Get("payment-settlements")
  @RequirePermissions("payment_settlements.read")
  listPaymentSettlements(@CurrentUser() actor: AuthUser, @Query() query: ListPaymentSettlementsQueryDto) {
    return this.service.listPaymentSettlements(actor, query);
  }

  @Post("payment-settlements/:id/receive")
  @RequirePermissions("payment_settlements.receive")
  receivePaymentSettlement(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReceivePaymentSettlementDto
  ) {
    return this.service.receivePaymentSettlement(actor, id, dto);
  }

  @Post("payment-settlements/:id/cancel")
  @RequirePermissions("payment_settlements.cancel")
  cancelPaymentSettlement(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: CancelPaymentSettlementDto
  ) {
    return this.service.cancelPaymentSettlement(actor, id, dto);
  }

  @Get("patients/:id/payments")
  @RequirePermissions("payments.read")
  getPatientPayments(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientPayments(actor, id);
  }

  @Get("patients/:id/billing/summary")
  @RequirePermissions("payments.read")
  getPatientBillingSummary(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientBillingSummary(actor, id);
  }

  @Get("patients/:id/financial-documents")
  @RequirePermissions("payments.read")
  listPatientFinancialDocuments(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query() query: ListPatientFinancialDocumentsQueryDto
  ) {
    return this.service.listPatientFinancialDocuments(actor, id, query);
  }

  @Get("patients/:id/reimbursement-requests")
  @RequirePermissions("payments.read")
  listPatientReimbursementRequests(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query() query: ListPatientCoverageCasesQueryDto
  ) {
    return this.service.listPatientReimbursementRequests(actor, id, query);
  }

  @Get("patients/:id/online-benefits")
  @RequirePermissions("payments.read")
  listPatientOnlineBenefits(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Query() query: ListPatientCoverageAuthorizationsQueryDto
  ) {
    return this.service.listPatientOnlineBenefits(actor, id, query);
  }

  @Get("patients/:id/voided-payments")
  @RequirePermissions("payments.read")
  listPatientVoidedPayments(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.listPatientVoidedPayments(actor, id);
  }

  @Get("patients/:id/balance")
  @RequirePermissions("accounts_receivable.read")
  getPatientBalance(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientBalance(actor, id);
  }

  @Get("patients/:id/balance/by-plan")
  @RequirePermissions("accounts_receivable.read")
  getPatientBalanceByPlan(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientBalanceByPlan(actor, id);
  }

  @Get("patients/:id/ledger")
  @RequirePermissions("accounts_receivable.read")
  getPatientLedger(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientLedger(actor, id);
  }

  @Get("patients/:id/payment-distribution")
  @RequirePermissions("accounts_receivable.read")
  getPatientPaymentDistribution(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientPaymentDistribution(actor, id);
  }

  @Get("patients/:id/payment-behavior")
  @RequirePermissions("accounts_receivable.read")
  getPatientPaymentBehavior(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getPatientPaymentBehavior(actor, id);
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

  @Get("cash-register/current")
  @RequirePermissions("payments.create")
  getCurrentCashRegister(@CurrentUser() actor: AuthUser, @Query("branchId") branchId: string) {
    return this.service.getCurrentCashRegister(actor, branchId);
  }

  @Get("cash-register/reports/collection-summary")
  @RequirePermissions("cash_register.read")
  collectionSummary(@CurrentUser() actor: AuthUser, @Query() query: CashReportQueryDto) {
    return this.service.getCollectionSummary(actor, query);
  }

  @Get("cash-register/reports/box-summary")
  @RequirePermissions("cash_register.read")
  boxSummary(@CurrentUser() actor: AuthUser, @Query() query: CashReportQueryDto) {
    return this.service.getBoxSummary(actor, query);
  }

  @Get("cash-register/reports/payments-by-period")
  @RequirePermissions("cash_register.read")
  paymentsByPeriod(@CurrentUser() actor: AuthUser, @Query() query: CashReportQueryDto) {
    return this.service.getPaymentsByPeriod(actor, query);
  }

  @Get("cash-register/reports/payments-by-professional")
  @RequirePermissions("cash_register.read")
  paymentsByProfessional(@CurrentUser() actor: AuthUser, @Query() query: CashReportByProfessionalQueryDto) {
    return this.service.getPaymentsByProfessional(actor, query);
  }

  @Get("cash-register/:id")
  @RequirePermissions("cash_register.read")
  getCashRegisterDetail(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.service.getCashRegisterDetail(actor, id);
  }

  @Get("cash-register/:id/report.pdf")
  @RequirePermissions("cash_register.read")
  async getCashRegisterReportPdf(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Res() res: Response
  ) {
    const report = await this.service.getCashRegisterReportPdf(actor, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=detalle-${report.fileNumber}.pdf`);
    res.send(Buffer.from(report.bytes));
  }

  @Get("cash-register/:id/report.csv")
  @RequirePermissions("cash_register.read")
  async getCashRegisterReportCsv(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Res() res: Response
  ) {
    const report = await this.service.getCashRegisterReportCsv(actor, id);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=movimientos-${report.fileNumber}.csv`);
    res.send(`\uFEFF${report.content}`);
  }

  @Get("cash-register/:id/report.xlsx")
  @RequirePermissions("cash_register.read")
  async getCashRegisterReportXlsx(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Res() res: Response
  ) {
    const report = await this.service.getCashRegisterReportXlsx(actor, id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=detalle-${report.fileNumber}.xlsx`);
    res.send(report.bytes);
  }

  @Post("cash-register/open")
  @RequirePermissions("cash_register.open")
  openCashRegister(@CurrentUser() actor: AuthUser, @Body() dto: OpenCashRegisterDto) {
    return this.service.openCashRegister(actor, dto);
  }

  @Post("cash-register/:id/close")
  @RequirePermissions("cash_register.close")
  closeCashRegister(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: CloseCashRegisterDto
  ) {
    return this.service.closeCashRegister(actor, id, dto);
  }

  @Post("cash-register/:id/movements")
  @RequirePermissions("cash_register.move")
  createCashMovement(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body() dto: CreateCashMovementDto
  ) {
    return this.service.createCashMovement(actor, id, dto);
  }
}
