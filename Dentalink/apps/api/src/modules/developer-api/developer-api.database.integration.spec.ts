import "reflect-metadata";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { Pool } from "pg";
import { assertTestDatabase } from "../../test/assert-test-database";
import type { AuthM2MClient } from "../../common/types/m2m-client.type";
import { DeveloperApiService } from "./developer-api.service";

describe("Developer API transactional idempotency", () => {
  const databaseUrl = assertTestDatabase(process.env.SECURITY_TEST_DATABASE_URL ?? process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const apiKeyId = "security-developer-api-key";
  const marker = "DEV-IDEMPOTENCY-SECURITY-TEST";
  const client: AuthM2MClient = {
    actorType: "API_KEY",
    apiKeyId,
    organizationId: "security-org-a",
    scopes: ["patients:write"],
    plan: "STANDARD",
    requestsPerMinute: 60,
    branchScope: "SELECTED",
    branchIds: ["security-org-a-branch-1"],
    networkScope: "ANY",
    name: "Integration test",
    keyPrefix: "dsk_test_transaction",
    clientIp: "127.0.0.1"
  };

  beforeAll(async () => {
    await prisma.apiKey.upsert({
      where: { id: apiKeyId },
      update: { status: "ACTIVE", branchIds: client.branchIds },
      create: {
        id: apiKeyId,
        organizationId: client.organizationId,
        name: "Developer API transactional test",
        scopes: client.scopes,
        status: "ACTIVE",
        branchScope: "SELECTED",
        branchIds: client.branchIds,
        networkScope: "ANY"
      }
    });
  });

  beforeEach(async () => {
    await prisma.apiIdempotencyRecord.deleteMany({ where: { apiKeyId } });
    await prisma.patient.deleteMany({
      where: { organizationId: client.organizationId, documentNumber: { startsWith: marker } }
    });
  });

  afterAll(async () => {
    await prisma.apiKey.deleteMany({ where: { id: apiKeyId } });
    await prisma.patient.deleteMany({
      where: { organizationId: client.organizationId, documentNumber: { startsWith: marker } }
    });
    await prisma.$disconnect();
    await pool.end();
  });

  function service(failAfterPatient = false) {
    const patients = {
      preparePatientForCreate: jest.fn().mockResolvedValue({ potentialDuplicates: [] }),
      createPreparedPatientInTransaction: jest.fn(
        async (tx: Prisma.TransactionClient, _actor: unknown, dto: { branchId: string; firstName: string; lastName: string; documentNumber?: string }) => {
          const created = await tx.patient.create({
            data: {
              organizationId: client.organizationId,
              branchId: dto.branchId,
              firstName: dto.firstName,
              lastName: dto.lastName,
              documentNumber: dto.documentNumber,
              source: "DEVELOPER_API"
            }
          });
          if (failAfterPatient) throw new Error("FORCED_ROLLBACK_AFTER_PATIENT");
          return created;
        }
      ),
      finalizePatientCreation: jest.fn().mockResolvedValue(undefined)
    };
    return {
      patients,
      service: new DeveloperApiService(
        prisma as never,
        patients as never,
        {} as never,
        { assertRequiredFields: jest.fn().mockResolvedValue(undefined) } as never,
        {} as never
      )
    };
  }

  it("returns one committed patient for two concurrent requests with the same key", async () => {
    const fixture = service();
    const dto = {
      branchId: "security-org-a-branch-1",
      firstName: "Atomic",
      lastName: "Patient",
      documentNumber: `${marker}-ONE`
    };

    const [first, second] = await Promise.all([
      fixture.service.createPatient(client, dto, "concurrent-request-atomic"),
      fixture.service.createPatient(client, dto, "concurrent-request-atomic")
    ]);

    expect(first.id).toBe(second.id);
    await expect(prisma.patient.count({ where: { documentNumber: dto.documentNumber } })).resolves.toBe(1);
    await expect(prisma.apiIdempotencyRecord.findUniqueOrThrow({
      where: {
        apiKeyId_operation_idempotencyKey: {
          apiKeyId,
          operation: "patients.create",
          idempotencyKey: "concurrent-request-atomic"
        }
      },
      select: { status: true, responseBody: true }
    })).resolves.toMatchObject({ status: "COMPLETED", responseBody: expect.objectContaining({ id: first.id }) });
    expect(fixture.patients.createPreparedPatientInTransaction).toHaveBeenCalledTimes(1);
  });

  it("rolls back both patient and idempotency record when business creation fails", async () => {
    const fixture = service(true);
    const dto = {
      branchId: "security-org-a-branch-1",
      firstName: "Rollback",
      lastName: "Patient",
      documentNumber: `${marker}-ROLLBACK`
    };

    await expect(
      fixture.service.createPatient(client, dto, "rollback-request-atomic")
    ).rejects.toThrow("FORCED_ROLLBACK_AFTER_PATIENT");

    await expect(prisma.patient.count({ where: { documentNumber: dto.documentNumber } })).resolves.toBe(0);
    await expect(prisma.apiIdempotencyRecord.count({
      where: { apiKeyId, operation: "patients.create", idempotencyKey: "rollback-request-atomic" }
    })).resolves.toBe(0);
  });
});
