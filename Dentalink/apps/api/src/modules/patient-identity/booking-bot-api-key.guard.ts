import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

@Injectable()
export class BookingBotApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const expected = this.config.get<string>("BOOKING_BOT_API_KEY")?.trim();
    const provided = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>().headers[
      "x-booking-bot-key"
    ];
    const value = Array.isArray(provided) ? provided[0] : provided;
    if (!expected || !value) throw new UnauthorizedException("Credencial de integración requerida");
    const left = Buffer.from(expected);
    const right = Buffer.from(value);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException("Credencial de integración inválida");
    return true;
  }
}
