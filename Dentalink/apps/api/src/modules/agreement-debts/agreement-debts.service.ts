import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgreementChargeStatus,
  CashMovementDirection,
  CashMovementType,
  CashRegisterStatus,
  CompanyPaymentStatus,
  CurrencyCode,
  Prisma
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import {
  AllocateCompanyPaymentDto,
  ApproveCompanyPaymentDto,
  CreateCompanyPaymentDto,
  CreatePayrollDiscountPlanDto,
  DebtDetailsQueryDto,
  DebtReportQueryDto,
  VoidCompanyPaymentDto
} from "./dto/agreement-debts.dto";
import * as debtRules from "./domain/agreement-debt-rules";
import {
  writeAgreementDebtAudit,
  type RequestAuditContext
} from "./infrastructure/agreement-debt-audit";
import {
  ACTIVE_PAYMENT_STATUSES,
  INVALID_CHARGE_STATUSES
} from "./application/agreement-debt-statuses";
import { findRequiredAgreement } from "./infrastructure/agreement-debt-repository";

type DebtChargeSource = Prisma.AgreementChargeGetPayload<{
  include: {
    allocations: {
      include: { companyPayment: { select: { status: true } } };
    };
    company: { select: { id: true; legalName: true } };
    agreement: { select: { id: true; name: true } };
    branch: { select: { id: true; name: true } };
  };
}>;

@Injectable()
export class AgreementDebtsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly audit = writeAgreementDebtAudit;
  private readonly dueDateAllocations = debtRules.dueDateAllocations;
  private readonly proportionalAllocations = debtRules.proportionalAllocations;
  private readonly splitMoney = debtRules.splitMoney;
  private readonly installmentDueDate = debtRules.installmentDueDate;
  private readonly appliedAmount = debtRules.appliedAmount;
  private readonly chargeState = debtRules.chargeState;
  private readonly persistedChargeStatus = debtRules.persistedChargeStatus;
  private readonly summaryState = debtRules.summaryState;
  private readonly startOfDay = debtRules.startOfDay;
  private readonly endOfDay = debtRules.endOfDay;
  private readonly daysBetween = debtRules.daysBetween;
  private readonly cents = debtRules.cents;
  private readonly money = debtRules.money;
  private readonly clean = debtRules.clean;
  private readonly csvCell = debtRules.csvCell;

  async getDebtReport(actor: AuthUser, query: DebtReportQueryDto) {
    const cutoff = this.endOfDay(query.cutoffDate);
    const branchIds = await this.resolveBranchScope(actor, query.branchId, query.scope);
    const agreementWhere: Prisma.AgreementWhereInput = {
      organizationId: actor.organizationId,
      ...(query.agreementId ? { id: query.agreementId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {})
    };
    const agreements = await this.prisma.agreement.findMany({
      where: agreementWhere,
      select: {
        id: true,
        name: true,
        companyId: true,
        company: { select: { id: true, legalName: true } },
        priceList: { select: { currency: true } }
      },
      orderBy: [{ company: { legalName: "asc" } }, { name: "asc" }]
    });
    const agreementIds = agreements.map((agreement) => agreement.id);
    const chargeWhere: Prisma.AgreementChargeWhereInput = {
      organizationId: actor.organizationId,
      agreementId: { in: agreementIds },
      dueDate: { lte: cutoff },
      status: { notIn: INVALID_CHARGE_STATUSES },
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
      ...(query.currencyId ? { currency: query.currencyId } : {})
    };
    const charges = await this.prisma.agreementCharge.findMany({
      where: chargeWhere,
      include: {
        company: { select: { id: true, legalName: true } },
        agreement: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        allocations: {
          where: {
            reversedAt: null,
            companyPayment: { status: { in: ACTIVE_PAYMENT_STATUSES } }
          },
          include: { companyPayment: { select: { status: true } } }
        }
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }]
    });

    const consolidated = this.groupConsolidated(charges);
    const byBranch = this.groupByBranch(charges);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const consolidatedPage = consolidated.slice((page - 1) * pageSize, page * pageSize);
    const branchPage = byBranch.slice((page - 1) * pageSize, page * pageSize);
    const futureChargeCount = agreementIds.length
      ? await this.prisma.agreementCharge.count({
          where: {
            organizationId: actor.organizationId,
            agreementId: { in: agreementIds },
            dueDate: { gt: cutoff },
            status: { notIn: INVALID_CHARGE_STATUSES },
            ...(branchIds ? { branchId: { in: branchIds } } : {}),
            ...(query.currencyId ? { currency: query.currencyId } : {})
          }
        })
      : 0;
    const authorizedBranches = await this.prisma.branch.findMany({
      where: {
        organizationId: actor.organizationId,
        isActive: true,
        ...(branchIds ? { id: { in: branchIds } } : {})
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
    const consolidatedDebt = this.money(consolidated.reduce((sum, row) => sum + row.outstandingDebt, 0));
    const branchDebt = this.money(byBranch.reduce((sum, row) => sum + row.outstandingDebt, 0));
    const totalsByCurrency = [...new Set(consolidated.map((row) => row.currency))].map((currency) => {
      const rows = consolidated.filter((row) => row.currency === currency);
      return {
        currency,
        generatedCharges: this.money(rows.reduce((sum, row) => sum + row.generatedCharges, 0)),
        paid: this.money(rows.reduce((sum, row) => sum + row.totalPaid, 0)),
        debt: this.money(rows.reduce((sum, row) => sum + row.outstandingDebt, 0))
      };
    });

    return {
      cutoffDate: query.cutoffDate,
      consolidated: consolidatedPage,
      byBranch: branchPage,
      totals: {
        generatedCharges: this.money(consolidated.reduce((sum, row) => sum + row.generatedCharges, 0)),
        paid: this.money(consolidated.reduce((sum, row) => sum + row.totalPaid, 0)),
        debt: consolidatedDebt,
        patients: new Set(charges.map((charge) => charge.patientId)).size,
        charges: charges.length
      },
      totalsByCurrency,
      reconciliation: {
        consolidatedDebt,
        branchDebt,
        difference: this.money(consolidatedDebt - branchDebt),
        matches: Math.abs(consolidatedDebt - branchDebt) < 0.01
      },
      diagnostics: {
        futureChargeCount,
        emptyReason: charges.length ? null : futureChargeCount ? "FUTURE_CHARGES" : "NO_CHARGES"
      },
      pagination: {
        page,
        pageSize,
        consolidatedTotal: consolidated.length,
        branchTotal: byBranch.length
      },
      filters: {
        companies: [...new Map(agreements.map((row) => [row.company.id, row.company])).values()],
        agreements: agreements.map((row) => ({
          id: row.id,
          name: row.name,
          companyId: row.companyId,
          currency: row.priceList?.currency ?? CurrencyCode.MXN
        })),
        branches: authorizedBranches,
        currencies: Object.values(CurrencyCode),
        canViewAllBranches: this.has(actor, "agreements.debt_report.all_branches")
      }
    };
  }

  async getDebtDetails(actor: AuthUser, agreementId: string, query: DebtDetailsQueryDto) {
    await findRequiredAgreement(this.prisma, actor, agreementId);
    const cutoff = this.endOfDay(query.cutoffDate);
    const branchIds = await this.resolveBranchScope(actor, query.branchId, query.scope);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Prisma.AgreementChargeWhereInput = {
      organizationId: actor.organizationId,
      agreementId,
      dueDate: {
        lte: query.dueTo ? this.endOfDay(query.dueTo) : cutoff,
        ...(query.dueFrom ? { gte: this.startOfDay(query.dueFrom) } : {})
      },
      status: { notIn: INVALID_CHARGE_STATUSES },
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
      ...(query.currencyId ? { currency: query.currencyId } : {}),
      ...(query.installmentNumber ? { installmentNumber: query.installmentNumber } : {}),
      ...(query.folio ? { folio: { contains: query.folio, mode: "insensitive" } } : {}),
      ...(query.patient
        ? {
            patient: {
              OR: [
                { firstName: { contains: query.patient, mode: "insensitive" } },
                { lastName: { contains: query.patient, mode: "insensitive" } },
                { documentNumber: { contains: query.patient, mode: "insensitive" } }
              ]
            }
          }
        : {})
    };
    const charges = await this.prisma.agreementCharge.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
        treatmentPlan: { select: { id: true, name: true } },
        treatmentPlanItem: {
          select: {
            id: true,
            procedureNameSnapshot: true,
            procedureCodeSnapshot: true,
            procedure: { select: { name: true, code: true } }
          }
        },
        branch: { select: { id: true, name: true } },
        allocations: {
          where: {
            reversedAt: null,
            companyPayment: { status: { in: ACTIVE_PAYMENT_STATUSES } }
          },
          include: { companyPayment: { select: { status: true } } }
        }
      },
      orderBy: [{ dueDate: "asc" }, { folio: "asc" }]
    });
    const rows = charges
      .map((charge) => {
        const paid = this.appliedAmount(charge.allocations);
        const balance = this.money(Number(charge.originalAmount) - paid);
        const status = this.chargeState(charge.status, charge.dueDate, paid, balance);
        return {
          id: charge.id,
          folio: charge.folio,
          patientId: charge.patient.id,
          patient: `${charge.patient.firstName} ${charge.patient.lastName}`.trim(),
          expediente: charge.patient.documentNumber ?? "Sin expediente",
          treatmentPlanId: charge.treatmentPlan.id,
          treatment: charge.treatmentPlan.name,
          treatmentPlanItemId: charge.treatmentPlanItem.id,
          procedure:
            charge.treatmentPlanItem.procedureNameSnapshot ?? charge.treatmentPlanItem.procedure.name,
          procedureCode:
            charge.treatmentPlanItem.procedureCodeSnapshot ?? charge.treatmentPlanItem.procedure.code,
          installmentNumber: charge.installmentNumber,
          dueDate: charge.dueDate,
          branch: charge.branch,
          originalAmount: this.money(Number(charge.originalAmount)),
          paid,
          balance,
          currency: charge.currency,
          status,
          overdueDays: status === "OVERDUE" ? this.daysBetween(charge.dueDate, new Date()) : 0,
          version: charge.version
        };
      })
      .filter((row) => !query.status || row.status === query.status);
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total: rows.length }
    };
  }

  async createPayrollDiscountPlan(
    actor: AuthUser,
    agreementId: string,
    dto: CreatePayrollDiscountPlanDto,
    context: RequestAuditContext = {}
  ) {
    const agreement = await this.prisma.agreement.findFirst({
      where: { id: agreementId, organizationId: actor.organizationId },
      include: { company: true }
    });
    if (!agreement) throw new NotFoundException("Convenio no encontrado");
    if (!agreement.isActive || agreement.status !== "ACTIVE")
      throw new ConflictException("El convenio no está activo");
    const today = new Date();
    if ((agreement.startsAt && agreement.startsAt > today) || (agreement.endsAt && agreement.endsAt < today))
      throw new ConflictException("El convenio está fuera de su periodo de vigencia");
    if (!agreement.payrollDiscount)
      throw new ConflictException("El convenio no permite descuento por planilla");
    const selectedIds = [...new Set(dto.treatmentPlanItemIds)];
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: {
        id: dto.treatmentPlanId,
        organizationId: actor.organizationId,
        agreementId
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, agreementId: true } },
        items: {
          where: { id: { in: selectedIds } },
          include: { procedure: { select: { id: true, code: true, name: true } } }
        }
      }
    });
    if (!plan) throw new BadRequestException("El plan no pertenece al convenio indicado");
    if (plan.patient.agreementId !== agreementId)
      throw new ConflictException("El paciente ya no está afiliado a este convenio");
    await this.resolveBranchScope(actor, plan.branchId, "AUTHORIZED");
    if (plan.items.length !== selectedIds.length)
      throw new BadRequestException("Una o más prestaciones no pertenecen al plan");
    const invalidItem = plan.items.find(
      (item) => item.status === "CANCELLED" || Number(item.agreementCoverage) <= 0
    );
    if (invalidItem)
      throw new BadRequestException(
        "Solo pueden trasladarse prestaciones vigentes con cobertura empresarial pendiente"
      );
    const duplicate = await this.prisma.agreementCharge.findFirst({
      where: {
        treatmentPlanItemId: { in: selectedIds },
        status: { notIn: INVALID_CHARGE_STATUSES }
      },
      select: { folio: true }
    });
    if (duplicate)
      throw new ConflictException(`Una prestación ya fue trasladada al cargo ${duplicate.folio}`);
    const currencies = [...new Set(plan.items.map((item) => item.priceCurrency))];
    if (currencies.length !== 1)
      throw new BadRequestException("Las prestaciones seleccionadas deben usar la misma moneda");
    const totalAmount = this.money(
      plan.items.reduce((sum, item) => sum + Number(item.agreementCoverage), 0)
    );
    const firstDueDate = this.startOfDay(dto.firstDueDate);
    const now = new Date();
    const agreementSnapshot = {
      agreementId: agreement.id,
      agreementName: agreement.name,
      agreementVersion: agreement.version,
      companyId: agreement.companyId,
      companyName: agreement.company.legalName,
      entityTaxId: agreement.entityTaxId,
      capturedAt: now.toISOString()
    };

    return this.prisma.$transaction(async (tx) => {
      const discountPlan = await tx.payrollDiscountPlan.create({
        data: {
          organizationId: actor.organizationId,
          companyId: agreement.companyId,
          agreementId,
          patientId: plan.patientId,
          treatmentPlanId: plan.id,
          branchId: plan.branchId,
          totalAmount: this.decimal(totalAmount),
          installmentCount: dto.installmentCount,
          firstDueDate,
          periodicity: dto.periodicity,
          currency: currencies[0],
          agreementSnapshot: agreementSnapshot as Prisma.InputJsonValue,
          createdById: actor.id
        }
      });
      const chargeRows = plan.items.flatMap((item) => {
        const installments = this.splitMoney(Number(item.agreementCoverage), dto.installmentCount);
        return installments.map((amount, index) => {
          const dueDate = this.installmentDueDate(firstDueDate, dto.periodicity, index);
          return {
            folio: `ADE-${randomUUID().slice(0, 8).toUpperCase()}`,
            organizationId: actor.organizationId,
            companyId: agreement.companyId,
            agreementId,
            payrollDiscountPlanId: discountPlan.id,
            patientId: plan.patientId,
            treatmentPlanId: plan.id,
            treatmentPlanItemId: item.id,
            branchId: plan.branchId,
            dueDate,
            installmentNumber: index + 1,
            originalAmount: this.decimal(amount),
            outstandingAmount: this.decimal(amount),
            currency: item.priceCurrency,
            status:
              dueDate > now ? AgreementChargeStatus.SCHEDULED : AgreementChargeStatus.PENDING,
            agreementSnapshot: agreementSnapshot as Prisma.InputJsonValue,
            priceSnapshot: {
              treatmentPlanItemId: item.id,
              procedureId: item.procedure.id,
              procedureCode: item.procedureCodeSnapshot ?? item.procedure.code,
              procedureName: item.procedureNameSnapshot ?? item.procedure.name,
              agreementVersionId: item.agreementVersionId,
              agreementVersionNumber: item.agreementVersionNumber,
              agreementNormalPrice: item.agreementNormalPrice?.toString(),
              agreementAppliedPrice: item.agreementAppliedPrice?.toString(),
              agreementCoverage: item.agreementCoverage.toString(),
              priceCurrency: item.priceCurrency
            } as Prisma.InputJsonValue,
            createdById: actor.id
          };
        });
      });
      await tx.agreementCharge.createMany({ data: chargeRows });
      await tx.payrollDiscount.create({
        data: {
          organizationId: actor.organizationId,
          patientId: plan.patientId,
          treatmentPlanId: plan.id,
          employerName: agreement.company.legalName,
          totalAmount,
          discountAmount: totalAmount,
          frequency: dto.periodicity,
          startDate: firstDueDate
        }
      });
      await this.audit(tx, actor, context, {
        action: "agreement_charge.generate",
        entity: "PayrollDiscountPlan",
        entityId: discountPlan.id,
        branchId: plan.branchId,
        after: {
          agreementId,
          companyId: agreement.companyId,
          patientId: plan.patientId,
          treatmentPlanId: plan.id,
          itemIds: selectedIds,
          installmentCount: dto.installmentCount,
          totalAmount,
          currency: currencies[0]
        }
      });
      return { ...discountPlan, chargeCount: chargeRows.length };
    });
  }

  async createPayment(
    actor: AuthUser,
    agreementId: string,
    dto: CreateCompanyPaymentDto,
    idempotencyKey: string | undefined,
    context: RequestAuditContext = {}
  ) {
    const key = idempotencyKey?.trim();
    if (!key) throw new BadRequestException("Idempotency-Key es obligatorio");
    const existing = await this.prisma.companyPayment.findUnique({
      where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey: key } },
      include: { allocations: true }
    });
    if (existing) return existing;
    const agreement = await findRequiredAgreement(this.prisma, actor, agreementId);
    if (dto.confirm && !this.has(actor, "agreements.payments.approve"))
      throw new ForbiddenException("No tienes permiso para aprobar pagos empresariales");
    if (dto.branchId) await this.resolveBranchScope(actor, dto.branchId, "AUTHORIZED");
    await this.validatePaymentReferences(actor, dto);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.companyPayment.create({
        data: {
          organizationId: actor.organizationId,
          companyId: agreement.companyId,
          agreementId,
          branchId: dto.branchId || null,
          paymentDate: new Date(dto.paymentDate),
          amount: this.decimal(dto.amount),
          unappliedAmount: this.decimal(dto.amount),
          currency: dto.currencyId,
          paymentMethodId: dto.paymentMethodId || null,
          financialInstitutionId: dto.financialInstitutionId || null,
          reference: this.clean(dto.reference),
          proofUrl: this.clean(dto.proofUrl),
          cashRegisterId: dto.cashRegisterId || null,
          notes: this.clean(dto.notes),
          status: dto.confirm ? CompanyPaymentStatus.CONFIRMED : CompanyPaymentStatus.DRAFT,
          receivedById: actor.id,
          approvedById: dto.confirm ? actor.id : null,
          approvedAt: dto.confirm ? new Date() : null,
          idempotencyKey: key
        }
      });
      const allocated = dto.confirm
        ? await this.applyPayment(tx, actor, payment.id, dto.allocationStrategy, dto.chargeIds)
        : payment;
      if (dto.confirm) await this.createCashMovement(tx, actor, allocated);
      await this.audit(tx, actor, context, {
        action: dto.confirm ? "company_payment.receive_and_apply" : "company_payment.create_draft",
        entity: "CompanyPayment",
        entityId: payment.id,
        branchId: dto.branchId,
        after: {
          agreementId,
          companyId: agreement.companyId,
          amount: dto.amount,
          currency: dto.currencyId,
          allocationStrategy: dto.allocationStrategy,
          status: allocated.status
        }
      });
      return allocated;
    });
  }

  async approvePayment(
    actor: AuthUser,
    paymentId: string,
    dto: ApproveCompanyPaymentDto,
    context: RequestAuditContext = {}
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.paymentForMutation(tx, actor, paymentId, dto.expectedVersion);
      if (payment.status !== CompanyPaymentStatus.DRAFT)
        throw new ConflictException("Solo pueden aprobarse pagos en borrador");
      const updated = await tx.companyPayment.updateMany({
        where: { id: paymentId, version: dto.expectedVersion },
        data: {
          status: CompanyPaymentStatus.CONFIRMED,
          approvedById: actor.id,
          approvedAt: new Date(),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw new ConflictException("El pago fue modificado por otro usuario");
      const allocated = await this.applyPayment(tx, actor, paymentId, dto.strategy, dto.chargeIds);
      await this.createCashMovement(tx, actor, allocated);
      await this.audit(tx, actor, context, {
        action: "company_payment.approve",
        entity: "CompanyPayment",
        entityId: paymentId,
        branchId: payment.branchId ?? undefined,
        before: { status: payment.status, version: payment.version },
        after: { status: allocated.status, version: allocated.version }
      });
      return allocated;
    });
  }

  async allocatePayment(
    actor: AuthUser,
    paymentId: string,
    dto: AllocateCompanyPaymentDto,
    context: RequestAuditContext = {}
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.paymentForMutation(tx, actor, paymentId, dto.expectedVersion);
      if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status))
        throw new ConflictException("El pago debe estar confirmado antes de aplicarlo");
      const allocated = await this.applyPayment(tx, actor, paymentId, dto.strategy, dto.chargeIds);
      await this.audit(tx, actor, context, {
        action: "company_payment.allocate",
        entity: "CompanyPayment",
        entityId: paymentId,
        branchId: payment.branchId ?? undefined,
        before: { unappliedAmount: payment.unappliedAmount.toString(), version: payment.version },
        after: { unappliedAmount: allocated.unappliedAmount.toString(), version: allocated.version }
      });
      return allocated;
    });
  }

  async voidPayment(
    actor: AuthUser,
    paymentId: string,
    dto: VoidCompanyPaymentDto,
    context: RequestAuditContext = {}
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.paymentForMutation(tx, actor, paymentId, dto.expectedVersion);
      if (([CompanyPaymentStatus.VOIDED, CompanyPaymentStatus.REFUNDED] as CompanyPaymentStatus[]).includes(payment.status))
        throw new ConflictException("El pago ya fue anulado o reembolsado");
      const allocations = await tx.companyPaymentAllocation.findMany({
        where: { companyPaymentId: paymentId, reversedAt: null },
        include: { agreementCharge: true }
      });
      const reversedAt = new Date();
      for (const allocation of allocations) {
        const paid = this.money(
          Math.max(0, Number(allocation.agreementCharge.paidAmount) - Number(allocation.allocatedAmount))
        );
        const outstanding = this.money(
          Number(allocation.agreementCharge.originalAmount) - paid
        );
        await tx.agreementCharge.update({
          where: { id: allocation.agreementChargeId },
          data: {
            paidAmount: this.decimal(paid),
            outstandingAmount: this.decimal(outstanding),
            status: this.persistedChargeStatus(allocation.agreementCharge.dueDate, paid, outstanding),
            version: { increment: 1 }
          }
        });
      }
      await tx.companyPaymentAllocation.updateMany({
        where: { companyPaymentId: paymentId, reversedAt: null },
        data: { reversedAt, reversedById: actor.id }
      });
      const updated = await tx.companyPayment.updateMany({
        where: { id: paymentId, version: dto.expectedVersion },
        data: {
          status: CompanyPaymentStatus.VOIDED,
          unappliedAmount: this.decimal(0),
          voidedAt: reversedAt,
          voidedById: actor.id,
          voidReason: dto.reason.trim(),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw new ConflictException("El pago fue modificado por otro usuario");
      await tx.cashMovement.updateMany({
        where: { companyPaymentId: paymentId, voidedAt: null },
        data: { voidedAt: reversedAt, voidedById: actor.id, voidReason: dto.reason.trim() }
      });
      await this.audit(tx, actor, context, {
        action: "company_payment.void",
        entity: "CompanyPayment",
        entityId: paymentId,
        branchId: payment.branchId ?? undefined,
        reason: dto.reason.trim(),
        before: { status: payment.status, version: payment.version },
        after: { status: CompanyPaymentStatus.VOIDED, reversedAllocations: allocations.length }
      });
      return tx.companyPayment.findUniqueOrThrow({ where: { id: paymentId } });
    });
  }

  async paymentAudit(actor: AuthUser, paymentId: string) {
    const payment = await this.prisma.companyPayment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId },
      select: { id: true, branchId: true }
    });
    if (!payment) throw new NotFoundException("Pago empresarial no encontrado");
    if (payment.branchId) await this.resolveBranchScope(actor, payment.branchId, "AUTHORIZED");
    if (!payment.branchId && !this.has(actor, "agreements.debt_report.all_branches")) {
      const inaccessibleAllocation = await this.prisma.companyPaymentAllocation.findFirst({
        where: {
          companyPaymentId: paymentId,
          agreementCharge: { branchId: { notIn: actor.branchIds } }
        },
        select: { id: true }
      });
      if (inaccessibleAllocation)
        throw new ForbiddenException("El pago contiene cargos fuera de tus sucursales autorizadas");
    }
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: actor.organizationId,
        entity: "CompanyPayment",
        entityId: paymentId
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async exportDebtReport(
    actor: AuthUser,
    query: DebtReportQueryDto,
    context: RequestAuditContext = {}
  ) {
    const report = await this.getDebtReport(actor, { ...query, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
    const header = [
      "Empresa",
      "Convenio",
      "Moneda",
      "Cargos generados",
      "Total pagado",
      "Deuda pendiente",
      "Pacientes",
      "Cargos",
      "Cargo más antiguo"
    ];
    const rows = report.consolidated.map((row) => [
      row.companyName,
      row.agreementName,
      row.currency,
      row.generatedCharges,
      row.totalPaid,
      row.outstandingDebt,
      row.patientCount,
      row.chargeCount,
      row.oldestCharge?.toISOString().slice(0, 10) ?? ""
    ]);
    await this.audit(this.prisma, actor, context, {
      action: "agreement_debt_report.export",
      entity: "AgreementDebtReport",
      after: { cutoffDate: query.cutoffDate, rows: rows.length, filters: JSON.parse(JSON.stringify(query)) }
    });
    return `\uFEFF${[header, ...rows].map((row) => row.map(this.csvCell).join(",")).join("\r\n")}`;
  }

  private groupConsolidated(charges: DebtChargeSource[]) {
    const groups = new Map<string, ReturnType<AgreementDebtsService["emptySummary"]>>();
    for (const charge of charges) {
      const key = [charge.organizationId, charge.companyId, charge.agreementId, charge.currency].join(":");
      const row = groups.get(key) ?? this.emptySummary(charge);
      const paid = this.appliedAmount(charge.allocations);
      row.generatedCharges = this.money(row.generatedCharges + Number(charge.originalAmount));
      row.totalPaid = this.money(row.totalPaid + paid);
      row.outstandingDebt = this.money(row.outstandingDebt + Math.max(0, Number(charge.originalAmount) - paid));
      row.patientIds.add(charge.patientId);
      row.patientCount = row.patientIds.size;
      row.chargeCount += 1;
      row.oldestCharge = !row.oldestCharge || charge.dueDate < row.oldestCharge ? charge.dueDate : row.oldestCharge;
      groups.set(key, row);
    }
    return [...groups.values()].map(({ patientIds: _patientIds, ...row }) => ({
      ...row,
      state: this.summaryState(row.generatedCharges, row.totalPaid, row.outstandingDebt)
    }));
  }

  private groupByBranch(charges: DebtChargeSource[]) {
    const groups = new Map<string, ReturnType<AgreementDebtsService["emptyBranchSummary"]>>();
    for (const charge of charges) {
      const key = [
        charge.organizationId,
        charge.companyId,
        charge.agreementId,
        charge.branchId,
        charge.currency
      ].join(":");
      const row = groups.get(key) ?? this.emptyBranchSummary(charge);
      const paid = this.appliedAmount(charge.allocations);
      row.generatedCharges = this.money(row.generatedCharges + Number(charge.originalAmount));
      row.totalPaid = this.money(row.totalPaid + paid);
      row.outstandingDebt = this.money(row.outstandingDebt + Math.max(0, Number(charge.originalAmount) - paid));
      row.chargeCount += 1;
      groups.set(key, row);
    }
    return [...groups.values()].map((row) => ({
      ...row,
      state: this.summaryState(row.generatedCharges, row.totalPaid, row.outstandingDebt)
    }));
  }

  private emptySummary(charge: DebtChargeSource) {
    return {
      id: `${charge.companyId}:${charge.agreementId}:${charge.currency}`,
      organizationId: charge.organizationId,
      companyId: charge.companyId,
      companyName: charge.company.legalName,
      agreementId: charge.agreementId,
      agreementName: charge.agreement.name,
      currency: charge.currency,
      generatedCharges: 0,
      totalPaid: 0,
      outstandingDebt: 0,
      patientIds: new Set<string>(),
      patientCount: 0,
      chargeCount: 0,
      oldestCharge: null as Date | null
    };
  }

  private emptyBranchSummary(charge: DebtChargeSource) {
    return {
      id: `${charge.companyId}:${charge.agreementId}:${charge.branchId}:${charge.currency}`,
      organizationId: charge.organizationId,
      companyId: charge.companyId,
      companyName: charge.company.legalName,
      agreementId: charge.agreementId,
      agreementName: charge.agreement.name,
      branchId: charge.branchId,
      branchName: charge.branch.name,
      currency: charge.currency,
      generatedCharges: 0,
      totalPaid: 0,
      outstandingDebt: 0,
      chargeCount: 0
    };
  }

  private async applyPayment(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    paymentId: string,
    strategy: "AUTO_DUE_DATE" | "MANUAL" | "PROPORTIONAL",
    chargeIds?: string[]
  ) {
    const payment = await tx.companyPayment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId }
    });
    if (!payment) throw new NotFoundException("Pago empresarial no encontrado");
    const available = this.money(Number(payment.unappliedAmount));
    if (available <= 0) throw new ConflictException("El pago no tiene saldo disponible para aplicar");
    const selectedIds = [...new Set(chargeIds ?? [])];
    const authorizedBranchIds = this.has(actor, "agreements.debt_report.all_branches")
      ? undefined
      : actor.branchIds;
    if (strategy === "MANUAL" && !selectedIds.length)
      throw new BadRequestException("Selecciona al menos un cargo para la aplicación manual");
    const charges = await tx.agreementCharge.findMany({
      where: {
        organizationId: actor.organizationId,
        companyId: payment.companyId,
        agreementId: payment.agreementId,
        currency: payment.currency,
        outstandingAmount: { gt: 0 },
        status: { notIn: [...INVALID_CHARGE_STATUSES, AgreementChargeStatus.PAID] },
        ...(payment.branchId ? { branchId: payment.branchId } : {}),
        ...(!payment.branchId && authorizedBranchIds
          ? { branchId: { in: authorizedBranchIds } }
          : {}),
        ...(selectedIds.length ? { id: { in: selectedIds } } : {})
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }]
    });
    if (selectedIds.length && charges.length !== selectedIds.length)
      throw new BadRequestException("Uno o más cargos no son aplicables a este pago");
    const totalDebt = this.money(charges.reduce((sum, charge) => sum + Number(charge.outstandingAmount), 0));
    if (available > totalDebt)
      throw new BadRequestException(
        `El pago supera la deuda aplicable por ${this.money(available - totalDebt).toFixed(2)} ${payment.currency}`
      );
    if (!charges.length) throw new BadRequestException("No existen cargos pendientes aplicables");
    const allocations =
      strategy === "PROPORTIONAL"
        ? this.proportionalAllocations(charges, available, totalDebt)
        : this.dueDateAllocations(charges, available);
    for (const allocation of allocations) {
      if (allocation.amount <= 0) continue;
      const charge = charges.find((row) => row.id === allocation.chargeId)!;
      const paid = this.money(Number(charge.paidAmount) + allocation.amount);
      const outstanding = this.money(Number(charge.originalAmount) - paid);
      const updated = await tx.agreementCharge.updateMany({
        where: { id: charge.id, version: charge.version },
        data: {
          paidAmount: this.decimal(paid),
          outstandingAmount: this.decimal(outstanding),
          status: this.persistedChargeStatus(charge.dueDate, paid, outstanding),
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1)
        throw new ConflictException(`El cargo ${charge.folio} fue modificado por otro usuario`);
      await tx.companyPaymentAllocation.create({
        data: {
          companyPaymentId: paymentId,
          agreementChargeId: charge.id,
          allocatedAmount: this.decimal(allocation.amount)
        }
      });
    }
    const allocatedTotal = this.money(allocations.reduce((sum, allocation) => sum + allocation.amount, 0));
    const remaining = this.money(available - allocatedTotal);
    return tx.companyPayment.update({
      where: { id: paymentId },
      data: {
        unappliedAmount: this.decimal(remaining),
        status: remaining > 0 ? CompanyPaymentStatus.PARTIALLY_APPLIED : CompanyPaymentStatus.APPLIED,
        version: { increment: 1 }
      }
    });
  }

  private async createCashMovement(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    payment: {
      id: string;
      branchId: string | null;
      cashRegisterId: string | null;
      paymentMethodId: string | null;
      amount: Prisma.Decimal;
      reference: string | null;
      idempotencyKey: string;
    }
  ) {
    if (!payment.cashRegisterId || !payment.branchId) return;
    const register = await tx.cashRegister.findFirst({
      where: {
        id: payment.cashRegisterId,
        organizationId: actor.organizationId,
        branchId: payment.branchId,
        status: CashRegisterStatus.OPEN
      }
    });
    if (!register) throw new ConflictException("La caja ya no está abierta o no corresponde a la sucursal");
    await tx.cashMovement.create({
      data: {
        organizationId: actor.organizationId,
        branchId: payment.branchId,
        cashRegisterId: register.id,
        type: CashMovementType.INCOME,
        direction: CashMovementDirection.IN,
        amount: payment.amount,
        companyPaymentId: payment.id,
        paymentMethodId: payment.paymentMethodId,
        reference: payment.reference,
        idempotencyKey: `company:${payment.idempotencyKey}`,
        description: "Ingreso por pago de empresa",
        createdById: actor.id
      }
    });
  }

  private async validatePaymentReferences(actor: AuthUser, dto: CreateCompanyPaymentDto) {
    if (dto.paymentMethodId) {
      const method = await this.prisma.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, organizationId: actor.organizationId, isActive: true }
      });
      if (!method) throw new BadRequestException("Medio de pago inválido");
    }
    if (dto.financialInstitutionId) {
      const bank = await this.prisma.financialInstitution.findFirst({
        where: { id: dto.financialInstitutionId, organizationId: actor.organizationId, isActive: true }
      });
      if (!bank) throw new BadRequestException("Banco inválido");
    }
    if (dto.cashRegisterId) {
      if (!dto.branchId) throw new BadRequestException("Selecciona una sucursal para asociar una caja");
      const register = await this.prisma.cashRegister.findFirst({
        where: {
          id: dto.cashRegisterId,
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          currency: dto.currencyId,
          status: CashRegisterStatus.OPEN
        }
      });
      if (!register) throw new BadRequestException("Caja abierta inválida para la sucursal y moneda");
    }
  }

  private async paymentForMutation(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    paymentId: string,
    expectedVersion: number
  ) {
    const payment = await tx.companyPayment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId }
    });
    if (!payment) throw new NotFoundException("Pago empresarial no encontrado");
    if (payment.version !== expectedVersion)
      throw new ConflictException("El pago fue modificado por otro usuario");
    if (payment.branchId) await this.resolveBranchScope(actor, payment.branchId, "AUTHORIZED");
    if (!payment.branchId && !this.has(actor, "agreements.debt_report.all_branches")) {
      const inaccessibleAllocation = await tx.companyPaymentAllocation.findFirst({
        where: {
          companyPaymentId: paymentId,
          reversedAt: null,
          agreementCharge: { branchId: { notIn: actor.branchIds } }
        },
        select: { id: true }
      });
      if (inaccessibleAllocation)
        throw new ForbiddenException("El pago contiene cargos fuera de tus sucursales autorizadas");
    }
    return payment;
  }

  private async resolveBranchScope(
    actor: AuthUser,
    requestedBranchId?: string,
    scope: "AUTHORIZED" | "ALL" = "AUTHORIZED"
  ) {
    const canViewAll = this.has(actor, "agreements.debt_report.all_branches");
    if (scope === "ALL" && !canViewAll)
      throw new ForbiddenException("No tienes permiso para consultar todas las sucursales");
    if (requestedBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: requestedBranchId, organizationId: actor.organizationId, isActive: true },
        select: { id: true }
      });
      if (!branch) throw new BadRequestException("Sucursal inválida");
      if (!canViewAll && !actor.branchIds.includes(requestedBranchId))
        throw new ForbiddenException("No tienes acceso a la sucursal seleccionada");
      return [requestedBranchId];
    }
    return scope === "ALL" && canViewAll ? undefined : actor.branchIds;
  }

  private has(actor: AuthUser, permission: string) {
    return actor.permissions.includes("organization.manage_all") || actor.permissions.includes(permission);
  }

  private decimal(value: number) {
    return new Prisma.Decimal(this.money(value));
  }
}
