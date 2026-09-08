import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../modules/redis/redis.service";
import { DeveloperApiKeyGuard } from "./developer-api-key.guard";

describe("DeveloperApiKeyGuard", () => {
  let guard: DeveloperApiKeyGuard;
  let prisma: Partial<PrismaService>;
  let redis: Partial<RedisService>;
  const rawKey = "dsk_live_abcdefghijklmnopqrstuvwxyzABCDEFGH123456789";
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const context = (headers: Record<string, string | undefined>, ip = "127.0.0.1") => {
    const req: Record<string, unknown> = { headers, ip, socket: { remoteAddress: ip } };
    return {
      req,
      value: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext
    };
  };

  beforeEach(() => {
    prisma = {
      apiKeySecret: { findUnique: jest.fn() } as unknown as typeof prisma.apiKeySecret,
      apiKey: { update: jest.fn().mockResolvedValue({}) } as unknown as typeof prisma.apiKey
    };
    redis = { consumeRateLimit: jest.fn().mockResolvedValue({ count: 1, ttlMs: 60_000 }) };
    guard = new DeveloperApiKeyGuard(prisma as PrismaService, redis as RedisService);
  });

  it("rechaza ausencia o formato experimental", async () => {
    await expect(guard.canActivate(context({}).value)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context({ "x-api-key": "legacy.token" }).value)).rejects.toThrow(UnauthorizedException);
  });

  it("rechaza cabeceras contradictorias", async () => {
    await expect(guard.canActivate(context({ "x-api-key": rawKey, authorization: `Bearer ${rawKey}x` }).value))
      .rejects.toThrow(UnauthorizedException);
  });

  it("consulta PostgreSQL en cada solicitud y autentica Bearer", async () => {
    (prisma.apiKeySecret!.findUnique as jest.Mock).mockResolvedValue({
      id: "secret-1",
      keyPrefix: "dsk_live_abcdefgh…",
      keyHash,
      activeFrom: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 10000),
      revokedAt: null,
      apiKey: {
        id: "key-1",
        organizationId: "org-1",
        name: "Integracion",
        scopes: ["patients:read"],
        status: "ACTIVE",
        branchScope: "ALL",
        branchIds: [],
        networkScope: "ANY",
        allowedIps: [],
        organization: { isActive: true, status: "ACTIVE", developerApiPlan: "STANDARD" }
      }
    });
    const request = context({ authorization: `Bearer ${rawKey}` });
    await expect(guard.canActivate(request.value)).resolves.toBe(true);
    expect(prisma.apiKeySecret!.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { keyHash } }));
    expect(request.req.m2mClient).toEqual(expect.objectContaining({ apiKeyId: "key-1", requestsPerMinute: 60 }));
  });

  it("valida allowlist IP en cada solicitud", async () => {
    (prisma.apiKeySecret!.findUnique as jest.Mock).mockResolvedValue({
      keyPrefix: "dsk_live_abcdefgh…",
      activeFrom: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 10000),
      revokedAt: null,
      apiKey: {
        id: "key-1",
        organizationId: "org-1",
        name: "Integracion",
        scopes: ["patients:read"],
        status: "ACTIVE",
        branchScope: "ALL",
        branchIds: [],
        networkScope: "ALLOWLIST",
        allowedIps: ["10.0.0.1"],
        organization: { isActive: true, status: "ACTIVE", developerApiPlan: "STANDARD" }
      }
    });
    await expect(guard.canActivate(context({ authorization: `Bearer ${rawKey}` }, "192.168.1.5").value))
      .rejects.toThrow(ForbiddenException);
    expect(redis.consumeRateLimit).toHaveBeenCalledWith("rate-limit:v2:developer-invalid:192.168.1.5", 60_000);
  });
});
