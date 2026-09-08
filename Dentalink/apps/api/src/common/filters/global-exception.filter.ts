import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { AppLogger } from "../utils/app-logger.util";
import { AppMetricsService } from "../../modules/metrics/app-metrics.service";
import { requestRouteTemplate } from "../utils/request-route.util";

type RequestWithMeta = Request & { requestId?: string; requestStartedAt?: number };

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: AppLogger,
    private readonly metrics: AppMetricsService
  ) {}

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
    const endpoint = requestRouteTemplate(request);
    this.metrics.recordHttpRequest(
      request.method,
      endpoint,
      status,
      request.requestStartedAt ? Date.now() - request.requestStartedAt : 0
    );

    const authenticatedRequest = request as RequestWithMeta & {
      user?: { id?: string; organizationId?: string };
    };

    const logMetadata = {
      requestId: request.requestId ?? "n/a",
      userId: authenticatedRequest.user?.id,
      organizationId: authenticatedRequest.user?.organizationId,
      branchId: request.headers["x-branch-id"],
      method: request.method,
      endpoint,
      statusCode: status,
      errorMessage: exposedMessage
    };

    if (status >= 500) {
      this.logger.errorEvent(
        "HTTP server error",
        "GlobalExceptionFilter",
        logMetadata,
        exception instanceof Error ? exception.stack : undefined
      );
    } else {
      // 4xx status codes (401, 403, 404, 400, etc.) are standard client lifecycle events, not server crashes
      this.logger.logEvent(
        "HTTP client error",
        "GlobalExceptionFilter",
        logMetadata
      );
    }

    response.status(status).json({
      statusCode: status,
      ...(status < 500 && typeof structuredPayload?.code === "string"
        ? { code: structuredPayload.code }
        : {}),
      message: exposedMessage,
      ...(status < 500 && isSafeDetails(structuredPayload?.details)
        ? { details: structuredPayload.details }
        : {}),
      path: request.path,
      requestId: request.requestId,
      timestamp: new Date().toISOString()
    });
  }
}

function isSafeDetails(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
