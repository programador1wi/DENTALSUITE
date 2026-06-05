import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CashMovementType,
  CashRegisterStatus,
  InstallmentFrequency,
  InstallmentStatus,
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
  ListInstallmentsQueryDto,
  ListPaymentLinksQueryDto,
  ListPaymentsQueryDto,
  ListRefundsQueryDto,
  OpenCashRegisterDto,
  PayInstallmentDto
  ,
  VoidPaymentDto
} from "./dto/payments.dto";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayments(actor: AuthUser, query: ListPaymentsQueryDto) {
    const { skip, take } = resolvePagination(query);
    return this.prisma.payment.findMany({
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
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
        financialInstitution: { select: { id: true, name: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        allocations: { select: { id: true, amount: true, treatmentPlanItemId: true } },
        refunds: { select: { id: true, amount: true, status: true, createdAt: true } }
      },
      skip,
      take,
      orderBy: { paidAt: "desc" }
    });
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

  async voidPayment(actor: AuthUser, paymentId: string, dto: VoidPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: {
        allocations: true,
        refunds: true,
        installments: true,
        cashMovements: true
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === PaymentStatus.VOIDED) throw new BadRequestException("Payment is already voided");
    if (payment.refunds.length) throw new BadRequestException("Refunded payments cannot be voided");
    if (payment.installments.length) throw new BadRequestException("Installment payments must be corrected from the installment flow");

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("Void reason is required");
    const itemIds = [...new Set(payment.allocations.map((allocation) => allocation.treatmentPlanItemId))];

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentAllocation.deleteMany({ where: { paymentId: payment.id } });
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.VOIDED,
          voidReason: reason,
          voidedAt: new Date(),
          voidedById: actor.id
        }
      });

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
          where: { treatmentPlanItemId: itemId }
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
          status: PaymentStatus.RECEIVED,
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
        action: "pay",
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

    const created = await this.prisma.$transaction(async (tx) => {
      const register = await tx.cashRegister.create({
        data: {
          organizationId: actor.organizationId,
          branchId: dto.branchId,
          openedById: actor.id,
          openingAmount: this.toDecimal(dto.openingAmount),
          status: CashRegisterStatus.OPEN,
          openedAt: new Date()
        }
      });

      await tx.cashMovement.create({
        data: {
          cashRegisterId: register.id,
          type: CashMovementType.OPENING,
          amount: this.toDecimal(dto.openingAmount),
          description: "Apertura de caja",
          createdById: actor.id
        }
      });

      return register.id;
    });

    return this.getCashRegister(actor, created);
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
    const [payments, links, installments] = await Promise.all([
      this.prisma.payment.findMany({
        where: { organizationId: actor.organizationId, patientId },
        include: {
          paymentMethod: { select: { id: true, name: true, type: true } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
          allocations: {
            include: { treatmentPlanItem: { select: { id: true, treatmentPlanId: true, status: true } } }
          },
          refunds: true
        },
        orderBy: { paidAt: "desc" }
      }),
      this.prisma.paymentLink.findMany({
        where: { organizationId: actor.organizationId, patientId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.installment.findMany({
        where: { patientId, patient: { organizationId: actor.organizationId } },
        include: { installmentPlan: true },
        orderBy: [{ dueDate: "asc" }, { number: "asc" }]
      })
    ]);

    const balance = await this.getPatientBalance(actor, patientId);
    return { payments, links, installments, balance };
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
        branchId: branchScope(actor)
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        payment: { select: { id: true, amount: true, status: true } },
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
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        allocations: {
          include: {
            treatmentPlanItem: { select: { id: true, treatmentPlanId: true, status: true } }
          }
        },
        refunds: true
      }
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
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

    if (this.hasAnyPermission(actor, ["payments.override.closed_cash", "system.manage_all"])) {
      return null;
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
      where: { id: paymentId, organizationId: actor.organizationId },
      include: { allocations: true }
    });
    if (!payment) throw new NotFoundException("Payment not found");

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
        where: { treatmentPlanItemId: itemId }
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
