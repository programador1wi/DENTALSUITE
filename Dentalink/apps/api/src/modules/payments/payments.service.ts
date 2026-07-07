import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CashMovementType,
  CashRegisterStatus,
  InstallmentFrequency,
  InstallmentStatus,
  PaymentLinkStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  TreatmentPlanItemStatus
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
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
  ListCancelledPendingPaymentsQueryDto,
  ListInstallmentsQueryDto,
  ListPaymentLinksQueryDto,
  ListPaymentsQueryDto,
  ListRefundsQueryDto,
  OpenCashRegisterDto,
  PayInstallmentDto,
  UpdatePaymentDto,
  VoidPaymentDto
} from "./dto/payments.dto";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private paymentDetailInclude() {
    return {
      patient: { select: { id: true, firstName: true, lastName: true, documentNumber: true } },
      branch: { select: { id: true, name: true } },
      paymentMethod: { select: { id: true, name: true, type: true } },
      financialInstitution: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
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
              treatmentPlan: { select: { id: true, name: true } },
              procedure: { select: { id: true, code: true, name: true } },
              paymentAllocations: {
                select: {
                  amount: true,
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
      refunds: { select: { id: true, amount: true, status: true, createdAt: true } }
    } satisfies Prisma.PaymentInclude;
  }

  async listPayments(actor: AuthUser, query: ListPaymentsQueryDto) {
    const { skip, take } = resolvePagination(query);
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
                { patient: { lastName: { contains: query.search, mode: "insensitive" } } }
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
      ...new Set(voidedPayments.map((payment) => payment.voidedById).filter((id): id is string => Boolean(id)))
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
        if (procedureName && !current.procedures.includes(procedureName)) current.procedures.push(procedureName);
        treatmentMap.set(plan.id, current);
      }

      return {
        ...payment,
        paymentNumber: this.shortCode(payment.reference || payment.id),
        voidedBy: payment.voidedById ? voidedByUserById.get(payment.voidedById) ?? null : null,
        treatments: Array.from(treatmentMap.values()).map((treatment) => ({
          ...treatment,
          number: this.shortCode(treatment.id)
        }))
      };
    });

    const linkStatusTotals = linkStatusSummary.reduce<Record<PaymentLinkStatus, { count: number; amount: number }>>(
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
    await this.ensurePatient(actor, dto.patientId);
    await this.ensurePaymentMethod(actor, dto.paymentMethodId);
    if (dto.financialInstitutionId) await this.ensureFinancialInstitution(actor, dto.financialInstitutionId);

    const openRegister = await this.ensureOpenCashRegister(actor, dto.branchId);

    const created = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          receivedById: actor.id,
          amount: this.toDecimal(dto.amount),
          currency: dto.currency ?? "MXN",
          paymentMethodId: dto.paymentMethodId,
          financialInstitutionId: dto.financialInstitutionId,
          status: PaymentStatus.RECEIVED,
          reference: dto.reference?.trim(),
          notes: dto.notes?.trim(),
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date()
        }
      });

      if (openRegister) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: openRegister.id,
            type: CashMovementType.INCOME,
            amount: this.toDecimal(dto.amount),
            paymentId: payment.id,
            description: `Ingreso por pago ${payment.id}`,
            createdById: actor.id
          }
        });
      }

      if (dto.allocations?.length) {
        await this.applyAllocations(tx, actor, payment.id, dto.allocations);
      }

      await this.audit(tx, actor, {
        entity: "Payment",
        entityId: payment.id,
        action: "create",
        after: {
          patientId: payment.patientId,
          amount: dto.amount,
          currency: payment.currency,
          paidAt: payment.paidAt
        }
      });

      return payment.id;
    });

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

    if (dto.paymentMethodId) await this.ensurePaymentMethod(actor, dto.paymentMethodId);
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
          paymentMethodId: payment.paymentMethodId,
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
          payment: { status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] } }
        }
      });
      const allocatedOnItem = Number(itemAllocatedAfter._sum.amount ?? 0);
      if (allocatedOnItem < Number(allocation.treatmentPlanItem.total) && allocation.treatmentPlanItem.status === TreatmentPlanItemStatus.PAID) {
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
        installments: true,
        installmentAllocations: { include: { installment: true } },
        cashMovements: true
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.VOIDED) throw new BadRequestException("Payment is already voided");
    if (payment.refunds.length) throw new BadRequestException("Refunded payments cannot be voided");

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("Void reason is required");
    const itemIds = [...new Set(payment.allocations.map((allocation) => allocation.treatmentPlanItemId))];

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

      for (const allocation of payment.installmentAllocations) {
        const installment = allocation.installment;
        const nextPaid = this.roundMoney(Math.max(Number(installment.paidAmount) - Number(allocation.amount), 0));
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

      const installmentIdsWithAllocations = new Set(payment.installmentAllocations.map((allocation) => allocation.installmentId));
      for (const installment of payment.installments.filter((row) => !installmentIdsWithAllocations.has(row.id))) {
        const nextPaid = this.roundMoney(Math.max(Number(installment.paidAmount) - Number(payment.amount), 0));
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
        await tx.cashMovement.create({
          data: {
            cashRegisterId: movement.cashRegisterId,
            type: CashMovementType.REFUND,
            amount: payment.amount,
            paymentId: payment.id,
            description: `Anulacion de pago ${payment.id}`,
            createdById: actor.id
          }
        });
      }

      for (const itemId of itemIds) {
        const item = await tx.treatmentPlanItem.findUnique({ where: { id: itemId } });
        if (!item) continue;
        const allocation = await tx.paymentAllocation.aggregate({
          _sum: { amount: true },
          where: {
            treatmentPlanItemId: itemId,
            payment: { status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] } }
          }
        });
        if (Number(allocation._sum.amount ?? 0) < Number(item.total) && item.status === TreatmentPlanItemStatus.PAID) {
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
      if (plan.patientId !== dto.patientId) throw new BadRequestException("Treatment plan does not belong to patient");
    }

    const created = await this.prisma.paymentLink.create({
      data: {
        organizationId: actor.organizationId,
        patientId: dto.patientId,
        treatmentPlanId: dto.treatmentPlanId,
        amount: this.toDecimal(dto.amount),
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
    if (plan.patientId !== dto.patientId) throw new BadRequestException("Treatment plan does not belong to patient");

    if (dto.downPayment > dto.totalAmount) {
      throw new BadRequestException("Down payment cannot be greater than total amount");
    }

    const financedAmount = this.roundMoney(dto.totalAmount - dto.downPayment);
    if (financedAmount <= 0) {
      throw new BadRequestException("Financed amount must be greater than zero");
    }

    const installmentAmounts = this.splitAmount(financedAmount, dto.numberOfInstallments);
    const created = await this.prisma.$transaction(async (tx) => {
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
          startDate: new Date(dto.startDate),
          status: "ACTIVE"
        }
      });

      for (let index = 0; index < dto.numberOfInstallments; index += 1) {
        await tx.installment.create({
          data: {
            installmentPlanId: installmentPlan.id,
            patientId: dto.patientId,
            number: index + 1,
            dueDate: this.shiftDate(new Date(dto.startDate), dto.frequency ?? InstallmentFrequency.MONTHLY, index),
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
          financedAmount
        }
      });

      return installmentPlan.id;
    });

    return this.prisma.installmentPlan.findFirst({
      where: { id: created, organizationId: actor.organizationId },
      include: { installments: { orderBy: { number: "asc" } } }
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
      isOverdue: row.status !== InstallmentStatus.PAID && row.status !== InstallmentStatus.CANCELLED && row.dueDate < now
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
    if (installment.status === InstallmentStatus.PAID) throw new BadRequestException("Installment is already paid");

    const remaining = this.roundMoney(Number(installment.amount) - Number(installment.paidAmount));
    if (dto.amount > remaining) throw new BadRequestException("Payment amount exceeds remaining installment balance");

    await this.ensureBranch(actor, dto.branchId);
    await this.ensurePaymentMethod(actor, dto.paymentMethodId);
    const openRegister = await this.ensureOpenCashRegister(actor, dto.branchId);

    const paymentId = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          patientId: installment.patientId,
          receivedById: actor.id,
          amount: this.toDecimal(dto.amount),
          currency: "MXN",
          paymentMethodId: dto.paymentMethodId,
          status: PaymentStatus.ALLOCATED,
          reference: dto.reference?.trim(),
          notes: dto.notes?.trim(),
          paidAt: new Date()
        }
      });

      if (openRegister) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: openRegister.id,
            type: CashMovementType.INCOME,
            amount: this.toDecimal(dto.amount),
            paymentId: payment.id,
            description: `Pago de cuota ${installment.number}`,
            createdById: actor.id
          }
        });
      }

      await tx.paymentInstallmentAllocation.create({
        data: {
          paymentId: payment.id,
          installmentId: installment.id,
          amount: this.toDecimal(dto.amount)
        }
      });

      const nextPaid = this.roundMoney(Number(installment.paidAmount) + dto.amount);
      await tx.installment.update({
        where: { id: installment.id },
        data: {
          paidAmount: this.toDecimal(nextPaid),
          status: nextPaid >= Number(installment.amount) ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL,
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
          amount: dto.amount
        }
      });

      return payment.id;
    });

    return this.getPayment(actor, paymentId);
  }

  async openCashRegister(actor: AuthUser, dto: OpenCashRegisterDto) {
    await this.ensureBranch(actor, dto.branchId);

    const existing = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: dto.branchId,
        openedById: actor.id,
        status: CashRegisterStatus.OPEN
      }
    });

    if (existing) {
      throw new BadRequestException("You already have an open cash register in this branch");
    }

    const created = await this.openCashRegisterInternal(actor, dto.branchId, dto.openingAmount);

    return this.getCashRegister(actor, created);
  }

  async getCurrentCashRegister(actor: AuthUser, branchId: string) {
    await this.ensureBranch(actor, branchId);

    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId,
        openedById: actor.id,
        status: CashRegisterStatus.OPEN
      },
      select: { id: true }
    });

    if (!register) return null;
    return this.getCashRegister(actor, register.id);
  }

  async closeCashRegister(actor: AuthUser, id: string, dto: CloseCashRegisterDto) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id, organizationId: actor.organizationId, branchId: branchScope(actor), status: CashRegisterStatus.OPEN },
      include: { movements: true }
    });
    if (!register) throw new NotFoundException("Open cash register not found");

    if (register.openedById !== actor.id && !this.hasAnyPermission(actor, ["cash_register.close_any", "system.manage_all"])) {
      throw new BadRequestException("Only the register owner can close this cash register");
    }

    const expectedClosing = this.calculateExpectedClosing(register.movements);
    const difference = this.roundMoney(dto.closingAmount - expectedClosing);

    await this.prisma.$transaction(async (tx) => {
      await tx.cashMovement.create({
        data: {
          cashRegisterId: register.id,
          type: CashMovementType.CLOSING,
          amount: this.toDecimal(dto.closingAmount),
          description: dto.notes?.trim() || "Cierre de caja",
          createdById: actor.id
        }
      });

      await tx.cashRegister.update({
        where: { id: register.id },
        data: {
          status: CashRegisterStatus.CLOSED,
          closingAmount: this.toDecimal(dto.closingAmount),
          closedAt: new Date(),
          closedById: actor.id
        }
      });

      await this.audit(tx, actor, {
        entity: "CashRegister",
        entityId: register.id,
        action: "close",
        after: {
          expectedClosing,
          closingAmount: dto.closingAmount,
          difference
        }
      });
    });

    return {
      register: await this.getCashRegister(actor, register.id),
      expectedClosing,
      difference
    };
  }

  async listCashRegisters(actor: AuthUser, query: ListCashRegistersQueryDto) {
    const { skip, take } = resolvePagination(query);
    const registers = await this.prisma.cashRegister.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, query.branchId),
        ...(query.status ? { status: query.status as CashRegisterStatus } : {}),
        ...(query.search
          ? {
              OR: [
                { id: { contains: query.search, mode: "insensitive" } },
                { branch: { name: { contains: query.search, mode: "insensitive" } } },
                { openedBy: { firstName: { contains: query.search, mode: "insensitive" } } },
                { openedBy: { lastName: { contains: query.search, mode: "insensitive" } } },
                { closedBy: { firstName: { contains: query.search, mode: "insensitive" } } },
                { closedBy: { lastName: { contains: query.search, mode: "insensitive" } } }
              ]
            }
          : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: true
      },
      skip,
      take,
      orderBy: { openedAt: "desc" }
    });

    return Promise.all(registers.map((register) => this.enrichCashRegister(actor, register)));
  }

  async getCashRegisterDetail(actor: AuthUser, registerId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id: registerId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor)
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: {
          orderBy: { createdAt: "asc" },
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            expense: { select: { id: true, description: true, total: true, paidAt: true } },
            payment: {
              select: {
                id: true,
                amount: true,
                reference: true,
                paidAt: true,
                status: true,
                patient: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    documentNumber: true,
                    agreement: { select: { id: true, name: true } }
                  }
                },
                paymentMethod: { select: { id: true, name: true, type: true } },
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

    return this.enrichCashRegister(actor, register);
  }

  async createCashMovement(actor: AuthUser, registerId: string, dto: CreateCashMovementDto) {
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

    return this.prisma.cashMovement.create({
      data: {
        cashRegisterId: register.id,
        type: dto.type,
        amount: this.toDecimal(dto.amount),
        paymentId: dto.paymentId,
        expenseId: dto.expenseId,
        description: dto.description?.trim(),
        createdById: actor.id
      }
    });
  }

  async getPatientPayments(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);
    const [payments, links, installments, treatmentPlans] = await Promise.all([
      this.prisma.payment.findMany({
        where: { organizationId: actor.organizationId, patientId, branchId: branchScope(actor) },
        include: this.paymentDetailInclude(),
        orderBy: { paidAt: "desc" }
      }),
      this.prisma.paymentLink.findMany({
        where: { organizationId: actor.organizationId, patientId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.installment.findMany({
        where: { patientId, patient: { organizationId: actor.organizationId, branchId: branchScope(actor) } },
        include: { installmentPlan: { include: { treatmentPlan: { select: { id: true, name: true } } } } },
        orderBy: [{ dueDate: "asc" }, { number: "asc" }]
      }),
      this.prisma.treatmentPlan.findMany({
        where: {
          organizationId: actor.organizationId,
          patientId,
          branchId: branchScope(actor),
          isAlternative: false
        },
        include: {
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
              }
            },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const balance = await this.getPatientBalance(actor, patientId);
    const { payablePlans, payableItems } = this.buildPayableTreatmentSummaries(treatmentPlans);
    return { payments: payments.map((payment) => this.enrichPayment(payment)), links, installments, balance, payablePlans, payableItems };
  }

  async getPatientBalance(actor: AuthUser, patientId: string) {
    await this.ensurePatient(actor, patientId);

    const billablePaymentStatus = { notIn: [PaymentStatus.REFUNDED, PaymentStatus.VOIDED] };
    const [plannedTotal, allocatedTotal, totalPayments, overdueInstallments] = await Promise.all([
      this.prisma.treatmentPlanItem.aggregate({
        _sum: { total: true },
        where: {
          treatmentPlan: { organizationId: actor.organizationId, patientId, branchId: branchScope(actor), isAlternative: false },
          status: { not: TreatmentPlanItemStatus.CANCELLED }
        }
      }),
      this.prisma.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          payment: {
            organizationId: actor.organizationId,
            patientId,
            status: billablePaymentStatus
          },
          treatmentPlanItem: {
            treatmentPlan: { organizationId: actor.organizationId, patientId, branchId: branchScope(actor), isAlternative: false }
          }
        }
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          organizationId: actor.organizationId,
          patientId,
          status: billablePaymentStatus
        }
      }),
      this.prisma.installment.count({
        where: {
          patientId,
          patient: { organizationId: actor.organizationId },
          dueDate: { lt: new Date() },
          status: { notIn: [InstallmentStatus.PAID, InstallmentStatus.CANCELLED] }
        }
      })
    ]);

    const planned = Number(plannedTotal._sum.total ?? 0);
    const allocated = Number(allocatedTotal._sum.amount ?? 0);
    const paid = Number(totalPayments._sum.amount ?? 0);
    const outstanding = this.roundMoney(Math.max(planned - allocated, 0));
    const unallocatedCredit = this.roundMoney(Math.max(paid - allocated, 0));

    return {
      patientId,
      plannedAmount: planned,
      allocatedPaidAmount: allocated,
      totalPaidAmount: paid,
      outstandingAmount: outstanding,
      unallocatedCredit,
      overdueInstallments
    };
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
              include: { paymentAllocations: true }
            }
          }
        },
        installments: true
      }
    });

    return patients
      .map((patient) => {
        const plannedAmount = patient.treatmentPlans.reduce(
          (planTotal, plan) => planTotal + plan.items.reduce((itemTotal, item) => itemTotal + Number(item.total), 0),
          0
        );
        const allocatedPaidAmount = patient.treatmentPlans.reduce(
          (planTotal, plan) =>
            planTotal +
            plan.items.reduce(
              (itemTotal, item) => itemTotal + item.paymentAllocations.reduce((allocationTotal, allocation) => allocationTotal + Number(allocation.amount), 0),
              0
            ),
          0
        );
        const outstandingAmount = this.roundMoney(Math.max(plannedAmount - allocatedPaidAmount, 0));
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
          outstandingAmount,
          overdueInstallments
        };
      })
      .filter((row) => row.outstandingAmount > 0 || row.overdueInstallments > 0)
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
      .slice((page - 1) * pageSize, page * pageSize);
  }

  async createRefund(actor: AuthUser, paymentId: string, dto: CreateRefundDto) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor)
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");

    const processedRefundSum = await this.prisma.refund.aggregate({
      _sum: { amount: true },
      where: { paymentId, status: RefundStatus.PROCESSED }
    });

    const refundedAmount = Number(processedRefundSum._sum.amount ?? 0);
    const maxRefund = this.roundMoney(Number(payment.amount) - refundedAmount);
    if (dto.amount > maxRefund) throw new BadRequestException("Refund amount exceeds available refundable amount");

    const openRegister = await this.ensureOpenCashRegister(actor, payment.branchId);

    const created = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          organizationId: actor.organizationId,
          branchId: payment.branchId,
          paymentId: payment.id,
          patientId: payment.patientId,
          amount: this.toDecimal(dto.amount),
          reason: dto.reason?.trim(),
          status: RefundStatus.PROCESSED,
          processedById: actor.id,
          processedAt: new Date()
        }
      });

      if (openRegister) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: openRegister.id,
            type: CashMovementType.REFUND,
            amount: this.toDecimal(dto.amount),
            paymentId: payment.id,
            description: `Devolucion ${refund.id}`,
            createdById: actor.id
          }
        });
      }

      const nextRefunded = this.roundMoney(refundedAmount + dto.amount);
      if (nextRefunded >= Number(payment.amount)) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED }
        });
      }

      await this.audit(tx, actor, {
        entity: "Refund",
        entityId: refund.id,
        action: "create",
        after: {
          paymentId,
          amount: dto.amount
        }
      });

      return refund.id;
    });

    return this.prisma.refund.findUnique({
      where: { id: created },
      include: {
        payment: { select: { id: true, amount: true, status: true } },
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
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor)
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
    const treatmentMap = new Map<string, { id: string; number: string; name: string; procedures: string[] }>();
    const breakdown: Array<{
      id: string;
      kind: "TREATMENT" | "INSTALLMENT";
      treatmentPlanId: string | null;
      treatmentNumber: string;
      treatmentName: string;
      detail: string;
      baseAmount: number;
      paidAmount: number;
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
        number: this.shortCode(plan.id),
        name: plan.name,
        procedures: [] as string[]
      };
      if (!current.procedures.includes(procedureName)) current.procedures.push(procedureName);
      treatmentMap.set(plan.id, current);

      const activePaid = this.roundMoney(
        (item.paymentAllocations ?? []).reduce((sum: number, row: any) => {
          if (!activeStatuses.has(row.payment?.status)) return sum;
          return sum + Number(row.amount);
        }, 0)
      );
      const baseAmount = this.roundMoney(Number(item.total ?? 0));
      breakdown.push({
        id: allocation.id,
        kind: "TREATMENT",
        treatmentPlanId: plan.id,
        treatmentNumber: this.shortCode(plan.id),
        treatmentName: plan.name,
        detail: [procedureName, item.toothNumber ? `Pieza ${item.toothNumber}` : null, item.surface ? `Cara ${item.surface}` : null]
          .filter(Boolean)
          .join(" - "),
        baseAmount,
        paidAmount: this.roundMoney(Number(allocation.amount ?? 0)),
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
          number: this.shortCode(planId),
          name: plan?.name ?? "Financiamiento",
          procedures: [] as string[]
        };
        if (!current.procedures.includes("Cuota de financiamiento")) current.procedures.push("Cuota de financiamiento");
        treatmentMap.set(planId, current);
      }
      const baseAmount = this.roundMoney(Number(installment?.amount ?? 0));
      breakdown.push({
        id: allocation.id,
        kind: "INSTALLMENT",
        treatmentPlanId: planId,
        treatmentNumber: planId ? this.shortCode(planId) : "-",
        treatmentName: plan?.name ?? "Financiamiento",
        detail: `Cuota ${installment?.number ?? "-"}`,
        baseAmount,
        paidAmount: this.roundMoney(Number(allocation.amount ?? 0)),
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
    const cashRegister = firstMovement?.cashRegister
      ? {
          id: firstMovement.cashRegister.id,
          movementId: firstMovement.id,
          branch: firstMovement.cashRegister.branch,
          openedBy: firstMovement.cashRegister.openedBy,
          status: firstMovement.cashRegister.status,
          openedAt: firstMovement.cashRegister.openedAt,
          closedAt: firstMovement.cashRegister.closedAt
        }
      : null;

    return {
      ...payment,
      paymentNumber: this.shortCode(payment.id),
      ticketId: payment.reference ?? firstMovement?.id ?? this.shortCode(payment.id),
      cashRegister,
      treatmentRefs: Array.from(treatmentMap.values()),
      breakdown,
      dueDate: dueDates.length ? dueDates.sort((a, b) => a.getTime() - b.getTime())[0] : null,
      allocatedAmount,
      unallocatedAmount: this.roundMoney(Math.max(Number(payment.amount ?? 0) - allocatedAmount, 0))
    };
  }

  private buildReceiptText(payment: any) {
    const patientName = `${payment.patient?.firstName ?? ""} ${payment.patient?.lastName ?? ""}`.trim();
    const receiverName = `${payment.receivedBy?.firstName ?? ""} ${payment.receivedBy?.lastName ?? ""}`.trim();
    const lines = [
      `Comprobante de pago #${payment.paymentNumber}`,
      "",
      `Paciente: ${patientName || payment.patientId}`,
      `Sucursal: ${payment.branch?.name ?? "-"}`,
      `Recibido por: ${receiverName || "-"}`,
      `Fecha recepcion: ${payment.paidAt ? new Date(payment.paidAt).toLocaleString("es-MX") : "-"}`,
      `Metodo: ${payment.paymentMethod?.name ?? "-"}`,
      `Referencia: ${payment.reference ?? payment.ticketId ?? "-"}`,
      `Caja: ${payment.cashRegister?.id ? this.shortCode(payment.cashRegister.id) : "-"}`,
      `Monto: ${this.formatCurrency(payment.amount)} ${payment.currency ?? ""}`.trim(),
      "",
      "Desglose"
    ];

    for (const row of payment.breakdown ?? []) {
      lines.push(
        `- Trat. ${row.treatmentNumber} | ${row.detail} | Base ${this.formatCurrency(row.baseAmount)} | Pagado ${this.formatCurrency(row.paidAmount)}`
      );
    }

    if (!payment.breakdown?.length) lines.push("- Pago recibido sin aplicaciones a tratamiento o cuota.");
    if (payment.notes) lines.push("", `Notas: ${payment.notes}`);
    return lines.join("\n");
  }

  private async getCashRegister(actor: AuthUser, registerId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id: registerId,
        organizationId: actor.organizationId,
        branchId: branchScope(actor)
      },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        movements: { orderBy: { createdAt: "asc" } }
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
      professional: { id: string; firstName: string; lastName: string };
      items: Array<{
        id: string;
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
          payment: { id: string; status: PaymentStatus };
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
      treatmentPlanId: string;
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
              return sum + Number(allocation.amount);
            }, 0)
          );
          const total = Number(item.total);
          const outstandingAmount = this.roundMoney(Math.max(total - paidAmount, 0));
          const summary = {
            id: item.id,
            treatmentPlanId: plan.id,
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
            status: item.status,
            plannedAt: item.plannedAt,
            completedAt: item.completedAt
          };

          if (outstandingAmount > 0) payableItems.push(summary);
          return summary;
        });

        const totalBudget = this.roundMoney(items.reduce((sum, item) => sum + item.total, 0));
        const paidAmount = this.roundMoney(items.reduce((sum, item) => sum + item.paidAmount, 0));
        const outstandingAmount = this.roundMoney(items.reduce((sum, item) => sum + item.outstandingAmount, 0));
        const realizedAmount = this.roundMoney(
          items
            .filter((item) => item.status === TreatmentPlanItemStatus.COMPLETED)
            .reduce((sum, item) => sum + item.total, 0)
        );

        return {
          id: plan.id,
          name: plan.name,
          status: plan.status,
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

  private async enrichCashRegister<T extends { branchId: string; openedAt: Date; movements: Array<{ type: CashMovementType; amount: Prisma.Decimal; payment?: { paymentMethod?: { name: string; type: string } | null } | null }> }>(
    actor: AuthUser,
    register: T
  ) {
    const previousBalance = await this.getPreviousCashRegisterBalance(actor, register.branchId, register.openedAt);
    const totals = this.calculateCashRegisterTotals(register.movements);

    return {
      ...register,
      previousBalance,
      expectedClosing: this.calculateExpectedClosing(register.movements),
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
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId: actor.organizationId, branchId: branchScope(actor), deletedAt: null }
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

  private async ensureFinancialInstitution(actor: AuthUser, financialInstitutionId: string) {
    const institution = await this.prisma.financialInstitution.findFirst({
      where: { id: financialInstitutionId, organizationId: actor.organizationId, isActive: true }
    });
    if (!institution) throw new BadRequestException("Invalid financial institution");
    return institution;
  }

  private async openCashRegisterInternal(actor: AuthUser, branchId: string, openingAmount: number) {
    return this.prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.create({
        data: {
          organizationId: actor.organizationId,
          branchId,
          openedById: actor.id,
          openingAmount: this.toDecimal(openingAmount),
          status: CashRegisterStatus.OPEN,
          openedAt: new Date()
        }
      });

      await tx.cashMovement.create({
        data: {
          cashRegisterId: register.id,
          type: CashMovementType.OPENING,
          amount: this.toDecimal(openingAmount),
          description: "Apertura de caja",
          createdById: actor.id
        }
      });

      await this.audit(tx, actor, {
        entity: "CashRegister",
        entityId: register.id,
        action: "open",
        after: {
          branchId,
          openingAmount
        }
      });

      return register.id;
    });
  }

  private async ensureOpenCashRegister(actor: AuthUser, branchId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId,
        openedById: actor.id,
        status: CashRegisterStatus.OPEN
      }
    });

    if (register) return register;

    if (this.hasAnyPermission(actor, ["cash_register.open", "system.manage_all"])) {
      const registerId = await this.openCashRegisterInternal(actor, branchId, 0);
      return this.prisma.cashRegister.findUniqueOrThrow({ where: { id: registerId } });
    }

    throw new BadRequestException("No open cash register found for this user and branch");
  }

  private async applyAllocations(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    paymentId: string,
    allocations: AddPaymentAllocationsDto["allocations"]
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

    const existingAllocated = payment.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const requested = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (requested <= 0) throw new BadRequestException("Allocation amount must be greater than zero");
    if (this.roundMoney(existingAllocated + requested) > Number(payment.amount)) {
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

    for (const item of items) {
      if (item.treatmentPlan.isAlternative) {
        throw new BadRequestException("Alternative treatment plan items cannot receive payments");
      }
      if (item.status === TreatmentPlanItemStatus.CANCELLED) {
        throw new BadRequestException("Cancelled treatment plan items cannot receive payments");
      }
    }

    const requestedByItem = allocations.reduce<Record<string, number>>((totals, allocation) => {
      totals[allocation.treatmentPlanItemId] = this.roundMoney(
        (totals[allocation.treatmentPlanItemId] ?? 0) + allocation.amount
      );
      return totals;
    }, {});
    const existingByItem = await tx.paymentAllocation.groupBy({
      by: ["treatmentPlanItemId"],
      _sum: { amount: true },
      where: {
        treatmentPlanItemId: { in: itemIds },
        payment: { status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] } }
      }
    });
    const existingByItemId = new Map(
      existingByItem.map((row) => [row.treatmentPlanItemId, Number(row._sum.amount ?? 0)])
    );

    for (const item of items) {
      const allocated = existingByItemId.get(item.id) ?? 0;
      const requestedForItem = requestedByItem[item.id] ?? 0;
      if (this.roundMoney(allocated + requestedForItem) > Number(item.total)) {
        throw new BadRequestException("Allocations exceed treatment plan item balance");
      }
    }

    for (const allocation of allocations) {
      if (allocation.amount <= 0) throw new BadRequestException("Allocation amount must be greater than zero");
      const current = await tx.paymentAllocation.findFirst({
        where: { paymentId, treatmentPlanItemId: allocation.treatmentPlanItemId }
      });

      if (current) {
        await tx.paymentAllocation.update({
          where: { id: current.id },
          data: { amount: this.toDecimal(this.roundMoney(Number(current.amount) + allocation.amount)) }
        });
      } else {
        await tx.paymentAllocation.create({
          data: {
            paymentId,
            treatmentPlanItemId: allocation.treatmentPlanItemId,
            amount: this.toDecimal(allocation.amount)
          }
        });
      }
    }

    const allocationsAfter = await tx.paymentAllocation.aggregate({
      _sum: { amount: true },
      where: { paymentId }
    });

    const allocatedAfter = Number(allocationsAfter._sum.amount ?? 0);
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: allocatedAfter >= Number(payment.amount) ? PaymentStatus.ALLOCATED : PaymentStatus.PARTIALLY_ALLOCATED
      }
    });

    for (const itemId of itemIds) {
      const item = await tx.treatmentPlanItem.findUnique({ where: { id: itemId } });
      if (!item) continue;
      const allocatedOnItem = await tx.paymentAllocation.aggregate({
        _sum: { amount: true },
        where: {
          treatmentPlanItemId: itemId,
          payment: { status: { in: [PaymentStatus.RECEIVED, PaymentStatus.PARTIALLY_ALLOCATED, PaymentStatus.ALLOCATED] } }
        }
      });
      const allocatedTotal = Number(allocatedOnItem._sum.amount ?? 0);
      if (
        allocatedTotal >= Number(item.total) &&
        (item.status === TreatmentPlanItemStatus.PLANNED || item.status === TreatmentPlanItemStatus.ACCEPTED)
      ) {
        await tx.treatmentPlanItem.update({
          where: { id: item.id },
          data: { status: TreatmentPlanItemStatus.PAID }
        });
      }
    }
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
    date.setMonth(date.getMonth() + index);
    return date;
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

  private calculateExpectedClosing(movements: Array<{ type: CashMovementType; amount: Prisma.Decimal }>) {
    return this.roundMoney(
      movements.reduce((sum, movement) => {
        const amount = Number(movement.amount);
        if (movement.type === CashMovementType.EXPENSE || movement.type === CashMovementType.REFUND) return sum - amount;
        if (movement.type === CashMovementType.CLOSING) return sum;
        return sum + amount;
      }, 0)
    );
  }

  private calculateCashRegisterTotals(
    movements: Array<{
      type: CashMovementType;
      amount: Prisma.Decimal;
      payment?: { paymentMethod?: { name: string; type: string } | null } | null;
    }>
  ) {
    const paymentMethods = new Map<string, { name: string; type: string; count: number; amount: number }>();
    let openingTotal = 0;
    let incomeTotal = 0;
    let expenseTotal = 0;
    let refundTotal = 0;
    let adjustmentTotal = 0;

    for (const movement of movements) {
      const amount = Number(movement.amount);
      if (movement.type === CashMovementType.OPENING) openingTotal += amount;
      if (movement.type === CashMovementType.INCOME) {
        incomeTotal += amount;

        const methodName = movement.payment?.paymentMethod?.name ?? "Ingresos manuales";
        const methodType = movement.payment?.paymentMethod?.type ?? "OTHER";
        const current = paymentMethods.get(methodName) ?? { name: methodName, type: methodType, count: 0, amount: 0 };
        current.count += 1;
        current.amount = this.roundMoney(current.amount + amount);
        paymentMethods.set(methodName, current);
      }
      if (movement.type === CashMovementType.EXPENSE) expenseTotal += amount;
      if (movement.type === CashMovementType.REFUND) refundTotal += amount;
      if (movement.type === CashMovementType.ADJUSTMENT) adjustmentTotal += amount;
    }

    return {
      openingTotal: this.roundMoney(openingTotal),
      incomeTotal: this.roundMoney(incomeTotal),
      expenseTotal: this.roundMoney(expenseTotal),
      refundTotal: this.roundMoney(refundTotal),
      adjustmentTotal: this.roundMoney(adjustmentTotal),
      paymentMethodTotals: Array.from(paymentMethods.values()).sort((a, b) => b.amount - a.amount)
    };
  }

  private hasAnyPermission(actor: AuthUser, permissions: string[]) {
    return permissions.some((permission) => actor.permissions.includes(permission));
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(this.roundMoney(value));
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private formatCurrency(value: number | string | Prisma.Decimal) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value ?? 0));
  }

  private shortCode(value: string) {
    const cleaned = value.trim();
    if (!cleaned) return "-";
    return cleaned.length <= 8 ? cleaned.toUpperCase() : cleaned.slice(-8).toUpperCase();
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
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
  async getCollectionSummary(actor: AuthUser, query: { branchId?: string; dateFrom?: string; dateTo?: string }) {
    const { start, end } = this.resolveReportRange(query.dateFrom, query.dateTo);
    const branchWhere = query.branchId ? branchScope(actor, query.branchId) : branchScope(actor);

    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchWhere,
        status: { not: PaymentStatus.VOIDED },
        paidAt: { gte: start, lte: end }
      },
      select: { amount: true, paidAt: true }
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

    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      total: this.roundMoney(total),
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
        paymentMethod: { select: { name: true, type: true } }
      }
    });

    const methodMap = new Map<string, { type: string; method: string; count: number; amount: number }>();
    const patientSet = new Set<string>();
    let total = 0;

    for (const p of payments) {
      const key = p.paymentMethod.name;
      const current = methodMap.get(key) ?? { type: "Pagos", method: p.paymentMethod.name, count: 0, amount: 0 };
      current.count += 1;
      current.amount = this.roundMoney(current.amount + Number(p.amount));
      methodMap.set(key, current);
      patientSet.add(p.patientId);
      total += Number(p.amount);
    }

    return {
      total: this.roundMoney(total),
      patientsCount: patientSet.size,
      rows: [...methodMap.values()].sort((a, b) => b.amount - a.amount)
    };
  }

  // ─── Reporte: Pagos recibidos por período ────────────────────────────────
  async getPaymentsByPeriod(actor: AuthUser, query: { branchId?: string; dateFrom?: string; dateTo?: string }) {
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
        cashMovements: { select: { cashRegister: { select: { branch: { select: { name: true } } } } }, take: 1 }
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
      responsible: p.cashMovements[0]?.cashRegister?.branch?.name ?? `${p.receivedBy.firstName} ${p.receivedBy.lastName}`.trim(),
      documentNumber: p.patient.documentNumber ?? "0",
      paymentType: "Pago",
      paymentMethod: p.paymentMethod.name,
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
        treatmentNumber: p.allocations[0]?.treatmentPlanItem?.treatmentPlan?.id?.slice(-6).toUpperCase() ?? "-",
        paymentMethod: p.paymentMethod.name,
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
