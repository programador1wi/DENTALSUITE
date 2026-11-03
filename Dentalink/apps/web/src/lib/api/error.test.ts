import type { AxiosError } from "axios";
import { ApiError, parseApiError } from "./error";

describe("parseApiError", () => {
  it("parses message from API payload", () => {
    const input = {
      response: {
        status: 400,
        data: {
          message: ["field_a is required", "field_b is invalid"]
        }
      },
      message: "Request failed"
    } as AxiosError;

    const out = parseApiError(input);
    expect(out).toBeInstanceOf(ApiError);
    expect(out.statusCode).toBe(400);
    expect(out.message).toContain("field_a is required");
  });

  it("falls back to generic message", () => {
    const out = parseApiError(new Error("boom"));
    expect(out).toBeInstanceOf(ApiError);
    expect(out.statusCode).toBe(500);
  });

  it("preserves structured domain-lock metadata for the informative modal", () => {
    const input = {
      response: {
        status: 409,
        data: {
          code: "EXPENSE_LOCKED_BY_CLOSED_CASH_SESSION",
          message: "El gasto pertenece a una caja cerrada y no puede modificarse.",
          details: { expenseNumber: "GAS-001245", cashSessionNumber: "CAJ-019052" },
          requestId: "request-1"
        }
      }
    } as AxiosError;

    const out = parseApiError(input);
    expect(out.code).toBe("EXPENSE_LOCKED_BY_CLOSED_CASH_SESSION");
    expect(out.details).toEqual(
      expect.objectContaining({ expenseNumber: "GAS-001245", cashSessionNumber: "CAJ-019052" })
    );
    expect(out.requestId).toBe("request-1");
  });
});
