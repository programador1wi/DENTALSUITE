import { ExecutionContext, HttpException, ServiceUnavailableException } from "@nestjs/common";
import { RedisService } from "../../modules/redis/redis.service";
import { DeveloperApiRateLimitGuard } from "./developer-api-rate-limit.guard";

describe("DeveloperApiRateLimitGuard", () => {
  const client = { apiKeyId: "key-1", requestsPerMinute: 60 };
  const buildContext = () => {
    const setHeader = jest.fn();
    return {
      setHeader,
      context: {
        switchToHttp: () => ({
          getRequest: () => ({ m2mClient: client }),
          getResponse: () => ({ setHeader })
        })
      } as unknown as ExecutionContext
    };
  };

  it("aplica cuota por apiKeyId y devuelve headers", async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ count: 2, ttlMs: 20_000 }) };
    const guard = new DeveloperApiRateLimitGuard(redis as unknown as RedisService);
    const { context, setHeader } = buildContext();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(redis.consumeRateLimit).toHaveBeenCalledWith("rate-limit:v2:developer-key:key-1", 60_000);
    expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "60");
    expect(setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "58");
  });

  it("falla cerrado cuando Redis no esta disponible", async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue(null) };
    const guard = new DeveloperApiRateLimitGuard(redis as unknown as RedisService);
    await expect(guard.canActivate(buildContext().context)).rejects.toThrow(ServiceUnavailableException);
  });

  it("responde 429 con codigo estable al exceder cuota", async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ count: 61, ttlMs: 20_000 }) };
    const guard = new DeveloperApiRateLimitGuard(redis as unknown as RedisService);
    const error = await guard.canActivate(buildContext().context).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toEqual(expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED" }));
  });
});
