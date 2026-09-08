import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "crypto";
import {
  CashMovementDirection,
  CashMovementType,
  CashRegisterStatus,
  ExpenseStatus,
  Prisma
} from "@prisma/client";
import { resolvePagination } from "../../common/utils/pagination.util";
import { branchScope } from "../../common/utils/branch-scope.util";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import { CreateExpenseDto, UpdateExpenseDto, VoidExpenseDto } from "./dto/admin-workflows.dto";
import { ExpensePolicy, type ExpensePolicySource } from "./application/expense.policy";

export const expenseCashRegisterSelect = Prisma.validator<Prisma.CashRegisterSelect>()({
  id: true,
  publicNumber: true,
  status: true,
  closedAt: true,
  branch: { select: { id: true, name: true } },
  responsibleUser: { select: { id: true, firstName: true, lastName: true } }
});

export const expenseMutationInclude = Prisma.validator<Prisma.ExpenseInclude>()({
  category: true,
  cashMovements: {
    include: { cashRegister: { select: expenseCashRegisterSelect } }
  }
});

@Injectable()
export class SettingsExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async listExpenses(
    actor: AuthUser,
    search?: string,
    branchId?: string,
    month?: number,
    year?: number,
    page?: number,
    pageSize?: number,
    status?: string,
    categoryId?: string
  ) {
    const { skip, take } = resolvePagination({ page, pageSize });
    const expenses = await this.prisma.expense.findMany({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor, branchId),
        ...(status ? { status: status as ExpenseStatus } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { description: { contains: search, mode: "insensitive" } },
                { notes: { contains: search, mode: "insensitive" } },
                { category: { name: { contains: search, mode: "insensitive" } } }
              ]
            }
          : {}),
        ...(month && year
          ? {
              paidAt: {
                gte: new Date(year, month - 1, 1),
                lt: new Date(year, month, 1)
              }
            }
          : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        voidedBy: { select: { id: true, firstName: true, lastName: true } },
        cashMovements: {
          select: {
            id: true,
            cashRegisterId: true,
            cashRegister: { select: expenseCashRegisterSelect }
          }
        }
      },
      skip,
      take,
      orderBy: { paidAt: "desc" }
    });
    return expenses.map((expense) => this.serializeExpense(actor, expense));
  }

  async getExpenseSummary(actor: AuthUser, branchId?: string, month?: number, year?: number) {
    const selected = new Date(year ?? new Date().getFullYear(), (month ?? new Date().getMonth() + 1) - 1, 1);
    const start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
    const previousStart = new Date(selected.getFullYear(), selected.getMonth() - 1, 1);
    const trendStart = new Date(selected.getFullYear(), selected.getMonth() - 11, 1);
    const scopedBranch = branchScope(actor, branchId);
    const baseWhere = {
      organizationId: actor.organizationId,
      branchId: scopedBranch,
      status: { not: ExpenseStatus.VOIDED }
    } satisfies Prisma.ExpenseWhereInput;

    const [currentGroups, previousGroups, categories, trendExpenses] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ["categoryId"],
        where: { ...baseWhere, paidAt: { gte: start, lt: end } },
        _count: { _all: true },
        _sum: { total: true }
      }),
      this.prisma.expense.groupBy({
        by: ["categoryId"],
        where: { ...baseWhere, paidAt: { gte: previousStart, lt: start } },
        _sum: { total: true }
      }),
      this.prisma.expenseCategory.findMany({
        where: { organizationId: actor.organizationId },
        select: { id: true, name: true }
      }),
      this.prisma.expense.findMany({
        where: { ...baseWhere, paidAt: { gte: trendStart, lt: end } },
        select: { paidAt: true, total: true }
      })
    ]);
    const names = new Map(categories.map((category) => [category.id, category.name]));
    const previous = new Map(
      previousGroups.map((group) => [group.categoryId, this.roundMoney(Number(group._sum.total ?? 0))])
    );
    const total = this.roundMoney(
      currentGroups.reduce((sum, group) => sum + Number(group._sum.total ?? 0), 0)
    );
    const rows = currentGroups
      .map((group) => {
        const categoryTotal = this.roundMoney(Number(group._sum.total ?? 0));
        const previousTotal = previous.get(group.categoryId) ?? 0;
        return {
          categoryId: group.categoryId,
          category: names.get(group.categoryId) ?? "Sin categoría",
          count: group._count._all,
          total: categoryTotal,
          percentage: total ? this.roundMoney((categoryTotal / total) * 100) : 0,
          previousTotal,
          comparisonPercent:
            previousTotal > 0
              ? this.roundMoney(((categoryTotal - previousTotal) / previousTotal) * 100)
              : null
        };
      })
      .sort((a, b) => b.total - a.total);
    const trend = new Map<string, number>();
    for (let index = 0; index < 12; index += 1) {
      const cursor = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
      trend.set(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const expense of trendExpenses) {
      const key = `${expense.paidAt.getFullYear()}-${String(expense.paidAt.getMonth() + 1).padStart(2, "0")}`;
      trend.set(key, this.roundMoney((trend.get(key) ?? 0) + Number(expense.total)));
    }

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      total,
      count: rows.reduce((sum, row) => sum + row.count, 0),
      rows,
      trend: [...trend].map(([period, amount]) => ({ period, amount }))
    };
  }

  async createExpense(actor: AuthUser, dto: CreateExpenseDto) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchScope(actor, dto.branchId),
        organizationId: actor.organizationId,
        deletedAt: null,
        status: "ACTIVE"
      }
    });
    if (!branch) throw new BadRequestException("Invalid branch");

    const quantity = this.roundMoney(dto.quantity);
    const unitCost = this.roundMoney(dto.unitCost);
    const total = this.roundMoney(quantity * unitCost);
    const categoryName = dto.categoryName.trim();
    const description = dto.description.trim();
    if (!categoryName) throw new BadRequestException("Expense category is required");
    if (!description) throw new BadRequestException("Expense description is required");
    if (dto.paymentMethodId) await this.ensureExpensePaymentMethod(actor, dto.paymentMethodId);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const expenseId = await this.prisma.$transaction(
          async (tx) => {
            const category = await tx.expenseCategory.upsert({
              where: { organizationId_name: { organizationId: actor.organizationId, name: categoryName } },
              create: { organizationId: actor.organizationId, name: categoryName, reportGroup: dto.categoryReportGroup },
              update: { isActive: true, reportGroup: dto.categoryReportGroup }
            });

            const expense = await tx.expense.create({
              data: {
                publicNumber: randomInt(100000, 1000000),
                organizationId: actor.organizationId,
                branchId: dto.branchId,
                categoryId: category.id,
                description,
                supplierName: dto.supplierName?.trim(),
                quantity: this.toDecimal(quantity),
                unitCost: this.toDecimal(unitCost),
                total: this.toDecimal(total),
                accountingDate: new Date(dto.accountingDate),
                invoicedAt: dto.invoicedAt ? new Date(dto.invoicedAt) : null,
                paidAt: new Date(dto.paidAt),
                paymentMethodId: dto.paymentMethodId,
                documentUrl: dto.documentUrl?.trim(),
                notes: dto.notes?.trim(),
                status: ExpenseStatus.PAID,
                createdById: actor.id
              }
            });

            if (dto.assignToOpenCash || dto.cashRegisterId) {
              const openRegister = await tx.cashRegister.findFirst({
                where: {
                  organizationId: actor.organizationId,
                  branchId: dto.branchId,
                  status: CashRegisterStatus.OPEN,
                  ...(dto.cashRegisterId ? { id: dto.cashRegisterId } : { responsibleUserId: actor.id })
                },
                orderBy: { openedAt: "desc" }
              });
              if (!openRegister)
                throw new BadRequestException("Open a cash register before assigning the expense");
              await tx.cashMovement.create({
                data: {
                  organizationId: actor.organizationId,
                  branchId: dto.branchId,
                  cashRegisterId: openRegister.id,
                  type: CashMovementType.EXPENSE,
                  direction: CashMovementDirection.OUT,
                  amount: this.toDecimal(total),
                  expenseId: expense.id,
                  paymentMethodId: dto.paymentMethodId,
                  description: `Gasto GAS-${String(expense.publicNumber).padStart(6, "0")}: ${expense.description}`,
                  createdById: actor.id
                }
              });
            }

            await tx.auditLog.create({
              data: {
                organizationId: actor.organizationId,
                actorUserId: actor.id,
                entity: "Expense",
                entityId: expense.id,
                action: "create",
                after: {
                  publicNumber: expense.publicNumber,
                  branchId: dto.branchId,
                  categoryName,
                  description: expense.description,
                  total,
                  assignedToCash: Boolean(dto.assignToOpenCash || dto.cashRegisterId)
                }
              }
            });
            return expense.id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );

        return this.getExpense(actor, expenseId);
      } catch (error) {
        if (this.isUniqueCollision(error, "publicNumber")) continue;
        throw error;
      }
    }

    throw new ConflictException("Could not generate a unique expense number. Try again.");
  }

  async updateExpense(actor: AuthUser, expenseId: string, dto: UpdateExpenseDto) {
    const publicNumber = this.parseExpenseNumber(expenseId);
    const expense = await this.prisma.expense.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: expenseId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: expenseMutationInclude
    });
    if (!expense) throw new NotFoundException("Expense not found");
    if (dto.paymentMethodId) await this.ensureExpensePaymentMethod(actor, dto.paymentMethodId);

    const quantity = this.roundMoney(dto.quantity ?? Number(expense.quantity));
    const unitCost = this.roundMoney(dto.unitCost ?? Number(expense.unitCost));
    const total = this.roundMoney(quantity * unitCost);
    const categoryName = dto.categoryName?.trim();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.expense.findFirst({
            where: { id: expense.id, organizationId: actor.organizationId, branchId: branchScope(actor) },
            include: expenseMutationInclude
          });
          if (!current) throw new NotFoundException("Expense not found");
          ExpensePolicy.assertCanEdit(current);
          if (current.version !== dto.expectedVersion) {
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras lo editabas. Actualiza la información antes de continuar."
            });
          }

          let categoryId = current.categoryId;
          if (categoryName) {
            const category = await tx.expenseCategory.upsert({
              where: { organizationId_name: { organizationId: actor.organizationId, name: categoryName } },
              create: {
                organizationId: actor.organizationId,
                name: categoryName,
                reportGroup: dto.categoryReportGroup ?? current.category.reportGroup
              },
              update: {
                isActive: true,
                ...(dto.categoryReportGroup ? { reportGroup: dto.categoryReportGroup } : {})
              }
            });
            categoryId = category.id;
          }

          const updated = await tx.expense.updateMany({
            where: { id: current.id, version: dto.expectedVersion, status: { not: ExpenseStatus.VOIDED } },
            data: {
              categoryId,
              description: dto.description?.trim(),
              supplierName: dto.supplierName?.trim(),
              quantity: this.toDecimal(quantity),
              unitCost: this.toDecimal(unitCost),
              total: this.toDecimal(total),
              accountingDate: dto.accountingDate ? new Date(dto.accountingDate) : undefined,
              invoicedAt: dto.invoicedAt ? new Date(dto.invoicedAt) : undefined,
              paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
              paymentMethodId: dto.paymentMethodId,
              documentUrl: dto.documentUrl?.trim(),
              notes: dto.notes?.trim(),
              updatedById: actor.id,
              version: { increment: 1 }
            }
          });
          if (updated.count !== 1)
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras lo editabas. Actualiza la información antes de continuar."
            });

          await tx.cashMovement.updateMany({
            where: { expenseId: current.id, voidedAt: null },
            data: { amount: this.toDecimal(total), paymentMethodId: dto.paymentMethodId }
          });
          await tx.auditLog.create({
            data: {
              organizationId: actor.organizationId,
              actorUserId: actor.id,
              entity: "Expense",
              entityId: expense.id,
              action: "update",
              before: {
                category: current.category.name,
                description: current.description,
                total: current.total.toString(),
                version: current.version
              },
              after: {
                category: categoryName ?? current.category.name,
                description: dto.description ?? current.description,
                total,
                version: current.version + 1
              }
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      const mappedError = await this.mapExpenseMutationError(actor, expense.id, error, "edit");
      await this.auditRejectedExpenseMutation(actor, expense, "update_rejected", mappedError);
      throw mappedError;
    }

    return this.getExpense(actor, expense.id);
  }

  async voidExpense(actor: AuthUser, expenseId: string, dto: VoidExpenseDto) {
    const publicNumber = this.parseExpenseNumber(expenseId);
    const expense = await this.prisma.expense.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: expenseId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: expenseMutationInclude
    });
    if (!expense) throw new NotFoundException("Expense not found");
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException("Void reason is required");

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.expense.findFirst({
            where: { id: expense.id, organizationId: actor.organizationId, branchId: branchScope(actor) },
            include: expenseMutationInclude
          });
          if (!current) throw new NotFoundException("Expense not found");
          ExpensePolicy.assertCanVoid(current);
          if (current.version !== dto.expectedVersion) {
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras intentabas anularlo. Actualiza la información."
            });
          }
          const updated = await tx.expense.updateMany({
            where: { id: current.id, version: dto.expectedVersion, status: { not: ExpenseStatus.VOIDED } },
            data: {
              status: ExpenseStatus.VOIDED,
              voidedAt: new Date(),
              voidedById: actor.id,
              voidReason: reason,
              updatedById: actor.id,
              version: { increment: 1 }
            }
          });
          if (updated.count !== 1)
            throw new ConflictException({
              code: "EXPENSE_VERSION_CONFLICT",
              message: "El gasto cambió mientras intentabas anularlo. Actualiza la información."
            });

          for (const movement of current.cashMovements) {
            await tx.cashMovement.create({
              data: {
                organizationId: actor.organizationId,
                branchId: expense.branchId,
                cashRegisterId: movement.cashRegisterId,
                type: CashMovementType.ADJUSTMENT,
                direction: CashMovementDirection.IN,
                amount: movement.amount,
                expenseId: expense.id,
                paymentMethodId: current.paymentMethodId,
                description: `Reversión de gasto GAS-${String(current.publicNumber).padStart(6, "0")}: ${reason}`,
                createdById: actor.id
              }
            });
          }

          await tx.auditLog.create({
            data: {
              organizationId: actor.organizationId,
              actorUserId: actor.id,
              entity: "Expense",
              entityId: current.id,
              action: "void",
              before: { status: current.status, total: current.total.toString(), version: current.version },
              after: { status: ExpenseStatus.VOIDED, reason, version: current.version + 1 }
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      const mappedError = await this.mapExpenseMutationError(actor, expense.id, error, "void");
      await this.auditRejectedExpenseMutation(actor, expense, "void_rejected", mappedError);
      throw mappedError;
    }

    return this.getExpense(actor, expense.id);
  }

  async getExpense(actor: AuthUser, expenseId: string) {
    const publicNumber = this.parseExpenseNumber(expenseId);
    const expense = await this.prisma.expense.findFirst({
      where: {
        organizationId: actor.organizationId,
        branchId: branchScope(actor),
        OR: [{ id: expenseId }, ...(publicNumber !== null ? [{ publicNumber }] : [])]
      },
      include: {
        branch: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        voidedBy: { select: { id: true, firstName: true, lastName: true } },
        cashMovements: {
          select: {
            id: true,
            cashRegisterId: true,
            cashRegister: { select: expenseCashRegisterSelect }
          }
        }
      }
    });
    if (!expense) throw new NotFoundException("Expense not found");
    return this.serializeExpense(actor, expense);
  }

  private serializeExpense<T extends ExpensePolicySource>(actor: AuthUser, expense: T) {
    const policy = ExpensePolicy.evaluate(expense);
    const association = policy.cashSession ?? expense.cashMovements[0]?.cashRegister ?? null;
    return {
      ...expense,
      cashAssociation: {
        associated: Boolean(association),
        cashSessionNumber: association ? `CAJ-${String(association.publicNumber).padStart(6, "0")}` : null,
        responsibleName: association
          ? `${association.responsibleUser.firstName} ${association.responsibleUser.lastName}`.trim()
          : null,
        branchName: association?.branch.name ?? null,
        status: association?.status ?? null,
        closedAt: association?.closedAt ?? null,
        locked: policy.locked,
        lockReason: policy.lockReason
      },
      permissions: ExpensePolicy.capabilities(expense, actor.permissions)
    };
  }

  private async auditRejectedExpenseMutation(
    actor: AuthUser,
    expense: ExpensePolicySource & { id: string; branchId: string },
    action: "update_rejected" | "void_rejected",
    error: unknown
  ) {
    const response = error instanceof ConflictException ? error.getResponse() : null;
    const code =
      response && typeof response === "object" && "code" in response
        ? String((response as { code?: unknown }).code ?? "")
        : "";
    if (!code.startsWith("EXPENSE_LOCKED_BY_")) return;
    const policy = ExpensePolicy.evaluate(expense);
    const details =
      response && typeof response === "object" && "details" in response
        ? ((response as { details?: Record<string, unknown> }).details ?? {})
        : {};
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        branchId: expense.branchId,
        actorUserId: actor.id,
        entity: "Expense",
        entityId: expense.id,
        action,
        reason: code,
        after: {
          expenseNumber: `GAS-${String(expense.publicNumber).padStart(6, "0")}`,
          cashSessionNumber:
            details.cashSessionNumber ??
            (policy.cashSession ? `CAJ-${String(policy.cashSession.publicNumber).padStart(6, "0")}` : null),
          requestedFields: action === "update_rejected" ? "expense_update" : "expense_void"
        }
      }
    });
  }

  private async mapExpenseMutationError(
    actor: AuthUser,
    expenseId: string,
    error: unknown,
    action: "edit" | "void"
  ) {
    if (error instanceof BadRequestException || error instanceof ConflictException) return error;
    if (!(error instanceof Error) || !error.message.includes("EXPENSE_LOCKED_BY_CASH_SESSION")) return error;
    const current = await this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId: actor.organizationId, branchId: branchScope(actor) },
      include: expenseMutationInclude
    });
    if (current) {
      try {
        if (action === "edit") ExpensePolicy.assertCanEdit(current);
        else ExpensePolicy.assertCanVoid(current);
      } catch (mappedError) {
        return mappedError;
      }
    }
    return new ConflictException({
      code: "EXPENSE_LOCKED_BY_CASH_SESSION",
      message: "El gasto está protegido por una sesión de caja no modificable."
    });
  }

  private async ensureExpensePaymentMethod(actor: AuthUser, paymentMethodId: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, organizationId: actor.organizationId, isActive: true },
      select: { id: true }
    });
    if (!method) throw new BadRequestException("Invalid payment method");
  }

  private isUniqueCollision(error: unknown, field: string) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
    const target = (error.meta?.target as string[] | string | undefined) ?? "";
    return Array.isArray(target) ? target.includes(field) : String(target).includes(field);
  }

  private parseExpenseNumber(value: string) {
    const normalized = value.trim().replace(/^GAS-/i, "");
    return /^\d{1,9}$/.test(normalized) ? Number(normalized) : null;
  }

  private roundMoney(value: number) {
    return Number(Number(value).toFixed(2));
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(this.roundMoney(value));
  }
}
