import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Response } from "express";
import { RedisService } from "../../modules/redis/redis.service";
import { AuthM2MClient } from "../types/m2m-client.type";

@Injectable()
export class DeveloperApiRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ m2mClient?: AuthM2MClient }>();
    const response = context.switchToHttp().getResponse<Response>();
    const client = request.m2mClient;
    if (!client) return false;
    const result = await this.redis.consumeRateLimit(`rate-limit:v2:developer-key:${client.apiKeyId}`, 60_000);
    if (!result) {
      throw new ServiceUnavailableException({ code: "RATE_LIMIT_UNAVAILABLE", message: "No se puede validar la cuota en este momento." });
    }
    const remaining = Math.max(client.requestsPerMinute - result.count, 0);
    response.setHeader("X-RateLimit-Limit", String(client.requestsPerMinute));
    response.setHeader("X-RateLimit-Remaining", String(remaining));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil((Date.now() + Math.max(result.ttlMs, 0)) / 1000)));
    if (result.count > client.requestsPerMinute) {
      const retryAfterSeconds = Math.max(1, Math.ceil(result.ttlMs / 1000));
      response.setHeader("Retry-After", String(retryAfterSeconds));
      throw new HttpException(
        { code: "RATE_LIMIT_EXCEEDED", message: "Se excedio la cuota de solicitudes.", retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    return true;
  }
}
