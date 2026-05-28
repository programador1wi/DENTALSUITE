import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET")
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
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
        branches: true
      }
    });

    if (!user || !user.isActive || user.status !== "ACTIVE" || user.deletedAt) {
      throw new UnauthorizedException("Invalid or inactive user");
    }

    const roleIds = user.roles.map((entry) => entry.role.id);
    const roleNames = user.roles.map((entry) => entry.role.name);

    if (user.role && !roleIds.includes(user.role.id)) {
      roleIds.push(user.role.id);
      roleNames.push(user.role.name);
    }

    const permissions = new Set<string>();
    const permissionEntries = user.permissionsOverride
      ? user.permissions
      : [...(user.role?.permissions ?? []), ...user.roles.flatMap((roleEntry) => roleEntry.role.permissions)];

    for (const permissionEntry of permissionEntries) {
      const permission = permissionEntry.permission;
      if (permission.isActive && !permission.deletedAt) {
        permissions.add(permission.key ?? permission.code ?? "");
      }
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleIds,
      roleNames,
      permissions: [...permissions].filter(Boolean),
      branchIds: user.branches.map((branch) => branch.branchId)
    };
  }
}
