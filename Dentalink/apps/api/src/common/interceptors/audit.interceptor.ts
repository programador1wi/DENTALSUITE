import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';
import { AUDITABLE_KEY, AuditableOptions } from '../decorators/auditable.decorator';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.getAllAndOverride<AuditableOptions>(AUDITABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    const ipAddress = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // Retrieve branchId if available
    const branchId = 
      request.params.branchId || 
      request.query.branchId || 
      request.body?.branchId;

    return next.handle().pipe(
      tap(async (response) => {
        if (!user || !user.organizationId) {
          return;
        }

        const entityId = response?.id || request.params.id;

        try {
          await this.prisma.auditLog.create({
            data: {
              organizationId: user.organizationId,
              branchId: branchId || null,
              userId: user.id,
              action: options.action,
              entity: options.entity,
              entityId: entityId || null,
              ipAddress: ipAddress || null,
              userAgent: userAgent || null,
            },
          });
        } catch (error) {
          console.error('Audit Log failed:', error);
        }
      }),
    );
  }
}
