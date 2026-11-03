import {
  AppointmentStatus,
  TreatmentPlanItemStatus
} from "@prisma/client";
import type { AuthUser } from "../../common/types/auth-user";
import {
  isAcceptedTreatmentItem,
  isConfirmedFromHistory,
  normalizePatientAnalyticsDetailMetric,
  percentage
} from "./patient-analytics.metric-definition";
import { PatientAnalyticsService } from "./patient-analytics.service";

describe("patient analytics metric definitions", () => {
  it("preserves full precision and produces the required 1327/719/89 example", () => {
    expect(percentage(719, 1327)).toBeCloseTo(54.1823662396, 8);
    expect(percentage(89, 1327)).toBeCloseTo(6.7068575735, 8);
    expect(percentage(89, 719)).toBeCloseTo(12.3783031989, 8);
    expect(Math.round(percentage(719, 1327))).toBe(54);
    expect(Math.round(percentage(89, 1327))).toBe(7);
  });

  it.each([
    ["totalPatients", "patients"],
    ["averageAttendance", "attendance"],
    ["accumulatedDebt", "debt"],
    ["pendingBudgets", "pending-budgets"],
    ["confirmed", "confirmed"]
  ])("normalizes dashboard metric %s to detail metric %s", (input, expected) => {
    expect(normalizePatientAnalyticsDetailMetric(input)).toBe(expected);
  });

  it("uses status history when a confirmed appointment is later cancelled", () => {
    const cutoffAt = new Date("2026-07-28T12:00:00.000Z");
    expect(
      isConfirmedFromHistory({
        status: AppointmentStatus.CANCELLED_BY_PATIENT,
        cutoffAt,
        history: [
          {
            newStatus: AppointmentStatus.CONFIRMED_BY_WHATSAPP,
            createdAt: new Date("2026-07-20T10:00:00.000Z")
          },
          {
            newStatus: AppointmentStatus.CANCELLED_BY_PATIENT,
            createdAt: new Date("2026-07-21T10:00:00.000Z")
          }
        ]
      })
    ).toBe(true);
  });

  it("does not use confirmation events after the report cutoff", () => {
    expect(
      isConfirmedFromHistory({
        status: AppointmentStatus.SCHEDULED,
        cutoffAt: new Date("2026-07-20T00:00:00.000Z"),
        history: [
          {
            newStatus: AppointmentStatus.CONFIRMED,
            createdAt: new Date("2026-07-21T00:00:00.000Z")
          }
        ]
      })
    ).toBe(false);
  });

  it("accepts only a completed 100 percent treatment item at the cutoff", () => {
    const cutoffAt = new Date("2026-07-28T12:00:00.000Z");
    expect(
      isAcceptedTreatmentItem(
        {
          status: TreatmentPlanItemStatus.COMPLETED,
          completionPercentage: 100,
          completedAt: new Date("2026-07-25T12:00:00.000Z")
        },
        cutoffAt
      )
    ).toBe(true);
    expect(
      isAcceptedTreatmentItem(
        {
          status: TreatmentPlanItemStatus.IN_PROGRESS,
          completionPercentage: 100,
          completedAt: null
        },
        cutoffAt
      )
    ).toBe(false);
  });
});

describe("PatientAnalyticsService scope and response security", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    permissions: ["patients.read"],
    branchIds: ["branch-1"]
  };

  function createPrismaMock() {
    return {
      branch: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "branch-1",
            name: "Centro",
            timezone: "America/Mexico_City"
          }
        ])
      },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      patient: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      treatmentPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
      treatmentPlan: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
  }

  it("pushes tenant and authorized branch scope into database queries", async () => {
    const prisma = createPrismaMock();
    const service = new PatientAnalyticsService(prisma as never);

    const result = await service.overview(actor, {
      from: "2026-07-01",
      to: "2026-07-28",
      branchId: "branch-1"
    });

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          branchId: { in: ["branch-1"] }
        })
      })
    );
    expect(result.metadata.branchIds).toEqual(["branch-1"]);
    expect(result.capabilities.canReadFinancial).toBe(false);
    expect(result.globalMetrics.map((metric) => metric.key)).not.toContain("accumulatedDebt");
    expect(result.globalMetrics.map((metric) => metric.key)).not.toContain("pendingBudgets");
  });

  it("rejects a branch outside the authenticated scope before querying analytics", async () => {
    const prisma = createPrismaMock();
    const service = new PatientAnalyticsService(prisma as never);

    await expect(
      service.overview(actor, {
        from: "2026-07-01",
        to: "2026-07-28",
        branchId: "branch-2"
      })
    ).rejects.toThrow("Branch outside authorized scope");
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it("uses completed versus no-show outcomes for attendance totals and trend", async () => {
    const prisma = createPrismaMock();
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: "appointment-completed",
        patientId: "patient-1",
        treatmentPlanId: null,
        status: AppointmentStatus.COMPLETED,
        startAt: new Date("2026-07-10T16:00:00.000Z"),
        statusHistory: []
      },
      {
        id: "appointment-no-show",
        patientId: "patient-2",
        treatmentPlanId: null,
        status: AppointmentStatus.NO_SHOW,
        startAt: new Date("2026-07-11T16:00:00.000Z"),
        statusHistory: []
      }
    ]);
    const service = new PatientAnalyticsService(prisma as never);

    const result = await service.overview(actor, {
      from: "2026-07-01",
      to: "2026-07-28",
      branchId: "branch-1",
      granularity: "month"
    });
    const attendance = result.globalMetrics.find(
      (metric) => metric.key === "averageAttendance"
    );

    expect(attendance?.value).toBe(50);
    expect(attendance?.trend).toEqual([50]);
    expect(result.conversion.trend[0]?.attendanceRate).toBe(50);
  });

  it("serves the pendingBudgets dashboard alias through the canonical detail handler", async () => {
    const prisma = createPrismaMock();
    const service = new PatientAnalyticsService(prisma as never);

    const result = await service.detail(
      {
        ...actor,
        permissions: ["patients.read", "payments.read"]
      },
      "pendingBudgets",
      {
        from: "2026-07-01",
        to: "2026-07-28",
        branchId: "branch-1",
        page: 1,
        pageSize: 25,
        order: "desc"
      }
    );

    expect(result.metric).toBe("pending-budgets");
    expect(result.rows).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });
});
