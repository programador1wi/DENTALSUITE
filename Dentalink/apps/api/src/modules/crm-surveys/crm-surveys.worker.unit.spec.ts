import "reflect-metadata";
import { SurveyDeliveryEventType, SurveyInvitationStatus } from "@prisma/client";
import { CrmSurveysWorker } from "./crm-surveys.worker";

type WorkerInternals = {
  claimNextInvitation(): Promise<{ id: string } | null>;
  reconcileExpiredLeases(): Promise<void>;
  insideSendWindow(start: string, end: string, timezone: string): boolean;
};

function candidate(id: string, attempts = 0, maxRetries = 3) {
  return {
    id,
    organizationId: "org-1",
    branchId: "branch-1",
    status: SurveyInvitationStatus.CREATED,
    attempts,
    lastError: null,
    survey: {
      sendConfiguration: {
        isActive: true,
        maxRetries,
        sendWindowStart: "08:00",
        sendWindowEnd: "20:00"
      }
    }
  };
}

function createWorker(prisma: Record<string, unknown>) {
  const config = {
    get: jest.fn((key: string) => (key === "SURVEY_WORKER_LEASE_MS" ? "120000" : undefined))
  };
  return new CrmSurveysWorker(prisma as never, {} as never, {} as never, config as never);
}

describe("CrmSurveysWorker durable claims", () => {
  it("defers an invitation outside its window and claims the next executable one", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      surveyInvitation: {
        findMany: jest.fn().mockResolvedValue([candidate("outside"), candidate("ready")]),
        updateMany
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: "branch-1", organizationId: "org-1", timezone: "America/Mexico_City" }
        ])
      }
    };
    const worker = createWorker(prisma);
    jest.spyOn(worker as unknown as WorkerInternals, "insideSendWindow")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await expect((worker as unknown as WorkerInternals).claimNextInvitation()).resolves.toEqual({ id: "ready" });
    expect(updateMany.mock.calls[0][0].data.nextAttemptAt).toBeInstanceOf(Date);
    expect(updateMany.mock.calls[1][0]).toMatchObject({
      where: { id: "ready", status: SurveyInvitationStatus.CREATED, terminalAt: null },
      data: {
        status: SurveyInvitationStatus.PROCESSING,
        attempts: { increment: 1 }
      }
    });
  });

  it("marks exhausted attempts terminal and continues to another invitation", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      surveyInvitation: {
        findMany: jest.fn().mockResolvedValue([candidate("exhausted", 3, 3), candidate("ready")]),
        updateMany
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: "branch-1", organizationId: "org-1", timezone: "America/Mexico_City" }
        ])
      }
    };
    const worker = createWorker(prisma);
    jest.spyOn(worker as unknown as WorkerInternals, "insideSendWindow").mockReturnValue(true);

    await expect((worker as unknown as WorkerInternals).claimNextInvitation()).resolves.toEqual({ id: "ready" });
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "exhausted", terminalAt: null },
      data: { status: SurveyInvitationStatus.FAILED, nextAttemptAt: null }
    });
    expect(updateMany.mock.calls[0][0].data.terminalAt).toBeInstanceOf(Date);
  });

  it("allows only one worker to acquire the same invitation", async () => {
    const updateMany = jest.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const prisma = {
      surveyInvitation: {
        findMany: jest.fn().mockResolvedValue([candidate("shared")]),
        updateMany
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: "branch-1", organizationId: "org-1", timezone: "America/Mexico_City" }
        ])
      }
    };
    const first = createWorker(prisma);
    const second = createWorker(prisma);
    jest.spyOn(first as unknown as WorkerInternals, "insideSendWindow").mockReturnValue(true);
    jest.spyOn(second as unknown as WorkerInternals, "insideSendWindow").mockReturnValue(true);

    await expect((first as unknown as WorkerInternals).claimNextInvitation()).resolves.toEqual({ id: "shared" });
    await expect((second as unknown as WorkerInternals).claimNextInvitation()).resolves.toBeNull();
  });

  it("moves an expired processing lease to UNCERTAIN without scheduling a retry", async () => {
    const transaction = jest.fn();
    const prismaCore = {
      surveyInvitation: {
        findMany: jest.fn().mockResolvedValue([
          { id: "leased", organizationId: "org-1", branchId: "branch-1" }
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      surveyDeliveryEvent: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = { ...prismaCore, $transaction: transaction };
    transaction.mockImplementation(async (operation: (tx: typeof prismaCore) => Promise<void>) => operation(prismaCore));
    const worker = createWorker(prisma);

    await (worker as unknown as WorkerInternals).reconcileExpiredLeases();

    expect(prisma.surveyInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: SurveyInvitationStatus.UNCERTAIN,
        nextAttemptAt: null,
        leaseOwner: null
      })
    }));
    expect(prisma.surveyDeliveryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: SurveyDeliveryEventType.UNCERTAIN,
        payloadJson: { reason: "LEASE_EXPIRED", retry: false }
      })
    });
  });
});
