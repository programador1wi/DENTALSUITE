import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, type JwtSignOptions } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { permissionDefinitions, roleDefinitions } from "@dentalwarner/shared";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

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
    private readonly config: ConfigService
  ) {}

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
        include: this.authUserInclude()
      });
    });

    const tokens = await this.issueTokens(user.id, user.email, user.organizationId, meta);
    return { user: this.serializeUser(user), ...tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: this.authUserInclude()
    });

    if (!user || !user.isActive || user.status !== "ACTIVE" || user.deletedAt) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokens(user.id, user.email, user.organizationId, meta);
    return {
      user: this.serializeUser(user),
      ...tokens
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const activeSessions = await this.prisma.session.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: this.authUserInclude()
        }
      }
    });

    const matched = await this.findMatchingSession(activeSessions, refreshToken);
    if (!matched || !matched.user.isActive || matched.user.status !== "ACTIVE" || matched.user.deletedAt) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.session.update({
      where: { id: matched.id },
      data: { revokedAt: new Date() }
    });

    const tokens = await this.issueTokens(
      matched.userId,
      matched.user.email,
      matched.user.organizationId,
      meta
    );
    return { user: this.serializeUser(matched.user), ...tokens };
  }

  async logout(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      await this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      return { success: true };
    }

    const sessions = await this.prisma.session.findMany({ where: { userId, revokedAt: null } });
    const matched = await this.findMatchingSession(sessions, refreshToken);
    if (matched) {
      await this.prisma.session.update({
        where: { id: matched.id },
        data: { revokedAt: new Date() }
      });
    }

    return { success: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    organizationId: string,
    meta: RequestMeta
  ): Promise<TokenPair> {
    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    const refreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, organizationId },
        {
          secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
          expiresIn: accessExpiresIn as JwtSignOptions["expiresIn"]
        }
      ),
      this.jwtService.signAsync(
        { sub: userId, email, organizationId, tokenId: refreshTokenId },
        {
          secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
          expiresIn: refreshExpiresIn as JwtSignOptions["expiresIn"]
        }
      )
    ]);

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: await bcrypt.hash(refreshToken, 12),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + this.durationToMs(refreshExpiresIn))
      }
    });

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  private async findMatchingSession<T extends { refreshTokenHash: string }>(
    records: T[],
    plainToken: string
  ): Promise<T | null> {
    for (const record of records) {
      if (await bcrypt.compare(plainToken, record.refreshTokenHash)) {
        return record;
      }
    }
    return null;
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
      include: this.authUserInclude()
    });

    return this.serializeUser(updated);
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    return { success: true, message: "Contraseña actualizada con éxito" };
  }

  private authUserInclude() {
    return {
      organization: {
        select: {
          id: true,
          name: true,
          legalName: true,
          taxId: true,
          logoUrl: true,
          slug: true,
          phone: true,
          email: true,
          address: true
        }
      },
      role: {
        include: {
          permissions: { include: { permission: true } }
        }
      },
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } }
            }
          }
        }
      },
      permissions: { include: { permission: true } },
      branches: {
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      }
    } as const;
  }

  private serializeUser(
    user: Prisma.UserGetPayload<{ include: ReturnType<AuthService["authUserInclude"]> }>
  ) {
    const roleNames = user.roles.map((entry) => entry.role.name);
    const roleIds = user.roles.map((entry) => entry.role.id);

    if (user.role && !roleIds.includes(user.role.id)) {
      roleIds.push(user.role.id);
      roleNames.push(user.role.name);
    }

    const permissions = new Set<string>();
    const permissionEntries = [
      ...user.permissions,
      ...(user.role?.permissions ?? []),
      ...user.roles.flatMap((roleEntry) => roleEntry.role.permissions)
    ];

    for (const permissionEntry of permissionEntries) {
      const permission = permissionEntry.permission;
      if (permission.isActive && !permission.deletedAt) {
        permissions.add(permission.key ?? permission.code ?? "");
      }
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization?.name,
      organization: user.organization ?? undefined,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roleIds,
      roleNames,
      permissions: [...permissions].filter(Boolean),
      branchIds: user.branches.map((branch) => branch.branchId),
      branches: user.branches.map((b) => ({
        id: b.branch.id,
        name: b.branch.name,
        code: b.branch.code,
        isPrimary: b.isPrimary
      })),
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    };
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
