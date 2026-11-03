import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { PatientIdentifierInterceptor } from "./patient-identifier.interceptor";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  branchIds: ["branch-1"]
};

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as ExecutionContext;
}

describe("PatientIdentifierInterceptor", () => {
  it("resolves numeric patient references in params, query and body", async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-cuid" }) }
    };
    const interceptor = new PatientIdentifierInterceptor(prisma as never);
    const request = {
      user: actor,
      params: { patientId: "150" },
      body: { patientId: 150 },
      url: "/patients/150/clinical?patientId=150",
      originalUrl: "/api/v1/patients/150/clinical?patientId=150"
    };
    const next = { handle: jest.fn(() => of("ok")) } as CallHandler;

    const result = await firstValueFrom(await interceptor.intercept(contextFor(request), next));

    expect(result).toBe("ok");
    expect(request.params.patientId).toBe("patient-cuid");
    expect(request.body.patientId).toBe("patient-cuid");
    expect(request.url).toBe("/patients/150/clinical?patientId=patient-cuid");
    expect(prisma.patient.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: {
        patientNumber: 150,
        organizationId: "org-1",
        branchId: { in: ["branch-1"] },
        deletedAt: null
      },
      select: { id: true }
    });
  });

  it("resolves zero-padded 6-digit patient references (e.g. 000150)", async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-cuid" }) }
    };
    const interceptor = new PatientIdentifierInterceptor(prisma as never);
    const request = {
      user: actor,
      params: { id: "000150" },
      url: "/patients/000150/facturacion/pagos",
      originalUrl: "/api/v1/patients/000150/facturacion/pagos"
    };
    const next = { handle: jest.fn(() => of("ok")) } as CallHandler;

    const result = await firstValueFrom(await interceptor.intercept(contextFor(request), next));

    expect(result).toBe("ok");
    expect(request.params.id).toBe("patient-cuid");
    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: {
        patientNumber: 150,
        organizationId: "org-1",
        branchId: { in: ["branch-1"] },
        deletedAt: null
      },
      select: { id: true }
    });
  });

  it("resolves :id only below a patients route", async () => {
    const prisma = {
      patient: { findFirst: jest.fn().mockResolvedValue({ id: "patient-cuid" }) }
    };
    const interceptor = new PatientIdentifierInterceptor(prisma as never);
    const request = {
      user: actor,
      params: { id: "150" },
      url: "/patients/150/timeline",
      originalUrl: "/api/v1/patients/150/timeline"
    };

    await firstValueFrom(
      await interceptor.intercept(contextFor(request), { handle: () => of("ok") } as CallHandler)
    );

    expect(request.params.id).toBe("patient-cuid");
  });

  it("leaves UUID references unchanged", async () => {
    const prisma = { patient: { findFirst: jest.fn() } };
    const interceptor = new PatientIdentifierInterceptor(prisma as never);
    const request = {
      user: actor,
      params: { patientId: "cmre5akn10001awuss4hm8rg4" },
      url: "/patients/cmre5akn10001awuss4hm8rg4/clinical",
      originalUrl: "/api/v1/patients/cmre5akn10001awuss4hm8rg4/clinical"
    };

    await firstValueFrom(
      await interceptor.intercept(contextFor(request), { handle: () => of("ok") } as CallHandler)
    );

    expect(request.params.patientId).toBe("cmre5akn10001awuss4hm8rg4");
    expect(prisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it("does not resolve a numeric id outside a patient route", async () => {
    const prisma = { patient: { findFirst: jest.fn() } };
    const interceptor = new PatientIdentifierInterceptor(prisma as never);
    const request = {
      user: actor,
      params: { id: "150" },
      url: "/payments/150",
      originalUrl: "/api/v1/payments/150"
    };

    await firstValueFrom(
      await interceptor.intercept(contextFor(request), { handle: () => of("ok") } as CallHandler)
    );

    expect(request.params.id).toBe("150");
    expect(prisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it("preserves authorization boundaries for numeric references", async () => {
    const prisma = { patient: { findFirst: jest.fn().mockResolvedValue(null) } };
    const interceptor = new PatientIdentifierInterceptor(prisma as never);
    const request = {
      user: actor,
      params: { patientId: "150" },
      url: "/patients/150/clinical",
      originalUrl: "/api/v1/patients/150/clinical"
    };
    const next = { handle: jest.fn(() => of("ok")) } as CallHandler;

    await expect(interceptor.intercept(contextFor(request), next)).rejects.toBeInstanceOf(NotFoundException);
    expect(next.handle).not.toHaveBeenCalled();
  });
});
