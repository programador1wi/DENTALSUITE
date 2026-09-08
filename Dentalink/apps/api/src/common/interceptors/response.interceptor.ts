import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AppLogger } from "../utils/app-logger.util";
import { AppMetricsService } from "../../modules/metrics/app-metrics.service";
import { requestRouteTemplate } from "../utils/request-route.util";

type RequestWithMeta = {
  method: string;
  url: string;
  path?: string;
  baseUrl?: string;
  route?: { path?: string | string[] };
  requestId?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string; organizationId?: string };
  m2mClient?: { apiKeyId: string; organizationId: string; keyPrefix: string; scopes: string[] };
};

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLogger,
    private readonly metrics: AppMetricsService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithMeta>();
    const response = http.getResponse<{ statusCode: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startedAt;
        const endpoint = requestRouteTemplate(request);
        this.metrics.recordHttpRequest(request.method, endpoint, response.statusCode, elapsed);
        this.logger.logEvent("HTTP request completed", "ResponseInterceptor", {
          requestId: request.requestId ?? "n/a",
          userId: request.user?.id,
          apiKeyId: request.m2mClient?.apiKeyId,
          apiKeyPrefix: request.m2mClient?.keyPrefix,
          apiScopes: request.m2mClient?.scopes,
          organizationId: request.user?.organizationId ?? request.m2mClient?.organizationId,
          branchId: request.headers["x-branch-id"],
          method: request.method,
          endpoint,
          statusCode: response.statusCode,
          durationMs: elapsed
        });
      })
    );
  }
}
