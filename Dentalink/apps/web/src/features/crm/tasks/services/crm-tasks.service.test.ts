import { http } from "@/lib/api/http-client";
import {
  cancelCrmTask,
  completeCrmTask,
  createCrmTask,
  getCrmTask,
  getCrmTaskConfiguration,
  getCrmTaskHistory,
  getCrmTaskStatistics,
  listCrmTasks,
  reopenCrmTask,
  updateCrmTask,
  updateCrmTaskConfiguration,
  zonedLocalToIso
} from "./crm-tasks.service";

vi.mock("@/lib/api/http-client", () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() }
}));

describe("CRM tasks HTTP contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue({ data: {} });
    vi.mocked(http.post).mockResolvedValue({ data: {} });
    vi.mocked(http.patch).mockResolvedValue({ data: {} });
    vi.mocked(http.put).mockResolvedValue({ data: {} });
  });

  it("CRM-WEB-001 sends branch, date, search and server pagination", async () => {
    const params = { branchId: "branch-1", date: "2026-07-31", search: "Silva", page: 2, pageSize: 25 };
    await listCrmTasks(params);
    expect(http.get).toHaveBeenCalledWith("/crm/tasks", { params });
  });

  it("CRM-WEB-002 uses backend overdue filter instead of local CSS logic", async () => {
    const params = { branchId: "branch-1", overdue: "true" as const, page: 1 };
    await listCrmTasks(params);
    expect(http.get).toHaveBeenCalledWith("/crm/tasks", { params });
  });

  it("CRM-WEB-003 creates with idempotency key", async () => {
    const payload = { branchId: "branch-1", patientId: "patient-1", type: "CITA" as const, title: "A", detail: "B" };
    await createCrmTask(payload, "request-1");
    expect(http.post).toHaveBeenCalledWith("/crm/tasks", payload, { headers: { "Idempotency-Key": "request-1" } });
  });

  it("CRM-WEB-004 reads detail and persisted history separately", async () => {
    await getCrmTask("task-1");
    await getCrmTaskHistory("task-1");
    expect(http.get).toHaveBeenNthCalledWith(1, "/crm/tasks/task-1");
    expect(http.get).toHaveBeenNthCalledWith(2, "/crm/tasks/task-1/history");
  });

  it("CRM-WEB-005 sends optimistic version on edit", async () => {
    await updateCrmTask("task-1", { title: "Editada", version: 4 });
    expect(http.patch).toHaveBeenCalledWith("/crm/tasks/task-1", { title: "Editada", version: 4 });
  });

  it("CRM-WEB-006 uses explicit complete, reopen and cancel state routes", async () => {
    await completeCrmTask("task-1", 1);
    await reopenCrmTask("task-1", 2);
    await cancelCrmTask("task-1", 3, "Duplicada");
    expect(http.post).toHaveBeenNthCalledWith(1, "/crm/tasks/task-1/complete", { version: 1 });
    expect(http.post).toHaveBeenNthCalledWith(2, "/crm/tasks/task-1/reopen", { version: 2 });
    expect(http.post).toHaveBeenNthCalledWith(3, "/crm/tasks/task-1/cancel", { version: 3, reason: "Duplicada" });
  });

  it("CRM-WEB-007 queries statistics by branch and real month", async () => {
    await getCrmTaskStatistics({ branchId: "branch-1", month: "2026-07" });
    expect(http.get).toHaveBeenCalledWith("/crm/tasks/statistics", {
      params: { branchId: "branch-1", month: "2026-07" }
    });
  });

  it("CRM-WEB-008 loads and saves configuration through backend", async () => {
    await getCrmTaskConfiguration("branch-1");
    const items = [
      { type: "CITA" as const, enabled: true, delayValue: 90, delayUnit: "DAYS" as const }
    ];
    await updateCrmTaskConfiguration("branch-1", items);
    expect(http.get).toHaveBeenCalledWith("/crm/tasks/configuration", { params: { branchId: "branch-1" } });
    expect(http.put).toHaveBeenCalledWith("/crm/tasks/configuration", { branchId: "branch-1", items });
  });

  it("CRM-WEB-009 converts branch-local time without UTC date drift", () => {
    expect(zonedLocalToIso("2026-07-31", "09:00", "America/Mexico_City")).toBe("2026-07-31T15:00:00.000Z");
  });

  it("CRM-WEB-010 respects daylight-saving timezone offsets", () => {
    expect(zonedLocalToIso("2026-07-31", "09:00", "America/New_York")).toBe("2026-07-31T13:00:00.000Z");
  });
});
