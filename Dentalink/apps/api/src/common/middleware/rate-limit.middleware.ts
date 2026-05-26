import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor() {
    this.windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    this.maxRequests = Number(process.env.RATE_LIMIT_MAX ?? 200);
    setInterval(() => this.cleanup(), Math.max(10_000, this.windowMs)).unref();
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (req.path.includes("/health")) return next();

    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = this.entries.get(key);

    if (!current || current.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      res.setHeader("X-RateLimit-Limit", this.maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", (this.maxRequests - 1).toString());
      res.setHeader("X-RateLimit-Reset", String(Math.floor((now + this.windowMs) / 1000)));
      return next();
    }

    current.count += 1;
    const remaining = Math.max(this.maxRequests - current.count, 0);
    res.setHeader("X-RateLimit-Limit", this.maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", String(Math.floor(current.resetAt / 1000)));

    if (current.count > this.maxRequests) {
      return res.status(429).json({
        statusCode: 429,
        message: "Too many requests",
        retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000)
      });
    }

    return next();
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}
