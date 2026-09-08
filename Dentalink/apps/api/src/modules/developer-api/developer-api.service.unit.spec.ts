import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { AuthM2MClient } from "../../common/types/m2m-client.type";
import { PrismaService } from "../../database/prisma.service";
import { AppointmentsService } from "../appointments/appointments.service";
import { PatientFieldConfigService } from "../patient-field-config/patient-field-config.service";
import { PatientsService } from "../patients/patients.service";
import { PricingService } from "../pricing/pricing.service";
import { DeveloperApiService } from "./developer-api.service";

describe("DeveloperApiService", () => {
  let service: DeveloperApiService;
  let prisma: Partial<PrismaService>;
  let patients: {
    preparePatientForCreate: jest.Mock;
    createPreparedPatientInTransaction: jest.Mock;
    finalizePatientCreation: jest.Mock;
  };
  let patientFieldConfig: { assertRequiredFields: jest.Mock };

  const client: AuthM2MClient = {
    actorType: "API_KEY",
    apiKeyId: "key-1",
    organizationId: "org-1",
    scopes: ["patients:read", "appointments:read"],
    plan: "STANDARD",
    requestsPerMinute: 60,
    branchScope: "ALL",
    branchIds: [],
    networkScope: "ANY",
    name: "Integracion Test",
    keyPrefix: "dsk_live_12345678…",
    clientIp: "127.0.0.1"
  };

  beforeEach(() => {
    prisma = {
      patient: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ id: "p-1", patientNumber: 100001, firstName: "Juan", lastName: "Perez", createdAt: new Date() }]),
        findFirst: jest.fn()
      } as unknown as typeof prisma.patient,
      branch: { findMany: jest.fn().mockResolvedValue([{ id: "branch-A" }]) } as unknown as typeof prisma.branch,
      apiIdempotencyRecord: {
        create: jest.fn().mockResolvedValue({ id: "idem-1" }),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      } as unknown as typeof prisma.apiIdempotencyRecord
    };
    const transactionClient = {
      apiIdempotencyRecord: prisma.apiIdempotencyRecord,
      patient: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "p-created",
          patientNumber: 100002,
          firstName: "Ana",
          lastName: "Lopez"
        })
      }
    };
    (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest.fn(
      async (operation: (tx: typeof transactionClient) => Promise<unknown>) => operation(transactionClient)
    );
    patients = {
      preparePatientForCreate: jest.fn().mockResolvedValue({ potentialDuplicates: [] }),
      createPreparedPatientInTransaction: jest.fn().mockResolvedValue({ id: "p-created" }),
      finalizePatientCreation: jest.fn().mockResolvedValue(undefined)
    };
    patientFieldConfig = { assertRequiredFields: jest.fn().mockResolvedValue(undefined) };
    service = new DeveloperApiService(
      prisma as PrismaService,
      patients as unknown as PatientsService,
      {} as AppointmentsService,
      patientFieldConfig as unknown as PatientFieldConfigService,
      {} as PricingService
    );
  });

  it("lista pacientes aislando por organizacion", async () => {
    const result = await service.listPatients(client, { page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(prisma.patient!.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1" })
    }));
  });

  it("rechaza una sucursal fuera del alcance SELECTED", async () => {
    await expect(service.listPatients({ ...client, branchScope: "SELECTED", branchIds: ["branch-A"] }, { branchId: "branch-B" }))
      .rejects.toThrow(ForbiddenException);
  });

  it("aplica alcance de sucursales en detalle", async () => {
    (prisma.patient!.findFirst as jest.Mock).mockResolvedValue({ id: "p-1" });
    await service.getPatient({ ...client, branchScope: "SELECTED", branchIds: ["branch-A"] }, "p-1");
    expect(prisma.patient!.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: { in: ["branch-A"] } })
    }));
  });

  it("no filtra existencia de pacientes fuera del tenant", async () => {
    (prisma.patient!.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.getPatient(client, "p-inexistente")).rejects.toThrow(NotFoundException);
  });

  it("exige Idempotency-Key en escrituras", async () => {
    await expect(service.createPatient(client, { branchId: "branch-A", firstName: "Ana", lastName: "Lopez" }))
      .rejects.toThrow("Idempotency-Key");
    expect(patients.createPreparedPatientInTransaction).not.toHaveBeenCalled();
  });

  it("confirma paciente y resultado idempotente con el mismo TransactionClient", async () => {
    const result = await service.createPatient(
      client,
      { branchId: "branch-A", firstName: "Ana", lastName: "Lopez" },
      "request-atomic-1"
    );

    expect(result).toMatchObject({ id: "p-created" });
    expect(patients.createPreparedPatientInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ apiIdempotencyRecord: prisma.apiIdempotencyRecord }),
      expect.objectContaining({ organizationId: "org-1" }),
      expect.objectContaining({ source: "DEVELOPER_API" }),
      expect.any(Object)
    );
    expect(prisma.apiIdempotencyRecord!.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "COMPLETED", responseStatus: 201 })
    }));
    expect(patients.finalizePatientCreation).toHaveBeenCalledTimes(1);
  });

  it("reproduce respuesta completada sin duplicar paciente", async () => {
    const payload = { branchId: "branch-A", firstName: "Ana", lastName: "Lopez" };
    const canonical = '{"branchId":"branch-A","firstName":"Ana","lastName":"Lopez"}';
    const hash = createHash("sha256").update(canonical).digest("hex");
    (prisma.apiIdempotencyRecord as unknown as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: "idem-1",
      payloadHash: hash,
      status: "COMPLETED",
      responseBody: { id: "p-original" },
      lockedUntil: new Date(Date.now() - 1000)
    });
    await expect(service.createPatient(client, payload, "request-123")).resolves.toEqual({ id: "p-original" });
    expect(patients.createPreparedPatientInTransaction).not.toHaveBeenCalled();
    expect(patients.finalizePatientCreation).not.toHaveBeenCalled();
  });

  it("rechaza una clave idempotente reutilizada con payload distinto", async () => {
    (prisma.apiIdempotencyRecord!.findUnique as jest.Mock).mockResolvedValue({
      id: "idem-1",
      payloadHash: "different-payload-hash",
      status: "COMPLETED",
      responseBody: { id: "p-original" },
      lockedUntil: new Date(Date.now() - 1000)
    });

    await expect(service.createPatient(client, { branchId: "branch-A", firstName: "Ana", lastName: "Lopez" }, "request-123"))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }) });
    expect(patients.createPreparedPatientInTransaction).not.toHaveBeenCalled();
  });

  it("responde como reintentable cuando la solicitud equivalente sigue en proceso", async () => {
    const payload = { branchId: "branch-A", firstName: "Ana", lastName: "Lopez" };
    const canonical = '{"branchId":"branch-A","firstName":"Ana","lastName":"Lopez"}';
    const hash = createHash("sha256").update(canonical).digest("hex");
    (prisma.apiIdempotencyRecord!.findUnique as jest.Mock).mockResolvedValue({
      id: "idem-1",
      payloadHash: hash,
      status: "PROCESSING",
      responseBody: null,
      lockedUntil: new Date(Date.now() + 10_000)
    });

    await expect(service.createPatient(client, payload, "request-123"))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "IDEMPOTENCY_IN_PROGRESS", retryable: true }) });
    expect(patients.createPreparedPatientInTransaction).not.toHaveBeenCalled();
  });

  it("does not replay a stale PROCESSING record whose business outcome is unknown", async () => {
    const payload = { branchId: "branch-A", firstName: "Ana", lastName: "Lopez" };
    const canonical = '{"branchId":"branch-A","firstName":"Ana","lastName":"Lopez"}';
    const hash = createHash("sha256").update(canonical).digest("hex");
    (prisma.apiIdempotencyRecord!.findUnique as jest.Mock).mockResolvedValue({
      id: "idem-stale",
      payloadHash: hash,
      status: "PROCESSING",
      responseBody: null,
      lockedUntil: new Date(Date.now() - 1_000)
    });

    await expect(service.createPatient(client, payload, "request-stale"))
      .rejects.toMatchObject({
        response: expect.objectContaining({ code: "IDEMPOTENCY_RESULT_UNCERTAIN", retryable: false })
      });
    expect(prisma.apiIdempotencyRecord!.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "UNCERTAIN" })
    }));
    expect(patients.createPreparedPatientInTransaction).not.toHaveBeenCalled();
  });
});
