import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CrmTasksController } from "./crm-tasks.controller";
import { CrmTasksService } from "./crm-tasks.service";

describe("CRM tasks API integration", () => {
  let app: INestApplication;
  const actor = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "CRM",
    roleIds: [],
    roleNames: [],
    permissions: ["organization.manage_all"],
    branchIds: ["branch-1"]
  };
  const service = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, overdueCount: 0, page: 1, pageSize: 25 }),
    get: jest.fn().mockResolvedValue({ id: "task-1", version: 1 }),
    history: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: "task-1", status: "PENDING", version: 1 }),
    update: jest.fn().mockResolvedValue({ id: "task-1", title: "Editada", version: 2 }),
    complete: jest.fn().mockResolvedValue({ id: "task-1", status: "COMPLETED", version: 2 }),
    reopen: jest.fn().mockResolvedValue({ id: "task-1", status: "PENDING", version: 3 }),
    cancel: jest.fn().mockResolvedValue({ id: "task-1", status: "CANCELLED", version: 2 }),
    statistics: jest.fn().mockResolvedValue({ total: 10, completed: 6, pending: 3, overdue: 1, cancelled: 1 }),
    getConfiguration: jest.fn().mockResolvedValue([]),
    updateConfiguration: jest.fn().mockResolvedValue([])
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CrmTasksController],
      providers: [{ provide: CrmTasksService, useValue: service }]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          context.switchToHttp().getRequest().user = actor;
          return true;
        }
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    actor.permissions = ["organization.manage_all"];
    jest.clearAllMocks();
  });

  afterAll(async () => app.close());

  it("CRM-API-001 lists branch-scoped tasks with server filters", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/crm/tasks?branchId=branch-1&date=2026-07-31&search=Silva&page=1&pageSize=25")
      .expect(200)
      .expect({ items: [], total: 0, overdueCount: 0, page: 1, pageSize: 25 });
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      expect.objectContaining({ branchId: "branch-1", date: "2026-07-31", search: "Silva" })
    );
  });

  it("CRM-API-002 rejects malformed date filters", () =>
    request(app.getHttpServer()).get("/api/v1/crm/tasks?branchId=branch-1&date=31-07-2026").expect(400));

  it("CRM-API-003 creates with a real idempotency header contract", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/crm/tasks")
      .set("Idempotency-Key", "crm-request-1")
      .send({
        branchId: "branch-1",
        patientId: "patient-1",
        type: "CITA",
        title: "Seguimiento",
        detail: "Llamar al paciente",
        dueAt: "2026-08-01T15:00:00.000Z"
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: "CITA" }), "crm-request-1");
  });

  it("CRM-API-004 exposes persisted detail and history", async () => {
    await request(app.getHttpServer()).get("/api/v1/crm/tasks/task-1").expect(200);
    await request(app.getHttpServer()).get("/api/v1/crm/tasks/task-1/history").expect(200);
    expect(service.get).toHaveBeenCalledWith(expect.anything(), "task-1");
    expect(service.history).toHaveBeenCalledWith(expect.anything(), "task-1");
  });

  it("CRM-API-005 updates using optimistic versioning", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/crm/tasks/task-1")
      .send({ title: "Editada", version: 1 })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(expect.anything(), "task-1", expect.objectContaining({ version: 1 }));
  });

  it("CRM-API-006 completes, reopens and cancels through separate state endpoints", async () => {
    await request(app.getHttpServer()).post("/api/v1/crm/tasks/task-1/complete").send({ version: 1 }).expect(201);
    await request(app.getHttpServer()).post("/api/v1/crm/tasks/task-1/reopen").send({ version: 2 }).expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/crm/tasks/task-1/cancel")
      .send({ version: 1, reason: "Paciente no requiere seguimiento" })
      .expect(201);
    expect(service.complete).toHaveBeenCalledWith(expect.anything(), "task-1", 1);
    expect(service.reopen).toHaveBeenCalledWith(expect.anything(), "task-1", 2);
    expect(service.cancel).toHaveBeenCalled();
  });

  it("CRM-API-007 validates cancellation reason in backend DTO", () =>
    request(app.getHttpServer()).post("/api/v1/crm/tasks/task-1/cancel").send({ version: 1, reason: "" }).expect(400));

  it("CRM-API-008 returns statistics from a dedicated endpoint", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/crm/tasks/statistics?branchId=branch-1&month=2026-07")
      .expect(200);
    expect(response.body).toMatchObject({ total: 10, completed: 6, overdue: 1 });
  });

  it("CRM-API-009 reads and persists all four deadline configurations", async () => {
    await request(app.getHttpServer()).get("/api/v1/crm/tasks/configuration?branchId=branch-1").expect(200);
    const items = ["COBRANZA", "CAPTURA", "CONTROL", "CITA"].map((type) => ({
      type,
      enabled: true,
      delayValue: 5,
      delayUnit: "DAYS"
    }));
    await request(app.getHttpServer())
      .put("/api/v1/crm/tasks/configuration")
      .send({ branchId: "branch-1", items })
      .expect(200);
    expect(service.updateConfiguration).toHaveBeenCalled();
  });

  it("CRM-API-010 rejects invalid custom deadlines", () => {
    const items = ["COBRANZA", "CAPTURA", "CONTROL", "CITA"].map((type) => ({
      type,
      enabled: true,
      delayValue: -1,
      delayUnit: "DAYS"
    }));
    return request(app.getHttpServer())
      .put("/api/v1/crm/tasks/configuration")
      .send({ branchId: "branch-1", items })
      .expect(400);
  });

  it("CRM-API-011 enforces permissions in backend even for direct requests", async () => {
    actor.permissions = [];
    await request(app.getHttpServer()).get("/api/v1/crm/tasks?branchId=branch-1").expect(403);
    expect(service.list).not.toHaveBeenCalled();
  });
});
