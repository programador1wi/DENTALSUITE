import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { AppLogger } from "../utils/app-logger.util";

type RequestWithMeta = Request & { requestId?: string };

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithMeta>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : "Internal server error";
    const structuredPayload = typeof payload === "string" ? null : (payload as Record<string, unknown>);
    const message = typeof payload === "string" ? payload : structuredPayload?.message;

    const exposedMessage =
      status >= 500 ? "Internal server error" : Array.isArray(message) ? message.join(", ") : String(message);

    this.logger.error(
      `${request.method} ${request.url} -> ${status} ${exposedMessage} requestId=${request.requestId ?? "n/a"}`,
      exception instanceof Error ? exception.stack : undefined,
      "GlobalExceptionFilter"
    );

    response.status(status).json({
      statusCode: status,
      ...(status < 500 && typeof structuredPayload?.code === "string"
        ? { code: structuredPayload.code }
        : {}),
      message: exposedMessage,
      ...(status < 500 && isSafeDetails(structuredPayload?.details)
        ? { details: structuredPayload.details }
        : {}),
      path: request.url,
      requestId: request.requestId,
      timestamp: new Date().toISOString()
    });
  }
}

function isSafeDetails(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
