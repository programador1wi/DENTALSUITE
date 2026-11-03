import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { ReportRequestStatus } from "@prisma/client";
import { ReportWorkerService } from "./report-worker.service";

const request = {
  id: "report-1",
  organizationId: "org-1",
  requestedById: "user-1",
  resolvedBranchIds: ["branch-1"],
  surface: "REQUEST",
  format: "xlsx",
  reportCode: "APPOINTMENTS_SUMMARY",
  parametersJson: {},
  branchWindowsJson: [],
  status: ReportRequestStatus.PROCESSING,
  attempts: 1
};

const user = {
  id: "user-1",
  organizationId: "org-1",
  organization: { name: "Clinic" },
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  phone: null,
  avatarUrl: null,
  isActive: true,
  status: "ACTIVE",
  deletedAt: null,
  role: null,
  roles: [],
  permissions: [],
  branches: [{ branchId: "branch-1", isPrimary: true, branch: { id: "branch-1", name: "Main", code: "MAIN" } }]
};

function fixture() {
  const reportRequest = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockImplementation(({ select }: { select?: { attempts?: boolean } }) =>
      Promise.resolve(select ? { attempts: 1 } : request)
    )
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "report-1" }]),
    reportRequest,
    user: { findUnique: jest.fn().mockResolvedValue(user) }
  };
  const reports = {
    createExcelRequest: jest.fn().mockResolvedValue({
      file: { base64: Buffer.from("xlsx").toString("base64"), fileName: "report.xlsx", mimeType: "application/xlsx" },
      fileName: "report.xlsx",
      mimeType: "application/xlsx",
      rowCount: 42,
      errorMessage: null
    })
  };
  const storage = {
    store: jest.fn().mockResolvedValue({ storageKey: "reports/org/report/file.enc", checksum: "abc", fileSize: 4 }),
    storeFile: jest.fn().mockResolvedValue({ storageKey: "reports/org/report/stream.enc", checksum: "def", fileSize: 400 }),
    remove: jest.fn(),
    read: jest.fn()
  };
  const periodProvider = { iterateRows: jest.fn().mockReturnValue((async function* () { yield { id: "patient-1" }; })()) };
  const streamingExport = {
    create: jest.fn().mockResolvedValue({
      path: "C:\\temp\\report.csv",
      fileName: "report.csv",
      mimeType: "text/csv; charset=utf-8",
      rowCount: 50_001,
      cleanup: jest.fn().mockResolvedValue(undefined)
    })
  };
  const worker = new ReportWorkerService(
    prisma as never,
    reports as never,
    storage as never,
    new ConfigService({ REPORT_WORKER_LEASE_MS: "15000" }),
    periodProvider as never,
    streamingExport as never
  );
  return { worker, prisma, reportRequest, reports, storage, periodProvider, streamingExport };
}

describe("ReportWorkerService leases", () => {
  it("finalizes only with its lease owner and publishes progress", async () => {
    const { worker, reportRequest } = fixture();
    await (worker as unknown as { process(id: string): Promise<void> }).process("report-1");

    const completion = reportRequest.updateMany.mock.calls.find(([call]) => call?.data?.status === ReportRequestStatus.COMPLETED)?.[0];
    expect(completion.where).toMatchObject({
      id: "report-1",
      status: ReportRequestStatus.PROCESSING,
      leaseOwner: expect.any(String)
    });
    expect(completion.data).toMatchObject({
      status: ReportRequestStatus.COMPLETED,
      progressRows: 42,
      progressPercent: 100,
      leaseOwner: null
    });
  });

  it("two workers sharing the queue generate a claimed request only once", async () => {
    const first = fixture();
    const second = fixture();
    const sharedClaim = jest.fn()
      .mockResolvedValueOnce([{ id: "report-1" }])
      .mockResolvedValueOnce([]);
    first.prisma.$queryRaw = sharedClaim;
    second.prisma.$queryRaw = sharedClaim;

    await Promise.all([first.worker.tick(), second.worker.tick()]);

    expect(first.reports.createExcelRequest.mock.calls.length + second.reports.createExcelRequest.mock.calls.length).toBe(1);
    const sql = sharedClaim.mock.calls[0][0].join(" ");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain('"leaseOwner"');
  });

  it("routes generic period reports through streaming generation and file storage", async () => {
    const fixtureValue = fixture();
    fixtureValue.reportRequest.findFirst.mockImplementation(({ select }: { select?: { attempts?: boolean } }) =>
      Promise.resolve(select ? { attempts: 1 } : { ...request, reportCode: "NEW_PATIENTS_REGISTERED", format: "csv" })
    );

    await (fixtureValue.worker as unknown as { process(id: string): Promise<void> }).process("report-1");

    expect(fixtureValue.periodProvider.iterateRows).toHaveBeenCalledTimes(1);
    expect(fixtureValue.streamingExport.create).toHaveBeenCalledWith(expect.objectContaining({
      format: "csv",
      rows: expect.anything()
    }));
    expect(fixtureValue.storage.storeFile).toHaveBeenCalledWith("org-1", "report-1", "C:\\temp\\report.csv");
    expect(fixtureValue.reports.createExcelRequest).not.toHaveBeenCalled();
  });
});
