import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthM2MClient } from "../types/m2m-client.type";

export const CurrentM2MClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthM2MClient => {
    const request = ctx.switchToHttp().getRequest<{ m2mClient?: AuthM2MClient }>();
    return request.m2mClient!;
  }
);
