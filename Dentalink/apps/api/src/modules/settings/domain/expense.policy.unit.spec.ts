import { BadRequestException, ConflictException } from "@nestjs/common";
import { CashRegisterStatus, ExpenseStatus } from "@prisma/client";
import { ExpensePolicy, type ExpensePolicySource } from "./expense.policy";

function expense(status?: CashRegisterStatus): ExpensePolicySource {
  return {
    publicNumber: 1245,
    status: ExpenseStatus.PAID,
    cashMovements: status
      ? [
          {
            cashRegister: {
              publicNumber: 19052,
              status,
              closedAt: status === CashRegisterStatus.CLOSED ? new Date("2026-07-17T19:18:00.000Z") : null,
              branch: { name: "Dental + Suc. Tuxtla" },
              responsibleUser: { firstName: "CAJA", lastName: "TUXTLA" }
            }
          }
        ]
      : []
  };
}

describe("ExpensePolicy", () => {
  it("allows editing an active expense without cash association", () => {
    expect(() => ExpensePolicy.assertCanEdit(expense())).not.toThrow();
  });

  it("allows editing and voiding while the associated cash session remains open", () => {
    const source = expense(CashRegisterStatus.OPEN);
    expect(() => ExpensePolicy.assertCanEdit(source)).not.toThrow();
    expect(() => ExpensePolicy.assertCanVoid(source)).not.toThrow();
  });

  it("returns a structured 409 while the cash session is closing", () => {
    expect.assertions(3);
    try {
      ExpensePolicy.assertCanEdit(expense(CashRegisterStatus.CLOSING));
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const response = (error as ConflictException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe("EXPENSE_LOCKED_BY_CASH_SESSION_CLOSING");
      expect(response.message).toContain("proceso de cierre");
    }
  });

  it("blocks editing and direct voiding for a closed cash session", () => {
    const source = expense(CashRegisterStatus.CLOSED);
    for (const operation of [ExpensePolicy.assertCanEdit, ExpensePolicy.assertCanVoid]) {
      try {
        operation.call(ExpensePolicy, source);
        throw new Error("Expected conflict");
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const response = (error as ConflictException).getResponse() as Record<string, unknown>;
        expect(response).toEqual(
          expect.objectContaining({
            code: "EXPENSE_LOCKED_BY_CLOSED_CASH_SESSION",
            details: expect.objectContaining({
              expenseNumber: "GAS-001245",
              cashSessionNumber: "CAJ-019052",
              cashSessionStatus: "CLOSED"
            })
          })
        );
      }
    }
  });

  it("treats a cancelled session with financial movements as immutable", () => {
    expect(() => ExpensePolicy.assertCanEdit(expense(CashRegisterStatus.CANCELLED))).toThrow(
      ConflictException
    );
  });

  it("blocks an already voided expense even when it has no cash session", () => {
    const source = expense();
    source.status = ExpenseStatus.VOIDED;
    expect(() => ExpensePolicy.assertCanEdit(source)).toThrow(BadRequestException);
  });
});
