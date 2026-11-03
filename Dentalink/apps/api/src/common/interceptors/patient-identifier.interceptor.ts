import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException
} from "@nestjs/common";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { PrismaService } from "../../database/prisma.service";
import type { AuthUser } from "../types/auth-user";

type RequestWithPatientReference = Request & {
  user?: AuthUser;
  params: Record<string, string>;
  body?: unknown;
};

@Injectable()
export class PatientIdentifierInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<RequestWithPatientReference>();
    const actor = request.user;

    if (!actor?.organizationId || !actor.branchIds?.length) return next.handle();

    const resolved = new Map<string, string>();
    const resolvePatientId = async (value: unknown) => {
      const reference = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
      if (!/^\d+$/.test(reference)) return value;

      const cached = resolved.get(reference);
      if (cached) return cached;

      const patient = await this.prisma.patient.findFirst({
        where: {
          patientNumber: Number(reference),
          organizationId: actor.organizationId,
          branchId: { in: actor.branchIds },
          deletedAt: null
        },
        select: { id: true }
      });

      if (!patient) throw new NotFoundException("Patient not found");
      resolved.set(reference, patient.id);
      return patient.id;
    };

    if (request.params?.patientId) {
      request.params.patientId = (await resolvePatientId(request.params.patientId)) as string;
    }

    if (request.params?.id && this.isPatientIdRoute(request, request.params.id)) {
      request.params.id = (await resolvePatientId(request.params.id)) as string;
    }

    const requestUrl = new URL(request.url, "http://localhost");
    const queryPatientId = requestUrl.searchParams.get("patientId");
    if (queryPatientId && /^\d+$/.test(queryPatientId.trim())) {
      requestUrl.searchParams.set("patientId", (await resolvePatientId(queryPatientId)) as string);
      request.url = `${requestUrl.pathname}${requestUrl.search}`;
    }

    if (this.isRecord(request.body) && Object.hasOwn(request.body, "patientId")) {
      request.body.patientId = await resolvePatientId(request.body.patientId);
    }

    return next.handle();
  }

  private isPatientIdRoute(request: Request, value: string) {
    const pathname = new URL(request.originalUrl || request.url, "http://localhost").pathname;
    const segments = pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
    return segments.some((segment, index) => segment === "patients" && segments[index + 1] === value);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
