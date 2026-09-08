import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { RedisService } from "../../modules/redis/redis.service";

type RateLimitPolicy = {
  name: string;
  maxRequests: number;
  windowMs: number;
  identity: string;
  failClosed: boolean;
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = req.path.toLowerCase();
    if (/^\/(?:api\/v1\/)?health(?:\/(?:live|ready|database|redis))?\/?$/.test(path)) return next();
    if (path.includes("/developer/")) return next();

    const policies = this.resolvePolicies(req, path);
    const consumed = await Promise.all(policies.map(async (policy) => ({
      policy,
      result: await this.redis.consumeRateLimit(
        `rate-limit:v1:${policy.name}:${this.hash(policy.identity)}`,
        policy.windowMs
      )
    })));

    const unavailable = consumed.find(({ policy, result }) => !result && policy.failClosed);
    if (unavailable) {
      return res.status(503).json({
        statusCode: 503,
        message: "Rate limit service unavailable"
      });
    }
    if (consumed.some(({ result }) => !result)) {
        res.setHeader("X-RateLimit-Degraded", "redis-unavailable");
        return next();
    }

    const available = consumed as Array<{ policy: RateLimitPolicy; result: { count: number; ttlMs: number } }>;
    const limiting = available.reduce((current, item) => {
      const remaining = item.policy.maxRequests - item.result.count;
      const currentRemaining = current.policy.maxRequests - current.result.count;
      return remaining < currentRemaining ? item : current;
    });
    const remaining = Math.max(limiting.policy.maxRequests - limiting.result.count, 0);
    const resetAt = Date.now() + Math.max(limiting.result.ttlMs, 0);
    res.setHeader("X-RateLimit-Limit", String(limiting.policy.maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    const exceeded = available.find(({ policy, result }) => result.count > policy.maxRequests);
    if (exceeded) {
      const retryAfterSeconds = Math.max(1, Math.ceil(exceeded.result.ttlMs / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        statusCode: 429,
        message: "Too many requests",
        retryAfterSeconds
      });
    }

    return next();
  }

  private resolvePolicies(req: Request, path: string): RateLimitPolicy[] {
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (path.endsWith("/auth/login")) {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "unknown";
      const windowMs = Number(this.config.get<string>("LOGIN_RATE_LIMIT_WINDOW_MS") ?? 15 * 60_000);
      return [
        {
          name: "login",
          maxRequests: Number(this.config.get<string>("LOGIN_RATE_LIMIT_EMAIL_MAX") ?? 10),
          windowMs,
          identity: `${ip}:${email}`,
          failClosed: true
        },
        {
          name: "login-ip",
          maxRequests: Number(this.config.get<string>("LOGIN_RATE_LIMIT_IP_MAX") ?? 100),
          windowMs,
          identity: ip,
          failClosed: true
        }
      ];
    }

    if (path.endsWith("/auth/refresh")) {
      const token = this.refreshToken(req) ?? ip;
      return [{ name: "refresh", maxRequests: 30, windowMs: 60_000, identity: token, failClosed: true }];
    }

    if (path.includes("/public/booking")) {
      return [{
        name: "public-booking",
        maxRequests: Number(this.config.get<string>("PUBLIC_BOOKING_RATE_LIMIT_MAX") ?? 60),
        windowMs: 60_000,
        identity: ip,
        failClosed: true
      }];
    }

    if (path.includes("/webhooks/") || path.includes("/payment-webhooks/")) {
      const provider = path.split("/").filter(Boolean).at(-1) ?? "unknown";
      return [{ name: "webhook", maxRequests: 120, windowMs: 60_000, identity: `${provider}:${ip}`, failClosed: true }];
    }

    if (/(?:\/export(?:\/|$)|\/download(?:\/|$)|\/excel\/requests(?:\/|$))/.test(path)) {
      return [{ name: "export", maxRequests: 20, windowMs: 60_000, identity: ip, failClosed: true }];
    }

    if (req.headers.authorization?.startsWith("Bearer ")) {
      return [{ name: "authenticated", maxRequests: 300, windowMs: 60_000, identity: ip, failClosed: false }];
    }

    return [{
      name: "public-default",
      maxRequests: Number(this.config.get<string>("RATE_LIMIT_MAX") ?? 200),
      windowMs: Number(this.config.get<string>("RATE_LIMIT_WINDOW_MS") ?? 60_000),
      identity: `${ip}:${path}`,
      failClosed: false
    }];
  }

  private refreshToken(req: Request) {
    if (typeof req.body?.refreshToken === "string") return req.body.refreshToken;
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]*)/);
    if (!match) return undefined;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return undefined;
    }
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
