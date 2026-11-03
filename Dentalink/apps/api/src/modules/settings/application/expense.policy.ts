import { BadRequestException, ConflictException } from "@nestjs/common";
import { CashRegisterStatus, ExpenseStatus } from "@prisma/client";

type ExpensePolicyCashMovement = {
  cashRegister: {
    publicNumber: number;
    status: CashRegisterStatus;
    closedAt: Date | null;
    branch: { name: string };
    responsibleUser: { firstName: string; lastName: string };
  };
};

export type ExpensePolicySource = {
  publicNumber: number;
  status: ExpenseStatus;
  cashMovements: ExpensePolicyCashMovement[];
};

export type ExpenseLockReason = "CLOSING_CASH_SESSION" | "CLOSED_CASH_SESSION" | "CANCELLED_CASH_SESSION";

export type ExpensePolicyResult = {
  locked: boolean;
  lockReason: ExpenseLockReason | null;
  cashSession: ExpensePolicyCashMovement["cashRegister"] | null;
};

export class ExpensePolicy {
  static evaluate(expense: ExpensePolicySource): ExpensePolicyResult {
    const priority: CashRegisterStatus[] = [
      CashRegisterStatus.CLOSED,
      CashRegisterStatus.CLOSING,
      CashRegisterStatus.CANCELLED
    ];
    const movement = priority
      .map((status) => expense.cashMovements.find((row) => row.cashRegister.status === status))
      .find(Boolean);
    if (!movement) return { locked: false, lockReason: null, cashSession: null };
    const lockReason =
      movement.cashRegister.status === CashRegisterStatus.CLOSED
        ? "CLOSED_CASH_SESSION"
        : movement.cashRegister.status === CashRegisterStatus.CLOSING
          ? "CLOSING_CASH_SESSION"
          : "CANCELLED_CASH_SESSION";
    return { locked: true, lockReason, cashSession: movement.cashRegister };
  }

  static assertCanEdit(expense: ExpensePolicySource) {
    if (expense.status === ExpenseStatus.VOIDED) {
      throw new BadRequestException({
        code: "EXPENSE_ALREADY_VOIDED",
        message: "El gasto ya está anulado y no puede modificarse."
      });
    }
    this.assertSessionAllowsMutation(expense, "editarse");
  }

  static assertCanVoid(expense: ExpensePolicySource) {
    if (expense.status === ExpenseStatus.VOIDED) {
      throw new BadRequestException({
        code: "EXPENSE_ALREADY_VOIDED",
        message: "El gasto ya está anulado."
      });
    }
    this.assertSessionAllowsMutation(expense, "anularse directamente");
  }

  static capabilities(expense: ExpensePolicySource, permissions: string[]) {
    const policy = this.evaluate(expense);
    const canUpdate = hasAnyPermission(permissions, [
      "expenses.update",
      "settings.update",
      "organization.manage_all"
    ]);
    const canVoid = hasAnyPermission(permissions, ["expenses.void", "settings.update", "organization.manage_all"]);
    return {
      canView: true,
      canEdit: canUpdate && expense.status !== ExpenseStatus.VOIDED && !policy.locked,
      canVoid: canVoid && expense.status !== ExpenseStatus.VOIDED && !policy.locked,
      canCreateCorrection: false,
      canViewCashSession:
        Boolean(policy.cashSession ?? expense.cashMovements[0]?.cashRegister) &&
        hasAnyPermission(permissions, ["cash_register.read", "organization.manage_all"])
    };
  }

  private static assertSessionAllowsMutation(expense: ExpensePolicySource, action: string) {
    const policy = this.evaluate(expense);
    if (!policy.locked || !policy.cashSession || !policy.lockReason) return;
    const sessionNumber = `CAJ-${String(policy.cashSession.publicNumber).padStart(6, "0")}`;
    const responsibleName =
      `${policy.cashSession.responsibleUser.firstName} ${policy.cashSession.responsibleUser.lastName}`.trim();
    const isClosing = policy.lockReason === "CLOSING_CASH_SESSION";
    const code = isClosing
      ? "EXPENSE_LOCKED_BY_CASH_SESSION_CLOSING"
      : policy.lockReason === "CLOSED_CASH_SESSION"
        ? "EXPENSE_LOCKED_BY_CLOSED_CASH_SESSION"
        : "EXPENSE_LOCKED_BY_CANCELLED_CASH_SESSION";
    const message = isClosing
      ? "La caja se encuentra en proceso de cierre. No es posible modificar sus movimientos hasta que el proceso concluya."
      : `El gasto pertenece a una caja ${policy.lockReason === "CLOSED_CASH_SESSION" ? "cerrada" : "cancelada con movimientos"} y no puede ${action}.`;
    throw new ConflictException({
      code,
      message,
      details: {
        expenseNumber: `GAS-${String(expense.publicNumber).padStart(6, "0")}`,
        cashSessionNumber: sessionNumber,
        cashSessionStatus: policy.cashSession.status,
        branchName: policy.cashSession.branch.name,
        responsibleName,
        closedAt: policy.cashSession.closedAt?.toISOString() ?? null,
        allowedAction: "VIEW_CLOSED_CASH_SESSION"
      }
    });
  }
}

function hasAnyPermission(current: string[], required: string[]) {
  return required.some((permission) => current.includes(permission));
}
