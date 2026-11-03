import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { DEVELOPER_API_RATE_LIMITS, isDeveloperApiScope } from "@dentalwarner/shared";
import { createHash } from "crypto";
import { isIP } from "net";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../modules/redis/redis.service";
import { AuthM2MClient } from "../types/m2m-client.type";

type RequestWithM2M = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  m2mClient?: AuthM2MClient;
};

const LAST_USED_WRITE_INTERVAL_MS = 60_000;

@Injectable()
export class DeveloperApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(DeveloperApiKeyGuard.name);
  private readonly lastUseWrites = new Map<string, number>();

  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithM2M>();
    const extracted = this.extractApiKey(request);
    if (extracted.conflicting || !extracted.rawKey || !/^dsk_live_[A-Za-z0-9_-]{43}$/.test(extracted.rawKey)) {
      await this.rejectInvalidAttempt(request);
    }
    const rawKey = extracted.rawKey!;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const now = new Date();
    const secret = await this.prisma.apiKeySecret.findUnique({
      where: { keyHash },
      include: { apiKey: { include: { organization: true } } }
    });
    if (!secret) return this.rejectInvalidAttempt(request);
    if (
      secret.revokedAt ||
      secret.activeFrom > now ||
      secret.expiresAt <= now ||
      secret.apiKey.status !== "ACTIVE" ||
      !secret.apiKey.organization.isActive ||
      secret.apiKey.organization.status !== "ACTIVE"
    ) {
      return this.rejectInvalidAttempt(request);
    }
    const scopes = secret.apiKey.scopes.filter(isDeveloperApiScope);
    if (scopes.length !== secret.apiKey.scopes.length) return this.rejectInvalidAttempt(request);
    const clientIp = this.normalizeClientIp(request.ip || request.socket?.remoteAddress || "");
    if (
      secret.apiKey.networkScope === "ALLOWLIST" &&
      !secret.apiKey.allowedIps.map((ip) => this.normalizeClientIp(ip)).includes(clientIp)
    ) {
      await this.consumeInvalidAttemptLimit(request);
      throw new ForbiddenException({ code: "IP_NOT_ALLOWED", message: "La direccion IP no esta autorizada." });
    }
    const plan = secret.apiKey.organization.developerApiPlan;
    request.m2mClient = {
      actorType: "API_KEY",
      apiKeyId: secret.apiKey.id,
      organizationId: secret.apiKey.organizationId,
      scopes,
      plan,
      requestsPerMinute: DEVELOPER_API_RATE_LIMITS[plan],
      branchScope: secret.apiKey.branchScope,
      branchIds: secret.apiKey.branchIds,
      networkScope: secret.apiKey.networkScope,
      name: secret.apiKey.name,
      keyPrefix: secret.keyPrefix,
      clientIp
    };
    this.scheduleLastUse(secret.apiKey.id, clientIp);
    return true;
  }

  private extractApiKey(request: RequestWithM2M) {
    const xApiKey = this.singleHeader(request.headers["x-api-key"]);
    const authorization = this.singleHeader(request.headers.authorization);
    const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (xApiKey && bearer && xApiKey !== bearer) {
      return { rawKey: null, conflicting: true };
    }
    return { rawKey: bearer || xApiKey || null, conflicting: false };
  }

  private singleHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value.length === 1 ? value[0]?.trim() : undefined;
    return value?.trim();
  }

  private normalizeClientIp(value: string) {
    const withoutBrackets = value.trim().replace(/^\[|\]$/g, "");
    const normalized = withoutBrackets.toLowerCase().startsWith("::ffff:") ? withoutBrackets.slice(7) : withoutBrackets;
    return isIP(normalized) ? normalized.toLowerCase() : "unknown";
  }

  private scheduleLastUse(apiKeyId: string, clientIp: string) {
    const now = Date.now();
    if (now - (this.lastUseWrites.get(apiKeyId) ?? 0) < LAST_USED_WRITE_INTERVAL_MS) return;
    this.lastUseWrites.set(apiKeyId, now);
    void this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date(now), lastUsedIp: clientIp }
    }).catch((error: Error) => this.logger.debug(`No se pudo actualizar ultimo uso de ${apiKeyId}: ${error.message}`));
  }

  private async rejectInvalidAttempt(request: RequestWithM2M): Promise<never> {
    await this.consumeInvalidAttemptLimit(request);
    throw new UnauthorizedException({ code: "API_CREDENTIAL_INVALID", message: "La credencial no es valida." });
  }

  private async consumeInvalidAttemptLimit(request: RequestWithM2M): Promise<void> {
    const clientIp = this.normalizeClientIp(request.ip || request.socket?.remoteAddress || "");
    const result = await this.redis.consumeRateLimit(`rate-limit:v2:developer-invalid:${clientIp}`, 60_000);
    if (!result) {
      throw new ServiceUnavailableException({ code: "RATE_LIMIT_UNAVAILABLE", message: "No se puede validar la solicitud en este momento." });
    }
    if (result.count > 30) {
      throw new HttpException({ code: "RATE_LIMIT_EXCEEDED", message: "Demasiados intentos de autenticacion." }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
