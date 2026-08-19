import { toDecimal, sumDecimals, isDecimalEqual } from "./utils/monetary.util";
import { createHash, randomInt } from "crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CashMovementDirection,
  CashMovementType,
  CashRegisterStatus,
  CommunicationChannel,
  CommunicationJobStatus,
  AuthorizationStatus,
  LedgerEntryStatus,
  LedgerEntryType,
  LedgerSourceType,
  InstallmentFrequency,
  InstallmentPlanStatus,
  InstallmentStatus,
  PaymentLinkStatus,
  PaymentMethod,
  PaymentMethodType,
  PaymentSettlementStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  TreatmentPlanItemStatus
} from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { resolvePagination } from "../../common/utils/pagination.util";
import { createXlsxWorkbook } from "../../common/utils/xlsx.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { EmailService } from "../notifications/email.service";
import { CashDiscountsService, CashDiscountPreviewResult } from "../cash-discounts/cash-discounts.service";
import {
  AddPaymentAllocationsDto,
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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService?: EmailService,
    private readonly cashDiscounts?: CashDiscountsService
  ) {}

  private paymentDetailInclude() {
    return {
      organization: {
        select: {
          id: true,
          name: true,
          legalName: true,
          phone: true,
          email: true,
          address: true,
          logoUrl: true
        }
      },
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          documentNumber: true,
          birthDate: true,
          email: true,
          agreement: { select: { id: true, name: true } }
        }
      },
      branch: {
        select: {
          id: true,
          name: true,
          phone: true,
          countryCode: true,
          email: true,
          replyToEmail: true,
          website: true,
          address: true,
          exteriorNumber: true,
          interiorNumber: true,
          neighborhood: true,
          postalCode: true,
          municipality: true,
          city: true,
          state: true,
          country: true,
          timezone: true,
          brand: {
            select: {
              id: true,
              name: true,
              legalName: true,
              shortName: true,
              logoUrl: true,
              primaryColor: true,
              secondaryColor: true,
              phone: true,
              senderEmail: true,
              replyToEmail: true,
              website: true,
              privacyNoticeUrl: true
            }
          }
        }
      },
      paymentMethod: { select: { id: true, name: true, type: true } },
      financialInstitution: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
      splits: {
        include: {
          paymentMethod: { select: { id: true, name: true, type: true } },
          financialInstitution: { select: { id: true, name: true } },
          settlements: {
            include: { financialInstitution: { select: { id: true, name: true } }, cashMovement: true },
            orderBy: { sequence: "asc" as const }
          }
        }
      },
      settlements: { orderBy: [{ dueAt: "asc" as const }, { sequence: "asc" as const }] },
      allocations: {
        include: {
          treatmentPlanItem: {
            select: {
              id: true,
              treatmentPlanId: true,
              toothNumber: true,
              surface: true,
              total: true,
              status: true,
              completedAt: true,
              treatmentPlan: {
                select: {
                  id: true,
                  name: true,
                  specialtySnapshotName: true,
                  professional: { select: { firstName: true, lastName: true } },
                  specialty: { select: { name: true } },
                  branch: { select: { name: true } }
                }
              },
              procedure: { select: { id: true, code: true, name: true } },
              paymentAllocations: {
                select: {
                  amount: true,
                  settlementDiscountAmount: true,
                  payment: { select: { status: true } }
                }
              }
            }
          }
        }
      },
      installmentAllocations: {
        include: {
          installment: {
            include: {
              installmentPlan: {
                select: {
                  id: true,
                  treatmentPlanId: true,
                  treatmentPlan: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      },
      cashMovements: {
        select: {
          id: true,
          cashRegisterId: true,
          createdAt: true,
          cashRegister: {
            select: {
              id: true,
              status: true,
              openedAt: true,
              closedAt: true,
              branch: { select: { id: true, name: true } },
              openedBy: { select: { id: true, firstName: true, lastName: true } }
            }
          }
        },
        orderBy: { createdAt: "asc" as const },
        take: 1
      },
      refunds: { select: { id: true, amount: true, status: true, createdAt: true } },
      cashDiscountApplication: {
        include: { items: { orderBy: { createdAt: "asc" as const } } }
      }
    } satisfies Prisma.PaymentInclude;
  }

  async listPayments(actor: AuthUser, query: ListPaymentsQueryDto) {
    const { skip, take } = resolvePagination(query);
    const searchPaymentNumber =
      query.search?.trim() && /^\d{6}$/.test(query.search.trim()) ? Number(query.search.trim()) : null;
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        patient: { branchId: branchScope(actor) },
        ...(query.patientId ? { patientId: query.patientId } : {}),
        branchId: branchScope(actor, query.branchId),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { reference: { contains: query.search, mode: "insensitive" } },
                { notes: { contains: query.search, mode: "insensitive" } },
                { patient: { firstName: { contains: query.search, mode: "insensitive" } } },
                { patient: { lastName: { contains: query.search, mode: "insensitive" } } },
                ...(searchPaymentNumber !== null ? [{ paymentNumber: searchPaymentNumber }] : [])
              ]
            }
          : {})
      },
      include: this.paymentDetailInclude(),
      skip,
      take,
      orderBy: { paidAt: "desc" }
    });

    return payments.map((payment) => this.enrichPayment(payment));
  }

  async listCancelledPendingPayments(actor: AuthUser, query: ListCancelledPendingPaymentsQueryDto) {
    if (query.linkStatus === PaymentLinkStatus.PAID) {
      throw new BadRequestException("Paid payment links do not belong to cancelled and pending payments");
    }

    const { skip, take } = resolvePagination(query);
    const branchWhere = branchScope(actor, query.branchId);
    const search = query.search?.trim();
    const dateRange = this.resolveOptionalDateRange(query.dateFrom, query.dateTo);
    const pendingLinkStatuses = query.linkStatus
      ? [query.linkStatus]
      : [PaymentLinkStatus.CREATED, PaymentLinkStatus.EXPIRED, PaymentLinkStatus.CANCELLED];

    const paymentSearchWhere: Prisma.PaymentWhereInput = search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
            { voidReason: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
            { branch: { name: { contains: search, mode: "insensitive" } } },
            { paymentMethod: { name: { contains: search, mode: "insensitive" } } },
            { receivedBy: { firstName: { contains: search, mode: "insensitive" } } },
            { receivedBy: { lastName: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {};

    const linkSearchWhere: Prisma.PaymentLinkWhereInput = search
      ? {
          OR: [
            { url: { contains: search, mode: "insensitive" } },
            { patient: { firstName: { contains: search, mode: "insensitive" } } },
            { patient: { lastName: { contains: search, mode: "insensitive" } } },
            { patient: { documentNumber: { contains: search, mode: "insensitive" } } },
            { treatmentPlan: { name: { contains: search, mode: "insensitive" } } }
          ]
        }
      : {};

    const voidedPaymentWhere: Prisma.PaymentWhereInput = {
      organizationId: actor.organizationId,
      status: PaymentStatus.VOIDED,
      branchId: branchWhere,
      patient: { branchId: branchWhere },
      ...(dateRange ? { voidedAt: dateRange } : {}),
      ...paymentSearchWhere
    };

    const pendingLinkWhere: Prisma.PaymentLinkWhereInput = {
      organizationId: actor.organizationId,
      status: { in: pendingLinkStatuses },
      patient: { branchId: branchWhere },
      ...(dateRange ? { createdAt: dateRange } : {}),
      ...linkSearchWhere
    };

    const [voidedPayments, pendingLinks, voidedSummary, linkSummary, linkStatusSummary] = await Promise.all([
      this.prisma.payment.findMany({
        where: voidedPaymentWhere,
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
          branch: { select: { id: true, name: true } },
          paymentMethod: { select: { id: true, name: true, type: true } },
          financialInstitution: { select: { id: true, name: true } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
          allocations: {
            select: {
              id: true,
              amount: true,
              treatmentPlanItemId: true,
              treatmentPlanItem: {
                select: {
                  id: true,
                  treatmentPlanId: true,
                  treatmentPlan: { select: { id: true, name: true } },
                  procedure: { select: { id: true, code: true, name: true } },
                  toothNumber: true,
                  surface: true
                }
              }
            }
          },
          refunds: { select: { id: true, amount: true, status: true, createdAt: true } }
        },
        skip,
        take,
        orderBy: [{ voidedAt: "desc" }, { paidAt: "desc" }]
      }),
      this.prisma.paymentLink.findMany({
        where: pendingLinkWhere,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              documentNumber: true,
              branch: { select: { id: true, name: true } }
            }
          },
          treatmentPlan: { select: { id: true, name: true } }
        },
        skip,
        take,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.payment.aggregate({
        where: voidedPaymentWhere,
        _count: { _all: true },
        _sum: { amount: true }
      }),
      this.prisma.paymentLink.aggregate({
        where: pendingLinkWhere,
        _count: { _all: true },
        _sum: { amount: true }
      }),
      this.prisma.paymentLink.groupBy({
        by: ["status"],
        where: pendingLinkWhere,
        _count: { _all: true },
        _sum: { amount: true }
      })
    ]);

    const voidedByIds = [
      ...new Set(
        voidedPayments.map((payment) => payment.voidedById).filter((id): id is string => Boolean(id))
      )
    ];
    const voidedByUsers = voidedByIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: voidedByIds }, organizationId: actor.organizationId },
          select: { id: true, firstName: true, lastName: true }
        })
      : [];
    const voidedByUserById = new Map(voidedByUsers.map((user) => [user.id, user]));
    const enrichedVoidedPayments = voidedPayments.map((payment) => {
      const treatmentMap = new Map<string, { id: string; name: string; procedures: string[] }>();
      for (const allocation of payment.allocations) {
        const item = allocation.treatmentPlanItem;
        const plan = item?.treatmentPlan;
        if (!plan) continue;
        const current = treatmentMap.get(plan.id) ?? { id: plan.id, name: plan.name, procedures: [] };
        const procedureName = item.procedure?.name ?? item.procedure?.code;
        if (procedureName && !current.procedures.includes(procedureName))
          current.procedures.push(procedureName);
        treatmentMap.set(plan.id, current);
      }

      return {
        ...payment,
        paymentNumber: this.publicPaymentNumber(payment),
        voidedBy: payment.voidedById ? (voidedByUserById.get(payment.voidedById) ?? null) : null,
        treatments: Array.from(treatmentMap.values()).map((treatment) => ({
          ...treatment,
          number: this.publicPlanNumber(treatment.id)
        }))
      };
    });

    const linkStatusTotals = linkStatusSummary.reduce<
      Record<PaymentLinkStatus, { count: number; amount: number }>
    >(
      (totals, row) => {
        totals[row.status] = {
          count: row._count._all,
          amount: this.roundMoney(Number(row._sum.amount ?? 0))
        };
        return totals;
      },
      {
        [PaymentLinkStatus.CREATED]: { count: 0, amount: 0 },
        [PaymentLinkStatus.PAID]: { count: 0, amount: 0 },
        [PaymentLinkStatus.EXPIRED]: { count: 0, amount: 0 },
        [PaymentLinkStatus.CANCELLED]: { count: 0, amount: 0 }
      }
    );

    return {
      summary: {
        voidedPayments: {
          count: voidedSummary._count._all,
          amount: this.roundMoney(Number(voidedSummary._sum.amount ?? 0))
        },
        pendingLinks: {
          count: linkSummary._count._all,
          amount: this.roundMoney(Number(linkSummary._sum.amount ?? 0))
        },
        linkStatusTotals
      },
      voidedPayments: enrichedVoidedPayments,
      pendingLinks
    };
  }

  async createPayment(actor: AuthUser, dto: CreatePaymentDto) {
    await this.ensureBranch(actor, dto.branchId);
    const patient = await this.ensurePatient(actor, dto.patientId);
    if (patient.branchId !== dto.branchId) {
      throw new BadRequestException("Patient does not belong to the selected branch");
    }

    const splits = this.normalizePaymentSplits(dto.splits);
    const splitTotal = sumDecimals(splits.map((split) => split.amount));
    const amount = dto.amount !== undefined ? toDecimal(dto.amount) : splitTotal;
    if (amount.lte(0)) throw new BadRequestException("Payment amount must be greater than zero");

    let cashDiscountPreview: CashDiscountPreviewResult | null = null;
    if (dto.cashDiscountRuleId) {
      if (!this.cashDiscounts) throw new BadRequestException("Cash discount service is unavailable");
      if (!dto.cashDiscountTreatmentPlanId || !dto.allocations?.length) {
        throw new BadRequestException("Cash discounts require a treatment plan and selected items");
      }
      cashDiscountPreview = await this.cashDiscounts.preview(actor, dto.patientId, {
        branchId: dto.branchId,
        treatmentPlanId: dto.cashDiscountTreatmentPlanId,
        cashDiscountRuleId: dto.cashDiscountRuleId,
        items: dto.allocations.map((allocation) => ({
          treatmentPlanItemId: allocation.treatmentPlanItemId,
          outstandingAmount: allocation.amount,
          expectedVersion: allocation.expectedVersion
        }))
      });
      if (!isDecimalEqual(cashDiscountPreview.finalAmount, amount)) {
        throw new BadRequestException({
          code: "PAYMENT_TOTAL_DOES_NOT_SETTLE_DISCOUNTED_BALANCE",
          message: `Este descuento requiere liquidar completamente las prestaciones seleccionadas. El saldo resultante es de $${cashDiscountPreview.finalAmount.toFixed(2)}.`,
          discountedTotal: cashDiscountPreview.finalAmount.toFixed(2),
          paymentTotal: amount.toFixed(2)
        });
      }
    }

    const paymentMethodsById = new Map<string, PaymentMethod>();
    if (splits.length) {
      if (!isDecimalEqual(splitTotal, amount)) {
        throw new BadRequestException("Payment method splits must match the payment amount");
      }
      for (const split of splits) {
        const method = await this.ensurePaymentMethod(actor, split.paymentMethodId);
        paymentMethodsById.set(method.id, method);
        if (split.financialInstitutionId)
          await this.ensureFinancialInstitution(actor, split.financialInstitutionId);
        this.validatePaymentMethodRequirements(method, split.reference, split.financialInstitutionId);
        await this.validateScheduledSettlements(actor, method, split);
      }
    }

    const primaryPaymentMethodId = dto.paymentMethodId ?? splits[0]?.paymentMethodId;
    const primaryFinancialInstitutionId =
      dto.financialInstitutionId ??
      splits.find((split) => split.financialInstitutionId)?.financialInstitutionId;
    if (primaryPaymentMethodId && !paymentMethodsById.has(primaryPaymentMethodId)) {
      paymentMethodsById.set(
        primaryPaymentMethodId,
        await this.ensurePaymentMethod(actor, primaryPaymentMethodId)
      );
    }
    if (primaryFinancialInstitutionId)
      await this.ensureFinancialInstitution(actor, primaryFinancialInstitutionId);
    if (!primaryPaymentMethodId) throw new BadRequestException("Payment method is required");
    const primaryMethod = paymentMethodsById.get(primaryPaymentMethodId)!;
    if (!splits.length) {
      this.validatePaymentMethodRequirements(
        primaryMethod,
        dto.reference ?? null,
        primaryFinancialInstitutionId ?? null
      );
    }

    const paymentFinancials = splits.length
      ? splits.reduce(
          (totals, split) => {
            const method = paymentMethodsById.get(split.paymentMethodId)!;
            const retention = split.amount.mul(method.retentionPercent).div(100).toDecimalPlaces(2);
            return {
              retention: totals.retention.add(retention),
              net: totals.net.add(split.amount.sub(retention))
            };
          },
          { retention: new Prisma.Decimal(0), net: new Prisma.Decimal(0) }
        )
      : (() => {
          const retention = amount.mul(primaryMethod.retentionPercent).div(100).toDecimalPlaces(2);
          return { retention, net: amount.sub(retention) };
        })();

    const openRegister = await this.ensureOpenCashRegister(actor, dto.branchId);
    const idempotencyKey = dto.idempotencyKey?.trim();
    const requestHash = idempotencyKey ? this.hashPaymentRequest(dto, amount, splits) : null;

    if (idempotencyKey && requestHash) {
      const existing = await this.prisma.paymentIdempotency.findUnique({
        where: { organizationId_idempotencyKey: { organizationId: actor.organizationId, idempotencyKey } }
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictException("Idempotency key was already used with a different payment request");
        }
        if (existing.paymentId) return this.getPayment(actor, existing.paymentId);
        throw new ConflictException("Payment request is already being processed");
      }
    }

    const created = await this.createPaymentWithPublicNumberRetry(async (paymentNumber) =>
      this.prisma.$transaction(async (tx) => {
        const currentMethods = await tx.paymentMethod.findMany({
          where: {
            organizationId: actor.organizationId,
            id: { in: [...paymentMethodsById.keys()] },
            isActive: true
          },
          select: { id: true, version: true }
        });
        const currentVersions = new Map(currentMethods.map((method) => [method.id, method.version]));
        if (
          currentMethods.length !== paymentMethodsById.size ||
          [...paymentMethodsById.values()].some((method) => currentVersions.get(method.id) !== method.version)
        ) {
          throw new ConflictException("Payment method configuration changed; refresh the checkout and retry");
        }

        const confirmedCashDiscount = cashDiscountPreview
          ? await this.cashDiscounts!.preview(
              actor,
              dto.patientId,
              {
                branchId: dto.branchId,
                treatmentPlanId: dto.cashDiscountTreatmentPlanId!,
                cashDiscountRuleId: dto.cashDiscountRuleId!,
                items: dto.allocations!.map((allocation) => ({
                  treatmentPlanItemId: allocation.treatmentPlanItemId,
                  outstandingAmount: allocation.amount,
                  expectedVersion: allocation.expectedVersion
                }))
              },
              tx
            )
          : null;
        if (confirmedCashDiscount && !isDecimalEqual(confirmedCashDiscount.finalAmount, amount)) {
          throw new ConflictException({
            code: "PAYMENT_TOTAL_DOES_NOT_SETTLE_DISCOUNTED_BALANCE",
            message: "El total descontado cambió antes de confirmar. Actualiza el cobro."
          });
        }
        let idempotencyRecordId: string | null = null;
        if (idempotencyKey && requestHash) {
          const record = await tx.paymentIdempotency.create({
            data: {
              organizationId: actor.organizationId,
              idempotencyKey,
              requestHash,
              status: "PROCESSING",
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          });
          idempotencyRecordId = record.id;
        }

        const payment = await tx.payment.create({
          data: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            patientId: dto.patientId,
            receivedById: actor.id,
            paymentNumber,
            amount,
            grossAmount: amount,
            retentionAmount: paymentFinancials.retention,
            netAmount: paymentFinancials.net,
            currency: dto.currency ?? "MXN",
            paymentMethodId: primaryPaymentMethodId,
            financialInstitutionId: primaryFinancialInstitutionId,
            status: PaymentStatus.RECEIVED,
            reference: dto.reference?.trim(),
            notes: dto.notes?.trim(),
            paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
            idempotencyKey,
            paymentMethodSnapshot: this.paymentMethodSnapshot(primaryMethod)
          }
        });

        for (const split of splits) {
          const method = paymentMethodsById.get(split.paymentMethodId)!;
          const retentionAmount = split.amount.mul(method.retentionPercent).div(100).toDecimalPlaces(2);
          const createdSplit = await tx.paymentMethodSplit.create({
            data: {
              paymentId: payment.id,
              paymentMethodId: split.paymentMethodId,
              amount: split.amount,
              grossAmount: split.amount,
              retentionAmount,
              netAmount: split.amount.sub(retentionAmount),
              paymentMethodCodeSnapshot: method.publicCode,
              paymentMethodNameSnapshot: method.name,
              paymentMethodTypeSnapshot: method.type,
              retentionPercentSnapshot: method.retentionPercent,
              allowsRefundSnapshot: method.allowsRefund,
              acceptsMultipleSettlementsSnapshot: method.acceptsMultipleSettlements,
              requiresReferenceSnapshot: method.requiresReference,
              requiresFinancialInstitutionSnapshot: method.requiresFinancialInstitution,
              includeInCollectionReportsSnapshot: method.includeInCollectionReports,
              includeInPhysicalCashBalanceSnapshot: method.includeInPhysicalCashBalance,
              includeInCashFlowReportsSnapshot: method.includeInCashFlowReports,
              includeInClosingSummarySnapshot: method.includeInClosingSummary,
              includeInGraphicalReportsSnapshot: method.includeInGraphicalReports,
              financialInstitutionId: split.financialInstitutionId,
              reference: split.reference
            }
          });
          if (split.scheduledSettlements.length) {
            await tx.paymentSettlement.createMany({
              data: split.scheduledSettlements.map((settlement) => ({
                organizationId: actor.organizationId,
                branchId: dto.branchId,
                paymentId: payment.id,
                paymentMethodSplitId: createdSplit.id,
                paymentMethodId: method.id,
                sequence: settlement.sequence,
                amount: settlement.amount,
                dueAt: settlement.dueAt,
                reference: settlement.reference,
                financialInstitutionId: settlement.financialInstitutionId,
                notes: settlement.notes
              }))
            });
          }
        }

        if (openRegister) {
          const activeRegister = await tx.cashRegister.findFirst({
            where: { id: openRegister.id, status: CashRegisterStatus.OPEN },
            select: { id: true }
          });
          if (!activeRegister)
            throw new ConflictException(
              "Cash register is being closed. Refresh before receiving the payment."
            );
        }

        if (openRegister && splits.length) {
          for (const split of splits) {
            if (split.scheduledSettlements.length) continue;
            const method = paymentMethodsById.get(split.paymentMethodId)!;
            const retentionAmount = split.amount.mul(method.retentionPercent).div(100).toDecimalPlaces(2);
            await tx.cashMovement.create({
              data: {
                organizationId: actor.organizationId,
                branchId: dto.branchId,
                cashRegisterId: openRegister.id,
                type: CashMovementType.INCOME,
                direction: CashMovementDirection.IN,
                amount: split.amount.sub(retentionAmount),
                paymentId: payment.id,
                paymentMethodId: split.paymentMethodId,
                ...this.cashMovementMethodSnapshot(method),
                reference: split.reference,
                description: `Ingreso por pago #${paymentNumber}`,
                createdById: actor.id
              }
            });
          }
        } else if (openRegister) {
          await tx.cashMovement.create({
            data: {
              organizationId: actor.organizationId,
              branchId: dto.branchId,
              cashRegisterId: openRegister.id,
              type: CashMovementType.INCOME,
              direction: CashMovementDirection.IN,
              amount: paymentFinancials.net,
              paymentId: payment.id,
              paymentMethodId: primaryPaymentMethodId,
              ...this.cashMovementMethodSnapshot(primaryMethod),
              reference: dto.reference?.trim(),
              description: `Ingreso por pago #${paymentNumber}`,
              createdById: actor.id
            }
          });
        }

        await tx.patientLedgerEntry.create({
          data: {
            organizationId: actor.organizationId,
            branchId: payment.branchId,
            patientId: payment.patientId,
            occurredAt: payment.paidAt,
            entryType: LedgerEntryType.PAYMENT,
            sourceType: LedgerSourceType.PAYMENT,
            sourceId: payment.id,
            creditAmount: amount,
            currency: payment.currency,
            descriptionSnapshot: `Pago #${paymentNumber}`
          }
        });

        let allocationIds = new Map<string, string>();
        if (dto.allocations?.length) {
          const allocations = confirmedCashDiscount
            ? confirmedCashDiscount.items.map((item) => ({
                treatmentPlanItemId: item.treatmentPlanItemId,
                amount: item.finalAmount.toNumber(),
                settlementDiscountAmount: item.discountAmount.toNumber(),
                expectedVersion: item.expectedVersion
              }))
            : dto.allocations;
          allocationIds = await this.applyAllocations(tx, actor, payment.id, allocations);
        }

        if (confirmedCashDiscount) {
          await this.cashDiscounts!.createApplication(
            tx,
            actor,
            payment.id,
            confirmedCashDiscount,
            allocationIds
          );
        }

        if (idempotencyRecordId) {
          await tx.paymentIdempotency.update({
            where: { id: idempotencyRecordId },
            data: { paymentId: payment.id, status: "COMPLETED" }
          });
        }

        await this.audit(tx, actor, {
          entity: "Payment",
          entityId: payment.id,
          action: "create",
          after: {
            paymentNumber,
            patientId: payment.patientId,
            amount: amount.toString(),
            currency: payment.currency,
            paidAt: payment.paidAt,
            splits: splits.length,
            allocations: dto.allocations?.length ?? 0,
            cashDiscountRuleId: confirmedCashDiscount?.rule.id ?? null,
            cashDiscountAmount: confirmedCashDiscount?.discountAmount.toFixed(2) ?? null
          }
        });

        return payment.id;
      })
    );

    return this.getPayment(actor, created);
  }

  async updatePayment(actor: AuthUser, paymentId: string, dto: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        paymentMethod: { select: { id: true, name: true } },
        financialInstitution: { select: { id: true, name: true } }
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");

    if (payment.status === PaymentStatus.VOIDED || payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException("Voided or refunded payments cannot be edited");
    }

    if (dto.paymentMethodId && dto.paymentMethodId !== payment.paymentMethodId) {
      throw new BadRequestException(
        "El medio de pago histórico no puede reemplazarse. Anula el pago y registra uno nuevo."
      );
    }
    if (dto.financialInstitutionId) await this.ensureFinancialInstitution(actor, dto.financialInstitutionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          ...(dto.paymentMethodId ? { paymentMethodId: dto.paymentMethodId } : {}),
          ...(dto.financialInstitutionId !== undefined
            ? { financialInstitutionId: dto.financialInstitutionId.trim() || null }
            : {}),
          ...(dto.reference !== undefined ? { reference: dto.reference.trim() || null } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
          ...(dto.paidAt ? { paidAt: new Date(dto.paidAt) } : {})
        }
      });

      await this.audit(tx, actor, {
        entity: "Payment",
        entityId: payment.id,
        action: "update",
        before: {
          paymentMethodId: payment.paymentMethodId || "",
          financialInstitutionId: payment.financialInstitutionId,
          reference: payment.reference,
          notes: payment.notes,
          paidAt: payment.paidAt
        },
        after: dto as Prisma.InputJsonValue
      });
    });

    return this.getPayment(actor, payment.id);
  }

  async getPaymentReceipt(actor: AuthUser, paymentId: string) {
    const payment = await this.getPayment(actor, paymentId);
    await this.audit(this.prisma, actor, {
      entity: "Payment",
      entityId: payment.id,
      action: "receipt_print",
      after: {
        paymentNumber: payment.paymentNumber,
        patientId: payment.patientId,
        amount: payment.amount
      }
    });

    return {
      payment,
      printableText: this.buildReceiptText(payment)
    };
  }

  async getPaymentReceiptPdf(actor: AuthUser, paymentId: string) {
    const { payment } = await this.getPaymentReceipt(actor, paymentId);
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const margin = 42;
    let y = 790;
    const drawText = (text: string, x: number, size = 10, font = regular, color = rgb(0.1, 0.15, 0.25)) => {
      page.drawText(text.slice(0, 115), { x, y, size, font, color });
      y -= size + 7;
    };
    const drawRule = () => {
      page.drawLine({
        start: { x: margin, y },
        end: { x: 553, y },
        thickness: 0.7,
        color: rgb(0.72, 0.76, 0.82)
      });
      y -= 18;
    };

    const patientName = `${payment.patient?.firstName ?? ""} ${payment.patient?.lastName ?? ""}`.trim();
    const branding = payment.receiptBranding;
    const brandName = branding.businessName;
    page.drawText(brandName, { x: margin, y, size: 18, font: bold, color: rgb(0.02, 0.25, 0.45) });
    page.drawText(`Pago #${payment.paymentNumber}`, {
      x: 430,
      y,
      size: 12,
      font: bold,
      color: rgb(0.02, 0.25, 0.45)
    });
    y -= 34;
    page.drawText("Comprobante de pago", { x: 210, y, size: 17, font: bold, color: rgb(0, 0, 0) });
    y -= 34;

    drawText(`Paciente: ${patientName || "-"}`, margin, 10, bold);
    drawText(`Documento: ${payment.patient?.documentNumber ?? "-"}`, margin);
    drawText(`Fecha transaccion: ${new Date(payment.paidAt).toLocaleString("es-MX")}`, margin);
    drawText(`Sucursal: ${payment.branch?.name ?? "-"}`, margin);
    drawRule();

    drawText("Tratamientos pagados", margin, 12, bold);
    for (const treatment of payment.treatmentRefs ?? []) {
      drawText(`#${treatment.number} - ${treatment.name}`, margin, 10, bold);
      for (const procedure of treatment.procedures ?? []) drawText(`  ${procedure}`, margin + 14, 9);
    }
    if (!payment.treatmentRefs?.length) drawText("Pago recibido sin aplicaciones a tratamiento.", margin);
    drawRule();

    drawText("Prestaciones", margin, 12, bold);
    for (const row of payment.breakdown ?? []) {
      drawText(
        `${this.humanizeReceiptDetail(row.detail)} | Plan #${row.treatmentNumber} | Precio ${this.formatCurrency(row.baseAmount)} | Pagado ${this.formatCurrency(row.paidAmount)}`,
        margin,
        8
      );
      if (y < 120) break;
    }
    drawRule();

    drawText("Transaccion", margin, 12, bold);
    for (const split of this.publicPaymentMethods(payment)) {
      drawText(
        `#${payment.paymentNumber} | ${split.name} | Ref. ${split.reference ?? "-"} | ${this.formatCurrency(split.amount)}`,
        margin
      );
    }
    if (payment.cashDiscountApplication) {
      drawText(
        `Descuento por caja: ${payment.cashDiscountApplication.ruleNameSnapshot} (${payment.cashDiscountApplication.discountPercentSnapshot} %) -${this.formatCurrency(payment.cashDiscountApplication.discountAmount)}`,
        margin,
        9,
        bold
      );
      drawText(
        `Saldo original: ${this.formatCurrency(payment.cashDiscountApplication.originalAmount)}`,
        margin,
        9
      );
    }
    drawText(`Total: ${this.formatCurrency(payment.amount)} ${payment.currency ?? ""}`, margin, 11, bold);

    y = 70;
    drawText(branding.address || payment.organization?.address || "-", margin, 8);
    drawText(
      [branding.phone || payment.organization?.phone, branding.email || payment.organization?.email]
        .filter(Boolean)
        .join(" - ") || "-",
      margin,
      8
    );
    const bytes = await pdf.save();
    return {
      bytes,
      fileName: `Comprobante_Pago_${payment.paymentNumber}_${patientName.replace(/[^a-zA-Z0-9]+/g, "_") || "Paciente"}.pdf`
    };
  }

  async getDailyReceiptPdf(actor: AuthUser, paymentId: string) {
    const basePayment = await this.getPayment(actor, paymentId);
    const date = this.localDateString(basePayment.paidAt, basePayment.branch?.timezone);
    return this.getPatientDailyReceiptPdf(actor, basePayment.patientId, {
      date,
      branchId: basePayment.branchId
    });
  }

  async getPatientDailyReceipt(actor: AuthUser, patientId: string, query: DailyReceiptQueryDto) {
    this.assertLocalDate(query.date);
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchScope(actor, query.branchId), organizationId: actor.organizationId },
      select: {
        id: true,
        name: true,
        timezone: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        brand: true
      }
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        documentNumber: true,
        email: true,
        agreement: { select: { id: true, name: true } }
      }
    });
    if (!patient) throw new NotFoundException("Patient not found");

    const range = this.zonedDayRange(query.date, branch.timezone);
    const paymentsRaw = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId,
        branchId: branch.id,
        paidAt: { gte: range.start, lt: range.end },
        status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] }
      },
      include: this.paymentDetailInclude(),
      orderBy: { paidAt: "asc" }
    });
    if (!paymentsRaw.length) throw new NotFoundException("No existen pagos validos para esta fecha.");

    const payments = paymentsRaw.map((payment) => this.enrichPayment(payment));
    const totalAmount = this.roundMoney(
      payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    );
    const paymentMethods = payments.flatMap((payment: any) =>
      this.publicPaymentMethods(payment).map((method: any) => ({
        ...method,
        paymentNumber: payment.paymentNumber
      }))
    );
    const breakdown = payments.flatMap((payment: any) =>
      (payment.breakdown ?? []).map((row: any) => ({ ...row, paymentNumber: payment.paymentNumber }))
    );
    const treatments = new Map<
      string,
      { id: string; number: string; name: string; procedures: Set<string> }
    >();
    for (const payment of payments as any[]) {
      for (const treatment of payment.treatmentRefs ?? []) {
        const current = treatments.get(treatment.id) ?? {
          id: treatment.id,
          number: treatment.number,
          name: treatment.name,
          procedures: new Set<string>()
        };
        for (const procedure of treatment.procedures ?? []) current.procedures.add(procedure);
        treatments.set(treatment.id, current);
      }
    }

    await this.audit(this.prisma, actor, {
      entity: "Payment",
      action: "daily_receipt_view",
      after: {
        patientId,
        branchId: branch.id,
        date: query.date,
        paymentNumbers: payments.map((payment: any) => payment.paymentNumber),
        totalAmount
      }
    });

    return {
      receiptType: "DAILY" as const,
      date: query.date,
      printedAt: new Date(),
      patient,
      branch,
      receiptBranding: this.resolveReceiptBranding(
        (payments[0] as any).branch,
        (payments[0] as any).organization
      ),
      payments,
      paymentNumbers: payments.map((payment: any) => payment.paymentNumber),
      totalAmount,
      paymentMethods,
      breakdown,
      treatments: Array.from(treatments.values()).map((treatment) => ({
        ...treatment,
        procedures: Array.from(treatment.procedures)
      }))
    };
  }

  async getPatientDailyReceiptPdf(actor: AuthUser, patientId: string, query: DailyReceiptQueryDto) {
    const receipt = await this.getPatientDailyReceipt(actor, patientId, query);
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const margin = 42;
    let y = 790;
    const drawText = (text: string, x: number, size = 10, font = regular, color = rgb(0.1, 0.15, 0.25)) => {
      page.drawText(text.slice(0, 115), { x, y, size, font, color });
      y -= size + 7;
    };
    const drawRule = () => {
      page.drawLine({
        start: { x: margin, y },
        end: { x: 553, y },
        thickness: 0.7,
        color: rgb(0.72, 0.76, 0.82)
      });
      y -= 18;
    };

    const patientName = `${receipt.patient.firstName ?? ""} ${receipt.patient.lastName ?? ""}`.trim();
    const branding = receipt.receiptBranding;
    const brandName = branding.businessName;
    page.drawText(brandName, { x: margin, y, size: 18, font: bold, color: rgb(0.02, 0.25, 0.45) });
    page.drawText(`Fecha: ${this.formatLocalDate(receipt.date)}`, {
      x: 410,
      y,
      size: 12,
      font: bold,
      color: rgb(0.02, 0.25, 0.45)
    });
    y -= 34;
    page.drawText("Comprobante de pago diario", { x: 190, y, size: 17, font: bold, color: rgb(0, 0, 0) });
    y -= 34;

    drawText(`Paciente: ${patientName || "-"}`, margin, 10, bold);
    drawText(`Documento: ${receipt.patient.documentNumber ?? "-"}`, margin);
    drawText(`Fecha: ${this.formatLocalDate(receipt.date)}`, margin);
    drawText(`Sucursal: ${receipt.branch?.name ?? "-"}`, margin);
    drawRule();

    drawText("Tratamientos pagados", margin, 12, bold);
    for (const treatment of receipt.treatments) {
      drawText(`#${treatment.number} - ${treatment.name}`, margin, 10, bold);
      for (const procedure of treatment.procedures ?? []) drawText(`  ${procedure}`, margin + 14, 9);
    }
    if (receipt.treatments.length === 0) drawText("Pagos recibidos sin aplicaciones a tratamiento.", margin);
    drawRule();

    drawText("Prestaciones", margin, 12, bold);
    for (const row of receipt.breakdown) {
      drawText(
        `${this.humanizeReceiptDetail(row.detail)} | Pago #${row.paymentNumber} | Plan #${row.treatmentNumber} | Precio ${this.formatCurrency(row.baseAmount)} | Pagado ${this.formatCurrency(row.paidAmount)}`,
        margin,
        8
      );
      if (y < 120) {
        drawText("...", margin, 8);
        break;
      }
    }
    drawRule();

    drawText("Transacciones", margin, 12, bold);
    for (const split of receipt.paymentMethods) {
      drawText(
        `Pago #${split.paymentNumber} | ${split.name} | Ref. ${split.reference ?? "-"} | ${this.formatCurrency(split.amount)}`,
        margin
      );
    }
    drawText(`Total: ${this.formatCurrency(receipt.totalAmount)} MXN`, margin, 11, bold);

    y = 70;
    drawText(branding.address || "-", margin, 8);
    drawText([branding.phone, branding.email].filter(Boolean).join(" - ") || "-", margin, 8);

    const bytes = await pdf.save();
    return {
      bytes,
      fileName: `Comprobante_Diario_${receipt.date}_${patientName.replace(/[^a-zA-Z0-9]+/g, "_") || "Paciente"}.pdf`
    };
  }

  async sendPaymentReceiptEmail(actor: AuthUser, paymentId: string, dto: ReceiptEmailDto) {
    const { payment } = await this.getPaymentReceipt(actor, paymentId);
    const patientEmail = this.normalizeReceiptEmail(payment.patient?.email);
    if (!patientEmail) throw new BadRequestException("El paciente no tiene un correo registrado.");
    const to = this.normalizeReceiptEmail(dto.to);
    if (!to || to !== patientEmail)
      throw new BadRequestException("El destinatario debe ser el correo registrado del paciente.");
    const pdf = await this.getPaymentReceiptPdf(actor, paymentId);
    return this.queueAndSendReceiptEmail(actor, {
      patientId: payment.patientId,
      paymentId: payment.id,
      branchId: payment.branchId,
      recipient: to,
      subject: dto.subject,
      message: dto.message,
      fileName: pdf.fileName,
      bytes: Buffer.from(pdf.bytes),
      templateKey: "payment_receipt",
      idempotencyKey: dto.idempotencyKey,
      documentType: "PAYMENT_RECEIPT",
      documentTitle: `Comprobante de pago #${payment.paymentNumber}`,
      patientName: this.displayName(payment.patient),
      branding: payment.receiptBranding,
      summaryRows: [
        ["Numero de pago", `#${payment.paymentNumber}`],
        ["Fecha", payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("es-MX") : "-"],
        ["Monto", `${this.formatCurrency(payment.amount)} ${payment.currency ?? "MXN"}`],
        ["Medio de pago", (payment.paymentMethods ?? [])[0]?.name ?? payment.paymentMethod?.name ?? "-"],
        [
          "Plan",
          (payment.treatmentRefs ?? [])[0]
            ? `#${payment.treatmentRefs[0].number} - ${payment.treatmentRefs[0].name}`
            : "-"
        ]
      ],
      metadata: {
        receiptType: "PAYMENT",
        paymentNumber: payment.paymentNumber,
        totalAmount: Number(payment.amount ?? 0)
      }
    });
  }

  async sendPatientDailyReceiptEmail(
    actor: AuthUser,
    patientId: string,
    query: DailyReceiptQueryDto,
    dto: ReceiptEmailDto
  ) {
    const receipt = await this.getPatientDailyReceipt(actor, patientId, query);
    const patientEmail = this.normalizeReceiptEmail(receipt.patient.email);
    if (!patientEmail) throw new BadRequestException("El paciente no tiene un correo registrado.");
    const to = this.normalizeReceiptEmail(dto.to);
    if (!to || to !== patientEmail)
      throw new BadRequestException("El destinatario debe ser el correo registrado del paciente.");
    const pdf = await this.getPatientDailyReceiptPdf(actor, patientId, query);
    return this.queueAndSendReceiptEmail(actor, {
      patientId,
      branchId: receipt.branch.id,
      recipient: to,
      subject: dto.subject,
      message: dto.message,
      fileName: pdf.fileName,
      bytes: Buffer.from(pdf.bytes),
      templateKey: "payment_daily_receipt",
      idempotencyKey: dto.idempotencyKey,
      documentType: "DAILY_PAYMENT_RECEIPT",
      documentTitle: `Comprobante diario de pagos - ${this.formatLocalDate(receipt.date)}`,
      patientName: this.displayName(receipt.patient),
      branding: receipt.receiptBranding,
      summaryRows: [
        ["Fecha", this.formatLocalDate(receipt.date)],
        ["Pagos incluidos", receipt.paymentNumbers.join(", ")],
        ["Cantidad de pagos", String(receipt.paymentNumbers.length)],
        ["Total del dia", `${this.formatCurrency(receipt.totalAmount)} MXN`],
        ["Sucursal", receipt.receiptBranding.businessName]
      ],
      metadata: {
        receiptType: "DAILY",
        date: receipt.date,
        paymentNumbers: receipt.paymentNumbers,
        totalAmount: receipt.totalAmount
      }
    });
  }

  async addAllocations(actor: AuthUser, paymentId: string, dto: AddPaymentAllocationsDto) {
    await this.prisma.$transaction(async (tx) => {
      await this.applyAllocations(tx, actor, paymentId, dto.allocations);
      await this.audit(tx, actor, {
        entity: "Payment",
        entityId: paymentId,
        action: "allocate",
        after: {
          allocations: dto.allocations.map((allocation) => ({
            treatmentPlanItemId: allocation.treatmentPlanItemId,
            amount: allocation.amount
          }))
        }
      });
    });

    return this.getPayment(actor, paymentId);
  }

  async removeAllocation(actor: AuthUser, allocationId: string) {
    const allocation = await this.prisma.paymentAllocation.findFirst({
      where: {
        id: allocationId,
        payment: {
          organizationId: actor.organizationId,
          branchId: branchScope(actor)
        }
      },
      include: {
        payment: true,
        treatmentPlanItem: true
      }
    });
    if (!allocation) throw new NotFoundException("Payment allocation not found");
    if (Number(allocation.settlementDiscountAmount ?? 0) > 0) {
      throw new BadRequestException(
        "An allocation with a cash discount cannot be detached; void the payment to reverse the complete transaction"
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentAllocation.delete({ where: { id: allocation.id } });

      const paymentAllocatedAfter = await tx.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: { paymentId: allocation.paymentId }
      });
      const allocatedOnPayment = Number(paymentAllocatedAfter._sum.amount ?? 0);
      await tx.payment.update({
        where: { id: allocation.paymentId },
        data: {
          status:
            allocatedOnPayment <= 0
              ? PaymentStatus.RECEIVED
              : allocatedOnPayment >= Number(allocation.payment.amount)
                ? PaymentStatus.ALLOCATED
                : PaymentStatus.PARTIALLY_ALLOCATED
        }
      });

      const itemAllocatedAfter = await tx.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          treatmentPlanItemId: allocation.treatmentPlanItemId,
          payment: {
            status: {
              in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED]
            }
          }
        }
      });
      const allocatedOnItem = Number(itemAllocatedAfter._sum.amount ?? 0);
      if (
        allocatedOnItem < Number(allocation.treatmentPlanItem.total) &&
        allocation.treatmentPlanItem.status === TreatmentPlanItemStatus.PAID
      ) {
        await tx.treatmentPlanItem.update({
          where: { id: allocation.treatmentPlanItemId },
          data: { status: TreatmentPlanItemStatus.ACCEPTED }
        });
      }

      await this.audit(tx, actor, {
        entity: "PaymentAllocation",
        entityId: allocation.id,
        action: "delete",
        before: {
          paymentId: allocation.paymentId,
          treatmentPlanItemId: allocation.treatmentPlanItemId,
          amount: allocation.amount
        },
        after: {
          paymentId: allocation.paymentId,
          unallocatedAmount: allocation.amount
        }
      });
    });

    return this.getPayment(actor, allocation.paymentId);
  }

  async voidPayment(actor: AuthUser, paymentId: string, dto: VoidPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        allocations: true,
        refunds: true,
        settlements: true,
        installments: true,
        installmentAllocations: { include: { installment: true } },
        cashMovements: { include: { cashRegister: { select: { status: true } } } }
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.VOIDED) throw new BadRequestException("Payment is already voided");
    if (payment.refunds.length) throw new BadRequestException("Refunded payments cannot be voided");

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("Void reason is required");
    const itemIds = [...new Set(payment.allocations.map((allocation) => allocation.treatmentPlanItemId))];
    const correctionRegister = payment.cashMovements.some(
      (movement) => movement.cashRegister.status === CashRegisterStatus.CLOSED
    )
      ? await this.ensureOpenCashRegister(actor, payment.branchId)
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidReason: reason,
          voidedAt: new Date(),
          voidedById: actor.id
        }
      });

      await tx.paymentSettlement.updateMany({
        where: {
          paymentId: payment.id,
          status: { in: [PaymentSettlementStatus.PENDING, PaymentSettlementStatus.OVERDUE] }
        },
        data: { status: PaymentSettlementStatus.CANCELLED, notes: reason, version: { increment: 1 } }
      });

      await tx.patientLedgerEntry.create({
        data: {
          organizationId: actor.organizationId,
          branchId: payment.branchId,
          patientId: payment.patientId,
          occurredAt: new Date(),
          entryType: LedgerEntryType.VOID,
          sourceType: LedgerSourceType.PAYMENT,
          sourceId: payment.id,
          debitAmount: payment.amount,
          currency: payment.currency,
          descriptionSnapshot: `Anulacion de pago #${this.publicPaymentNumber(payment)}: ${reason}`
        }
      });

      for (const allocation of payment.installmentAllocations) {
        const installment = allocation.installment;
        const nextPaid = this.roundMoney(
          Math.max(Number(installment.paidAmount) - Number(allocation.amount), 0)
        );
        const isOverdue = installment.dueDate < new Date();
        await tx.installment.update({
          where: { id: installment.id },
          data: {
            paidAmount: this.toDecimal(nextPaid),
            status:
              nextPaid <= 0
                ? isOverdue
                  ? InstallmentStatus.OVERDUE
                  : InstallmentStatus.PENDING
                : nextPaid >= Number(installment.amount)
                  ? InstallmentStatus.PAID
                  : InstallmentStatus.PARTIAL,
            paidAt: nextPaid >= Number(installment.amount) ? installment.paidAt : null,
            paymentId: installment.paymentId === payment.id ? null : installment.paymentId
          }
        });

        await tx.collectionCase.updateMany({
          where: {
            installmentId: installment.id,
            status: { in: ["PAID", "PENDING", "CONTACTED", "PROMISE_TO_PAY"] }
          },
          data: {
            status: nextPaid >= Number(installment.amount) ? "PAID" : "PENDING",
            amountDue: this.toDecimal(this.roundMoney(Math.max(Number(installment.amount) - nextPaid, 0))),
            daysOverdue: isOverdue && nextPaid < Number(installment.amount) ? 1 : 0,
            lastContactAt: new Date()
          }
        });

        await tx.installmentPlan.update({
          where: { id: installment.installmentPlanId },
          data: { status: "ACTIVE" }
        });
      }

      const installmentIdsWithAllocations = new Set(
        payment.installmentAllocations.map((allocation) => allocation.installmentId)
      );
      for (const installment of payment.installments.filter(
        (row) => !installmentIdsWithAllocations.has(row.id)
      )) {
        const nextPaid = this.roundMoney(
          Math.max(Number(installment.paidAmount) - Number(payment.amount), 0)
        );
        const isOverdue = installment.dueDate < new Date();
        await tx.installment.update({
          where: { id: installment.id },
          data: {
            paidAmount: this.toDecimal(nextPaid),
            status:
              nextPaid <= 0
                ? isOverdue
                  ? InstallmentStatus.OVERDUE
                  : InstallmentStatus.PENDING
                : nextPaid >= Number(installment.amount)
                  ? InstallmentStatus.PAID
                  : InstallmentStatus.PARTIAL,
            paidAt: nextPaid >= Number(installment.amount) ? installment.paidAt : null,
            paymentId: installment.paymentId === payment.id ? null : installment.paymentId
          }
        });

        await tx.collectionCase.updateMany({
          where: {
            installmentId: installment.id,
            status: { in: ["PAID", "PENDING", "CONTACTED", "PROMISE_TO_PAY"] }
          },
          data: {
            status: nextPaid >= Number(installment.amount) ? "PAID" : "PENDING",
            amountDue: this.toDecimal(this.roundMoney(Math.max(Number(installment.amount) - nextPaid, 0))),
            daysOverdue: isOverdue && nextPaid < Number(installment.amount) ? 1 : 0,
            lastContactAt: new Date()
          }
        });

        await tx.installmentPlan.update({
          where: { id: installment.installmentPlanId },
          data: { status: "ACTIVE" }
        });
      }

      for (const movement of payment.cashMovements) {
        const targetRegisterId =
          movement.cashRegister.status === CashRegisterStatus.OPEN
            ? movement.cashRegisterId
            : correctionRegister?.id;
        if (!targetRegisterId) continue;
        await tx.cashMovement.create({
          data: {
            organizationId: actor.organizationId,
            branchId: payment.branchId,
            cashRegisterId: targetRegisterId,
            type: CashMovementType.PAYMENT_VOID,
            direction: CashMovementDirection.OUT,
            amount: movement.amount,
            paymentId: payment.id,
            paymentMethodId: movement.paymentMethodId,
            paymentMethodNameSnapshot: movement.paymentMethodNameSnapshot,
            paymentMethodTypeSnapshot: movement.paymentMethodTypeSnapshot,
            includeInCollectionReportsSnapshot: movement.includeInCollectionReportsSnapshot,
            includeInPhysicalCashBalanceSnapshot: movement.includeInPhysicalCashBalanceSnapshot,
            includeInCashFlowReportsSnapshot: movement.includeInCashFlowReportsSnapshot,
            includeInClosingSummarySnapshot: movement.includeInClosingSummarySnapshot,
            includeInGraphicalReportsSnapshot: movement.includeInGraphicalReportsSnapshot,
            description: `Anulacion de pago #${this.publicPaymentNumber(payment)}`,
            createdById: actor.id
          }
        });
      }

      for (const itemId of itemIds) {
        const item = await tx.treatmentPlanItem.findUnique({ where: { id: itemId } });
        if (!item) continue;
        const allocation = await tx.paymentAllocation.aggregate({
          _sum: { amount: true, settlementDiscountAmount: true },
          where: {
            treatmentPlanItemId: itemId,
            payment: {
              status: {
                in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED]
              }
            }
          }
        });
        if (
          Number(allocation._sum.amount ?? 0) + Number(allocation._sum.settlementDiscountAmount ?? 0) <
            Number(item.total) &&
          item.status === TreatmentPlanItemStatus.PAID
        ) {
          await tx.treatmentPlanItem.update({
            where: { id: item.id },
            data: { status: TreatmentPlanItemStatus.ACCEPTED }
          });
        }
      }

      await this.audit(tx, actor, {
        entity: "Payment",
        entityId: payment.id,
        action: "void",
        before: {
          status: payment.status,
          allocationCount: payment.allocations.length
        },
        after: {
          status: PaymentStatus.VOIDED,
          reason
        }
      });
      if (this.cashDiscounts) await this.cashDiscounts.markPaymentVoided(tx, actor, payment.id);
    });

    return this.getPayment(actor, payment.id);
  }

  async createPaymentLink(actor: AuthUser, dto: CreatePaymentLinkDto) {
    await this.ensurePatient(actor, dto.patientId);

    if (dto.treatmentPlanId) {
      const plan = await this.prisma.treatmentPlan.findFirst({
        where: { id: dto.treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) }
      });
      if (!plan) throw new NotFoundException("Treatment plan not found");
      if (plan.patientId !== dto.patientId)
        throw new BadRequestException("Treatment plan does not belong to patient");
    }

    const created = await this.prisma.paymentLink.create({
      data: {
        organizationId: actor.organizationId,
        patientId: dto.patientId,
        treatmentPlanId: dto.treatmentPlanId,
        amount: this.toDecimal(dto.amount || 0),
        url: "pending",
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null
      }
    });

    const link = await this.prisma.paymentLink.update({
      where: { id: created.id },
      data: {
        url: `https://payments.local/link/${created.id}`
      }
    });

    await this.audit(this.prisma, actor, {
      entity: "PaymentLink",
      entityId: link.id,
      action: "create",
      after: {
        patientId: link.patientId,
        treatmentPlanId: link.treatmentPlanId,
        amount: dto.amount
      }
    });

    return link;
  }

  async listPaymentLinks(actor: AuthUser, query: ListPaymentLinksQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.paymentLink.findMany({
      where: {
        organizationId: actor.organizationId,
        patient: { branchId: branchScope(actor) },
        ...(query.patientId ? { patientId: query.patientId } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        treatmentPlan: { select: { id: true, name: true } }
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  async createInstallmentPlan(actor: AuthUser, dto: CreateInstallmentPlanDto) {
    await this.ensurePatient(actor, dto.patientId);
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: dto.treatmentPlanId, organizationId: actor.organizationId, branchId: branchScope(actor) }
    });
    if (!plan) throw new NotFoundException("Treatment plan not found");
    if (plan.patientId !== dto.patientId)
      throw new BadRequestException("Treatment plan does not belong to patient");

    if (dto.downPayment > dto.totalAmount) {
      throw new BadRequestException("Down payment cannot be greater than total amount");
    }

    const itemAllocations = this.normalizeInstallmentPlanItemAllocations(dto.itemAllocations);
    if (itemAllocations.length) {
      const selectedTotal = sumDecimals(itemAllocations.map((allocation) => allocation.amount));
      if (!isDecimalEqual(selectedTotal, toDecimal(dto.totalAmount))) {
        throw new BadRequestException("Installment item allocations must match total amount");
      }
      await this.validateInstallmentPlanItemAllocations(actor, dto.treatmentPlanId, itemAllocations);
    }

    const financedAmount = this.roundMoney(dto.totalAmount - dto.downPayment);
    if (financedAmount <= 0) {
      throw new BadRequestException("Financed amount must be greater than zero");
    }

    const installmentAmounts = this.splitAmount(financedAmount, dto.numberOfInstallments);
    const created = await this.prisma.$transaction(async (tx) => {
      if (itemAllocations.length) {
        await this.validateInstallmentPlanItemAllocations(actor, dto.treatmentPlanId, itemAllocations, tx);
      }

      const installmentPlan = await tx.installmentPlan.create({
        data: {
          organizationId: actor.organizationId,
          patientId: dto.patientId,
          treatmentPlanId: dto.treatmentPlanId,
          totalAmount: this.toDecimal(dto.totalAmount),
          downPayment: this.toDecimal(dto.downPayment),
          financedAmount: this.toDecimal(financedAmount),
          numberOfInstallments: dto.numberOfInstallments,
          frequency: dto.frequency ?? InstallmentFrequency.MONTHLY,
          startDate: this.parseDateInput(dto.startDate),
          status: "ACTIVE"
        }
      });

      for (const allocation of itemAllocations) {
        await tx.installmentPlanItem.create({
          data: {
            installmentPlanId: installmentPlan.id,
            treatmentPlanItemId: allocation.treatmentPlanItemId,
            amount: allocation.amount
          }
        });
      }

      for (let index = 0; index < dto.numberOfInstallments; index += 1) {
        await tx.installment.create({
          data: {
            installmentPlanId: installmentPlan.id,
            patientId: dto.patientId,
            number: index + 1,
            dueDate: this.shiftDate(
              this.parseDateInput(dto.startDate),
              dto.frequency ?? InstallmentFrequency.MONTHLY,
              index
            ),
            amount: this.toDecimal(installmentAmounts[index]),
            paidAmount: this.toDecimal(0),
            status: InstallmentStatus.PENDING
          }
        });
      }

      await this.audit(tx, actor, {
        entity: "InstallmentPlan",
        entityId: installmentPlan.id,
        action: "create",
        after: {
          patientId: dto.patientId,
          treatmentPlanId: dto.treatmentPlanId,
          totalAmount: dto.totalAmount,
          financedAmount,
          itemAllocations: itemAllocations.map((allocation) => ({
            treatmentPlanItemId: allocation.treatmentPlanItemId,
            amount: allocation.amount.toString()
          }))
        }
      });

      return installmentPlan.id;
    });

    return this.prisma.installmentPlan.findFirst({
      where: { id: created, organizationId: actor.organizationId },
      include: {
        installments: { orderBy: { number: "asc" } },
        items: {
          include: {
            treatmentPlanItem: {
              select: {
                id: true,
                procedure: { select: { id: true, code: true, name: true } },
                toothNumber: true,
                surface: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  async listInstallments(actor: AuthUser, query: ListInstallmentsQueryDto) {
    const { skip, take } = resolvePagination(query);
    const now = new Date();
    const rows = await this.prisma.installment.findMany({
      where: {
        patient: { organizationId: actor.organizationId, branchId: branchScope(actor) },
        ...(query.patientId ? { patientId: query.patientId } : {}),
        ...(query.installmentPlanId ? { installmentPlanId: query.installmentPlanId } : {}),
        ...(query.status ? { status: query.status as InstallmentStatus } : {}),
        ...(query.dueBefore ? { dueDate: { lte: new Date(query.dueBefore) } } : {})
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        installmentPlan: { select: { id: true, treatmentPlanId: true } },
        payment: { select: { id: true, paidAt: true, status: true, amount: true } }
      },
      skip,
      take,
      orderBy: [{ dueDate: "asc" }, { number: "asc" }]
    });

    return rows.map((row) => ({
      ...row,
      isOverdue:
        row.status !== InstallmentStatus.PAID &&
        row.status !== InstallmentStatus.CANCELLED &&
        row.dueDate < now
    }));
  }

  async payInstallment(actor: AuthUser, installmentId: string, dto: PayInstallmentDto) {
    const installment = await this.prisma.installment.findFirst({
      where: {
        id: installmentId,
        patient: { organizationId: actor.organizationId, branchId: branchScope(actor) }
      },
      include: {
        patient: true,
        installmentPlan: true
      }
    });
    if (!installment) throw new NotFoundException("Installment not found");
    if (installment.status === InstallmentStatus.PAID)
      throw new BadRequestException("Installment is already paid");

    const remaining = this.roundMoney(Number(installment.amount) - Number(installment.paidAmount));
    if (dto.amount > remaining)
      throw new BadRequestException("Payment amount exceeds remaining installment balance");

    await this.ensureBranch(actor, dto.branchId);
    const installmentPaymentMethod = dto.paymentMethodId
      ? await this.ensurePaymentMethod(actor, dto.paymentMethodId)
      : null;
    const installmentGross = this.toDecimal(dto.amount || 0);
    const installmentRetention = installmentPaymentMethod
      ? installmentGross
          .mul(installmentPaymentMethod.retentionPercent ?? 0)
          .div(100)
          .toDecimalPlaces(2)
      : this.toDecimal(0);
    const installmentNet = installmentGross.sub(installmentRetention);
    const openRegister = await this.ensureOpenCashRegister(actor, dto.branchId);

    const paymentId = await this.createPaymentWithPublicNumberRetry(async (paymentNumber) =>
      this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            organizationId: actor.organizationId,
            branchId: dto.branchId,
            patientId: installment.patientId,
            receivedById: actor.id,
            paymentNumber,
            amount: installmentGross,
            grossAmount: installmentGross,
            retentionAmount: installmentRetention,
            netAmount: installmentNet,
            currency: "MXN",
            paymentMethodId: dto.paymentMethodId,
            ...(installmentPaymentMethod
              ? { paymentMethodSnapshot: this.paymentMethodSnapshot(installmentPaymentMethod) }
              : {}),
            status: PaymentStatus.ALLOCATED,
            reference: dto.reference?.trim(),
            notes: dto.notes?.trim(),
            paidAt: new Date()
          }
        });

        if (openRegister) {
          const activeRegister = await tx.cashRegister.findFirst({
            where: { id: openRegister.id, status: CashRegisterStatus.OPEN },
            select: { id: true }
          });
          if (!activeRegister)
            throw new ConflictException(
              "Cash register is being closed. Refresh before receiving the payment."
            );
          await tx.cashMovement.create({
            data: {
              organizationId: actor.organizationId,
              branchId: dto.branchId,
              cashRegisterId: openRegister.id,
              type: CashMovementType.INCOME,
              direction: CashMovementDirection.IN,
              amount: installmentNet,
              paymentId: payment.id,
              paymentMethodId: dto.paymentMethodId,
              ...(installmentPaymentMethod ? this.cashMovementMethodSnapshot(installmentPaymentMethod) : {}),
              reference: dto.reference?.trim(),
              description: `Pago #${paymentNumber} de cuota ${installment.number}`,
              createdById: actor.id
            }
          });
        }

        await tx.paymentInstallmentAllocation.create({
          data: {
            paymentId: payment.id,
            installmentId: installment.id,
            amount: this.toDecimal(dto.amount || 0)
          }
        });

        const nextPaid = this.roundMoney(Number(installment.paidAmount) + dto.amount);
        await tx.installment.update({
          where: { id: installment.id },
          data: {
            paidAmount: this.toDecimal(nextPaid),
            status:
              nextPaid >= Number(installment.amount) ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL,
            paidAt: nextPaid >= Number(installment.amount) ? new Date() : installment.paidAt,
            paymentId: nextPaid >= Number(installment.amount) ? payment.id : installment.paymentId
          }
        });

        if (nextPaid >= Number(installment.amount)) {
          await tx.collectionCase.updateMany({
            where: {
              installmentId: installment.id,
              status: { in: ["PENDING", "CONTACTED", "PROMISE_TO_PAY"] }
            },
            data: {
              status: "PAID",
              amountDue: this.toDecimal(0),
              daysOverdue: 0,
              lastContactAt: new Date(),
              nextContactAt: null
            }
          });
        } else {
          const remainingDue = this.roundMoney(Number(installment.amount) - nextPaid);
          await tx.collectionCase.updateMany({
            where: {
              installmentId: installment.id,
              status: { in: ["PENDING", "CONTACTED", "PROMISE_TO_PAY"] }
            },
            data: {
              amountDue: this.toDecimal(remainingDue)
            }
          });
        }

        const pendingCount = await tx.installment.count({
          where: {
            installmentPlanId: installment.installmentPlanId,
            status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] }
          }
        });

        if (pendingCount === 0) {
          await tx.installmentPlan.update({
            where: { id: installment.installmentPlanId },
            data: { status: "COMPLETED" }
          });
        }

        await this.audit(tx, actor, {
          entity: "Installment",
          entityId: installment.id,
          action: "installment_pay",
          after: {
            paymentId: payment.id,
            paymentNumber,
            amount: dto.amount
          }
        });

        return payment.id;
      })
    );

    return this.getPayment(actor, paymentId);
  }

  async openCashRegister(actor: AuthUser, dto: OpenCashRegisterDto) {
    await this.ensureBranch(actor, dto.branchId);
    const responsibleUserId = dto.responsibleUserId?.trim() || actor.id;
    await this.ensureCashResponsible(actor, dto.branchId, responsibleUserId);

    const existing = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: dto.branchId,
        responsibleUserId,
        status: CashRegisterStatus.OPEN
      }
    });

    if (existing) {
      throw new BadRequestException("You already have an open cash register in this branch");
    }

    const previousBalance = await this.getLatestClosingCarryover(actor, dto.branchId);
    const created = await this.openCashRegisterInternal(actor, {
      branchId: dto.branchId,
      responsibleUserId,
      previousBalance,
      initialDeposit: dto.openingAmount,
      notes: dto.notes
    });

    return this.getCashRegister(actor, created);
  }

  async getCurrentCashRegister(actor: AuthUser, branchId: string) {
    await this.ensureBranch(actor, branchId);

    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId,
        responsibleUserId: actor.id,
        status: CashRegisterStatus.OPEN
      },
      select: { id: true }
    });

    if (!register) return null;
    return this.getCashRegister(actor, register.id);
  }

  async closeCashRegister(actor: AuthUser, id: string, dto: CloseCashRegisterDto) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        status: CashRegisterStatus.OPEN
      }
    });
    if (!register) throw new NotFoundException("Open cash register not found");

    if (
      register.responsibleUserId !== actor.id &&
      !this.hasAnyPermission(actor, ["cash_register.close_any", "system.manage_all"])
    ) {
      throw new BadRequestException("Only the register owner can close this cash register");
    }
    const closingCarryover = this.roundMoney(dto.closingCarryover ?? 0);
    if (closingCarryover > dto.closingAmount) {
      throw new BadRequestException("Closing carryover cannot exceed declared cash");
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const transitioned = await tx.cashRegister.updateMany({
          where: {
            id: register.id,
            status: CashRegisterStatus.OPEN,
            version: dto.expectedVersion ?? register.version
          },
          data: { status: CashRegisterStatus.CLOSING, version: { increment: 1 } }
        });
        if (transitioned.count !== 1) {
          throw new ConflictException(
            "Los movimientos de la caja cambiaron mientras realizabas la conciliacion. Actualiza la informacion antes de cerrar."
          );
        }

        const snapshot = await tx.cashRegister.findUniqueOrThrow({
          where: { id: register.id },
          include: {
            movements: {
              include: {
                paymentMethod: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    includeInCollectionReports: true,
                    includeInPhysicalCashBalance: true,
                    includeInCashFlowReports: true,
                    includeInClosingSummary: true,
                    includeInGraphicalReports: true
                  }
                },
                payment: {
                  select: {
                    paymentMethod: {
                      select: {
                        id: true,
                        name: true,
                        type: true,
                        includeInCollectionReports: true,
                        includeInPhysicalCashBalance: true,
                        includeInCashFlowReports: true,
                        includeInClosingSummary: true,
                        includeInGraphicalReports: true
                      }
                    }
                  }
                }
              }
            }
          }
        });
        const expectedClosing = this.calculateExpectedClosing(snapshot.movements);
        const reconciliationTotals = this.calculateCashRegisterTotals(snapshot.movements);
        const reportingMethods = new Map<
          string,
          {
            id: string;
            name: string;
            type: string;
            includeInCollectionReports: boolean;
            includeInPhysicalCashBalance: boolean;
            includeInCashFlowReports: boolean;
            includeInClosingSummary: boolean;
            includeInGraphicalReports: boolean;
          }
        >();
        for (const movement of snapshot.movements) {
          const method = movement.paymentMethod ?? movement.payment?.paymentMethod;
          if (!method || !movement.paymentMethodId) continue;
          reportingMethods.set(movement.paymentMethodId, {
            ...method,
            name: movement.paymentMethodNameSnapshot ?? method.name,
            type: movement.paymentMethodTypeSnapshot ?? method.type,
            includeInCollectionReports:
              movement.includeInCollectionReportsSnapshot ?? method.includeInCollectionReports,
            includeInPhysicalCashBalance:
              movement.includeInPhysicalCashBalanceSnapshot ?? method.includeInPhysicalCashBalance,
            includeInCashFlowReports:
              movement.includeInCashFlowReportsSnapshot ?? method.includeInCashFlowReports,
            includeInClosingSummary:
              movement.includeInClosingSummarySnapshot ?? method.includeInClosingSummary,
            includeInGraphicalReports:
              movement.includeInGraphicalReportsSnapshot ?? method.includeInGraphicalReports
          });
        }
        const difference = this.roundMoney(dto.closingAmount - expectedClosing);
        if (difference !== 0 && !dto.notes?.trim()) {
          throw new BadRequestException("A closing difference requires an explanation");
        }
        const withdrawnAmount = this.roundMoney(dto.closingAmount - closingCarryover);

        await tx.cashMovement.create({
          data: {
            organizationId: actor.organizationId,
            branchId: register.branchId,
            cashRegisterId: register.id,
            type: CashMovementType.CLOSING,
            direction: CashMovementDirection.OUT,
            amount: this.toDecimal(withdrawnAmount),
            description: dto.notes?.trim() || "Cierre de caja conciliado",
            createdById: actor.id
          }
        });

        const closed = await tx.cashRegister.updateMany({
          where: {
            id: register.id,
            status: CashRegisterStatus.CLOSING,
            version: (dto.expectedVersion ?? register.version) + 1
          },
          data: {
            status: CashRegisterStatus.CLOSED,
            expectedCashBalance: this.toDecimal(expectedClosing),
            declaredCashBalance: this.toDecimal(dto.closingAmount),
            closingCarryover: this.toDecimal(closingCarryover),
            withdrawnAmount: this.toDecimal(withdrawnAmount),
            differenceAmount: this.toDecimal(difference),
            closingAmount: this.toDecimal(closingCarryover),
            closingNotes: dto.notes?.trim(),
            reconciliationSnapshot: {
              calculatedAt: new Date().toISOString(),
              expectedCashBalance: expectedClosing,
              declaredCashBalance: this.roundMoney(dto.closingAmount),
              closingCarryover,
              withdrawnAmount,
              differenceAmount: difference,
              totals: reconciliationTotals,
              paymentMethodConfiguration: [...reportingMethods.values()]
            } as Prisma.InputJsonValue,
            closedAt: new Date(),
            closedById: actor.id,
            version: { increment: 1 }
          }
        });
        if (closed.count !== 1) {
          throw new ConflictException(
            "Los movimientos de la caja cambiaron mientras realizabas la conciliacion. Actualiza la informacion antes de cerrar."
          );
        }

        await this.audit(tx, actor, {
          entity: "CashRegister",
          entityId: register.id,
          action: "close",
          after: {
            expectedCashBalance: expectedClosing,
            declaredCashBalance: dto.closingAmount,
            closingCarryover,
            withdrawnAmount,
            differenceAmount: difference
          }
        });

        return { expectedClosing, difference, withdrawnAmount, closingCarryover };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return { register: await this.getCashRegister(actor, register.id), ...result };
  }

  async listCashRegisters(actor: AuthUser, query: ListCashRegistersQueryDto) {
    const { skip, take } = resolvePagination(query);
    const search = query.search?.trim();
    const publicNumber = search?.replace(/^CAJ-/i, "");
    const parsedPublicNumber = publicNumber && /^\d{1,6}$/.test(publicNumber) ? Number(publicNumber) : null;
    const openedAt = this.resolveOptionalDateRange(query.openedFrom, query.openedTo);
    const closedAt = this.resolveOptionalDateRange(query.closedFrom, query.closedTo);
    const registers = await this.prisma.cashRegister.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, query.branchId),
        ...(query.status ? { status: query.status as CashRegisterStatus } : {}),
        ...(query.responsibleUserId ? { responsibleUserId: query.responsibleUserId } : {}),
        ...(openedAt ? { openedAt } : {}),
        ...(closedAt ? { closedAt } : {}),
        ...(query.withDifference === "true" ? { differenceAmount: { not: 0 } } : {}),
        ...(search
          ? {
              OR: [
                ...(parsedPublicNumber !== null ? [{ publicNumber: parsedPublicNumber }] : []),
                { branch: { name: { contains: search, mode: "insensitive" } } },
                { responsibleUser: { firstName: { contains: search, mode: "insensitive" } } },
                { responsibleUser: { lastName: { contains: search, mode: "insensitive" } } },
                { openedBy: { firstName: { contains: search, mode: "insensitive" } } },
                { openedBy: { lastName: { contains: search, mode: "insensitive" } } },
                { closedBy: { firstName: { contains: search, mode: "insensitive" } } },
                { closedBy: { lastName: { contains: search, mode: "insensitive" } } },
                { movements: { some: { reference: { contains: search, mode: "insensitive" } } } },
                {
                  movements: {
                    some: { payment: { patient: { firstName: { contains: search, mode: "insensitive" } } } }
                  }
                },
                {
                  movements: {
                    some: { payment: { patient: { lastName: { contains: search, mode: "insensitive" } } } }
                  }
                }
              ]
            }
          : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        responsibleUser: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: {
          include: {
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
                includeInPhysicalCashBalance: true,
                includeInClosingSummary: true
              }
            },
            payment: {
              select: {
                paymentMethod: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    includeInPhysicalCashBalance: true,
                    includeInClosingSummary: true
                  }
                }
              }
            }
          }
        }
      },
      skip,
      take,
      orderBy: { openedAt: "desc" }
    });

    return Promise.all(registers.map((register) => this.enrichCashRegister(actor, register)));
  }

  async getCashRegisterDetail(actor: AuthUser, registerId: string) {
    const publicNumber = this.parseCashRegisterNumber(registerId);
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: registerId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        responsibleUser: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: {
          orderBy: { createdAt: "asc" },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
                includeInPhysicalCashBalance: true,
                includeInClosingSummary: true
              }
            },
            expense: {
              select: {
                id: true,
                publicNumber: true,
                description: true,
                total: true,
                paidAt: true,
                status: true,
                category: { select: { id: true, name: true } }
              }
            },
            refund: { select: { id: true, amount: true, reason: true, status: true, processedAt: true } },
            payment: {
              select: {
                id: true,
                paymentNumber: true,
                amount: true,
                reference: true,
                paidAt: true,
                status: true,
                voidReason: true,
                voidedAt: true,
                voidedBy: { select: { id: true, firstName: true, lastName: true } },
                patient: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    documentNumber: true,
                    agreement: { select: { id: true, name: true } }
                  }
                },
                paymentMethod: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    includeInPhysicalCashBalance: true,
                    includeInClosingSummary: true
                  }
                },
                financialInstitution: { select: { id: true, name: true } },
                allocations: {
                  select: {
                    amount: true,
                    treatmentPlanItem: {
                      select: {
                        agreement: { select: { id: true, name: true } },
                        treatmentPlan: { select: { id: true, name: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!register) throw new NotFoundException("Cash register not found");
    const relatedEntityIds = register.movements.flatMap((movement) =>
      [movement.payment?.id, movement.expense?.id, movement.refund?.id].filter((value): value is string =>
        Boolean(value)
      )
    );
    const auditRows = await this.prisma.auditLog.findMany({
      where: {
        organizationId: actor.organizationId,
        OR: [
          { entity: "CashRegister", entityId: register.id },
          ...(relatedEntityIds.length
            ? [{ entity: { in: ["Payment", "Expense", "Refund"] }, entityId: { in: relatedEntityIds } }]
            : [])
        ]
      },
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        reason: true,
        before: true,
        after: true,
        actorUserId: true,
        createdAt: true
      },
      orderBy: { createdAt: "asc" },
      take: 300
    });
    const actorIds = [
      ...new Set(auditRows.map((row) => row.actorUserId).filter((id): id is string => Boolean(id)))
    ];
    const auditActors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds }, organizationId: actor.organizationId },
          select: { id: true, firstName: true, lastName: true }
        })
      : [];
    const actorNames = new Map(
      auditActors.map((auditActor) => [auditActor.id, this.displayName(auditActor)] as const)
    );
    const enriched = await this.enrichCashRegister(actor, register);
    return {
      ...enriched,
      audit: auditRows.map((row) => ({
        ...row,
        actorName: row.actorUserId ? (actorNames.get(row.actorUserId) ?? "Usuario del sistema") : "Sistema"
      }))
    };
  }

  async getCashRegisterReportPdf(actor: AuthUser, registerId: string) {
    const register = await this.getCashRegisterDetail(actor, registerId);
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const margin = 42;
    let page = document.addPage([595.28, 841.89]);
    let y = 800;
    const line = (label: string, value?: unknown, strong = false) => {
      if (y < 58) {
        page = document.addPage([595.28, 841.89]);
        y = 800;
      }
      page.drawText(value === undefined ? label : `${label}: ${String(value)}`, {
        x: margin,
        y,
        size: strong ? 12 : 9,
        font: strong ? bold : regular,
        color: rgb(0.12, 0.18, 0.25)
      });
      y -= strong ? 19 : 14;
    };
    const number = `CAJ-${String(register.publicNumber).padStart(6, "0")}`;
    line(`${register.branch.name} | ${number}`, undefined, true);
    line("Estado", register.status);
    line("Responsable", this.displayName(register.responsibleUser));
    line("Apertura", register.openedAt.toISOString?.() ?? register.openedAt);
    line("Cierre", register.closedAt?.toISOString?.() ?? register.closedAt ?? "-");
    y -= 6;
    line("CONCILIACION", undefined, true);
    line("Saldo anterior", this.formatCurrency(register.previousClosingBalance));
    line("Abono inicial", this.formatCurrency(register.initialDeposit));
    line("Saldo inicial", this.formatCurrency(register.openingAmount));
    line("Total recaudado", this.formatCurrency(register.incomeTotal));
    line("Gastos", this.formatCurrency(register.expenseTotal));
    line("Devoluciones", this.formatCurrency(register.refundTotal));
    line("Pagos anulados", this.formatCurrency(register.voidTotal));
    line("Efectivo esperado", this.formatCurrency(register.expectedCashBalance ?? register.expectedClosing));
    line("Efectivo declarado", this.formatCurrency(register.declaredCashBalance ?? 0));
    line(
      "Saldo dejado en caja",
      this.formatCurrency(register.closingCarryover ?? register.closingAmount ?? 0)
    );
    line("Monto retirado", this.formatCurrency(register.withdrawnAmount ?? 0));
    line("Diferencia", this.formatCurrency(register.differenceAmount ?? 0));
    y -= 6;
    line("MOVIMIENTOS", undefined, true);
    for (const movement of register.movements) {
      const paymentNumber = movement.payment?.paymentNumber
        ? String(movement.payment.paymentNumber).padStart(6, "0")
        : "-";
      const method = movement.paymentMethod?.name ?? movement.payment?.paymentMethod?.name ?? "-";
      const signedAmount =
        movement.direction === CashMovementDirection.OUT
          ? Number(movement.amount) * -1
          : Number(movement.amount);
      const voidDetails =
        movement.type === CashMovementType.PAYMENT_VOID
          ? ` | Motivo: ${movement.payment?.voidReason ?? movement.voidReason ?? "-"} | Anulado por: ${
              movement.payment?.voidedBy
                ? this.displayName(movement.payment.voidedBy)
                : this.displayName(movement.createdBy)
            }`
          : "";
      line(
        `${new Date(movement.createdAt).toLocaleString("es-MX")} | ${movement.type} | Pago ${paymentNumber} | ${method} | ${this.formatCurrency(signedAmount)}${voidDetails}`
      );
    }
    const bytes = await document.save();
    await this.audit(this.prisma, actor, {
      entity: "CashRegister",
      entityId: register.id,
      action: "export_pdf",
      after: { publicNumber: register.publicNumber }
    });
    return { fileNumber: number, bytes };
  }

  async getCashRegisterReportCsv(actor: AuthUser, registerId: string) {
    const register = await this.getCashRegisterDetail(actor, registerId);
    const headers = [
      "Caja",
      "Fecha",
      "Tipo",
      "Direccion",
      "Pago",
      "Paciente",
      "Medio",
      "Referencia",
      "Importe",
      "Estado",
      "Fecha anulacion",
      "Anulado por",
      "Motivo anulacion"
    ];
    const number = `CAJ-${String(register.publicNumber).padStart(6, "0")}`;
    const rows = register.movements.map((movement) => {
      const patient = movement.payment?.patient ? this.displayName(movement.payment.patient) : "";
      const isPaymentVoid = movement.type === CashMovementType.PAYMENT_VOID;
      return [
        number,
        new Date(movement.createdAt).toISOString(),
        movement.type,
        movement.direction,
        movement.payment?.paymentNumber ? String(movement.payment.paymentNumber).padStart(6, "0") : "",
        patient,
        movement.paymentMethod?.name ?? movement.payment?.paymentMethod?.name ?? "",
        movement.reference ?? movement.payment?.reference ?? "",
        movement.direction === CashMovementDirection.OUT
          ? Number(movement.amount) * -1
          : Number(movement.amount),
        movement.voidedAt ? "MOVEMENT_VOIDED" : isPaymentVoid ? "PAYMENT_VOIDED" : "ACTIVE",
        isPaymentVoid ? new Date(movement.payment?.voidedAt ?? movement.createdAt).toISOString() : "",
        isPaymentVoid
          ? movement.payment?.voidedBy
            ? this.displayName(movement.payment.voidedBy)
            : this.displayName(movement.createdBy)
          : "",
        isPaymentVoid ? (movement.payment?.voidReason ?? movement.voidReason ?? "") : ""
      ]
        .map((value) => this.csvCell(value))
        .join(",");
    });
    await this.audit(this.prisma, actor, {
      entity: "CashRegister",
      entityId: register.id,
      action: "export_csv",
      after: { publicNumber: register.publicNumber, movementCount: register.movements.length }
    });
    return { fileNumber: number, content: [headers.join(","), ...rows].join("\r\n") };
  }

  async getCashRegisterReportXlsx(actor: AuthUser, registerId: string) {
    const register = await this.getCashRegisterDetail(actor, registerId);
    const number = `CAJ-${String(register.publicNumber).padStart(6, "0")}`;
    const summaryRows = [
      { concept: "Caja", value: number },
      { concept: "Estado", value: register.status },
      { concept: "Sucursal", value: register.branch.name },
      { concept: "Responsable", value: this.displayName(register.responsibleUser) },
      { concept: "Apertura", value: new Date(register.openedAt) },
      { concept: "Cierre", value: register.closedAt ? new Date(register.closedAt) : "" },
      { concept: "Moneda", value: register.currency ?? "MXN" },
      { concept: "Saldo anterior", value: Number(register.previousClosingBalance ?? 0) },
      { concept: "Abono inicial", value: Number(register.initialDeposit ?? 0) },
      { concept: "Saldo inicial", value: Number(register.openingAmount ?? 0) },
      { concept: "Total recaudado", value: Number(register.incomeTotal ?? 0) },
      { concept: "Gastos", value: Number(register.expenseTotal ?? 0) },
      { concept: "Devoluciones", value: Number(register.refundTotal ?? 0) },
      {
        concept: "Efectivo esperado",
        value: Number(register.expectedCashBalance ?? register.expectedClosing ?? 0)
      },
      { concept: "Efectivo declarado", value: Number(register.declaredCashBalance ?? 0) },
      { concept: "Saldo dejado", value: Number(register.closingCarryover ?? register.closingAmount ?? 0) },
      { concept: "Monto retirado", value: Number(register.withdrawnAmount ?? 0) },
      { concept: "Diferencia", value: Number(register.differenceAmount ?? 0) }
    ];
    const movementRows = register.movements.map((movement) => ({
      date: new Date(movement.createdAt),
      type: movement.type,
      direction: movement.direction,
      payment: movement.payment?.paymentNumber ? String(movement.payment.paymentNumber).padStart(6, "0") : "",
      patient: movement.payment?.patient ? this.displayName(movement.payment.patient) : "",
      method: movement.paymentMethod?.name ?? movement.payment?.paymentMethod?.name ?? "",
      reference: movement.reference ?? movement.payment?.reference ?? "",
      amount:
        movement.direction === CashMovementDirection.OUT
          ? Number(movement.amount) * -1
          : Number(movement.amount),
      status: movement.voidedAt
        ? "MOVEMENT_VOIDED"
        : movement.type === CashMovementType.PAYMENT_VOID
          ? "PAYMENT_VOIDED"
          : "ACTIVE",
      voidedAt:
        movement.type === CashMovementType.PAYMENT_VOID
          ? new Date(movement.payment?.voidedAt ?? movement.createdAt)
          : "",
      voidedBy:
        movement.type === CashMovementType.PAYMENT_VOID
          ? movement.payment?.voidedBy
            ? this.displayName(movement.payment.voidedBy)
            : this.displayName(movement.createdBy)
          : "",
      voidReason:
        movement.type === CashMovementType.PAYMENT_VOID
          ? (movement.payment?.voidReason ?? movement.voidReason ?? "")
          : ""
    }));
    const bytes = createXlsxWorkbook([
      { name: "Conciliacion", rows: summaryRows },
      { name: "Movimientos", rows: movementRows }
    ]);
    await this.audit(this.prisma, actor, {
      entity: "CashRegister",
      entityId: register.id,
      action: "export_xlsx",
      after: { publicNumber: register.publicNumber, movementCount: register.movements.length }
    });
    return { fileNumber: number, bytes };
  }

  async createCashMovement(actor: AuthUser, registerId: string, dto: CreateCashMovementDto) {
    const allowedTypes = new Set<CashMovementType>([
      CashMovementType.INCOME,
      CashMovementType.EXPENSE,
      CashMovementType.MANUAL_INCOME,
      CashMovementType.MANUAL_EXPENSE,
      CashMovementType.ADJUSTMENT,
      CashMovementType.WITHDRAWAL
    ]);
    if (!allowedTypes.has(dto.type))
      throw new BadRequestException(
        "This cash movement type can only be generated by its financial workflow"
      );
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id: registerId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        status: CashRegisterStatus.OPEN
      }
    });
    if (!register) throw new NotFoundException("Open cash register not found");

    if (dto.paymentId) {
      const payment = await this.prisma.payment.findFirst({
        where: { id: dto.paymentId, organizationId: actor.organizationId, branchId: branchScope(actor) }
      });
      if (!payment) throw new NotFoundException("Payment not found");
    }
    const movementPaymentMethod = dto.paymentMethodId
      ? await this.ensurePaymentMethod(actor, dto.paymentMethodId)
      : null;
    if (dto.expenseId) {
      const expense = await this.prisma.expense.findFirst({
        where: {
          id: dto.expenseId,
          organizationId: actor.organizationId,
          branchId: register.branchId,
          status: { not: "VOIDED" }
        },
        select: { id: true }
      });
      if (!expense) throw new NotFoundException("Expense not found");
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const active = await tx.cashRegister.findFirst({
            where: { id: register.id, status: CashRegisterStatus.OPEN },
            select: { id: true }
          });
          if (!active)
            throw new ConflictException("Cash register is being closed. Refresh before adding a movement.");
          const movement = await tx.cashMovement.create({
            data: {
              organizationId: actor.organizationId,
              branchId: register.branchId,
              cashRegisterId: register.id,
              type: dto.type,
              direction: this.cashMovementDirection(dto.type),
              amount: this.toDecimal(dto.amount || 0),
              paymentId: dto.paymentId,
              expenseId: dto.expenseId,
              paymentMethodId: dto.paymentMethodId,
              ...(movementPaymentMethod ? this.cashMovementMethodSnapshot(movementPaymentMethod) : {}),
              reference: dto.reference?.trim(),
              idempotencyKey: dto.idempotencyKey?.trim(),
              description: dto.description?.trim(),
              createdById: actor.id
            }
          });
          await this.audit(tx, actor, {
            entity: "CashMovement",
            entityId: movement.id,
            action: "create",
            after: {
              cashRegisterId: register.id,
              type: dto.type,
              amount: dto.amount,
              direction: movement.direction
            }
          });
          return movement;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (dto.idempotencyKey && this.isUniqueCollision(error, "idempotencyKey")) {
        const existing = await this.prisma.cashMovement.findFirst({
          where: { cashRegisterId: register.id, idempotencyKey: dto.idempotencyKey.trim() }
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async getPatientPayments(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const [payments, links, installments, treatmentPlans] = await Promise.all([
      this.prisma.payment.findMany({
        where: { organizationId: actor.organizationId, patientId: resolvedId, branchId: branchScope(actor) },
        include: this.paymentDetailInclude(),
        orderBy: { paidAt: "desc" }
      }),
      this.prisma.paymentLink.findMany({
        where: { organizationId: actor.organizationId, patientId: resolvedId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.installment.findMany({
        where: { patientId: resolvedId, patient: { organizationId: actor.organizationId, branchId: branchScope(actor) } },
        include: { installmentPlan: { include: { treatmentPlan: { select: { id: true, name: true } } } } },
        orderBy: [{ dueDate: "asc" }, { number: "asc" }]
      }),
      this.prisma.treatmentPlan.findMany({
        where: {
          organizationId: actor.organizationId,
          patientId: resolvedId,
          branchId: branchScope(actor),
          isAlternative: false
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true
            }
          },
          professional: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          items: {
            where: { status: { not: TreatmentPlanItemStatus.CANCELLED } },
            include: {
              procedure: { select: { id: true, code: true, name: true } },
              section: { select: { id: true, name: true } },
              paymentAllocations: {
                include: { payment: { select: { id: true, status: true } } }
              },
              installmentPlanItems: {
                where: {
                  installmentPlan: {
                    status: {
                      in: [
                        InstallmentPlanStatus.DRAFT,
                        InstallmentPlanStatus.ACTIVE,
                        InstallmentPlanStatus.DEFAULTED
                      ]
                    }
                  }
                },
                select: { amount: true }
              }
            },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const balance = await this.getPatientBalance(actor, resolvedId);
    const { payablePlans, payableItems } = this.buildPayableTreatmentSummaries(treatmentPlans);
    return {
      payments: payments.map((payment) => this.enrichPayment(payment)),
      links,
      installments,
      balance,
      payablePlans,
      payableItems
    };
  }

  async getPatientBillingSummary(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const [balance, documents, reimbursements, onlineBenefits, refunds, voidedPayments, ledgerEntries] =
      await Promise.all([
        this.getPatientBalance(actor, resolvedId),
        this.prisma.financialDocument.count({
          where: { organizationId: actor.organizationId, patientId: resolvedId, branchId: branchScope(actor) }
        }),
        this.prisma.coverageCase.count({
          where: { organizationId: actor.organizationId, patientId: resolvedId, branchId: branchScope(actor) }
        }),
        this.prisma.coverageAuthorization.count({
          where: {
            coverageCase: {
              organizationId: actor.organizationId,
              patientId: resolvedId,
              branchId: branchScope(actor)
            }
          }
        }),
        this.prisma.refund.count({
          where: { organizationId: actor.organizationId, patientId: resolvedId, branchId: branchScope(actor) }
        }),
        this.prisma.payment.count({
          where: {
            organizationId: actor.organizationId,
            patientId: resolvedId,
            branchId: branchScope(actor),
            status: PaymentStatus.VOIDED
          }
        }),
        this.prisma.patientLedgerEntry.count({
          where: { organizationId: actor.organizationId, patientId: resolvedId, branchId: branchScope(actor) }
        })
      ]);

    return {
      patientId: resolvedId,
      balance,
      counts: {
        documents,
        reimbursements,
        onlineBenefits,
        refunds,
        voidedPayments,
        ledgerEntries
      }
    };
  }

  async listPatientFinancialDocuments(
    actor: AuthUser,
    patientId: string,
    query: ListPatientFinancialDocumentsQueryDto
  ) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const { skip, take } = resolvePagination(query);
    return this.prisma.financialDocument.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId: resolvedId,
        branchId: branchScope(actor),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        payment: { select: { id: true, paymentNumber: true, amount: true, status: true, paidAt: true } },
        refund: { select: { id: true, amount: true, status: true, createdAt: true } },
        treatmentPlan: { select: { id: true, name: true } },
        files: true
      },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take
    });
  }

  async listPatientReimbursementRequests(
    actor: AuthUser,
    patientId: string,
    query: ListPatientCoverageCasesQueryDto
  ) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const { skip, take } = resolvePagination(query);
    const cases = await this.prisma.coverageCase.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId: resolvedId,
        branchId: branchScope(actor),
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        agreement: { select: { id: true, name: true } },
        authorizations: {
          include: { treatmentPlan: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    });

    return cases.map((coverageCase) => {
      const requestedAmount = this.roundMoney(
        coverageCase.authorizations.reduce((sum, row) => sum + Number(row.requestedAmount ?? 0), 0)
      );
      const approvedAmount = this.roundMoney(
        coverageCase.authorizations.reduce((sum, row) => sum + Number(row.authorizedAmount ?? 0), 0)
      );
      const paidAmount = this.roundMoney(
        coverageCase.authorizations.reduce((sum, row) => sum + Number(row.consumedAmount ?? 0), 0)
      );
      return {
        ...coverageCase,
        requestedAmount,
        approvedAmount,
        paidAmount
      };
    });
  }

  async listPatientOnlineBenefits(
    actor: AuthUser,
    patientId: string,
    query: ListPatientCoverageAuthorizationsQueryDto
  ) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const { skip, take } = resolvePagination(query);
    return this.prisma.coverageAuthorization.findMany({
      where: {
        coverageCase: {
          organizationId: actor.organizationId,
          patientId: resolvedId,
          branchId: branchScope(actor)
        },
        ...(query.status ? { status: query.status } : {})
      },
      include: {
        treatmentPlan: { select: { id: true, name: true } },
        coverageCase: {
          select: {
            id: true,
            policyNumber: true,
            status: true,
            agreement: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take
    });
  }

  async listPatientVoidedPayments(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        patientId: resolvedId,
        branchId: branchScope(actor),
        status: PaymentStatus.VOIDED
      },
      include: this.paymentDetailInclude(),
      orderBy: [{ voidedAt: "desc" }, { paidAt: "desc" }]
    });
    return payments.map((payment) => this.enrichPayment(payment));
  }

  async getPatientBalance(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;

    const billablePaymentStatus = { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] };
    const [
      plannedTotal,
      allocatedTotal,
      totalPayments,
      overdueInstallments,
      activeRefunds,
      projectedCoverage
    ] = await Promise.all([
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          treatmentPlan: {
            organizationId: actor.organizationId,
            patientId: resolvedId,
            branchId: branchScope(actor),
            isAlternative: false
          },
          status: { not: TreatmentPlanItemStatus.CANCELLED }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true, settlementDiscountAmount: true },
        where: {
          payment: {
            organizationId: actor.organizationId,
            patientId: resolvedId,
            status: billablePaymentStatus
          },
          treatmentPlanItem: {
            treatmentPlan: {
              organizationId: actor.organizationId,
              patientId: resolvedId,
              branchId: branchScope(actor),
              isAlternative: false
            }
          }
        }
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          patientId: resolvedId,
          status: billablePaymentStatus
        }
      }),
      this.prisma.installment.count({
        where: {
          patientId: resolvedId,
          patient: { organizationId: actor.organizationId },
          dueDate: { lt: new Date() },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] }
        }
      }),
      this.prisma.refund.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          patientId: resolvedId,
          branchId: branchScope(actor),
          status: RefundStatus.PROCESSED
        }
      }),
      this.prisma.coverageAuthorization.aggregate({
        _sum: { authorizedAmount: true },
        where: {
          status: { in: [AuthorizationStatus.AUTHORIZED, AuthorizationStatus.PARTIALLY_AUTHORIZED] },
          coverageCase: {
            organizationId: actor.organizationId,
            patientId: resolvedId,
            branchId: branchScope(actor)
          }
        }
      })
    ]);

    const planned = Number(plannedTotal._sum.total ?? 0);
    const allocatedCash = Number(allocatedTotal._sum.amount ?? 0);
    const settlementDiscount = Number(allocatedTotal._sum.settlementDiscountAmount ?? 0);
    const allocated = allocatedCash + settlementDiscount;
    const paid = Number(totalPayments._sum.amount ?? 0);
    const refunded = Number(activeRefunds._sum.amount ?? 0);
    const coverage = Number(projectedCoverage._sum.authorizedAmount ?? 0);
    const outstanding = this.roundMoney(Math.max(planned - allocated, 0));
    const unallocatedCredit = this.roundMoney(Math.max(paid - allocatedCash, 0));
    const projectedBalance = this.roundMoney(Math.max(outstanding - coverage, 0));

    return {
      patientId: resolvedId,
      plannedAmount: planned,
      allocatedPaidAmount: allocatedCash,
      settlementDiscountAmount: settlementDiscount,
      settledAmount: allocated,
      totalPaidAmount: paid,
      outstandingAmount: outstanding,
      unallocatedCredit,
      overdueInstallments,
      confirmedBalance: outstanding,
      currentDueBalance: outstanding,
      futureBalance: 0,
      freeCreditBalance: unallocatedCredit,
      refundedAmount: this.roundMoney(refunded),
      projectedCoverage: this.roundMoney(coverage),
      projectedBalance
    };
  }

  async getPatientLedger(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    return this.prisma.patientLedgerEntry.findMany({
      where: { organizationId: actor.organizationId, patientId: resolvedId, branchId: branchScope(actor) },
      include: {
        branch: { select: { id: true, name: true } },
        treatmentPlan: { select: { id: true, name: true } }
      },
      orderBy: { occurredAt: "desc" }
    });
  }

  async getPatientPaymentBehavior(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const [ledgerEntries, treatmentItems, payments] = await Promise.all([
      this.prisma.patientLedgerEntry.findMany({
        where: {
          organizationId: actor.organizationId,
          patientId: resolvedId,
          branchId: branchScope(actor),
          status: LedgerEntryStatus.APPLIED,
          entryType: {
            in: [
              LedgerEntryType.CHARGE,
              LedgerEntryType.PAYMENT,
              LedgerEntryType.REFUND,
              LedgerEntryType.VOID
            ]
          }
        },
        orderBy: { occurredAt: "asc" }
      }),
      this.prisma.treatmentPlanItem.findMany({
        where: {
          treatmentPlan: {
            organizationId: actor.organizationId,
            patientId: resolvedId,
            branchId: branchScope(actor),
            isAlternative: false
          },
          status: { not: TreatmentPlanItemStatus.CANCELLED }
        },
        select: { id: true, total: true, createdAt: true }
      }),
      this.prisma.payment.findMany({
        where: {
          organizationId: actor.organizationId,
          patientId: resolvedId,
          branchId: branchScope(actor),
          status: { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] }
        },
        select: { id: true, amount: true, paidAt: true }
      })
    ]);

    const ledgerFinancialRows = ledgerEntries.map((entry) => ({
      date: entry.occurredAt,
      charges: Number(entry.debitAmount ?? 0),
      payments: Number(entry.creditAmount ?? 0)
    }));
    const paymentRows = ledgerFinancialRows.length
      ? ledgerFinancialRows
      : payments.map((payment) => ({
          date: payment.paidAt,
          charges: 0,
          payments: Number(payment.amount ?? 0)
        }));
    const rows = [
      ...treatmentItems.map((item) => ({
        date: item.createdAt,
        charges: Number(item.total ?? 0),
        payments: 0
      })),
      ...paymentRows
    ];

    const byDate = new Map<
      string,
      { date: string; charges: number; payments: number; runningBalance: number }
    >();
    for (const row of rows.sort((a, b) => a.date.getTime() - b.date.getTime())) {
      const date = row.date.toISOString().slice(0, 10);
      const current = byDate.get(date) ?? { date, charges: 0, payments: 0, runningBalance: 0 };
      current.charges = this.roundMoney(current.charges + row.charges);
      current.payments = this.roundMoney(current.payments + row.payments);
      byDate.set(date, current);
    }

    let runningBalance = 0;
    return Array.from(byDate.values()).map((row) => {
      runningBalance = this.roundMoney(runningBalance + row.charges - row.payments);
      return { ...row, runningBalance };
    });
  }

  async getPatientPaymentDistribution(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const [treatmentAllocations, installmentAllocations] = await Promise.all([
      this.prisma.paymentAllocation.findMany({
        where: {
          payment: {
            organizationId: actor.organizationId,
            patientId: resolvedId,
            branchId: branchScope(actor),
            status: { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] }
          }
        },
        include: {
          treatmentPlanItem: {
            select: {
              id: true,
              status: true,
              treatmentPlanId: true,
              treatmentPlan: { select: { id: true, name: true } },
              procedure: { select: { id: true, code: true, name: true } }
            }
          }
        }
      }),
      this.prisma.paymentInstallmentAllocation.findMany({
        where: {
          payment: {
            organizationId: actor.organizationId,
            patientId: resolvedId,
            branchId: branchScope(actor),
            status: { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] }
          }
        },
        include: {
          installment: {
            select: {
              id: true,
              dueDate: true,
              number: true,
              installmentPlan: { select: { treatmentPlanId: true } }
            }
          }
        }
      })
    ]);

    const categories = {
      performedProcedures: {
        key: "performedProcedures",
        label: "Pagos sobre prestaciones realizadas",
        amount: 0,
        count: 0
      },
      pendingProcedures: {
        key: "pendingProcedures",
        label: "Pagos sobre prestaciones no realizadas",
        amount: 0,
        count: 0
      },
      overdueInstallments: {
        key: "overdueInstallments",
        label: "Pagos a cuotas vencidas",
        amount: 0,
        count: 0
      },
      futureInstallments: {
        key: "futureInstallments",
        label: "Pagos a cuotas por vencer",
        amount: 0,
        count: 0
      }
    };

    for (const allocation of treatmentAllocations) {
      const itemStatus = allocation.treatmentPlanItem.status;
      const key: keyof typeof categories =
        itemStatus === TreatmentPlanItemStatus.COMPLETED || itemStatus === TreatmentPlanItemStatus.PAID
          ? "performedProcedures"
          : "pendingProcedures";
      categories[key].amount = this.roundMoney(categories[key].amount + Number(allocation.amount ?? 0));
      categories[key].count += 1;
    }

    const now = new Date();
    for (const allocation of installmentAllocations) {
      const key: keyof typeof categories =
        allocation.installment.dueDate < now ? "overdueInstallments" : "futureInstallments";
      categories[key].amount = this.roundMoney(categories[key].amount + Number(allocation.amount ?? 0));
      categories[key].count += 1;
    }

    const total = this.roundMoney(Object.values(categories).reduce((sum, row) => sum + row.amount, 0));
    return Object.values(categories).map((row) => ({
      ...row,
      percentage: total > 0 ? this.roundMoney((row.amount / total) * 100) : 0
    }));
  }

  async getPatientBalanceByPlan(actor: AuthUser, patientId: string) {
    const patient = await this.ensurePatient(actor, patientId);
    const resolvedId = patient.id;
    const [plans, coverageAuthorizations, refunds] = await Promise.all([
      this.prisma.treatmentPlan.findMany({
        where: {
          organizationId: actor.organizationId,
          patientId: resolvedId,
          branchId: branchScope(actor),
          isAlternative: false
        },
        include: {
          items: {
            where: { status: { not: TreatmentPlanItemStatus.CANCELLED } },
            include: {
              paymentAllocations: {
                include: { payment: { select: { id: true, status: true } } }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.coverageAuthorization.findMany({
        where: {
          coverageCase: { organizationId: actor.organizationId, patientId: resolvedId, branchId: branchScope(actor) },
          treatmentPlanId: { not: null }
        },
        select: { treatmentPlanId: true, authorizedAmount: true, consumedAmount: true, status: true }
      }),
      this.prisma.refund.findMany({
        where: {
          organizationId: actor.organizationId,
          patientId,
          branchId: branchScope(actor),
          status: RefundStatus.PROCESSED
        },
        include: {
          payment: {
            include: {
              allocations: {
                select: { amount: true, treatmentPlanItem: { select: { treatmentPlanId: true } } }
              }
            }
          }
        }
      })
    ]);

    const coverageByPlan = new Map<string, number>();
    for (const authorization of coverageAuthorizations) {
      if (!authorization.treatmentPlanId) continue;
      coverageByPlan.set(
        authorization.treatmentPlanId,
        this.roundMoney(
          (coverageByPlan.get(authorization.treatmentPlanId) ?? 0) +
            Number(authorization.authorizedAmount ?? 0)
        )
      );
    }

    const refundsByPlan = new Map<string, number>();
    for (const refund of refunds) {
      const allocations = refund.payment?.allocations ?? [];
      const paymentAllocated = allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amount ?? 0),
        0
      );
      for (const allocation of allocations) {
        const planId = allocation.treatmentPlanItem?.treatmentPlanId;
        if (!planId || paymentAllocated <= 0) continue;
        const proportional = Number(refund.amount ?? 0) * (Number(allocation.amount ?? 0) / paymentAllocated);
        refundsByPlan.set(planId, this.roundMoney((refundsByPlan.get(planId) ?? 0) + proportional));
      }
    }

    return plans.map((plan) => {
      const subtotal = this.roundMoney(
        plan.items.reduce((sum, item) => sum + Number(item.total ?? 0) + Number(item.discount ?? 0), 0)
      );
      const discount = this.roundMoney(plan.items.reduce((sum, item) => sum + Number(item.discount ?? 0), 0));
      const totalNet = this.roundMoney(plan.items.reduce((sum, item) => sum + Number(item.total ?? 0), 0));
      const paidCash = this.roundMoney(
        plan.items.reduce(
          (sum, item) =>
            sum +
            item.paymentAllocations.reduce((allocationSum, allocation) => {
              if (
                allocation.payment.status === PaymentStatus.REFUNDED ||
                allocation.payment.status === PaymentStatus.VOIDED
              )
                return allocationSum;
              return allocationSum + Number(allocation.amount ?? 0);
            }, 0),
          0
        )
      );
      const settlementDiscount = this.roundMoney(
        plan.items.reduce(
          (sum, item) =>
            sum +
            item.paymentAllocations.reduce((allocationSum, allocation) => {
              if (
                allocation.payment.status === PaymentStatus.REFUNDED ||
                allocation.payment.status === PaymentStatus.VOIDED
              )
                return allocationSum;
              return allocationSum + Number(allocation.settlementDiscountAmount ?? 0);
            }, 0),
          0
        )
      );
      const settled = this.roundMoney(paidCash + settlementDiscount);
      const realized = this.roundMoney(
        plan.items
          .filter(
            (item) =>
              item.status === TreatmentPlanItemStatus.COMPLETED ||
              item.status === TreatmentPlanItemStatus.PAID
          )
          .reduce((sum, item) => sum + Number(item.total ?? 0), 0)
      );
      const coverage = coverageByPlan.get(plan.id) ?? 0;
      const refunded = refundsByPlan.get(plan.id) ?? 0;
      const balanceTotal = this.roundMoney(Math.max(totalNet - settled - coverage + refunded, 0));
      const currentDue = this.roundMoney(Math.max(realized - settled - coverage + refunded, 0));
      return {
        planId: plan.id,
        planName: plan.name,
        subtotal,
        discount,
        totalNet,
        realized,
        paid: paidCash,
        settlementDiscount,
        settled,
        coverage,
        refunded,
        currentDueBalance: currentDue,
        futureBalance: this.roundMoney(Math.max(balanceTotal - currentDue, 0)),
        totalBalance: balanceTotal
      };
    });
  }

  async listAccountsReceivable(actor: AuthUser, query: ListAccountsReceivableQueryDto) {
    const { page, pageSize } = resolvePagination(query);
    const patients = await this.prisma.patient.findMany({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        branchId: branchScope(actor, query.branchId),
        ...(query.patientId ? { id: query.patientId } : {}),
        ...(query.search
          ? {
              OR: [
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        treatmentPlans: {
          where: { isAlternative: false },
          include: {
            items: {
              where: { status: { not: TreatmentPlanItemStatus.CANCELLED } },
              include: {
                paymentAllocations: {
                  include: { payment: { select: { status: true } } }
                }
              }
            }
          }
        },
        installments: true
      }
    });

    return patients
      .map((patient) => {
        const plannedAmount = patient.treatmentPlans.reduce(
          (planTotal, plan) =>
            planTotal + plan.items.reduce((itemTotal, item) => itemTotal + Number(item.total), 0),
          0
        );
        const activePaymentStatuses = new Set<PaymentStatus>([
          PaymentStatus.RECEIVED,
          PaymentStatus.PARTIALLY_ALLOCATED,
          PaymentStatus.ALLOCATED
        ]);
        const allocatedPaidAmount = patient.treatmentPlans.reduce(
          (planTotal, plan) =>
            planTotal +
            plan.items.reduce(
              (itemTotal, item) =>
                itemTotal +
                item.paymentAllocations.reduce(
                  (allocationTotal, allocation) =>
                    activePaymentStatuses.has(allocation.payment.status)
                      ? allocationTotal + Number(allocation.amount)
                      : allocationTotal,
                  0
                ),
              0
            ),
          0
        );
        const settlementDiscountAmount = patient.treatmentPlans.reduce(
          (planTotal, plan) =>
            planTotal +
            plan.items.reduce(
              (itemTotal, item) =>
                itemTotal +
                item.paymentAllocations.reduce(
                  (allocationTotal, allocation) =>
                    activePaymentStatuses.has(allocation.payment.status)
                      ? allocationTotal + Number(allocation.settlementDiscountAmount ?? 0)
                      : allocationTotal,
                  0
                ),
              0
            ),
          0
        );
        const settledAmount = this.roundMoney(allocatedPaidAmount + settlementDiscountAmount);
        const outstandingAmount = this.roundMoney(Math.max(plannedAmount - settledAmount, 0));
        const overdueInstallments = patient.installments.filter(
          (installment) =>
            installment.dueDate < new Date() &&
            installment.status !== InstallmentStatus.PAID &&
            installment.status !== InstallmentStatus.CANCELLED
        ).length;

        return {
          patientId: patient.id,
          fullName: `${patient.firstName} ${patient.lastName}`,
          branchName: patient.branch.name,
          plannedAmount: this.roundMoney(plannedAmount),
          allocatedPaidAmount: this.roundMoney(allocatedPaidAmount),
          settlementDiscountAmount: this.roundMoney(settlementDiscountAmount),
          settledAmount,
          outstandingAmount,
          overdueInstallments
        };
      })
      .filter((row) => row.outstandingAmount > 0 || row.overdueInstallments > 0)
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
      .slice((page - 1) * pageSize, page * pageSize);
  }

  async listPaymentSettlements(actor: AuthUser, query: ListPaymentSettlementsQueryDto) {
    const { skip, take, page, pageSize } = resolvePagination(query);
    const branchId = branchScope(actor, query.branchId);
    const where: Prisma.PaymentSettlementWhereInput = {
      organizationId: actor.organizationId,
      branchId,
      ...(query.paymentId ? { paymentId: query.paymentId } : {}),
      ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueAt: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {})
            }
          }
        : {})
    };

    await this.prisma.paymentSettlement.updateMany({
      where: {
        organizationId: actor.organizationId,
        branchId,
        status: PaymentSettlementStatus.PENDING,
        dueAt: { lt: new Date() }
      },
      data: { status: PaymentSettlementStatus.OVERDUE, version: { increment: 1 } }
    });

    const [rows, total, aggregates, byStatus] = await this.prisma.$transaction([
      this.prisma.paymentSettlement.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          payment: {
            select: {
              id: true,
              paymentNumber: true,
              currency: true,
              status: true,
              patient: { select: { id: true, firstName: true, lastName: true } }
            }
          },
          paymentMethod: { select: { id: true, publicCode: true, name: true, type: true } },
          paymentMethodSplit: {
            select: { retentionPercentSnapshot: true, paymentMethodNameSnapshot: true }
          },
          financialInstitution: { select: { id: true, name: true } },
          cashMovement: { select: { id: true, cashRegisterId: true, amount: true, createdAt: true } }
        },
        orderBy: [{ dueAt: "asc" }, { sequence: "asc" }],
        skip,
        take
      }),
      this.prisma.paymentSettlement.count({ where }),
      this.prisma.paymentSettlement.aggregate({ where, _sum: { amount: true } }),
      this.prisma.paymentSettlement.groupBy({
        where,
        by: ["status"],
        _count: { _all: true },
        _sum: { amount: true }
      })
    ]);

    return {
      data: rows.map((row) => {
        const grossAmount = Number(row.amount);
        const retentionAmount = this.roundMoney(
          grossAmount * (Number(row.paymentMethodSplit.retentionPercentSnapshot) / 100)
        );
        return {
          ...row,
          grossAmount,
          retentionAmount,
          netAmount: this.roundMoney(grossAmount - retentionAmount)
        };
      }),
      meta: { page, pageSize, total },
      totals: {
        grossAmount: Number(aggregates._sum.amount ?? 0),
        byStatus: Object.fromEntries(
          byStatus.map((row) => [
            row.status,
            { count: row._count._all, amount: Number(row._sum.amount ?? 0) }
          ])
        )
      }
    };
  }

  async receivePaymentSettlement(actor: AuthUser, id: string, dto: ReceivePaymentSettlementDto) {
    const current = await this.prisma.paymentSettlement.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: { paymentMethodSplit: true, payment: true }
    });
    if (!current) throw new NotFoundException("Payment settlement not found");
    if (
      current.status !== PaymentSettlementStatus.PENDING &&
      current.status !== PaymentSettlementStatus.OVERDUE
    ) {
      throw new BadRequestException("Only pending or overdue settlements can be received");
    }
    if (current.version !== dto.expectedVersion)
      throw new ConflictException("Settlement changed; refresh and retry");
    this.validatePaymentMethodRequirements(
      {
        requiresReference: current.paymentMethodSplit.requiresReferenceSnapshot,
        requiresFinancialInstitution: current.paymentMethodSplit.requiresFinancialInstitutionSnapshot
      } as PaymentMethod,
      dto.reference ?? current.reference ?? undefined,
      dto.financialInstitutionId ?? current.financialInstitutionId ?? undefined
    );

    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id: dto.cashRegisterId,
        organizationId: actor.organizationId,
        branchId: current.branchId,
        status: CashRegisterStatus.OPEN
      },
      select: { id: true }
    });
    if (!register)
      throw new ConflictException("An open cash register is required to receive this settlement");

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentSettlement.updateMany({
        where: {
          id: current.id,
          version: dto.expectedVersion,
          status: { in: [PaymentSettlementStatus.PENDING, PaymentSettlementStatus.OVERDUE] }
        },
        data: {
          status: PaymentSettlementStatus.RECEIVED,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          reference: dto.reference?.trim() || current.reference,
          financialInstitutionId: dto.financialInstitutionId ?? current.financialInstitutionId,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw new ConflictException("Settlement changed; refresh and retry");

      const grossAmount = Number(current.amount);
      const retentionAmount = this.roundMoney(
        grossAmount * (Number(current.paymentMethodSplit.retentionPercentSnapshot) / 100)
      );
      await tx.cashMovement.create({
        data: {
          organizationId: actor.organizationId,
          branchId: current.branchId,
          cashRegisterId: register.id,
          type: CashMovementType.INCOME,
          direction: CashMovementDirection.IN,
          amount: this.toDecimal(this.roundMoney(grossAmount - retentionAmount)),
          paymentId: current.paymentId,
          paymentSettlementId: current.id,
          paymentMethodId: current.paymentMethodId,
          paymentMethodNameSnapshot: current.paymentMethodSplit.paymentMethodNameSnapshot,
          paymentMethodTypeSnapshot: current.paymentMethodSplit.paymentMethodTypeSnapshot,
          includeInPhysicalCashBalanceSnapshot:
            current.paymentMethodSplit.includeInPhysicalCashBalanceSnapshot,
          includeInCashFlowReportsSnapshot: current.paymentMethodSplit.includeInCashFlowReportsSnapshot,
          includeInClosingSummarySnapshot: current.paymentMethodSplit.includeInClosingSummarySnapshot,
          includeInGraphicalReportsSnapshot: current.paymentMethodSplit.includeInGraphicalReportsSnapshot,
          reference: dto.reference?.trim() || current.reference,
          description: `Recepcion ${current.sequence} de pago #${this.publicPaymentNumber(current.payment)}`,
          createdById: actor.id
        }
      });
      await this.audit(tx, actor, {
        entity: "PaymentSettlement",
        entityId: current.id,
        action: "receive",
        before: { status: current.status, version: current.version },
        after: { status: PaymentSettlementStatus.RECEIVED, grossAmount, retentionAmount }
      });
    });
    return this.prisma.paymentSettlement.findUnique({ where: { id }, include: { cashMovement: true } });
  }

  async cancelPaymentSettlement(actor: AuthUser, id: string, dto: CancelPaymentSettlementDto) {
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("Cancellation reason is required");
    const current = await this.prisma.paymentSettlement.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor) }
    });
    if (!current) throw new NotFoundException("Payment settlement not found");
    if (
      current.status !== PaymentSettlementStatus.PENDING &&
      current.status !== PaymentSettlementStatus.OVERDUE
    ) {
      throw new BadRequestException("Only pending or overdue settlements can be cancelled");
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentSettlement.updateMany({
        where: { id, version: dto.expectedVersion, status: current.status },
        data: { status: PaymentSettlementStatus.CANCELLED, notes: reason, version: { increment: 1 } }
      });
      if (updated.count !== 1) throw new ConflictException("Settlement changed; refresh and retry");
      await this.audit(tx, actor, {
        entity: "PaymentSettlement",
        entityId: id,
        action: "cancel",
        before: { status: current.status, version: current.version },
        after: { status: PaymentSettlementStatus.CANCELLED, reason }
      });
    });
    return this.prisma.paymentSettlement.findUnique({ where: { id } });
  }

  async createRefund(actor: AuthUser, paymentId: string, dto: CreateRefundDto) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor)
      },
      include: {
        paymentMethod: true,
        cashMovements: {
          where: { direction: CashMovementDirection.IN, voidedAt: null },
          select: { amount: true }
        },
        settlements: { select: { id: true, status: true } }
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");

    const refundMethodId = dto.paymentMethodId ?? payment.paymentMethodId;
    if (!refundMethodId) throw new BadRequestException("A refund payment method is required");
    const refundMethod = await this.prisma.paymentMethod.findFirst({
      where: { id: refundMethodId, organizationId: actor.organizationId, isActive: true }
    });
    if (!refundMethod) throw new BadRequestException("Refund payment method is not active");
    if (!refundMethod.allowsRefund) {
      throw new BadRequestException("The selected payment method does not allow refunds");
    }
    if (refundMethod.id !== payment.paymentMethodId && !dto.reason?.trim()) {
      throw new BadRequestException("A reason is required when refunding through a different payment method");
    }
    this.validatePaymentMethodRequirements(refundMethod, dto.reference, dto.financialInstitutionId);
    if (dto.financialInstitutionId) await this.ensureFinancialInstitution(actor, dto.financialInstitutionId);

    const processedRefundSum = await this.prisma.refund.aggregate({
      _sum: { amount: true },
      where: { paymentId, status: RefundStatus.PROCESSED }
    });

    const refundedAmount = Number(processedRefundSum._sum.amount ?? 0);
    const receivedNetFromCash = this.roundMoney(
      payment.cashMovements.reduce((sum, movement) => sum + Number(movement.amount), 0)
    );
    const receivedNet = payment.settlements.length
      ? receivedNetFromCash
      : receivedNetFromCash > 0
        ? receivedNetFromCash
        : Number(payment.netAmount ?? payment.amount);
    const maxRefund = this.roundMoney(receivedNet - refundedAmount);
    if (dto.amount > maxRefund)
      throw new BadRequestException("Refund amount exceeds available refundable amount");

    const openRegister = await this.ensureOpenCashRegister(actor, payment.branchId);

    const created = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          organizationId: actor.organizationId,
          branchId: payment.branchId,
          paymentId: payment.id,
          patientId: payment.patientId,
          amount: this.toDecimal(dto.amount || 0),
          originalPaymentMethodId: payment.paymentMethodId,
          ...(payment.paymentMethodSnapshot !== null
            ? { originalPaymentMethodSnapshot: payment.paymentMethodSnapshot as Prisma.InputJsonValue }
            : payment.paymentMethod
              ? { originalPaymentMethodSnapshot: this.paymentMethodSnapshot(payment.paymentMethod) }
              : {}),
          paymentMethodId: refundMethod.id,
          refundPaymentMethodSnapshot: this.paymentMethodSnapshot(refundMethod),
          financialInstitutionId: dto.financialInstitutionId,
          reference: dto.reference?.trim(),
          reason: dto.reason?.trim(),
          status: RefundStatus.PROCESSED,
          processedById: actor.id,
          processedAt: new Date()
        }
      });

      if (openRegister) {
        const activeRegister = await tx.cashRegister.findFirst({
          where: { id: openRegister.id, status: CashRegisterStatus.OPEN },
          select: { id: true }
        });
        if (!activeRegister)
          throw new ConflictException("Cash register is being closed. Refresh before processing the refund.");
        await tx.cashMovement.create({
          data: {
            organizationId: actor.organizationId,
            branchId: payment.branchId,
            cashRegisterId: openRegister.id,
            type: CashMovementType.REFUND,
            direction: CashMovementDirection.OUT,
            amount: this.toDecimal(dto.amount || 0),
            paymentId: payment.id,
            refundId: refund.id,
            paymentMethodId: refund.paymentMethodId,
            ...this.cashMovementMethodSnapshot(refundMethod),
            description: `Devolucion ${refund.id}`,
            createdById: actor.id
          }
        });
      }

      await tx.patientLedgerEntry.create({
        data: {
          organizationId: actor.organizationId,
          branchId: payment.branchId,
          patientId: payment.patientId,
          occurredAt: refund.processedAt ?? refund.createdAt,
          entryType: LedgerEntryType.REFUND,
          sourceType: LedgerSourceType.REFUND,
          sourceId: refund.id,
          debitAmount: refund.amount,
          currency: payment.currency,
          descriptionSnapshot: `Devolucion de pago #${this.publicPaymentNumber(payment)}`
        }
      });

      const nextRefunded = this.roundMoney(refundedAmount + dto.amount);
      if (nextRefunded >= receivedNet) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED }
        });
        await tx.paymentSettlement.updateMany({
          where: {
            paymentId: payment.id,
            status: { in: [PaymentSettlementStatus.PENDING, PaymentSettlementStatus.OVERDUE] }
          },
          data: {
            status: PaymentSettlementStatus.CANCELLED,
            notes: "Cancelada automáticamente por devolución total del neto recibido",
            version: { increment: 1 }
          }
        });
      }

      await this.audit(tx, actor, {
        entity: "Refund",
        entityId: refund.id,
        action: "create",
        after: {
          paymentId,
          amount: dto.amount,
          paymentMethodId: refundMethod.id,
          financialInstitutionId: dto.financialInstitutionId,
          reference: dto.reference?.trim()
        }
      });

      if (this.cashDiscounts) await this.cashDiscounts.syncRefundStatus(tx, actor, payment.id);

      return refund.id;
    });

    return this.prisma.refund.findUnique({
      where: { id: created },
      include: {
        payment: { select: { id: true, paymentNumber: true, amount: true, status: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        processedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  async listRefunds(actor: AuthUser, query: ListRefundsQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.refund.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.patientId ? { patientId: query.patientId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.treatmentPlanId
          ? {
              payment: {
                allocations: {
                  some: {
                    treatmentPlanItem: {
                      treatmentPlanId: query.treatmentPlanId
                    }
                  }
                }
              }
            }
          : {}),
        branchId: branchScope(actor)
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        payment: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            status: true,
            allocations: {
              include: {
                treatmentPlanItem: {
                  select: {
                    id: true,
                    treatmentPlanId: true,
                    toothNumber: true,
                    surface: true,
                    procedure: { select: { id: true, code: true, name: true } }
                  }
                }
              }
            }
          }
        },
        processedBy: { select: { id: true, firstName: true, lastName: true } }
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }
    });
  }

  private async getPayment(actor: AuthUser, paymentId: string) {
    const paymentNumber = this.parsePaymentNumber(paymentId);
    const payment = await this.prisma.payment.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: paymentId }, ...(paymentNumber !== null ? [{ paymentNumber }] : [])]
      },
      include: this.paymentDetailInclude()
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return this.enrichPayment(payment);
  }

  private enrichPayment(payment: any) {
    const activeStatuses = new Set<PaymentStatus>([
      PaymentStatus.RECEIVED,
      PaymentStatus.PARTIALLY_ALLOCATED,
      PaymentStatus.ALLOCATED
    ]);
    const treatmentMap = new Map<
      string,
      { id: string; number: string; name: string; procedures: string[] }
    >();
    const breakdown: Array<{
      id: string;
      kind: "TREATMENT" | "INSTALLMENT";
      treatmentPlanId: string | null;
      treatmentNumber: string;
      treatmentName: string;
      detail: string;
      baseAmount: number;
      paidAmount: number;
      discountAmount: number;
      remainingAmount: number;
      dueDate: Date | null;
    }> = [];

    for (const allocation of payment.allocations ?? []) {
      const item = allocation.treatmentPlanItem;
      const plan = item?.treatmentPlan;
      if (!item || !plan) continue;
      const procedureName = item.procedure?.name ?? item.procedure?.code ?? "Prestacion";
      const current = treatmentMap.get(plan.id) ?? {
        id: plan.id,
        number: this.publicPlanNumber(plan.id),
        name: plan.name,
        procedures: [] as string[]
      };
      if (!current.procedures.includes(procedureName)) current.procedures.push(procedureName);
      treatmentMap.set(plan.id, current);

      const activePaid = this.roundMoney(
        (item.paymentAllocations ?? []).reduce((sum: number, row: any) => {
          if (!activeStatuses.has(row.payment?.status)) return sum;
          return sum + Number(row.amount) + Number(row.settlementDiscountAmount ?? 0);
        }, 0)
      );
      const baseAmount = this.roundMoney(Number(item.total ?? 0));
      breakdown.push({
        id: allocation.id,
        kind: "TREATMENT",
        treatmentPlanId: plan.id,
        treatmentNumber: this.publicPlanNumber(plan.id),
        treatmentName: plan.name,
        detail: [
          procedureName,
          item.toothNumber ? `Pieza ${item.toothNumber}` : null,
          item.surface ? `Cara ${item.surface}` : null
        ]
          .filter(Boolean)
          .join(" - "),
        baseAmount,
        paidAmount: this.roundMoney(Number(allocation.amount ?? 0)),
        discountAmount: this.roundMoney(Number(allocation.settlementDiscountAmount ?? 0)),
        remainingAmount: this.roundMoney(Math.max(baseAmount - activePaid, 0)),
        dueDate: null
      });
    }

    for (const allocation of payment.installmentAllocations ?? []) {
      const installment = allocation.installment;
      const plan = installment?.installmentPlan?.treatmentPlan;
      const planId = plan?.id ?? installment?.installmentPlan?.treatmentPlanId ?? null;
      if (planId) {
        const current = treatmentMap.get(planId) ?? {
          id: planId,
          number: this.publicPlanNumber(planId),
          name: plan?.name ?? "Financiamiento",
          procedures: [] as string[]
        };
        if (!current.procedures.includes("Cuota de financiamiento"))
          current.procedures.push("Cuota de financiamiento");
        treatmentMap.set(planId, current);
      }
      const baseAmount = this.roundMoney(Number(installment?.amount ?? 0));
      breakdown.push({
        id: allocation.id,
        kind: "INSTALLMENT",
        treatmentPlanId: planId,
        treatmentNumber: planId ? this.publicPlanNumber(planId) : "-",
        treatmentName: plan?.name ?? "Financiamiento",
        detail: `Cuota ${installment?.number ?? "-"}`,
        baseAmount,
        paidAmount: this.roundMoney(Number(allocation.amount ?? 0)),
        discountAmount: 0,
        remainingAmount: this.roundMoney(Math.max(baseAmount - Number(installment?.paidAmount ?? 0), 0)),
        dueDate: installment?.dueDate ?? null
      });
    }

    const allocatedAmount = this.roundMoney(
      [...(payment.allocations ?? []), ...(payment.installmentAllocations ?? [])].reduce(
        (sum, allocation) => sum + Number(allocation.amount ?? 0),
        0
      )
    );
    const dueDates = breakdown.map((row) => row.dueDate).filter((date): date is Date => Boolean(date));
    const firstMovement = payment.cashMovements?.[0] ?? null;
    const publicPaymentNumber = this.publicPaymentNumber(payment);
    const cashRegister = firstMovement?.cashRegister
      ? {
          id: firstMovement.cashRegister.id,
          movementId: firstMovement.id,
          displayName: this.cashRegisterDisplayName(firstMovement.cashRegister),
          branch: firstMovement.cashRegister.branch,
          openedBy: firstMovement.cashRegister.openedBy,
          status: firstMovement.cashRegister.status,
          openedAt: firstMovement.cashRegister.openedAt,
          closedAt: firstMovement.cashRegister.closedAt
        }
      : null;

    return {
      ...payment,
      paymentNumber: publicPaymentNumber,
      ticketId: payment.reference ?? null,
      cashRegister,
      paymentMethods: this.publicPaymentMethods(payment),
      treatmentRefs: Array.from(treatmentMap.values()),
      breakdown,
      dueDate: dueDates.length ? dueDates.sort((a, b) => a.getTime() - b.getTime())[0] : null,
      allocatedAmount,
      unallocatedAmount: this.roundMoney(Math.max(Number(payment.amount ?? 0) - allocatedAmount, 0)),
      remainingPlanBalance: this.roundMoney(breakdown.reduce((sum, row) => sum + row.remainingAmount, 0)),
      receiptBranding: this.resolveReceiptBranding(payment.branch, payment.organization),
      receipt: {
        available: publicPaymentNumber !== "SIN-NUMERO",
        previewUrl: `/payments/${publicPaymentNumber}/receipt`,
        pdfUrl: `/payments/${publicPaymentNumber}/receipt.pdf`
      }
    };
  }

  private parsePaymentNumber(value: string) {
    if (!/^\d{6}$/.test(value.trim())) return null;
    return Number(value);
  }

  private publicPaymentNumber(payment: { paymentNumber?: number | null; reference?: string | null }) {
    if (payment.paymentNumber) return String(payment.paymentNumber).padStart(6, "0");
    const reference = payment.reference?.trim();
    if (reference && /^\d{6}$/.test(reference)) return reference;
    return "SIN-NUMERO";
  }

  private parseCashRegisterNumber(value: string) {
    const normalized = value.trim().replace(/^CAJ-/i, "");
    return /^\d{1,6}$/.test(normalized) ? Number(normalized) : null;
  }

  private publicPlanNumber(planId: string) {
    let hash = 0;
    for (let index = 0; index < planId.length; index += 1) {
      hash = planId.charCodeAt(index) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 1000000)
      .toString()
      .padStart(6, "0");
  }

  private generatePaymentNumber() {
    return randomInt(100000, 1000000);
  }

  private async createPaymentWithPublicNumberRetry(create: (paymentNumber: number) => Promise<string>) {
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await create(this.generatePaymentNumber());
      } catch (error) {
        if (this.isPaymentNumberCollision(error)) continue;
        throw error;
      }
    }
    throw new ConflictException("Could not generate a unique payment number. Try again.");
  }

  private isPaymentNumberCollision(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== "P2002") return false;
    const target = (error.meta?.target as string[] | string | undefined) ?? "";
    return Array.isArray(target)
      ? target.includes("paymentNumber")
      : String(target).includes("paymentNumber");
  }

  private isUniqueCollision(error: unknown, field: string) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
    const target = (error.meta?.target as string[] | string | undefined) ?? "";
    return Array.isArray(target) ? target.includes(field) : String(target).includes(field);
  }

  private cashRegisterDisplayName(
    register?: {
      openedAt?: Date | string | null;
      branch?: { name?: string | null } | null;
      openedBy?: { firstName?: string | null; lastName?: string | null } | null;
    } | null
  ) {
    if (!register) return null;
    const owner = `${register.openedBy?.firstName ?? ""} ${register.openedBy?.lastName ?? ""}`.trim();
    const date = register.openedAt ? new Date(register.openedAt).toLocaleDateString("es-MX") : "";
    return ["Caja", register.branch?.name, owner ? `abierta por ${owner}` : null, date]
      .filter(Boolean)
      .join(" · ");
  }

  private resolveReceiptBranding(branch?: any, organization?: any) {
    const brand = branch?.brand ?? null;
    const businessName = branch?.name || brand?.shortName || brand?.name || organization?.name || "Clinica";
    const address = this.formatBranchAddress(branch) || organization?.address || null;
    const phone = this.formatPhone(branch?.phone || brand?.phone || organization?.phone, branch?.countryCode);
    const email = branch?.email || brand?.senderEmail || brand?.replyToEmail || organization?.email || null;
    return {
      logoUrl: this.publicAssetUrl(branch?.logoUrl || brand?.logoUrl || organization?.logoUrl),
      businessName,
      legalName: brand?.legalName || organization?.legalName || null,
      address,
      phone,
      email,
      website: branch?.website || brand?.website || null,
      privacyNoticeUrl: brand?.privacyNoticeUrl || null,
      primaryColor: brand?.primaryColor || "#0369a1",
      secondaryColor: brand?.secondaryColor || "#0f172a"
    };
  }

  private formatBranchAddress(branch?: any) {
    if (!branch) return null;
    const streetLine = [
      branch.address,
      branch.exteriorNumber ? `No. ${branch.exteriorNumber}` : null,
      branch.interiorNumber ? `Int. ${branch.interiorNumber}` : null
    ]
      .filter(Boolean)
      .join(" ");
    const locality = [branch.neighborhood, branch.municipality].filter(Boolean).join(", ");
    const cityLine = [branch.city, branch.state].filter(Boolean).join(", ");
    const postal = branch.postalCode ? `C.P. ${branch.postalCode}` : null;
    return [
      streetLine,
      locality,
      cityLine,
      postal,
      branch.country && branch.country !== "MX" ? branch.country : null
    ]
      .filter((part) => typeof part === "string" && part.trim())
      .join(", ");
  }

  private formatPhone(value?: string | null, countryCode?: string | null) {
    const phone = value?.trim();
    if (!phone) return null;
    if (phone.startsWith("+") || !countryCode?.trim()) return phone;
    return `${countryCode.trim()} ${phone}`;
  }

  private publicAssetUrl(value?: string | null) {
    const url = value?.trim();
    if (!url || !/^https:\/\//i.test(url)) return null;
    return url;
  }

  private publicPaymentMethods(payment: any) {
    if (payment.splits?.length) {
      return payment.splits.map((split: any) => ({
        name: split.paymentMethod?.name ?? "Medio no informado",
        amount: Number(split.amount ?? 0),
        reference: split.reference ?? split.authorizationCode ?? split.externalTransactionId ?? null,
        financialInstitution: split.financialInstitution?.name ?? null
      }));
    }
    return [
      {
        name: payment.paymentMethod?.name ?? "Medio no informado",
        amount: Number(payment.amount ?? 0),
        reference: payment.reference ?? null,
        financialInstitution: payment.financialInstitution?.name ?? null
      }
    ];
  }

  private buildReceiptText(payment: any) {
    const patientName = `${payment.patient?.firstName ?? ""} ${payment.patient?.lastName ?? ""}`.trim();
    const receiverName =
      `${payment.receivedBy?.firstName ?? ""} ${payment.receivedBy?.lastName ?? ""}`.trim();
    const lines = [
      `Comprobante de pago #${payment.paymentNumber}`,
      "",
      `Paciente: ${patientName || payment.patientId}`,
      `Sucursal: ${payment.branch?.name ?? "-"}`,
      `Recibido por: ${receiverName || "-"}`,
      `Fecha recepcion: ${payment.paidAt ? new Date(payment.paidAt).toLocaleString("es-MX") : "-"}`,
      payment.splits?.length
        ? `Metodos: ${payment.splits.map((s: any) => `${s.paymentMethod?.name} (${this.formatCurrency(s.amount)})`).join(", ")}`
        : `Metodo: ${payment.paymentMethod?.name ?? "-"}`,
      `Referencia: ${payment.reference ?? payment.ticketId ?? "-"}`,
      `Caja: ${payment.cashRegister?.displayName ?? "-"}`,
      `Monto: ${this.formatCurrency(payment.amount)} ${payment.currency ?? ""}`.trim(),
      "",
      "Desglose"
    ];

    for (const row of payment.breakdown ?? []) {
      lines.push(
        `- Trat. ${row.treatmentNumber} | ${row.detail} | Base ${this.formatCurrency(row.baseAmount)} | Pagado ${this.formatCurrency(row.paidAmount)}${row.discountAmount ? ` | Descuento ${this.formatCurrency(row.discountAmount)}` : ""}`
      );
    }

    if (payment.cashDiscountApplication) {
      lines.push(
        "",
        `Descuento por caja: ${payment.cashDiscountApplication.ruleNameSnapshot} (${payment.cashDiscountApplication.discountPercentSnapshot} %)`,
        `Importe descontado: ${this.formatCurrency(payment.cashDiscountApplication.discountAmount)}`,
        `Saldo original: ${this.formatCurrency(payment.cashDiscountApplication.originalAmount)}`
      );
    }

    if (!payment.breakdown?.length) lines.push("- Pago recibido sin aplicaciones a tratamiento o cuota.");
    if (payment.notes) lines.push("", `Notas: ${payment.notes}`);
    return lines.join("\n");
  }

  private async getCashRegister(actor: AuthUser, registerId: string) {
    const publicNumber = this.parseCashRegisterNumber(registerId);
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: registerId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        responsibleUser: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: {
          orderBy: { createdAt: "asc" },
          include: {
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
                includeInPhysicalCashBalance: true,
                includeInClosingSummary: true
              }
            },
            payment: {
              select: {
                paymentMethod: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    includeInPhysicalCashBalance: true,
                    includeInClosingSummary: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!register) throw new NotFoundException("Cash register not found");
    return register;
  }

  private buildPayableTreatmentSummaries(
    treatmentPlans: Array<{
      id: string;
      name: string;
      status: string;
      createdAt: Date;
      branch: { id: string; name: string };
      professional: { id: string; firstName: string; lastName: string };
      items: Array<{
        id: string;
        version: number;
        toothNumber: string | null;
        surface: string | null;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        discount: Prisma.Decimal;
        total: Prisma.Decimal;
        status: TreatmentPlanItemStatus;
        plannedAt: Date | null;
        completedAt: Date | null;
        procedure: { id: string; code: string; name: string };
        section: { id: string; name: string } | null;
        paymentAllocations: Array<{
          amount: Prisma.Decimal;
          settlementDiscountAmount: Prisma.Decimal;
          payment: { id: string; status: PaymentStatus };
        }>;
        installmentPlanItems?: Array<{
          amount: Prisma.Decimal;
        }>;
      }>;
    }>
  ) {
    const payableStatuses = new Set<PaymentStatus>([
      PaymentStatus.RECEIVED,
      PaymentStatus.PARTIALLY_ALLOCATED,
      PaymentStatus.ALLOCATED
    ]);
    const payableItems: Array<{
      id: string;
      version: number;
      treatmentPlanId: string;
      treatmentPlanNumber: string;
      treatmentPlanName: string;
      treatmentPlanStatus: string;
      procedure: { id: string; code: string; name: string };
      section: { id: string; name: string } | null;
      toothNumber: string | null;
      surface: string | null;
      quantity: number;
      unitPrice: number;
      discount: number;
      total: number;
      paidAmount: number;
      outstandingAmount: number;
      financedAmount: number;
      financeableAmount: number;
      status: TreatmentPlanItemStatus;
      plannedAt: Date | null;
      completedAt: Date | null;
    }> = [];

    const payablePlans = treatmentPlans
      .map((plan) => {
        const items = plan.items.map((item) => {
          const paidAmount = this.roundMoney(
            item.paymentAllocations.reduce((sum, allocation) => {
              if (!payableStatuses.has(allocation.payment.status)) return sum;
              return sum + Number(allocation.amount) + Number(allocation.settlementDiscountAmount ?? 0);
            }, 0)
          );
          const total = Number(item.total);
          const outstandingAmount = this.roundMoney(Math.max(total - paidAmount, 0));
          const financedAmount = this.roundMoney(
            (item.installmentPlanItems ?? []).reduce((sum, allocation) => sum + Number(allocation.amount), 0)
          );
          const financeableAmount = this.roundMoney(Math.max(outstandingAmount - financedAmount, 0));
          const summary = {
            id: item.id,
            version: item.version,
            treatmentPlanId: plan.id,
            treatmentPlanNumber: this.publicPlanNumber(plan.id),
            treatmentPlanName: plan.name,
            treatmentPlanStatus: plan.status,
            procedure: item.procedure,
            section: item.section,
            toothNumber: item.toothNumber,
            surface: item.surface,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            total: this.roundMoney(total),
            paidAmount,
            outstandingAmount,
            financedAmount,
            financeableAmount,
            status: item.status,
            plannedAt: item.plannedAt,
            completedAt: item.completedAt
          };

          if (outstandingAmount > 0) payableItems.push(summary);
          return summary;
        });

        const totalBudget = this.roundMoney(items.reduce((sum, item) => sum + item.total, 0));
        const paidAmount = this.roundMoney(items.reduce((sum, item) => sum + item.paidAmount, 0));
        const outstandingAmount = this.roundMoney(
          items.reduce((sum, item) => sum + item.outstandingAmount, 0)
        );
        const realizedAmount = this.roundMoney(
          items
            .filter((item) => item.status === TreatmentPlanItemStatus.COMPLETED)
            .reduce((sum, item) => sum + item.total, 0)
        );

        return {
          id: plan.id,
          number: this.publicPlanNumber(plan.id),
          name: plan.name,
          status: plan.status,
          branch: plan.branch,
          professional: plan.professional,
          createdAt: plan.createdAt,
          totalBudget,
          paidAmount,
          realizedAmount,
          outstandingAmount,
          items: items.filter((item) => item.outstandingAmount > 0)
        };
      })
      .filter((plan) => plan.outstandingAmount > 0);

    return { payablePlans, payableItems };
  }

  private async enrichCashRegister<
    T extends {
      branchId: string;
      openedAt: Date;
      previousClosingBalance?: Prisma.Decimal;
      expectedCashBalance?: Prisma.Decimal | null;
      reconciliationSnapshot?: Prisma.JsonValue | null;
      movements: Array<{
        type: CashMovementType;
        direction: CashMovementDirection;
        amount: Prisma.Decimal;
        voidedAt?: Date | null;
        paymentMethod?: {
          name: string;
          type: string;
          includeInPhysicalCashBalance: boolean;
          includeInClosingSummary: boolean;
        } | null;
        payment?: {
          paymentMethod?: {
            name: string;
            type: string;
            includeInPhysicalCashBalance: boolean;
            includeInClosingSummary: boolean;
          } | null;
        } | null;
      }>;
    }
  >(actor: AuthUser, register: T) {
    const previousBalance =
      register.previousClosingBalance !== undefined
        ? this.roundMoney(register.previousClosingBalance)
        : await this.getPreviousCashRegisterBalance(actor, register.branchId, register.openedAt);
    const totals = this.calculateCashRegisterTotals(register.movements);

    return {
      ...register,
      previousBalance,
      expectedClosing:
        register.expectedCashBalance !== undefined && register.expectedCashBalance !== null
          ? this.roundMoney(register.expectedCashBalance)
          : this.calculateExpectedClosing(register.movements),
      movementCount: register.movements.length,
      ...totals
    };
  }

  private async getPreviousCashRegisterBalance(actor: AuthUser, branchId: string, openedAt: Date) {
    const previous = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId,
        status: CashRegisterStatus.CLOSED,
        openedAt: { lt: openedAt }
      },
      select: { closingAmount: true },
      orderBy: { openedAt: "desc" }
    });

    return this.roundMoney(Number(previous?.closingAmount ?? 0));
  }

  private async ensureBranch(actor: AuthUser, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchScope(actor, branchId), organizationId: actor.organizationId, deletedAt: null }
    });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async ensurePatient(actor: AuthUser, patientId: string) {
    const trimmed = patientId.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    const patient = await this.prisma.patient.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        deletedAt: null,
        ...(isNumeric
          ? { OR: [{ id: trimmed }, { patientNumber: parseInt(trimmed, 10) }] }
          : { id: trimmed })
      }
    });
    if (!patient) throw new NotFoundException("Patient not found");
    return patient;
  }

  private async ensurePaymentMethod(actor: AuthUser, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, organizationId: actor.organizationId, isActive: true }
    });
    if (!method) throw new NotFoundException("Payment method not found");
    return method;
  }

  private validatePaymentMethodRequirements(
    method: PaymentMethod,
    reference?: string | null,
    financialInstitutionId?: string | null
  ) {
    if (method.requiresReference && !reference?.trim()) {
      throw new BadRequestException(`El medio ${method.name} requiere una referencia.`);
    }
    if (method.requiresFinancialInstitution && !financialInstitutionId) {
      throw new BadRequestException(`El medio ${method.name} requiere una institución financiera.`);
    }
  }

  private async validateScheduledSettlements(
    actor: AuthUser,
    method: PaymentMethod,
    split: ReturnType<PaymentsService["normalizePaymentSplits"]>[number]
  ) {
    if (!split.scheduledSettlements.length) return;
    if (!method.acceptsMultipleSettlements) {
      throw new BadRequestException(`El medio ${method.name} no acepta liquidaciones programadas.`);
    }
    if (split.scheduledSettlements.length < 2) {
      throw new BadRequestException("Una recepción diferida debe contener al menos dos vencimientos.");
    }
    const sequences = new Set(split.scheduledSettlements.map((settlement) => settlement.sequence));
    if (sequences.size !== split.scheduledSettlements.length) {
      throw new BadRequestException("Los números de las liquidaciones programadas no pueden repetirse.");
    }
    const references = split.scheduledSettlements
      .map((settlement) => settlement.reference?.toLocaleLowerCase())
      .filter((reference): reference is string => Boolean(reference));
    if (new Set(references).size !== references.length) {
      throw new BadRequestException("Las referencias de las liquidaciones programadas no pueden repetirse.");
    }
    const scheduledTotal = sumDecimals(split.scheduledSettlements.map((settlement) => settlement.amount));
    if (!isDecimalEqual(scheduledTotal, split.amount)) {
      throw new BadRequestException(
        "La suma de las liquidaciones programadas debe coincidir con el importe del medio de pago."
      );
    }
    for (const settlement of split.scheduledSettlements) {
      if (Number.isNaN(settlement.dueAt.getTime())) {
        throw new BadRequestException("Una fecha de recepción programada no es válida.");
      }
      if (settlement.financialInstitutionId) {
        await this.ensureFinancialInstitution(actor, settlement.financialInstitutionId);
      }
      this.validatePaymentMethodRequirements(
        method,
        settlement.reference ?? split.reference,
        settlement.financialInstitutionId ?? split.financialInstitutionId
      );
    }
  }

  private paymentMethodSnapshot(method: PaymentMethod): Prisma.InputJsonObject {
    return {
      id: method.id,
      publicCode: method.publicCode,
      name: method.name,
      type: method.type,
      source: method.source,
      retentionPercent: method.retentionPercent.toFixed(2),
      allowsRefund: method.allowsRefund,
      acceptsMultipleSettlements: method.acceptsMultipleSettlements,
      requiresReference: method.requiresReference,
      requiresFinancialInstitution: method.requiresFinancialInstitution,
      fiscalCode: method.fiscalCode,
      includeInCollectionReports: method.includeInCollectionReports,
      includeInPhysicalCashBalance: method.includeInPhysicalCashBalance,
      includeInCashFlowReports: method.includeInCashFlowReports,
      includeInClosingSummary: method.includeInClosingSummary,
      includeInGraphicalReports: method.includeInGraphicalReports,
      version: method.version
    };
  }

  private cashMovementMethodSnapshot(method: PaymentMethod) {
    return {
      paymentMethodNameSnapshot: method.name,
      paymentMethodTypeSnapshot: method.type,
      includeInCollectionReportsSnapshot: method.includeInCollectionReports,
      includeInPhysicalCashBalanceSnapshot: method.includeInPhysicalCashBalance,
      includeInCashFlowReportsSnapshot: method.includeInCashFlowReports,
      includeInClosingSummarySnapshot: method.includeInClosingSummary,
      includeInGraphicalReportsSnapshot: method.includeInGraphicalReports
    };
  }

  private snapshotBoolean(snapshot: Prisma.JsonValue | null, key: string, fallback: boolean) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return fallback;
    const value = snapshot[key];
    return typeof value === "boolean" ? value : fallback;
  }

  private snapshotString(snapshot: Prisma.JsonValue | null, key: string, fallback: string) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return fallback;
    const value = snapshot[key];
    return typeof value === "string" ? value : fallback;
  }

  private async ensureFinancialInstitution(actor: AuthUser, financialInstitutionId: string) {
    const institution = await this.prisma.financialInstitution.findFirst({
      where: { id: financialInstitutionId, organizationId: actor.organizationId, isActive: true }
    });
    if (!institution) throw new BadRequestException("Invalid financial institution");
    return institution;
  }

  private async openCashRegisterInternal(
    actor: AuthUser,
    input: {
      branchId: string;
      responsibleUserId: string;
      previousBalance: number;
      initialDeposit: number;
      notes?: string;
    }
  ) {
    const openingAmount = this.roundMoney(input.previousBalance + input.initialDeposit);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const register = await tx.cashRegister.create({
              data: {
                publicNumber: randomInt(100000, 1000000),
                organizationId: actor.organizationId,
                branchId: input.branchId,
                openedById: actor.id,
                responsibleUserId: input.responsibleUserId,
                previousClosingBalance: this.toDecimal(input.previousBalance),
                initialDeposit: this.toDecimal(input.initialDeposit),
                openingAmount: this.toDecimal(openingAmount),
                openingNotes: input.notes?.trim(),
                status: CashRegisterStatus.OPEN,
                openedAt: new Date()
              }
            });

            await tx.cashMovement.create({
              data: {
                organizationId: actor.organizationId,
                branchId: input.branchId,
                cashRegisterId: register.id,
                type: CashMovementType.OPENING,
                direction: CashMovementDirection.IN,
                amount: this.toDecimal(input.previousBalance),
                description: "Saldo proveniente del cierre anterior",
                createdById: actor.id
              }
            });

            if (input.initialDeposit > 0) {
              await tx.cashMovement.create({
                data: {
                  organizationId: actor.organizationId,
                  branchId: input.branchId,
                  cashRegisterId: register.id,
                  type: CashMovementType.INITIAL_DEPOSIT,
                  direction: CashMovementDirection.IN,
                  amount: this.toDecimal(input.initialDeposit),
                  description: "Abono inicial de caja",
                  createdById: actor.id
                }
              });
            }

            await this.audit(tx, actor, {
              entity: "CashRegister",
              entityId: register.id,
              action: "open",
              after: {
                publicNumber: register.publicNumber,
                branchId: input.branchId,
                responsibleUserId: input.responsibleUserId,
                previousBalance: input.previousBalance,
                initialDeposit: input.initialDeposit,
                openingAmount
              }
            });

            return register.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (this.isUniqueCollision(error, "publicNumber")) continue;
        if (this.isUniqueCollision(error, "responsibleUserId")) {
          throw new ConflictException(
            "The responsible user already has an open cash register in this branch"
          );
        }
        throw error;
      }
    }
    throw new ConflictException("Could not generate a unique cash session number. Try again.");
  }

  private async ensureCashResponsible(actor: AuthUser, branchId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: actor.organizationId,
        isActive: true,
        branches: { some: { branchId } }
      },
      select: { id: true }
    });
    if (!user)
      throw new BadRequestException("Cash register responsible is not active in the selected branch");
  }

  private async getLatestClosingCarryover(actor: AuthUser, branchId: string) {
    const previous = await this.prisma.cashRegister.findFirst({
      where: { organizationId: actor.organizationId, branchId, status: CashRegisterStatus.CLOSED },
      select: { closingCarryover: true, closingAmount: true },
      orderBy: { closedAt: "desc" }
    });
    return this.roundMoney(Number(previous?.closingCarryover ?? previous?.closingAmount ?? 0));
  }

  private async ensureOpenCashRegister(actor: AuthUser, branchId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId,
        responsibleUserId: actor.id,
        status: CashRegisterStatus.OPEN
      }
    });

    if (register) return register;

    throw new BadRequestException("No open cash register found for this user and branch");
  }

  private normalizePaymentSplits(splits?: CreatePaymentDto["splits"]) {
    return (splits ?? []).map((split) => ({
      paymentMethodId: split.paymentMethodId,
      amount: toDecimal(split.amount),
      financialInstitutionId: split.financialInstitutionId?.trim() || null,
      reference: split.reference?.trim() || null,
      scheduledSettlements: (split.scheduledSettlements ?? []).map((settlement) => ({
        sequence: settlement.sequence,
        amount: toDecimal(settlement.amount),
        dueAt: new Date(settlement.dueAt),
        reference: settlement.reference?.trim() || null,
        financialInstitutionId: settlement.financialInstitutionId?.trim() || null,
        notes: settlement.notes?.trim() || null
      }))
    }));
  }

  private hashPaymentRequest(
    dto: CreatePaymentDto,
    amount: Prisma.Decimal,
    splits: ReturnType<PaymentsService["normalizePaymentSplits"]>
  ) {
    const normalized = {
      branchId: dto.branchId,
      patientId: dto.patientId,
      amount: amount.toFixed(2),
      currency: dto.currency ?? "MXN",
      paidAt: dto.paidAt ?? null,
      paymentMethodId: dto.paymentMethodId ?? null,
      financialInstitutionId: dto.financialInstitutionId ?? null,
      reference: dto.reference?.trim() ?? null,
      notes: dto.notes?.trim() ?? null,
      cashDiscountRuleId: dto.cashDiscountRuleId ?? null,
      cashDiscountTreatmentPlanId: dto.cashDiscountTreatmentPlanId ?? null,
      allocations: (dto.allocations ?? [])
        .map((allocation) => ({
          treatmentPlanItemId: allocation.treatmentPlanItemId,
          amount: toDecimal(allocation.amount).toFixed(2),
          expectedVersion: allocation.expectedVersion ?? null
        }))
        .sort((a, b) => a.treatmentPlanItemId.localeCompare(b.treatmentPlanItemId)),
      splits: splits
        .map((split) => ({
          paymentMethodId: split.paymentMethodId,
          amount: split.amount.toFixed(2),
          financialInstitutionId: split.financialInstitutionId,
          reference: split.reference,
          scheduledSettlements: split.scheduledSettlements.map((settlement) => ({
            sequence: settlement.sequence,
            amount: settlement.amount.toFixed(2),
            dueAt: settlement.dueAt.toISOString(),
            reference: settlement.reference,
            financialInstitutionId: settlement.financialInstitutionId,
            notes: settlement.notes
          }))
        }))
        .sort((a, b) =>
          `${a.paymentMethodId}:${a.amount}:${a.reference ?? ""}`.localeCompare(
            `${b.paymentMethodId}:${b.amount}:${b.reference ?? ""}`
          )
        )
    };

    return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  }

  private normalizeInstallmentPlanItemAllocations(allocations?: CreateInstallmentPlanDto["itemAllocations"]) {
    const byItem = new Map<
      string,
      { treatmentPlanItemId: string; amount: Prisma.Decimal; expectedVersion?: number }
    >();
    for (const allocation of allocations ?? []) {
      const treatmentPlanItemId = allocation.treatmentPlanItemId.trim();
      if (!treatmentPlanItemId) throw new BadRequestException("Treatment plan item is required");
      const amount = toDecimal(allocation.amount);
      if (amount.lte(0))
        throw new BadRequestException("Installment item allocation amount must be greater than zero");
      const current = byItem.get(treatmentPlanItemId);
      if (current) {
        if (
          allocation.expectedVersion !== undefined &&
          current.expectedVersion !== undefined &&
          current.expectedVersion !== allocation.expectedVersion
        ) {
          throw new ConflictException(
            "El saldo cambiÃ³ mientras preparabas el financiamiento. Revisa la informaciÃ³n actualizada antes de continuar."
          );
        }
        byItem.set(treatmentPlanItemId, {
          treatmentPlanItemId,
          amount: current.amount.add(amount),
          expectedVersion: allocation.expectedVersion ?? current.expectedVersion
        });
      } else {
        byItem.set(treatmentPlanItemId, {
          treatmentPlanItemId,
          amount,
          expectedVersion: allocation.expectedVersion
        });
      }
    }

    return Array.from(byItem.values());
  }

  private async validateInstallmentPlanItemAllocations(
    actor: AuthUser,
    treatmentPlanId: string,
    allocations: ReturnType<PaymentsService["normalizeInstallmentPlanItemAllocations"]>,
    client: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    const itemIds = allocations.map((allocation) => allocation.treatmentPlanItemId);
    const items = await client.treatmentPlanItem.findMany({
      where: {
        id: { in: itemIds },
        treatmentPlanId,
        treatmentPlan: {
          organizationId: actor.organizationId,
          branchId: branchScope(actor)
        }
      },
      include: {
        treatmentPlan: { select: { id: true, isAlternative: true } },
        paymentAllocations: {
          where: {
            payment: {
              status: {
                in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED]
              }
            }
          },
          select: { amount: true, settlementDiscountAmount: true }
        },
        installmentPlanItems: {
          where: {
            installmentPlan: {
              status: {
                in: [
                  InstallmentPlanStatus.DRAFT,
                  InstallmentPlanStatus.ACTIVE,
                  InstallmentPlanStatus.DEFAULTED
                ]
              }
            }
          },
          select: { amount: true }
        }
      }
    });

    if (items.length !== itemIds.length) {
      throw new BadRequestException("One or more treatment plan items are invalid for financing");
    }

    const itemById = new Map(items.map((item) => [item.id, item]));
    for (const allocation of allocations) {
      const item = itemById.get(allocation.treatmentPlanItemId);
      if (!item) throw new BadRequestException("Treatment plan item is invalid for financing");
      if (item.treatmentPlan.isAlternative) {
        throw new BadRequestException("Alternative treatment plan items cannot be financed");
      }
      if (item.status === TreatmentPlanItemStatus.CANCELLED) {
        throw new BadRequestException("Cancelled treatment plan items cannot be financed");
      }
      if (allocation.expectedVersion !== undefined && item.version !== allocation.expectedVersion) {
        throw new ConflictException(
          "El saldo cambiÃ³ mientras preparabas el financiamiento. Revisa la informaciÃ³n actualizada antes de continuar."
        );
      }

      const paid = sumDecimals(
        item.paymentAllocations.map((paymentAllocation) =>
          paymentAllocation.amount.add(paymentAllocation.settlementDiscountAmount ?? 0)
        )
      );
      const committed = sumDecimals(
        item.installmentPlanItems.map((installmentPlanItem) => installmentPlanItem.amount)
      );
      const available = toDecimal(item.total).sub(paid).sub(committed);
      if (available.lte(0)) {
        throw new BadRequestException("This treatment plan item has no balance available for financing");
      }
      if (allocation.amount.gt(available)) {
        throw new BadRequestException("Installment item allocation exceeds available financing balance");
      }
    }
  }

  private async applyAllocations(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    paymentId: string,
    allocations: Array<
      AddPaymentAllocationsDto["allocations"][number] & { settlementDiscountAmount?: number }
    >
  ) {
    if (!allocations.length) throw new BadRequestException("Allocations are required");

    const payment = await tx.payment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: { allocations: true }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.VOIDED || payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException("Voided or refunded payments cannot receive allocations");
    }

    const existingAllocated = sumDecimals(payment.allocations.map((a) => a.amount));
    const requested = sumDecimals(allocations.map((a) => a.amount));
    if (requested.lte(0)) throw new BadRequestException("Allocation amount must be greater than zero");

    if (existingAllocated.add(requested).gt(payment.amount)) {
      throw new BadRequestException("Allocations exceed payment amount");
    }

    const itemIds = [...new Set(allocations.map((allocation) => allocation.treatmentPlanItemId))];
    const items = await tx.treatmentPlanItem.findMany({
      where: {
        id: { in: itemIds },
        treatmentPlan: {
          organizationId: actor.organizationId,
          patientId: payment.patientId
        }
      },
      include: { treatmentPlan: true }
    });

    if (items.length !== itemIds.length) {
      throw new BadRequestException("One or more treatment plan items are invalid");
    }

    const expectedVersions = new Map(
      allocations
        .filter((allocation) => allocation.expectedVersion !== undefined)
        .map((allocation) => [allocation.treatmentPlanItemId, allocation.expectedVersion as number])
    );

    for (const item of items) {
      if (item.treatmentPlan.isAlternative) {
        throw new BadRequestException("Alternative treatment plan items cannot receive payments");
      }
      if (item.status === TreatmentPlanItemStatus.CANCELLED) {
        throw new BadRequestException("Cancelled treatment plan items cannot receive payments");
      }
      const expectedVersion = expectedVersions.get(item.id);
      if (expectedVersion !== undefined && item.version !== expectedVersion) {
        throw new ConflictException(
          "El saldo cambió mientras realizabas el cobro. Revisa la información actualizada antes de continuar."
        );
      }
    }

    const requestedByItem = allocations.reduce<Record<string, Prisma.Decimal>>((totals, allocation) => {
      const current = totals[allocation.treatmentPlanItemId] ?? new Prisma.Decimal(0);
      totals[allocation.treatmentPlanItemId] = current
        .add(toDecimal(allocation.amount))
        .add(toDecimal(allocation.settlementDiscountAmount ?? 0));
      return totals;
    }, {});

    const existingByItem = await tx.paymentAllocation.groupBy({
      by: ["treatmentPlanItemId"],
      _sum: { amount: true, settlementDiscountAmount: true },
      where: {
        treatmentPlanItemId: { in: itemIds },
        payment: {
          status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] }
        }
      }
    });

    const existingByItemId = new Map(
      existingByItem.map((row) => [
        row.treatmentPlanItemId,
        toDecimal(row._sum.amount ?? 0).add(toDecimal(row._sum.settlementDiscountAmount ?? 0))
      ])
    );

    for (const item of items) {
      const allocated = existingByItemId.get(item.id) ?? new Prisma.Decimal(0);
      const requestedForItem = requestedByItem[item.id] ?? new Prisma.Decimal(0);
      if (allocated.add(requestedForItem).gt(item.total)) {
        throw new BadRequestException("Allocations exceed treatment plan item balance");
      }
    }

    const allocationIds = new Map<string, string>();
    for (const allocation of allocations) {
      if (toDecimal(allocation.amount).lte(0))
        throw new BadRequestException("Allocation amount must be greater than zero");
      const current = await tx.paymentAllocation.findFirst({
        where: { paymentId, treatmentPlanItemId: allocation.treatmentPlanItemId }
      });

      if (current) {
        const updated = await tx.paymentAllocation.update({
          where: { id: current.id },
          data: {
            amount: current.amount.add(toDecimal(allocation.amount)),
            settlementDiscountAmount: current.settlementDiscountAmount.add(
              toDecimal(allocation.settlementDiscountAmount ?? 0)
            )
          }
        });
        allocationIds.set(allocation.treatmentPlanItemId, updated.id);
      } else {
        const createdAllocation = await tx.paymentAllocation.create({
          data: {
            paymentId,
            treatmentPlanItemId: allocation.treatmentPlanItemId,
            amount: toDecimal(allocation.amount),
            settlementDiscountAmount: toDecimal(allocation.settlementDiscountAmount ?? 0)
          }
        });
        allocationIds.set(allocation.treatmentPlanItemId, createdAllocation.id);
      }
    }

    const allocationsAfter = await tx.paymentAllocation.aggregate({
      _sum: { amount: true },
      where: { paymentId }
    });

    const allocatedAfter = toDecimal(allocationsAfter._sum.amount ?? 0);
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: allocatedAfter.gte(payment.amount)
          ? PaymentStatus.ALLOCATED
          : PaymentStatus.PARTIALLY_ALLOCATED
      }
    });

    for (const itemId of itemIds) {
      const item = await tx.treatmentPlanItem.findUnique({ where: { id: itemId } });
      if (!item) continue;
      const allocatedOnItem = await tx.paymentAllocation.aggregate({
        _sum: { amount: true, settlementDiscountAmount: true },
        where: {
          treatmentPlanItemId: itemId,
          payment: {
            status: {
              in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED]
            }
          }
        }
      });
      const allocatedTotal = toDecimal(allocatedOnItem._sum.amount ?? 0).add(
        toDecimal(allocatedOnItem._sum.settlementDiscountAmount ?? 0)
      );

      const shouldMarkPaid =
        allocatedTotal.gte(item.total) &&
        (item.status === TreatmentPlanItemStatus.PLANNED || item.status === TreatmentPlanItemStatus.ACCEPTED);
      const updated = await tx.treatmentPlanItem.updateMany({
        where: { id: item.id, version: item.version },
        data: {
          ...(shouldMarkPaid ? { status: TreatmentPlanItemStatus.PAID } : {}),
          version: { increment: 1 }
        }
      });

      if (updated.count === 0) {
        throw new ConflictException(
          "El saldo cambió mientras realizabas el cobro. Revisa la información actualizada antes de continuar."
        );
      }
    }
    return allocationIds;
  }

  private parseDateInput(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return new Date(value);
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  private shiftDate(baseDate: Date, frequency: InstallmentFrequency, index: number) {
    const date = new Date(baseDate);
    if (index === 0) return date;
    if (frequency === InstallmentFrequency.WEEKLY) {
      date.setDate(date.getDate() + index * 7);
      return date;
    }
    if (frequency === InstallmentFrequency.BIWEEKLY) {
      date.setDate(date.getDate() + index * 14);
      return date;
    }
    const year = date.getFullYear();
    const month = date.getMonth() + index;
    const day = date.getDate();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(
      year,
      month,
      Math.min(day, lastDay),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    );
  }

  private splitAmount(total: number, numberOfInstallments: number) {
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / numberOfInstallments);
    const remainder = cents - base * numberOfInstallments;
    const result: number[] = [];
    for (let i = 0; i < numberOfInstallments; i += 1) {
      result.push((base + (i === numberOfInstallments - 1 ? remainder : 0)) / 100);
    }
    return result;
  }

  private calculateExpectedClosing(
    movements: Array<{
      type: CashMovementType;
      direction: CashMovementDirection;
      amount: Prisma.Decimal;
      voidedAt?: Date | null;
      includeInPhysicalCashBalanceSnapshot?: boolean | null;
      paymentMethod?: { includeInPhysicalCashBalance: boolean } | null;
      payment?: { paymentMethod?: { includeInPhysicalCashBalance: boolean } | null } | null;
    }>
  ) {
    return this.roundMoney(
      movements.reduce((sum, movement) => {
        if (movement.voidedAt) return sum;
        if (
          movement.type === CashMovementType.CLOSING ||
          movement.type === CashMovementType.CLOSING_CARRYOVER
        )
          return sum;
        const amount = Number(movement.amount);
        if (movement.type === CashMovementType.OPENING || movement.type === CashMovementType.INITIAL_DEPOSIT)
          return sum + amount;
        const method = movement.paymentMethod ?? movement.payment?.paymentMethod ?? null;
        const includeInPhysicalCashBalance =
          movement.includeInPhysicalCashBalanceSnapshot ?? method?.includeInPhysicalCashBalance ?? true;
        if (!includeInPhysicalCashBalance) return sum;
        return movement.direction === CashMovementDirection.OUT ? sum - amount : sum + amount;
      }, 0)
    );
  }

  private cashMovementDirection(type: CashMovementType) {
    if (
      type === CashMovementType.EXPENSE ||
      type === CashMovementType.REFUND ||
      type === CashMovementType.PAYMENT_VOID ||
      type === CashMovementType.MANUAL_EXPENSE ||
      type === CashMovementType.WITHDRAWAL
    ) {
      return CashMovementDirection.OUT;
    }
    return CashMovementDirection.IN;
  }

  private calculateCashRegisterTotals(
    movements: Array<{
      type: CashMovementType;
      direction: CashMovementDirection;
      amount: Prisma.Decimal;
      voidedAt?: Date | null;
      paymentMethodNameSnapshot?: string | null;
      paymentMethodTypeSnapshot?: PaymentMethodType | null;
      includeInClosingSummarySnapshot?: boolean | null;
      paymentMethod?: {
        name: string;
        type: string;
        includeInPhysicalCashBalance: boolean;
        includeInClosingSummary: boolean;
      } | null;
      payment?: {
        paymentMethod?: {
          name: string;
          type: string;
          includeInPhysicalCashBalance: boolean;
          includeInClosingSummary: boolean;
        } | null;
      } | null;
    }>
  ) {
    const paymentMethods = new Map<string, { name: string; type: string; count: number; amount: number }>();
    let openingTotal = 0;
    let incomeTotal = 0;
    let expenseTotal = 0;
    let refundTotal = 0;
    let voidTotal = 0;
    let withdrawalTotal = 0;
    let adjustmentTotal = 0;

    for (const movement of movements) {
      if (movement.voidedAt) continue;
      const amount = Number(movement.amount);
      if (movement.type === CashMovementType.OPENING || movement.type === CashMovementType.INITIAL_DEPOSIT)
        openingTotal += amount;
      if (movement.type === CashMovementType.INCOME) {
        incomeTotal += amount;

        const method = movement.paymentMethod ?? movement.payment?.paymentMethod ?? null;
        const includeInClosingSummary =
          movement.includeInClosingSummarySnapshot ?? method?.includeInClosingSummary ?? true;
        if (!includeInClosingSummary) continue;
        const methodName = movement.paymentMethodNameSnapshot ?? method?.name ?? "Ingresos manuales";
        const methodType = movement.paymentMethodTypeSnapshot ?? method?.type ?? "OTHER";
        const current = paymentMethods.get(methodName) ?? {
          name: methodName,
          type: methodType,
          count: 0,
          amount: 0
        };
        current.count += 1;
        current.amount = this.roundMoney(current.amount + amount);
        paymentMethods.set(methodName, current);
      }
      if (movement.type === CashMovementType.EXPENSE) expenseTotal += amount;
      if (movement.type === CashMovementType.REFUND) refundTotal += amount;
      if (movement.type === CashMovementType.PAYMENT_VOID) voidTotal += amount;
      if (movement.type === CashMovementType.WITHDRAWAL) withdrawalTotal += amount;
      if (movement.type === CashMovementType.ADJUSTMENT) {
        adjustmentTotal += movement.direction === CashMovementDirection.OUT ? -amount : amount;
      }
    }

    return {
      openingTotal: this.roundMoney(openingTotal),
      incomeTotal: this.roundMoney(incomeTotal),
      expenseTotal: this.roundMoney(expenseTotal),
      refundTotal: this.roundMoney(refundTotal),
      voidTotal: this.roundMoney(voidTotal),
      withdrawalTotal: this.roundMoney(withdrawalTotal),
      adjustmentTotal: this.roundMoney(adjustmentTotal),
      paymentMethodTotals: Array.from(paymentMethods.values()).sort((a, b) => b.amount - a.amount)
    };
  }

  private hasAnyPermission(actor: AuthUser, permissions: string[]) {
    return permissions.some((permission) => actor.permissions.includes(permission));
  }

  private toDecimal(value: number | string | Prisma.Decimal) {
    if (value instanceof Prisma.Decimal) return value;
    return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  private roundMoney(value: number | Prisma.Decimal) {
    if (value instanceof Prisma.Decimal) return value.toNumber();
    return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  }

  private formatCurrency(value: number | string | Prisma.Decimal) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value ?? 0));
  }

  private csvCell(value: unknown) {
    const normalized = String(value ?? "").replace(/"/g, '""');
    return `"${normalized}"`;
  }

  private humanizeReceiptDetail(detail: string) {
    return detail.replace(/\s+-\s+Cara\s+ALL\b/gi, " - Pieza completa");
  }

  private displayName(entity?: { firstName?: string | null; lastName?: string | null } | null) {
    return `${entity?.firstName ?? ""} ${entity?.lastName ?? ""}`.trim() || "Paciente";
  }

  private shortCode(value: string) {
    const cleaned = value.trim();
    if (!cleaned) return "-";
    return cleaned.length <= 8 ? cleaned.toUpperCase() : cleaned.slice(-8).toUpperCase();
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private assertLocalDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException("La fecha del comprobante diario no es valida.");
  }

  private formatLocalDate(value: string) {
    this.assertLocalDate(value);
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, day))
    );
  }

  private localDateString(value: Date | string, timezone?: string | null) {
    const parts = this.localDateParts(new Date(value), timezone || "America/Mexico_City");
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }

  private zonedDayRange(date: string, timezone?: string | null) {
    this.assertLocalDate(date);
    const tz = timezone || "America/Mexico_City";
    const start = this.zonedLocalToUtc(date, "00:00:00.000", tz);
    const nextDate = new Date(`${date}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const next = nextDate.toISOString().slice(0, 10);
    return { start, end: this.zonedLocalToUtc(next, "00:00:00.000", tz) };
  }

  private zonedLocalToUtc(date: string, time: string, timezone: string) {
    const utcGuess = new Date(`${date}T${time}Z`);
    const local = this.localDateParts(utcGuess, timezone);
    const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    return new Date(utcGuess.getTime() - (asUtc - utcGuess.getTime()));
  }

  private localDateParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return {
      year: get("year"),
      month: get("month"),
      day: get("day"),
      hour: get("hour"),
      minute: get("minute"),
      second: get("second")
    };
  }

  private normalizeReceiptEmail(value?: string | null) {
    const email = value?.trim().toLowerCase();
    if (!email) return null;
    if (/[\r\n]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
  }

  private async queueAndSendReceiptEmail(
    actor: AuthUser,
    input: {
      patientId: string;
      paymentId?: string;
      branchId: string;
      recipient: string;
      subject: string;
      message: string;
      fileName: string;
      bytes: Buffer;
      templateKey: string;
      idempotencyKey?: string;
      documentType: "PAYMENT_RECEIPT" | "DAILY_PAYMENT_RECEIPT";
      documentTitle: string;
      patientName: string;
      branding: {
        logoUrl?: string | null;
        businessName: string;
        legalName?: string | null;
        address?: string | null;
        phone?: string | null;
        email?: string | null;
        website?: string | null;
        privacyNoticeUrl?: string | null;
        primaryColor?: string | null;
      };
      summaryRows: Array<[string, string]>;
      metadata: Record<string, unknown>;
    }
  ) {
    if (input.idempotencyKey) {
      const existing = await this.prisma.communicationJob.findFirst({
        where: {
          organizationId: actor.organizationId,
          patientId: input.patientId,
          ...(input.paymentId ? { paymentId: input.paymentId } : {}),
          metadata: { path: ["idempotencyKey"], equals: input.idempotencyKey } as any
        }
      });
      if (existing) return this.serializeReceiptEmailResponse(existing, input);
    }

    const job = await this.prisma.communicationJob.create({
      data: {
        organizationId: actor.organizationId,
        patientId: input.patientId,
        paymentId: input.paymentId,
        createdById: actor.id,
        channel: CommunicationChannel.EMAIL,
        templateKey: input.templateKey,
        recipient: input.recipient,
        subject: input.subject,
        body: input.message,
        status: CommunicationJobStatus.QUEUED,
        provider: this.emailService?.getDefaultSender().provider ?? "smtp",
        queuedAt: new Date(),
        metadata: {
          ...input.metadata,
          documentType: input.documentType,
          branchId: input.branchId,
          fileName: input.fileName,
          idempotencyKey: input.idempotencyKey,
          toAddress: input.recipient
        } as Prisma.InputJsonValue
      }
    });

    try {
      if (!this.emailService) throw new BadRequestException("El servicio de correo no esta configurado.");
      const emailHtml = this.renderReceiptEmailHtml(input);
      const emailText = this.renderReceiptEmailText(input);

      const sent = await this.emailService.sendPatientEmail({
        to: input.recipient,
        subject: input.subject,
        html: emailHtml,
        text: emailText,
        attachments: [{ filename: input.fileName, content: input.bytes, contentType: "application/pdf" }]
      });
      const updated = await this.prisma.communicationJob.update({
        where: { id: job.id },
        data: {
          status: CommunicationJobStatus.SENT,
          providerMessageId: sent.providerMessageId,
          sentAt: new Date()
        }
      });
      await this.audit(this.prisma, actor, {
        entity: "CommunicationJob",
        entityId: updated.id,
        action: "send_payment_receipt_email",
        after: {
          patientId: input.patientId,
          paymentId: input.paymentId ?? null,
          recipient: input.recipient,
          templateKey: input.templateKey
        }
      });
      return this.serializeReceiptEmailResponse(updated, input);
    } catch (error) {
      const safeMessage =
        error instanceof Error ? error.message.slice(0, 500) : "No fue posible enviar el correo.";
      await this.prisma.communicationJob.update({
        where: { id: job.id },
        data: { status: CommunicationJobStatus.FAILED, failedAt: new Date(), errorMessage: safeMessage }
      });
      throw error;
    }
  }

  private escapeEmailText(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  private renderReceiptEmailHtml(input: {
    documentTitle: string;
    patientName: string;
    message: string;
    fileName: string;
    branding: {
      logoUrl?: string | null;
      businessName: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      privacyNoticeUrl?: string | null;
      primaryColor?: string | null;
    };
    summaryRows: Array<[string, string]>;
  }) {
    const brand = input.branding;
    const primary = /^#[0-9a-f]{6}$/i.test(brand.primaryColor ?? "") ? brand.primaryColor! : "#0369a1";
    const safeBrand = this.escapeEmailText(brand.businessName);
    const logo = brand.logoUrl
      ? `<img src="${this.escapeEmailAttribute(brand.logoUrl)}" alt="${safeBrand}" width="112" style="display:block;max-width:112px;max-height:56px;border:0;">`
      : `<div style="width:52px;height:52px;border-radius:14px;background:${primary};color:#ffffff;font-weight:800;font-size:16px;line-height:52px;text-align:center;">${this.brandInitials(brand.businessName)}</div>`;
    const paragraphs = input.message
      .split(/\r?\n\r?\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map(
        (paragraph) =>
          `<p style="margin:0 0 14px;color:#334155;font-size:14px;line-height:1.65;">${this.escapeEmailText(paragraph).replace(/\r?\n/g, "<br>")}</p>`
      )
      .join("");
    const summaryRows = input.summaryRows
      .map(
        ([label, value]) => `
        <tr>
          <td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;">${this.escapeEmailText(label)}</td>
          <td style="padding:9px 0;color:#0f172a;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #e2e8f0;">${this.escapeEmailText(value)}</td>
        </tr>`
      )
      .join("");
    const contactRows = [
      brand.address ? `Direcci&oacute;n: ${this.escapeEmailText(brand.address)}` : null,
      brand.phone ? `Tel&eacute;fono: ${this.escapeEmailText(brand.phone)}` : null,
      brand.email ? `Correo: ${this.escapeEmailText(brand.email)}` : null
    ]
      .filter(Boolean)
      .join("<br>");
    return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">Adjuntamos el comprobante en PDF.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:24px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="width:128px;vertical-align:middle;">${logo}</td>
              <td style="vertical-align:middle;">
                <div style="font-size:18px;font-weight:800;color:#0f172a;">${safeBrand}</div>
                <div style="font-size:12px;color:#64748b;margin-top:4px;">${this.escapeEmailText(input.documentTitle)}</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;color:#0f172a;">${this.escapeEmailText(input.documentTitle)}</h1>
            ${paragraphs}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-top:1px solid #e2e8f0;border-collapse:collapse;">${summaryRows}</table>
            <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.65;">El comprobante se encuentra adjunto en formato PDF.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;color:#334155;font-size:13px;line-height:1.6;">
              <strong style="display:block;color:#0f172a;margin-bottom:4px;">${safeBrand}</strong>
              ${contactRows || "Datos de contacto no registrados."}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.55;">
            Este es un correo generado autom&aacute;ticamente. ${brand.privacyNoticeUrl ? `Aviso de privacidad: <a href="${this.escapeEmailAttribute(brand.privacyNoticeUrl)}" style="color:${primary};text-decoration:none;">consultar</a>.` : ""}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private renderReceiptEmailText(input: {
    patientName: string;
    message: string;
    fileName: string;
    branding: {
      businessName: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      privacyNoticeUrl?: string | null;
    };
    summaryRows: Array<[string, string]>;
  }) {
    const lines = [
      input.message.trim(),
      "",
      ...input.summaryRows.map(([label, value]) => `${label}: ${value}`),
      "",
      `Adjunto: ${input.fileName}`,
      "",
      "Para cualquier aclaracion:",
      input.branding.businessName,
      input.branding.address ? `Direccion: ${input.branding.address}` : null,
      input.branding.phone ? `Telefono: ${input.branding.phone}` : null,
      input.branding.email ? `Correo: ${input.branding.email}` : null,
      "",
      `Saludos,`,
      `Equipo de ${input.branding.businessName}`,
      "",
      "Este es un correo generado automaticamente.",
      input.branding.privacyNoticeUrl ? `Aviso de privacidad: ${input.branding.privacyNoticeUrl}` : null
    ];
    return lines.filter((line): line is string => line !== null).join("\n");
  }

  private serializeReceiptEmailResponse(
    job: {
      id: string;
      status: CommunicationJobStatus;
      providerMessageId?: string | null;
      sentAt?: Date | null;
      queuedAt?: Date | null;
    },
    input: { documentType: string; recipient: string; fileName: string; metadata: Record<string, unknown> }
  ) {
    return {
      status: job.status,
      documentType: input.documentType,
      paymentNumber: input.metadata.paymentNumber ?? null,
      documentDate: input.metadata.date ?? null,
      paymentCount: Array.isArray(input.metadata.paymentNumbers)
        ? input.metadata.paymentNumbers.length
        : input.metadata.paymentNumber
          ? 1
          : null,
      totalAmount: input.metadata.totalAmount ?? null,
      recipient: input.recipient,
      attachmentName: input.fileName,
      sentAt: job.sentAt ?? job.queuedAt ?? null,
      messageId: job.providerMessageId ?? null,
      communicationJobId: job.id
    };
  }

  private escapeEmailAttribute(value: string) {
    return this.escapeEmailText(value).replaceAll("`", "&#096;");
  }

  private brandInitials(value: string) {
    return (
      value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "DS"
    );
  }

  private resolveOptionalDateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    const range: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      range.gte = start;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return range;
  }

  private resolveReportRange(dateFrom?: string, dateTo?: string): { start: Date; end: Date } {
    const now = new Date();
    const start = dateFrom ? new Date(dateFrom) : new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);
    const end = dateTo ? new Date(dateTo) : new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // ─── Reporte: Resumen de recaudación últimos 10 días ─────────────────────
  async getCollectionSummary(
    actor: AuthUser,
    query: { branchId?: string; dateFrom?: string; dateTo?: string }
  ) {
    const { start, end } = this.resolveReportRange(query.dateFrom, query.dateTo);
    const branchWhere = query.branchId ? branchScope(actor, query.branchId) : branchScope(actor);

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchWhere,
        status: { not: PaymentStatus.VOIDED },
        paidAt: { gte: start, lte: end }
      },
      select: {
        amount: true,
        paidAt: true,
        paymentMethodSnapshot: true,
        paymentMethod: { select: { includeInCollectionReports: true } },
        splits: {
          select: {
            amount: true,
            includeInCollectionReportsSnapshot: true,
            paymentMethod: { select: { includeInCollectionReports: true } }
          }
        }
      }
    });

    const byDayMap = new Map<string, { amount: number; paymentsCount: number }>();
    let total = 0;
    let totalPayments = 0;
    for (const p of payments) {
      const includedAmount = p.splits.length
        ? p.splits.reduce(
            (sum, split) =>
              (split.includeInCollectionReportsSnapshot ?? split.paymentMethod.includeInCollectionReports)
                ? sum + Number(split.amount)
                : sum,
            0
          )
        : this.snapshotBoolean(
              p.paymentMethodSnapshot,
              "includeInCollectionReports",
              p.paymentMethod?.includeInCollectionReports ?? true
            )
          ? Number(p.amount)
          : 0;
      if (includedAmount <= 0) continue;
      const key = this.dateKey(p.paidAt);
      const current = byDayMap.get(key) ?? { amount: 0, paymentsCount: 0 };
      byDayMap.set(key, {
        amount: this.roundMoney(current.amount + includedAmount),
        paymentsCount: current.paymentsCount + 1
      });
      total += includedAmount;
      totalPayments += 1;
    }

    const byDay = [...byDayMap.entries()]
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const roundedTotal = this.roundMoney(total);

    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      total: roundedTotal,
      totalPayments,
      averageTicket: totalPayments > 0 ? this.roundMoney(roundedTotal / totalPayments) : 0,
      byDay
    };
  }

  // ─── Reporte: Resumen cajas (por medio de pago) ───────────────────────────
  async getBoxSummary(actor: AuthUser, query: { branchId?: string; dateFrom?: string; dateTo?: string }) {
    const { start, end } = this.resolveReportRange(query.dateFrom, query.dateTo);
    const branchWhere = query.branchId ? branchScope(actor, query.branchId) : branchScope(actor);

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchWhere,
        status: { not: PaymentStatus.VOIDED },
        paidAt: { gte: start, lte: end }
      },
      select: {
        amount: true,
        patientId: true,
        paymentMethodSnapshot: true,
        paymentMethod: { select: { name: true, type: true, includeInCollectionReports: true } },
        splits: {
          select: {
            amount: true,
            paymentMethodNameSnapshot: true,
            paymentMethodTypeSnapshot: true,
            includeInCollectionReportsSnapshot: true,
            paymentMethod: { select: { name: true, type: true, includeInCollectionReports: true } }
          }
        }
      }
    });

    const methodMap = new Map<string, { type: string; method: string; count: number; amount: number }>();
    const patientSet = new Set<string>();
    let total = 0;

    for (const p of payments) {
      const methods = p.splits.length
        ? p.splits.map((split) => ({
            amount: split.amount,
            method: {
              name: split.paymentMethodNameSnapshot ?? "Medio histórico",
              type: split.paymentMethodTypeSnapshot ?? split.paymentMethod.type,
              includeInCollectionReports:
                split.includeInCollectionReportsSnapshot ?? split.paymentMethod.includeInCollectionReports
            }
          }))
        : [
            {
              amount: p.amount,
              method: p.paymentMethod
                ? {
                    name: this.snapshotString(p.paymentMethodSnapshot, "name", p.paymentMethod.name),
                    type: this.snapshotString(p.paymentMethodSnapshot, "type", p.paymentMethod.type),
                    includeInCollectionReports: this.snapshotBoolean(
                      p.paymentMethodSnapshot,
                      "includeInCollectionReports",
                      p.paymentMethod.includeInCollectionReports
                    )
                  }
                : null
            }
          ];
      let includedAmount = 0;
      for (const row of methods) {
        if (!row.method?.includeInCollectionReports) continue;
        const key = row.method.name;
        const current = methodMap.get(key) ?? { type: row.method.type, method: key, count: 0, amount: 0 };
        current.count += 1;
        current.amount = this.roundMoney(current.amount + Number(row.amount));
        methodMap.set(key, current);
        includedAmount += Number(row.amount);
      }
      patientSet.add(p.patientId);
      total += includedAmount;
    }

    return {
      total: this.roundMoney(total),
      patientsCount: patientSet.size,
      rows: [...methodMap.values()].sort((a, b) => b.amount - a.amount)
    };
  }

  // ─── Reporte: Pagos recibidos por período ────────────────────────────────
  async getPaymentsByPeriod(
    actor: AuthUser,
    query: { branchId?: string; dateFrom?: string; dateTo?: string }
  ) {
    const { start, end } = this.resolveReportRange(query.dateFrom, query.dateTo);
    const branchWhere = query.branchId ? branchScope(actor, query.branchId) : branchScope(actor);

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchWhere,
        status: { not: PaymentStatus.VOIDED },
        paidAt: { gte: start, lte: end }
      },
      include: {
        patient: { select: { firstName: true, lastName: true, documentNumber: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
        paymentMethod: { select: { name: true, type: true } },
        cashMovements: {
          select: { cashRegister: { select: { branch: { select: { name: true } } } } },
          take: 1
        }
      },
      orderBy: { paidAt: "desc" }
    });

    const byDayMap = new Map<string, number>();
    let total = 0;
    for (const p of payments) {
      const key = this.dateKey(p.paidAt);
      byDayMap.set(key, this.roundMoney((byDayMap.get(key) ?? 0) + Number(p.amount)));
      total += Number(p.amount);
    }

    const byDay = [...byDayMap.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const paymentsList = payments.map((p, index) => ({
      id: p.id,
      number: index + 1,
      date: p.paidAt.toISOString(),
      patient: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
      responsible:
        p.cashMovements[0]?.cashRegister?.branch?.name ??
        `${p.receivedBy.firstName} ${p.receivedBy.lastName}`.trim(),
      documentNumber: p.patient.documentNumber ?? "0",
      paymentType: "Pago",
      paymentMethod: p.paymentMethod?.name || "",
      total: this.roundMoney(Number(p.amount))
    }));

    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      total: this.roundMoney(total),
      byDay,
      payments: paymentsList
    };
  }

  // ─── Reporte: Pagos por período por profesional ──────────────────────────
  async getPaymentsByProfessional(
    actor: AuthUser,
    query: { branchId?: string; dateFrom?: string; dateTo?: string; professionalId?: string }
  ) {
    const { start, end } = this.resolveReportRange(query.dateFrom, query.dateTo);
    const branchWhere = query.branchId ? branchScope(actor, query.branchId) : branchScope(actor);

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchWhere,
        status: { not: PaymentStatus.VOIDED },
        paidAt: { gte: start, lte: end },
        ...(query.professionalId
          ? {
              allocations: {
                some: {
                  treatmentPlanItem: {
                    treatmentPlan: { professionalId: query.professionalId }
                  }
                }
              }
            }
          : {})
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
        paymentMethod: { select: { name: true } },
        allocations: {
          take: 1,
          select: {
            treatmentPlanItem: {
              select: { treatmentPlan: { select: { id: true } } }
            }
          }
        }
      },
      orderBy: { paidAt: "desc" }
    });

    let total = 0;
    const paymentsList = payments.map((p, index) => {
      total += Number(p.amount);
      return {
        number: index + 1,
        treatmentNumber:
          p.allocations[0]?.treatmentPlanItem?.treatmentPlan?.id?.slice(-6).toUpperCase() ?? "-",
        paymentMethod: p.paymentMethod?.name || "",
        patientName: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
        reception: `${p.receivedBy.firstName} ${p.receivedBy.lastName}`.trim(),
        amount: this.roundMoney(Number(p.amount))
      };
    });

    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      total: this.roundMoney(total),
      payments: paymentsList
    };
  }

  private async audit(
    tx: Prisma.TransactionClient | PrismaService,
    actor: AuthUser,
    payload: {
      entity: string;
      entityId?: string;
      action: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    }
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        actorUserId: actor.id,
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        before: payload.before,
        after: payload.after
      }
    });
  }
}
