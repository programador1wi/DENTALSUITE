import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AppLogger } from "../utils/app-logger.util";

type RequestWithMeta = {
  method: string;
  url: string;
  requestId?: string;
};

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithMeta>();
    const response = http.getResponse<{ statusCode: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startedAt;
        this.logger.log(
          `${request.method} ${request.url} -> ${response.statusCode} completed in ${elapsed}ms requestId=${request.requestId ?? "n/a"}`,
          "ResponseInterceptor"
        );
      })
    );
  }
}
