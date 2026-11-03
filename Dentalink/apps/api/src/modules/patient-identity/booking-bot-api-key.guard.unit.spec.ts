import "reflect-metadata";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { BookingBotApiKeyGuard } from "./booking-bot-api-key.guard";

function context(headers: Record<string, string> = {}, body?: { organizationId?: string }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, body }) })
  } as unknown as ExecutionContext;
}

describe("BookingBotApiKeyGuard organization binding", () => {
  function guard(overrides: Record<string, string | undefined> = {}) {
    const values = {
      BOOKING_BOT_API_KEY: "bot-secret",
      BOOKING_BOT_ORGANIZATION_ID: "org-a",
      ...overrides
    };
    return new BookingBotApiKeyGuard({ get: jest.fn((key: string) => values[key as keyof typeof values]) } as never);
  }

  it("accepts the exact secret only for its configured organization", () => {
    expect(guard().canActivate(context(
      { "x-booking-bot-key": "bot-secret", "x-organization-id": "org-a" }
    ))).toBe(true);
    expect(guard().canActivate(context(
      { "x-booking-bot-key": "bot-secret" },
      { organizationId: "org-a" }
    ))).toBe(true);
  });

  it("rejects organization IDs that disagree with the credential binding", () => {
    expect(() => guard().canActivate(context(
      { "x-booking-bot-key": "bot-secret", "x-organization-id": "org-b" }
    ))).toThrow(ForbiddenException);
    expect(() => guard().canActivate(context(
      { "x-booking-bot-key": "bot-secret" },
      { organizationId: "org-b" }
    ))).toThrow(ForbiddenException);
  });

  it("fails closed when the credential has no organization binding", () => {
    expect(() => guard({ BOOKING_BOT_ORGANIZATION_ID: undefined }).canActivate(context(
      { "x-booking-bot-key": "bot-secret", "x-organization-id": "org-a" }
    ))).toThrow(UnauthorizedException);
  });
});
