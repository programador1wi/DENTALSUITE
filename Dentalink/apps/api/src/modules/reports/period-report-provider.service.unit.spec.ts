import "reflect-metadata";
import type { AuthUser } from "../../common/types/auth-user";
import { ReportExportFormat } from "./dto/reports.dto";
import { PeriodReportProviderService } from "./period-report-provider.service";

const actor: AuthUser = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "User",
  roleIds: [],
  roleNames: [],
  permissions: [],
  branchIds: ["branch-1"]
};

const definition = {
  code: "NEW_PATIENTS_REGISTERED",
  id: "new-patients",
  name: "New patients"
};

describe("PeriodReportProviderService", () => {
  it("iterates with an id cursor and a deterministic date/id order", async () => {
    const findMany = jest.fn()
      .mockResolvedValueOnce([
        { id: "patient-1", createdAt: new Date("2026-01-01T00:00:00Z"), name: "A" },
        { id: "patient-2", createdAt: new Date("2026-01-01T00:00:00Z"), name: "B" }
      ])
      .mockResolvedValueOnce([
        { id: "patient-3", createdAt: new Date("2026-01-02T00:00:00Z"), name: "C" }
      ]);
    const service = new PeriodReportProviderService({ patient: { findMany } } as never);
    Object.defineProperty(service, "batchSize", { value: 2 });

    const rows = [];
    for await (const row of service.iterateRows(definition as never, actor, {
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01"
    })) rows.push(row);

    expect(rows).toHaveLength(3);
    expect(findMany.mock.calls[0][0]).not.toHaveProperty("skip");
    expect(findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: "patient-2" }, skip: 1 });
  });

  it("fails XLSX explicitly at its row limit but lets CSV continue", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: "patient-1", createdAt: new Date(), name: "A" },
      { id: "patient-2", createdAt: new Date(), name: "B" }
    ]);
    const service = new PeriodReportProviderService({ patient: { findMany } } as never);
    Object.defineProperty(service, "batchSize", { value: 3 });
    Object.defineProperty(service, "maxXlsxRows", { value: 1 });

    await expect(service.rows(definition as never, actor, {}, ReportExportFormat.XLSX)).rejects.toThrow("LIMIT_EXCEEDED");
    await expect(service.rows(definition as never, actor, {}, ReportExportFormat.CSV)).resolves.toHaveLength(2);
  });
});
