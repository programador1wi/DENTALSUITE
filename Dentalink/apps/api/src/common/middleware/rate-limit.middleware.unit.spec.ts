import { RateLimitMiddleware } from "./rate-limit.middleware";

describe("RateLimitMiddleware", () => {
  function response() {
    const res = {
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn()
    };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res;
  }

  function request(overrides: Record<string, unknown> = {}) {
    return {
      path: "/api/v1/patients",
      ip: "198.51.100.10",
      socket: {},
      body: {},
      headers: {},
      ...overrides
    };
  }

  it("enforces the login policy by IP and normalized email", async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ count: 11, ttlMs: 60_000 }) };
    const config = { get: jest.fn() };
    const middleware = new RateLimitMiddleware(redis as never, config as never);
    const res = response();
    const next = jest.fn();

    await middleware.use(
      request({ path: "/api/v1/auth/login", body: { email: " ADMIN@Example.com " } }) as never,
      res as never,
      next
    );

    expect(redis.consumeRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^rate-limit:v1:login:[a-f0-9]{64}$/),
      15 * 60_000
    );
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "60");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("uses the cookie-backed refresh token without exposing it in the Redis key", async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ count: 1, ttlMs: 60_000 }) };
    const middleware = new RateLimitMiddleware(redis as never, { get: jest.fn() } as never);
    const res = response();
    const next = jest.fn();

    await middleware.use(
      request({
        path: "/api/v1/auth/refresh",
        headers: { cookie: "refreshToken=sensitive-refresh-token-value" }
      }) as never,
      res as never,
      next
    );

    const key = redis.consumeRateLimit.mock.calls[0][0] as string;
    expect(key).not.toContain("sensitive-refresh-token-value");
    expect(redis.consumeRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^rate-limit:v1:refresh:[a-f0-9]{64}$/),
      60_000
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("fails open with an explicit degraded header for ordinary clinical reads", async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue(null) };
    const middleware = new RateLimitMiddleware(redis as never, { get: jest.fn() } as never);
    const res = response();
    const next = jest.fn();

    await middleware.use(request() as never, res as never, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Degraded", "redis-unavailable");
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("fails closed for login when Redis cannot enforce the shared limit", async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue(null) };
    const middleware = new RateLimitMiddleware(redis as never, { get: jest.fn() } as never);
    const res = response();
    const next = jest.fn();

    await middleware.use(request({ path: "/api/v1/auth/login", body: { email: "admin@example.com" } }) as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("keeps health checks independent from Redis", async () => {
    const redis = { consumeRateLimit: jest.fn() };
    const middleware = new RateLimitMiddleware(redis as never, { get: jest.fn() } as never);
    const next = jest.fn();

    await middleware.use(
      request({ path: "/api/v1/health" }) as never,
      response() as never,
      next
    );

    expect(redis.consumeRateLimit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
