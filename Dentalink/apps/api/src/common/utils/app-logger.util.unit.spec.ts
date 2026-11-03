import { AppLogger } from "./app-logger.util";

describe("AppLogger", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes structured request metadata and redacts secrets", () => {
    const output = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = new AppLogger();

    logger.logEvent(
      "Authorization Bearer eyJ.header.payload",
      "SecurityTest",
      {
        requestId: "request-1",
        organizationId: "org-1",
        durationMs: 25,
        refreshToken: "secret-refresh-token"
      }
    );

    const payload = JSON.parse(output.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      context: "SecurityTest",
      requestId: "request-1",
      organizationId: "org-1",
      durationMs: 25,
      refreshToken: "[REDACTED]"
    });
    expect(payload.message).toBe("Authorization Bearer [REDACTED]");
    expect(output.mock.calls[0][0]).not.toContain("secret-refresh-token");
    expect(output.mock.calls[0][0]).not.toContain("eyJ.header.payload");
  });

  it("safely handles Error objects passed as trace or message without crashing", () => {
    const errorOutput = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = new AppLogger();

    const testError = new Error("Database connection failed with password=supersecret");

    // Standard NestJS Logger error with Error instance in trace parameter
    expect(() => {
      logger.error("Worker failure", testError, "AppointmentReminderWorker");
    }).not.toThrow();

    expect(errorOutput).toHaveBeenCalled();
    const payload = JSON.parse(errorOutput.mock.calls[0][0] as string);
    expect(payload.level).toBe("error");
    expect(payload.context).toBe("AppointmentReminderWorker");
    expect(payload.message).toBe("Worker failure");
    expect(payload.trace).toContain("Database connection failed with password=[REDACTED]");

    // Passing Error directly as message
    expect(() => {
      logger.error(testError);
    }).not.toThrow();
  });
});
