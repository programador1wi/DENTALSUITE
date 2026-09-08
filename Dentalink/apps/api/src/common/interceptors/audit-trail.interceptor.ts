import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { PrismaService } from "../../database/prisma.service";

type RequestUser = {
  id?: string;
  organizationId?: string;
};

type RequestWithUser = Request & {
  user?: RequestUser;
  m2mClient?: {
    apiKeyId: string;
    organizationId: string;
    name: string;
    keyPrefix: string;
  };
  requestId?: string;
};

const AUDITED_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithUser>();
    const method = req.method.toUpperCase();
    const shouldAudit = AUDITED_METHODS.has(method);

    return next.handle().pipe(
      tap({
        next: () => {
          if (!shouldAudit) return;
          const user = req.user;
          const m2m = req.m2mClient;
          const entity = this.extractEntity(req.path);

          if (user?.organizationId && user.id) {
            // E-03: Fire-and-forget para no bloquear el response del cliente
            this.prisma.auditLog.create({
              data: {
                organizationId: user.organizationId,
                userId: user.id,
                actorUserId: user.id,
                entity,
                action: `${method.toLowerCase()} ${req.path}`,
                after: {
                  requestId: req.requestId,
                  method,
                  path: req.path
                }
              }
            }).catch(err => {
              Logger.error(`Error guardando audit log: ${err.message}`, err.stack, 'AuditTrailInterceptor');
            });
          } else if (m2m?.organizationId) {
            this.prisma.auditLog.create({
              data: {
                organizationId: m2m.organizationId,
                actorApiKeyId: m2m.apiKeyId,
                entity,
                action: `[m2m] ${method.toLowerCase()} ${req.path}`,
                after: {
                  requestId: req.requestId,
                  method,
                  path: req.path
                }
              }
            }).catch(err => {
              Logger.error(`Error guardando audit log M2M: ${err.message}`, err.stack, 'AuditTrailInterceptor');
            });
          }
        }
      })
    );
  }

  private extractEntity(path: string) {
    const parts = path.split("/").filter(Boolean);
    const segment = parts[0] === "api" && parts[1]?.startsWith("v") ? parts[2] : parts[0];
    if (!segment) return "Unknown";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }
}
