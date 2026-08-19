import { ExecutionContext, CallHandler } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";
import { AuditInterceptor } from "./audit.interceptor";
import { PrismaService } from "../../database/prisma.service";

describe("AuditInterceptor", () => {
  let reflector: Reflector;
  let prisma: PrismaService;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn()
    } as unknown as Reflector;

    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;

    interceptor = new AuditInterceptor(reflector, prisma);
  });

  const createMockContext = (options: {
    user?: any;
    params?: any;
    query?: any;
    body?: any;
    headers?: any;
  }) =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: options.user,
          params: options.params || {},
          query: options.query || {},
          body: options.body || {},
          headers: options.headers || { "user-agent": "test-agent" },
          ip: "127.0.0.1"
        })
      })
    }) as unknown as ExecutionContext;

  it("passes through without logging when endpoint is not decorated with @Auditable", (done) => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    const context = createMockContext({ user: { id: "user-1", organizationId: "org-1" } });
    const next: CallHandler = { handle: () => of({ success: true }) };

    interceptor.intercept(context, next).subscribe({
      next: (res) => {
        expect(res).toEqual({ success: true });
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        done();
      }
    });
  });

  it("creates an AuditLog entry when endpoint is decorated with @Auditable", (done) => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      entity: "Payment",
      action: "void"
    });

    const context = createMockContext({
      user: { id: "user-1", organizationId: "org-1" },
      params: { id: "payment-123", branchId: "branch-1" }
    });
    const next: CallHandler = { handle: () => of({ id: "payment-123", status: "VOIDED" }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: {
            organizationId: "org-1",
            branchId: "branch-1",
            userId: "user-1",
            action: "void",
            entity: "Payment",
            entityId: "payment-123",
            ipAddress: "127.0.0.1",
            userAgent: "test-agent"
          }
        });
        done();
      }
    });
  });
});
