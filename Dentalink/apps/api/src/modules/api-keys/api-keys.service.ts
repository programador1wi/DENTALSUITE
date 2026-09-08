import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  DEVELOPER_API_RATE_LIMITS,
  DEVELOPER_API_SCOPE_DETAILS,
  DeveloperApiScope,
  normalizeDeveloperApiScopes
} from "@dentalwarner/shared";
import { ApiKeyBranchScope, ApiKeyNetworkScope, ApiKeyStatus, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { isIP } from "net";
import { AuthUser } from "../../common/types/auth-user";
import { PrismaService } from "../../database/prisma.service";
import {
  ApiKeyDisplayStatus,
  CreateApiKeyDto,
  ListApiKeysQueryDto,
  UpdateApiKeyDto
} from "./dto/api-keys.dto";

const DAY_MS = 24 * 60 * 60 * 1000;
const ROTATION_GRACE_MS = DAY_MS;
const EXPIRING_DAYS = 7;

type ApiKeyWithSecrets = Prisma.ApiKeyGetPayload<{
  include: {
    secrets: true;
    createdBy: { select: { id: true; firstName: true; lastName: true; email: true } };
  };
}>;

function generateSecret() {
  const secret = `dsk_live_${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    keyHash: createHash("sha256").update(secret).digest("hex"),
    keyPrefix: `${secret.slice(0, 18)}…`
  };
}

function normalizeIp(value: string) {
  const trimmed = value.trim().replace(/^\[|\]$/g, "");
  const mapped = trimmed.toLowerCase().startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
  if (isIP(mapped) === 0 || mapped.includes("/")) {
    throw new BadRequestException({ code: "INVALID_IP_ADDRESS", message: `Direccion IP no valida: ${value}` });
  }
  return mapped.toLowerCase();
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async createApiKey(actor: AuthUser, dto: CreateApiKeyDto) {
    const normalized = await this.validateConfiguration(actor, dto);
    const generated = generateSecret();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + dto.expiresInDays * DAY_MS);
    const credential = await this.prisma.apiKey.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        scopes: normalized.scopes,
        status: ApiKeyStatus.ACTIVE,
        branchScope: dto.branchScope,
        branchIds: normalized.branchIds,
        networkScope: dto.networkScope,
        allowedIps: normalized.allowedIps,
        createdById: actor.id,
        secrets: { create: { keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, activeFrom: now, expiresAt } }
      },
      include: this.detailInclude()
    });
    return { credential: this.present(credential), secret: generated.secret, shownOnce: true as const };
  }

  async listApiKeys(actor: AuthUser, query: ListApiKeysQueryDto) {
    const rows = await this.prisma.apiKey.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(query.search?.trim() ? { name: { contains: query.search.trim(), mode: Prisma.QueryMode.insensitive } } : {})
      },
      orderBy: { createdAt: "desc" },
      include: this.detailInclude()
    });
    const presented = rows.map((row) => this.present(row));
    const filtered = query.status ? presented.filter((row) => row.status === query.status) : presented;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      pagination: { page, pageSize, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)) }
    };
  }

  async getOptions(actor: AuthUser) {
    const [organization, branches] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: actor.organizationId }, select: { developerApiPlan: true } }),
      this.prisma.branch.findMany({
        where: { organizationId: actor.organizationId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      })
    ]);
    return {
      scopes: DEVELOPER_API_SCOPE_DETAILS,
      branches,
      plan: organization.developerApiPlan,
      requestsPerMinute: DEVELOPER_API_RATE_LIMITS[organization.developerApiPlan]
    };
  }

  async getApiKey(actor: AuthUser, id: string) {
    return this.present(await this.findOwned(actor, id));
  }

  async updateApiKey(actor: AuthUser, id: string, dto: UpdateApiKeyDto) {
    const existing = await this.findOwned(actor, id);
    if (existing.status === ApiKeyStatus.REVOKED) {
      throw new ConflictException({ code: "API_CREDENTIAL_REVOKED", message: "Una credencial revocada no puede modificarse." });
    }
    const merged = {
      name: dto.name ?? existing.name,
      scopes: dto.scopes ?? existing.scopes,
      branchScope: dto.branchScope ?? existing.branchScope,
      branchIds: dto.branchIds ?? existing.branchIds,
      networkScope: dto.networkScope ?? existing.networkScope,
      allowedIps: dto.allowedIps ?? existing.allowedIps
    };
    const normalized = await this.validateConfiguration(actor, merged);
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        name: merged.name.trim(),
        scopes: normalized.scopes,
        branchScope: merged.branchScope,
        branchIds: normalized.branchIds,
        networkScope: merged.networkScope,
        allowedIps: normalized.allowedIps
      },
      include: this.detailInclude()
    });
    return this.present(updated);
  }

  async rotateApiKey(actor: AuthUser, id: string) {
    const existing = await this.findOwned(actor, id);
    if (existing.status === ApiKeyStatus.REVOKED) {
      throw new ConflictException({ code: "API_CREDENTIAL_REVOKED", message: "Una credencial revocada no puede rotarse." });
    }
    const generated = generateSecret();
    const now = new Date();
    const graceEndsAt = new Date(now.getTime() + ROTATION_GRACE_MS);
    const expiresAt = new Date(now.getTime() + 90 * DAY_MS);
    const credential = await this.prisma.$transaction(async (tx) => {
      await tx.apiKeySecret.updateMany({
        where: { apiKeyId: id, revokedAt: null, expiresAt: { gt: graceEndsAt } },
        data: { expiresAt: graceEndsAt }
      });
      await tx.apiKeySecret.create({
        data: { apiKeyId: id, keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, activeFrom: now, expiresAt }
      });
      return tx.apiKey.findUniqueOrThrow({ where: { id }, include: this.detailInclude() });
    });
    return { credential: this.present(credential), secret: generated.secret, shownOnce: true as const };
  }

  async revokeApiKey(actor: AuthUser, id: string) {
    const existing = await this.findOwned(actor, id);
    if (existing.status === ApiKeyStatus.REVOKED) return this.present(existing);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.apiKeySecret.updateMany({ where: { apiKeyId: id, revokedAt: null }, data: { revokedAt: now } });
      return tx.apiKey.update({
        where: { id },
        data: { status: ApiKeyStatus.REVOKED, revokedAt: now, revokedById: actor.id },
        include: this.detailInclude()
      });
    });
    return this.present(updated);
  }

  private async findOwned(actor: AuthUser, id: string) {
    const credential = await this.prisma.apiKey.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: this.detailInclude()
    });
    if (!credential) throw new NotFoundException("Credencial API no encontrada");
    return credential;
  }

  private detailInclude() {
    return {
      secrets: { orderBy: { createdAt: Prisma.SortOrder.desc } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
    } satisfies Prisma.ApiKeyInclude;
  }

  private async validateConfiguration(
    actor: AuthUser,
    dto: {
      name: string;
      scopes: readonly string[];
      branchScope: ApiKeyBranchScope;
      branchIds?: readonly string[];
      networkScope: ApiKeyNetworkScope;
      allowedIps?: readonly string[];
    }
  ) {
    if (!dto.scopes || !Array.isArray(dto.scopes) || dto.scopes.length === 0) {
      throw new BadRequestException({ code: "INVALID_API_SCOPES", message: "Los scopes deben ser externos, unicos y pertenecer al catalogo permitido." });
    }
    const scopes = normalizeDeveloperApiScopes(dto.scopes);
    if (scopes.length !== dto.scopes.length || new Set(dto.scopes).size !== dto.scopes.length) {
      throw new BadRequestException({ code: "INVALID_API_SCOPES", message: "Los scopes deben ser externos, unicos y pertenecer al catalogo permitido." });
    }
    if (!dto.name.trim()) throw new BadRequestException("El nombre es obligatorio");
    const branchIds = dto.branchScope === ApiKeyBranchScope.ALL ? [] : [...new Set(dto.branchIds ?? [])];
    if (dto.branchScope === ApiKeyBranchScope.SELECTED && branchIds.length === 0) {
      throw new BadRequestException({ code: "BRANCH_SCOPE_REQUIRED", message: "Selecciona al menos una sucursal." });
    }
    if (branchIds.length > 0) {
      const count = await this.prisma.branch.count({
        where: { id: { in: branchIds }, organizationId: actor.organizationId, isActive: true }
      });
      if (count !== branchIds.length) throw new BadRequestException("Una o mas sucursales no pertenecen a la organizacion o estan inactivas");
    }
    const allowedIps = dto.networkScope === ApiKeyNetworkScope.ANY ? [] : [...new Set((dto.allowedIps ?? []).map(normalizeIp))];
    if (dto.networkScope === ApiKeyNetworkScope.ALLOWLIST && allowedIps.length === 0) {
      throw new BadRequestException({ code: "IP_ALLOWLIST_REQUIRED", message: "Agrega al menos una direccion IP." });
    }
    return { scopes, branchIds, allowedIps };
  }

  private present(row: ApiKeyWithSecrets) {
    const now = Date.now();
    const usable = row.secrets.filter((secret) => !secret.revokedAt && secret.activeFrom.getTime() <= now && secret.expiresAt.getTime() > now);
    const newest = row.secrets[0] ?? null;
    let status: ApiKeyDisplayStatus;
    if (row.status === ApiKeyStatus.REVOKED) status = "REVOKED";
    else if (usable.length === 0) status = "EXPIRED";
    else if (usable.length > 1) status = "ROTATING";
    else if (usable[0].expiresAt.getTime() - now <= EXPIRING_DAYS * DAY_MS) status = "EXPIRING";
    else status = "ACTIVE";
    return {
      id: row.id,
      name: row.name,
      keyPrefix: newest?.keyPrefix ?? null,
      status,
      scopes: row.scopes,
      branchScope: row.branchScope,
      branchIds: row.branchIds,
      networkScope: row.networkScope,
      allowedIps: row.allowedIps,
      expiresAt: usable[0]?.expiresAt ?? newest?.expiresAt ?? null,
      rotationEndsAt: usable.length > 1 ? usable.map((secret) => secret.expiresAt).sort((a, b) => a.getTime() - b.getTime())[0] : null,
      lastUsedAt: row.lastUsedAt,
      lastUsedIp: row.lastUsedIp,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy
    };
  }
}
