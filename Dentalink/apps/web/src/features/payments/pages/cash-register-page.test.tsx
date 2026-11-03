import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CashRegisterDetail, CashRegisterMovement } from "../services/payments.service";
import { CashRegisterDetailPanel } from "./cash-register-page";

describe("CashRegisterDetailPanel", () => {
  it("shows a voided payment once with its patient, author, reason and grouped amount", () => {
    const payment = {
      id: "payment-1",
      paymentNumber: 212180,
      amount: "40505",
      reference: null,
      paidAt: "2026-08-07T14:00:00.000Z",
      status: "VOIDED" as const,
      voidReason: "Pago duplicado; registrar nuevamente con tarjeta",
      voidedAt: "2026-08-07T16:30:00.000Z",
      voidedBy: { id: "user-2", firstName: "Marcela", lastName: "Rodríguez" },
      patient: {
        id: "patient-1",
        firstName: "Ricardo",
        lastName: "Carriola",
        documentNumber: "PAC-100"
      },
      paymentMethod: { id: "method-1", name: "Pago mixto", type: "OTHER" },
      allocations: []
    };
    const movementBase = {
      type: "PAYMENT_VOID" as const,
      direction: "OUT" as const,
      description: "Anulación de pago #212180",
      reference: null,
      voidedAt: null,
      voidReason: null,
      createdAt: "2026-08-07T16:30:00.000Z",
      createdBy: { id: "user-2", firstName: "Marcela", lastName: "Rodríguez" },
      expense: null,
      refund: null,
      payment
    };
    const movements: CashRegisterMovement[] = [
      {
        ...movementBase,
        id: "void-cash",
        amount: "20000",
        paymentMethod: { id: "cash", name: "Efectivo", type: "CASH", includeInPhysicalCashBalance: true }
      },
      {
        ...movementBase,
        id: "void-card",
        amount: "20505",
        paymentMethod: { id: "card", name: "Tarjeta", type: "CARD", includeInPhysicalCashBalance: false }
      }
    ];
    const register = {
      id: "register-1",
      publicNumber: 811016,
      status: "OPEN",
      branch: { id: "branch-1", name: "Sucursal Centro" },
      openedBy: { id: "user-1", firstName: "Admin", lastName: "Sistema" },
      responsibleUser: { id: "user-1", firstName: "Admin", lastName: "Sistema" },
      openedAt: "2026-08-07T13:00:00.000Z",
      initialDeposit: "0",
      openingAmount: "0",
      expectedClosing: 0,
      previousBalance: 0,
      openingTotal: 0,
      incomeTotal: 40505,
      expenseTotal: 0,
      refundTotal: 0,
      voidTotal: 40505,
      withdrawalTotal: 0,
      adjustmentTotal: 0,
      paymentMethodTotals: [],
      movements,
      audit: []
    } as unknown as CashRegisterDetail;

    render(<CashRegisterDetailPanel register={register} />);

    const voidedSection = screen.getByRole("heading", { name: "Pagos anulados de la caja" }).parentElement;
    expect(voidedSection).not.toBeNull();
    const table = within(voidedSection as HTMLElement);
    expect(table.getByText("PAG-212180")).toBeInTheDocument();
    expect(table.getByText(/Ricardo Carriola/)).toBeInTheDocument();
    expect(table.getByText("Marcela Rodríguez")).toBeInTheDocument();
    expect(table.getByText("Pago duplicado; registrar nuevamente con tarjeta")).toBeInTheDocument();
    expect(table.getByText("Efectivo, Tarjeta")).toBeInTheDocument();
    expect(table.getByText("$40,505")).toBeInTheDocument();
    expect(table.getAllByRole("row")).toHaveLength(2);
  });
});
