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
});
