import { ConflictException, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, CrmTaskDelayUnit, CrmTaskOrigin, CrmTaskPriority, PatientTaskStatus, Prisma } from "@prisma/client";
import { CrmTasksService } from "./crm-tasks.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "CRM",
  roleIds: [],
  roleNames: [],
  permissions: ["system.manage_all"],
  branchIds: ["branch-1"]
};

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    organizationId: "org-1",
    branchId: "branch-1",
    patientId: "patient-1",
    type: "CITA",
    title: "Seguimiento",
    detail: "Llamar",
    dueDate: new Date("2026-08-01T15:00:00.000Z"),
    priority: CrmTaskPriority.NORMAL,
    origin: CrmTaskOrigin.MANUAL,
    assignedToId: null,
    createdById: "user-1",
    status: PatientTaskStatus.PENDING,
    completedAt: null,
    completedById: null,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    version: 1,
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    updatedAt: new Date("2026-08-01T12:00:00.000Z"),
    patient: { id: "patient-1", firstName: "Ana", lastName: "Silva", branchId: "branch-1" },
    branch: { id: "branch-1", name: "Centro", timezone: "America/Mexico_City" },
    createdBy: { id: "user-1", firstName: "Admin", lastName: "CRM", email: "admin@example.com" },
    assignedTo: null,
    completedBy: null,
    cancelledBy: null,
    ...overrides
  };
}

describe("CrmTasksService", () => {
  const prisma = {
    branch: { findFirst: jest.fn() },
    patient: { findFirst: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    patientTask: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn()
    },
    crmTaskHistory: { findMany: jest.fn(), create: jest.fn() },
    crmTaskConfiguration: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    appointment: { findUnique: jest.fn(), count: jest.fn() },
    treatmentPlanItem: { findUnique: jest.fn() },
    budget: { findUnique: jest.fn() },
    $transaction: jest.fn()
  };
  let service: CrmTasksService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.branch.findFirst.mockResolvedValue({ id: "branch-1", timezone: "America/Mexico_City" });
    prisma.patient.findFirst.mockResolvedValue({ id: "patient-1" });
    prisma.user.findFirst.mockResolvedValue({ id: "user-2" });
    prisma.crmTaskHistory.create.mockResolvedValue({ id: "history-1" });
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (client: typeof prisma) => unknown)(prisma);
    });
    service = new CrmTasksService(prisma as never);
  });

  it("CRM-SVC-001 applies branch, date, search and pagination in PostgreSQL query", async () => {
    prisma.patientTask.findMany.mockResolvedValue([]);
    prisma.patientTask.count.mockResolvedValue(0);
    await service.list(actor, {
      branchId: "branch-1",
      date: "2026-07-31",
      search: "Silva",
      page: 2,
      pageSize: 25,
      sortBy: "dueDate",
      sortOrder: "asc"
    });
    expect(prisma.patientTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
        where: expect.objectContaining({ organizationId: "org-1", branchId: "branch-1", OR: expect.any(Array) })
      })
    );
    const where = prisma.patientTask.findMany.mock.calls[0][0].where;
    expect(where.dueDate.gte.toISOString()).toBe("2026-07-31T06:00:00.000Z");
    expect(where.dueDate.lt.toISOString()).toBe("2026-08-01T06:00:00.000Z");
  });

  it("CRM-SVC-002 calculates overdue in backend independently of page size", async () => {
    prisma.patientTask.findMany.mockResolvedValue([]);
    prisma.patientTask.count.mockResolvedValueOnce(25).mockResolvedValueOnce(427);
    const result = await service.list(actor, {
      branchId: "branch-1",
      overdue: "true",
      page: 1,
      pageSize: 25,
      sortBy: "dueDate",
      sortOrder: "asc"
    });
    expect(result).toMatchObject({ total: 25, overdueCount: 427 });
    expect(prisma.patientTask.findMany.mock.calls[0][0].where).toMatchObject({ status: "PENDING" });
  });

  it("CRM-SVC-003 rejects task reads outside actor branches without leaking data", async () => {
    prisma.patientTask.findFirst.mockResolvedValue(null);
    await expect(service.get(actor, "foreign-task")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.patientTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ branchId: { in: ["branch-1"] } }) })
    );
  });

  it("CRM-SVC-004 persists manual task and history atomically", async () => {
    const created = task();
    prisma.patientTask.create.mockResolvedValue(created);
    const result = await service.create(
      actor,
      {
        branchId: "branch-1",
        patientId: "patient-1",
        type: "CITA",
        title: " Seguimiento ",
        detail: " Llamar ",
        dueAt: "2026-08-01T15:00:00.000Z",
        priority: CrmTaskPriority.NORMAL
      },
      "request-1"
    );
    expect(result.id).toBe("task-1");
    expect(prisma.patientTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: "branch-1", title: "Seguimiento", idempotencyKey: "request-1" }) })
    );
    expect(prisma.crmTaskHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taskId: "task-1", action: "CREATED" }) })
    );
  });

  it("CRM-SVC-005 returns existing task for repeated idempotency key", async () => {
    prisma.patientTask.findUnique.mockResolvedValue(task());
    const result = await service.create(
      actor,
      { branchId: "branch-1", patientId: "patient-1", type: "CITA", title: "A", detail: "B", priority: CrmTaskPriority.NORMAL },
      "request-1"
    );
    expect(result.id).toBe("task-1");
    expect(prisma.patientTask.create).not.toHaveBeenCalled();
  });

  it("CRM-SVC-006 completes with optimistic locking and writes history", async () => {
    prisma.patientTask.findFirst.mockResolvedValue(task());
    prisma.patientTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.patientTask.findUniqueOrThrow.mockResolvedValue(
      task({ status: PatientTaskStatus.COMPLETED, completedAt: new Date(), completedById: "user-1", version: 2 })
    );
    const result = await service.complete(actor, "task-1", 1);
    expect(result.status).toBe(PatientTaskStatus.COMPLETED);
    expect(prisma.patientTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ version: 1, status: "PENDING" }) })
    );
    expect(prisma.crmTaskHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "COMPLETED" }) })
    );
  });

  it("CRM-SVC-007 rejects stale concurrent updates", async () => {
    prisma.patientTask.findFirst.mockResolvedValue(task());
    prisma.patientTask.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update(actor, "task-1", { title: "Cambio", version: 1 })).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("CRM-SVC-008 calculates controlled statistics with cancelled tasks excluded from rate", async () => {
    prisma.patientTask.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.patientTask.groupBy.mockResolvedValueOnce([{ type: "CITA", _count: { _all: 10 } }]).mockResolvedValueOnce([]);
    prisma.user.findMany.mockResolvedValue([]);
    const result = await service.statistics(actor, { branchId: "branch-1" });
    expect(result).toMatchObject({ total: 10, completed: 6, pending: 3, cancelled: 1, overdue: 1, completionRate: 66.67 });
    expect(result.metricDefinition).toBe("completed / (total - cancelled) * 100");
  });

  it("CRM-SVC-009 refuses incomplete or duplicated automatic configuration", async () => {
    await expect(
      service.updateConfiguration(actor, {
        branchId: "branch-1",
        items: [
          { type: "CITA", enabled: true, delayValue: 1, delayUnit: CrmTaskDelayUnit.DAYS },
          { type: "CITA", enabled: true, delayValue: 2, delayUnit: CrmTaskDelayUnit.DAYS },
          { type: "CONTROL", enabled: true, delayValue: 3, delayUnit: CrmTaskDelayUnit.DAYS },
          { type: "CAPTURA", enabled: true, delayValue: 4, delayUnit: CrmTaskDelayUnit.DAYS }
        ]
      })
    ).rejects.toThrow("exactly once");
  });

  it("CRM-SVC-010 does not create appointment follow-up when a future appointment exists", async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: "appointment-1",
      organizationId: "org-1",
      branchId: "branch-1",
      patientId: "patient-1",
      startAt: new Date(),
      createdById: "user-1",
      updatedById: "user-1"
    });
    prisma.appointment.count.mockResolvedValue(1);
    const result = await service.handleAppointmentStatusChanged("appointment-1", AppointmentStatus.NO_SHOW);
    expect(result).toBeNull();
    expect(prisma.patientTask.create).not.toHaveBeenCalled();
  });

  it("CRM-SVC-011 creates one idempotent appointment follow-up when no future appointment exists", async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: "appointment-1",
      organizationId: "org-1",
      branchId: "branch-1",
      patientId: "patient-1",
      startAt: new Date("2026-08-01T15:00:00.000Z"),
      createdById: "user-1",
      updatedById: "user-1"
    });
    prisma.appointment.count.mockResolvedValue(0);
    prisma.crmTaskConfiguration.findUnique.mockResolvedValue(null);
    prisma.patientTask.create.mockResolvedValue(task({ origin: CrmTaskOrigin.AUTOMATIC }));
    await service.handleAppointmentStatusChanged("appointment-1", AppointmentStatus.NO_SHOW);
    expect(prisma.patientTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CITA",
          sourceType: "APPOINTMENT",
          sourceId: "appointment-1",
          trigger: "NO_SHOW",
          origin: "AUTOMATIC"
        })
      })
    );
  });

  it("CRM-SVC-012 treats unique constraint race as idempotent success", async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: "appointment-1",
      organizationId: "org-1",
      branchId: "branch-1",
      patientId: "patient-1",
      startAt: new Date(),
      createdById: "user-1",
      updatedById: "user-1"
    });
    prisma.appointment.count.mockResolvedValue(0);
    prisma.crmTaskConfiguration.findUnique.mockResolvedValue(null);
    prisma.patientTask.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "7.8.0" })
    );
    prisma.patientTask.findFirst.mockResolvedValue(task({ origin: CrmTaskOrigin.AUTOMATIC }));
    const result = await service.handleAppointmentStatusChanged("appointment-1", AppointmentStatus.NO_SHOW);
    expect(result?.id).toBe("task-1");
  });

  it("CRM-SVC-013 creates CAPTURA from a draft treatment item using configured delay and assignee", async () => {
    prisma.treatmentPlanItem.findUnique.mockResolvedValue({
      id: "item-1",
      treatmentPlan: {
        organizationId: "org-1",
        branchId: "branch-1",
        patientId: "patient-1",
        status: "DRAFT"
      },
      procedure: { name: "Corona" },
      createdAt: new Date("2026-08-01T12:00:00.000Z")
    });
    prisma.crmTaskConfiguration.findUnique.mockResolvedValue({
      enabled: true,
      delayValue: 2,
      delayUnit: CrmTaskDelayUnit.WEEKS,
      defaultAssignedToId: "user-2"
    });
    prisma.patientTask.create.mockImplementation(({ data }) => Promise.resolve({ id: "capture-1", ...data }));

    await service.handleTreatmentItemAdded("item-1", "user-1");

    expect(prisma.patientTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CAPTURA",
          sourceType: "TREATMENT_PLAN_ITEM",
          sourceId: "item-1",
          assignedToId: "user-2",
          dueDate: new Date("2026-08-15T12:00:00.000Z")
        })
      })
    );
  });

  it("CRM-SVC-014 creates CONTROL and COBRANZA for an accepted budget with outstanding debt", async () => {
    prisma.budget.findUnique.mockResolvedValue({
      id: "budget-1",
      organizationId: "org-1",
      patientId: "patient-1",
      total: 1000,
      acceptedAt: new Date("2026-08-01T12:00:00.000Z"),
      status: "ACCEPTED",
      treatmentPlan: { branchId: "branch-1" },
      items: [
        {
          treatmentPlanItem: {
            paymentAllocations: [{ amount: 250, settlementDiscountAmount: 50 }]
          }
        }
      ]
    });
    prisma.crmTaskConfiguration.findUnique.mockResolvedValue(null);
    prisma.patientTask.create.mockImplementation(({ data }) => Promise.resolve({ id: `${data.type}-1`, ...data }));

    const result = await service.handleBudgetAccepted("budget-1", "user-1");

    expect(result).toHaveLength(2);
    expect(prisma.patientTask.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ type: "CONTROL", sourceId: "budget-1" }) })
    );
    expect(prisma.patientTask.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          type: "COBRANZA",
          sourceId: "budget-1",
          detail: "Saldo pendiente al aceptar presupuesto: 700.00."
        })
      })
    );
  });

  it("CRM-SVC-015 omits COBRANZA when an accepted budget is fully covered", async () => {
    prisma.budget.findUnique.mockResolvedValue({
      id: "budget-paid",
      organizationId: "org-1",
      patientId: "patient-1",
      total: 1000,
      acceptedAt: new Date("2026-08-01T12:00:00.000Z"),
      status: "ACCEPTED",
      treatmentPlan: { branchId: "branch-1" },
      items: [
        {
          treatmentPlanItem: {
            paymentAllocations: [{ amount: 1000, settlementDiscountAmount: 0 }]
          }
        }
      ]
    });
    prisma.crmTaskConfiguration.findUnique.mockResolvedValue(null);
    prisma.patientTask.create.mockImplementation(({ data }) => Promise.resolve({ id: `${data.type}-1`, ...data }));

    const result = await service.handleBudgetAccepted("budget-paid", "user-1");

    expect(result).toHaveLength(1);
    expect(prisma.patientTask.create).toHaveBeenCalledTimes(1);
    expect(prisma.patientTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "CONTROL" }) })
    );
  });

  it("CRM-SVC-016 applies changed deadline configuration only to future automatic tasks", async () => {
    prisma.appointment.findUnique
      .mockResolvedValueOnce({
        id: "appointment-5-days",
        organizationId: "org-1",
        branchId: "branch-1",
        patientId: "patient-1",
        startAt: new Date("2026-08-01T12:00:00.000Z"),
        createdById: "user-1",
        updatedById: "user-1"
      })
      .mockResolvedValueOnce({
        id: "appointment-10-days",
        organizationId: "org-1",
        branchId: "branch-1",
        patientId: "patient-1",
        startAt: new Date("2026-08-01T12:00:00.000Z"),
        createdById: "user-1",
        updatedById: "user-1"
      });
    prisma.appointment.count.mockResolvedValue(0);
    prisma.crmTaskConfiguration.findUnique
      .mockResolvedValueOnce({ enabled: true, delayValue: 5, delayUnit: CrmTaskDelayUnit.DAYS, defaultAssignedToId: null })
      .mockResolvedValueOnce({ enabled: true, delayValue: 10, delayUnit: CrmTaskDelayUnit.DAYS, defaultAssignedToId: null });
    prisma.patientTask.create.mockImplementation(({ data }) => Promise.resolve({ id: data.sourceId, ...data }));

    await service.handleAppointmentStatusChanged("appointment-5-days", AppointmentStatus.NO_SHOW);
    await service.handleAppointmentStatusChanged("appointment-10-days", AppointmentStatus.NO_SHOW);

    expect(prisma.patientTask.create.mock.calls[0][0].data.dueDate.toISOString()).toBe("2026-08-06T12:00:00.000Z");
    expect(prisma.patientTask.create.mock.calls[1][0].data.dueDate.toISOString()).toBe("2026-08-11T12:00:00.000Z");
  });

  it("CRM-SVC-017 honors disabled automatic configuration and ignores non-trigger statuses", async () => {
    await service.handleAppointmentStatusChanged("appointment-1", AppointmentStatus.COMPLETED);
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();

    prisma.appointment.findUnique.mockResolvedValue({
      id: "appointment-1",
      organizationId: "org-1",
      branchId: "branch-1",
      patientId: "patient-1",
      startAt: new Date("2026-08-01T12:00:00.000Z"),
      createdById: "user-1",
      updatedById: "user-1"
    });
    prisma.appointment.count.mockResolvedValue(0);
    prisma.crmTaskConfiguration.findUnique.mockResolvedValue({
      enabled: false,
      delayValue: 90,
      delayUnit: CrmTaskDelayUnit.DAYS,
      defaultAssignedToId: null
    });

    await service.handleAppointmentStatusChanged("appointment-1", AppointmentStatus.NO_SHOW);
    expect(prisma.patientTask.create).not.toHaveBeenCalled();
  });
});
