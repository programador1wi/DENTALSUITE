import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { permissionDefinitions, roleDefinitions } from "@dentalwarner/shared";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../redis/redis.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { authUserInclude, isActiveAuthUser, serializeAuthUser } from "./auth-user.resolver";

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService
  ) {}

  async invalidateUserCache(userId: string) {
    await this.redis.del(`auth:user:${userId}`);
  }

  async registerOrganization(dto: RegisterOrganizationDto, meta: RequestMeta) {
    const adminEmail = dto.adminEmail.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) {
      throw new ConflictException("Admin email already exists");
    }

    const organizationSlug = this.generateSlug(dto.organizationName);
    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          legalName: dto.legalName?.trim(),
          taxId: dto.taxId?.trim(),
          phone: dto.organizationPhone?.trim(),
          email: dto.organizationEmail?.toLowerCase().trim(),
          address: dto.organizationAddress?.trim(),
          slug: `${organizationSlug}-${randomUUID().slice(0, 8)}`,
          isActive: true,
          status: "ACTIVE"
        }
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: dto.branchName.trim(),
          phone: dto.branchPhone?.trim(),
          email: dto.branchEmail?.toLowerCase().trim(),
          address: dto.branchAddress?.trim(),
          city: dto.branchCity?.trim(),
          state: dto.branchState?.trim(),
          country: dto.branchCountry?.trim() ?? "MX",
          timezone: dto.branchTimezone?.trim() ?? "America/Mexico_City",
          code: "MAIN",
          isActive: true,
          status: "ACTIVE"
        }
      });

      await this.ensurePermissionTemplates(tx);
      const roles = await this.ensureOrganizationRoles(tx, organization.id);
      const superAdmin = roles.find((role) => role.code === "super_admin");
      if (!superAdmin) throw new Error("SUPER_ADMIN role was not created");

      const createdUser = await tx.user.create({
        data: {
          organizationId: organization.id,
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          email: adminEmail,
          phone: dto.adminPhone?.trim(),
          passwordHash,
          roleId: superAdmin.id,
          isActive: true,
          status: "ACTIVE"
        }
      });

      await tx.userRole.create({ data: { userId: createdUser.id, roleId: superAdmin.id } });
      await tx.userBranch.create({ data: { userId: createdUser.id, branchId: branch.id, isPrimary: true } });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          userId: createdUser.id,
          actorUserId: createdUser.id,
          action: "register_organization",
          entity: "Organization",
          entityId: organization.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            organizationName: organization.name,
            branchName: branch.name,
            adminEmail: createdUser.email
          },
          after: {
            organizationName: organization.name,
            branchName: branch.name,
            adminEmail: createdUser.email
          },
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        }
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: authUserInclude
      });
    });

    const tokens = await this.createSessionTokens(user.id, user.email, user.organizationId, meta);
    return { user: serializeAuthUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: authUserInclude
    });

    if (!isActiveAuthUser(user)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Invalidate stale user cache on fresh login
    await this.invalidateUserCache(user.id);

    const tokens = await this.createSessionTokens(user.id, user.email, user.organizationId, meta);
    return {
      user: serializeAuthUser(user),
      ...tokens
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    let payload: { sub?: string; sid?: string; refreshVersion?: number };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET")
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (!payload?.sub || !payload.sid || !Number.isInteger(payload.refreshVersion)) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: authUserInclude
        }
      }
    });

    if (!session || !isActiveAuthUser(session.user)) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (
      session.refreshVersion !== payload.refreshVersion ||
      this.digestRefreshToken(refreshToken) !== session.refreshTokenHash
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const nextVersion = session.refreshVersion + 1;
    const newTokens = await this.signTokenPair(
      session.userId,
      session.user.email,
      session.user.organizationId,
      session.id,
      nextVersion
    );
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    const claim = await this.prisma.session.updateMany({
        where: {
          id: session.id,
          userId: session.userId,
          refreshVersion: session.refreshVersion,
          refreshTokenHash: session.refreshTokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() }
        },
        data: {
          refreshVersion: nextVersion,
          refreshTokenHash: this.digestRefreshToken(newTokens.refreshToken),
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
          expiresAt: new Date(Date.now() + this.durationToMs(refreshExpiresIn))
        }
      });
    if (claim.count !== 1) throw new UnauthorizedException("Invalid refresh token");

    return { user: serializeAuthUser(session.user), ...newTokens };
  }

  async logout(userId: string, refreshToken?: string, sessionId?: string) {
    await this.invalidateUserCache(userId);

    if (!refreshToken && sessionId) {
      await this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      return { success: true };
    }

    if (!refreshToken) return { success: true };

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET")
      });
      if (payload?.sid && payload?.sub === userId) {
        await this.prisma.session.updateMany({
          where: { id: payload.sid, userId, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
    } catch {
      // Logout remains idempotent and does not scan session hashes for invalid tokens.
    }

    return { success: true };
  }

  private async createSessionTokens(
    userId: string,
    email: string,
    organizationId: string,
    meta: RequestMeta,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma
  ): Promise<TokenPair> {
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    const sessionId = randomUUID();
    const tokens = await this.signTokenPair(userId, email, organizationId, sessionId, 0);

    await (prismaClient as PrismaService).session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: this.digestRefreshToken(tokens.refreshToken),
        refreshVersion: 0,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + this.durationToMs(refreshExpiresIn))
      }
    });

    return tokens;
  }

  private async signTokenPair(
    userId: string,
    email: string,
    organizationId: string,
    sessionId: string,
    refreshVersion: number
  ): Promise<TokenPair> {
    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, organizationId, sid: sessionId },
        {
          secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
          expiresIn: accessExpiresIn as JwtSignOptions["expiresIn"]
        }
      ),
      this.jwtService.signAsync(
        { sub: userId, email, organizationId, sid: sessionId, refreshVersion },
        {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
          expiresIn: refreshExpiresIn as JwtSignOptions["expiresIn"]
        }
      )
    ]);
    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  private digestRefreshToken(token: string) {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  private durationToMs(value: string): number {
    const match = /^(\d+)([mhd])$/.exec(value);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === "m") return amount * 60 * 1000;
    if (unit === "h") return amount * 60 * 60 * 1000;
    return amount * 24 * 60 * 60 * 1000;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null }
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl?.trim() || null } : {})
      },
      include: authUserInclude
    });

    await this.invalidateUserCache(userId);

    return serializeAuthUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null }
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const validPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestException("La contraseña actual es incorrecta");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash }
      });

      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    });

    await this.invalidateUserCache(userId);

    return { success: true, message: "Contraseña actualizada con éxito" };
  }

  private generateSlug(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  private async ensurePermissionTemplates(tx: Prisma.TransactionClient) {
    for (const [key, name, description, module] of permissionDefinitions) {
      await tx.permission.upsert({
        where: { key },
        update: {
          name,
          description,
          module,
          code: key,
          action: key.split(".")[1] ?? "read",
          resource: key.split(".")[0] ?? module,
          isActive: true,
          isSystem: true
        },
        create: {
          key,
          name,
          description,
          module,
          code: key,
          action: key.split(".")[1] ?? "read",
          resource: key.split(".")[0] ?? module,
          isActive: true,
          isSystem: true
        }
      });
    }
  }

  private async ensureOrganizationRoles(tx: Prisma.TransactionClient, organizationId: string) {
    const roles: { id: string; name: string; code: string }[] = [];

    for (const template of roleDefinitions) {
      const roleCode = template.code;
      const existingRole = await tx.role.findFirst({
        where: {
          organizationId,
          OR: [{ name: template.name }, { code: roleCode }]
        }
      });

      const role = existingRole
        ? await tx.role.update({
            where: { id: existingRole.id },
            data: {
              name: template.name,
              description: template.description,
              isSystem: true,
              isActive: true,
              code: roleCode
            }
          })
        : await tx.role.create({
            data: {
              organizationId,
              name: template.name,
              description: template.description,
              isSystem: true,
              isActive: true,
              code: roleCode
            }
          });

      const permissions = await tx.permission.findMany({
        where: { key: { in: [...template.permissionKeys] } },
        select: { id: true }
      });

      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
        skipDuplicates: true
      });

      roles.push({ id: role.id, name: role.name, code: role.code ?? roleCode });
    }

    return roles;
  }
}
