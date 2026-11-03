import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../database/prisma.service";
import { AuthUser } from "../../common/types/auth-user";
import { authUserInclude, isActiveAuthUser, serializeAuthUser } from "./auth-user.resolver";

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

  async validate(payload: { sub?: string; sid?: string }): Promise<AuthUser> {
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException({
        code: "SESSION_TOKEN_UNSUPPORTED",
        message: "La sesión requiere iniciar sesión nuevamente"
      });
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: { include: authUserInclude }
      }
    });

    if (!session || !isActiveAuthUser(session.user)) {
      throw new UnauthorizedException({
        code: "SESSION_REVOKED_OR_EXPIRED",
        message: "La sesión expiró o fue revocada"
      });
    }
    return serializeAuthUser(session.user, session.id);
  }
}
