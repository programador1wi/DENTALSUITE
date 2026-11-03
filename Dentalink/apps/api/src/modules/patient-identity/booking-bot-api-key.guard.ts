import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

@Injectable()
export class BookingBotApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const expected = this.config.get<string>("BOOKING_BOT_API_KEY")?.trim();
    const expectedOrganizationId = this.config.get<string>("BOOKING_BOT_ORGANIZATION_ID")?.trim();
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body?: { organizationId?: unknown };
    }>();
    const provided = request.headers["x-booking-bot-key"];
    const value = Array.isArray(provided) ? provided[0] : provided;
    if (!expected || !value) throw new UnauthorizedException("Credencial de integración requerida");
    const left = Buffer.from(expected);
    const right = Buffer.from(value);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException("Credencial de integración inválida");
    if (!expectedOrganizationId) {
      throw new UnauthorizedException("La credencial de integración no está vinculada a una organización");
    }
    const headerOrganization = request.headers["x-organization-id"];
    const requestedOrganizationIds = [
      Array.isArray(headerOrganization) ? headerOrganization[0] : headerOrganization,
      typeof request.body?.organizationId === "string" ? request.body.organizationId : undefined
    ].filter((item): item is string => Boolean(item?.trim()));
    if (requestedOrganizationIds.some((organizationId) => organizationId.trim() !== expectedOrganizationId)) {
      throw new ForbiddenException({
        code: "BOOKING_BOT_ORGANIZATION_MISMATCH",
        message: "La credencial no autoriza la organización solicitada."
      });
    }
    return true;
  }
}
