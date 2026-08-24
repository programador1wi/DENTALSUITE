import { ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "../../common/types/auth-user";
import { ReportsPeriodPreset } from "./dto/reports.dto";
import { ReportsAnalyticsService } from "./reports-analytics.service";

describe("ReportsAnalyticsService", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    permissions: ["reports.read"],
    branchIds: ["branch-1", "branch-2"],
    branches: [
      { id: "branch-1", name: "Sucursal 1", isPrimary: false },
      { id: "branch-2", name: "Sucursal 2", isPrimary: true },
    ],
  };

  it("scopes analytics to all authorized branches when branchId is omitted", async () => {
    const service = new ReportsAnalyticsService({
      branch: { findFirst: jest.fn() },
    } as never);

    const filters = await service.resolveFilters(actor, {
      preset: ReportsPeriodPreset.CUSTOM,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-10",
    });

    expect(filters.branchWhere).toEqual({ in: ["branch-1", "branch-2"] });
    expect(filters.branchId).toBeUndefined();
    expect(filters.branchName).toBe("Todas las sucursales autorizadas");
  });

  it("rejects branch filters outside the actor scope before querying metrics", async () => {
    const service = new ReportsAnalyticsService({
      branch: { findFirst: jest.fn() },
    } as never);

    await expect(
      service.resolveFilters(actor, {
        preset: ReportsPeriodPreset.CUSTOM,
        dateFrom: "2026-07-01",
        dateTo: "2026-07-10",
        branchId: "branch-3",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("resolves automatic windows by report type in the primary branch timezone", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-21T18:00:00.000Z"));
    try {
      const findFirst = jest.fn().mockResolvedValue({
        id: "branch-2",
        name: "Sucursal 2",
        timezone: "America/Mexico_City",
      });
      const service = new ReportsAnalyticsService({
        branch: { findFirst },
      } as never);

      const results = await service.resolveFilters(actor, {}, "results");
      const daily = await service.resolveFilters(
        actor,
        {},
        "daily-collection",
      );
      const referrals = await service.resolveFilters(
        actor,
        {},
        "patient-referrals",
      );
      const monthly = await service.resolveFilters(
        actor,
        {},
        "professional-efficiency",
      );

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "branch-2" }),
        }),
      );
      expect(results).toEqual(
        expect.objectContaining({
          start: new Date("2025-08-01T06:00:00.000Z"),
          end: new Date("2026-09-01T05:59:59.999Z"),
          periodMode: "automatic",
          asOf: "2026-08-21",
        }),
      );
      expect(daily).toEqual(
        expect.objectContaining({
          start: new Date("2026-08-21T06:00:00.000Z"),
          end: new Date("2026-08-22T05:59:59.999Z"),
        }),
      );
      expect(referrals).toEqual(
        expect.objectContaining({
          start: new Date("2026-08-01T06:00:00.000Z"),
          end: new Date("2026-08-22T05:59:59.999Z"),
        }),
      );
      expect(monthly).toEqual(
        expect.objectContaining({
          start: new Date("2026-08-01T06:00:00.000Z"),
          end: new Date("2026-09-01T05:59:59.999Z"),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("preserves exact historical dates after resolving the selected branch timezone", async () => {
    const service = new ReportsAnalyticsService({
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          id: "branch-1",
          name: "Sucursal 1",
          timezone: "America/New_York",
        }),
      },
    } as never);

    const filters = await service.resolveFilters(
      actor,
      {
        preset: ReportsPeriodPreset.CUSTOM,
        dateFrom: "2026-02-01",
        dateTo: "2026-02-28",
        branchId: "branch-1",
      },
      "results",
    );

    expect(filters).toEqual(
      expect.objectContaining({
        start: new Date("2026-02-01T05:00:00.000Z"),
        end: new Date("2026-03-01T04:59:59.999Z"),
        periodMode: "historical",
        asOf: "2026-02-28",
        timezone: "America/New_York",
      }),
    );
  });

  it("expands automatic matrix and captured-budget anchors to their effective windows", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-21T18:00:00.000Z"));
    try {
      const service = new ReportsAnalyticsService({
        branch: {
          findFirst: jest.fn().mockResolvedValue({
            id: "branch-2",
            name: "Sucursal 2",
            timezone: "America/Mexico_City",
          }),
        },
        expense: { findMany: jest.fn().mockResolvedValue([]) },
        installment: { findMany: jest.fn().mockResolvedValue([]) },
        agreementCharge: { findMany: jest.fn().mockResolvedValue([]) },
        budget: { findMany: jest.fn().mockResolvedValue([]) },
      } as never);

      const expenses = await service.generateChartReport(actor, "expenses", {});
      const financing = await service.generateChartReport(
        actor,
        "financing-status",
        {},
      );
      const payroll = await service.generateChartReport(
        actor,
        "payroll-discount-status",
        {},
      );
      const captured = await service.generateChartReport(
        actor,
        "captured-budgets",
        {},
      );

      expect(expenses.filters).toEqual(
        expect.objectContaining({
          dateFrom: "2025-09-01T06:00:00.000Z",
          dateTo: "2026-09-01T05:59:59.999Z",
          periodMode: "automatic",
        }),
      );
      for (const report of [financing, payroll]) {
        expect(report.filters).toEqual(
          expect.objectContaining({
            dateFrom: "2026-08-01T06:00:00.000Z",
            dateTo: "2027-08-01T05:59:59.999Z",
          }),
        );
      }
      expect(captured.filters).toEqual(
        expect.objectContaining({
          dateFrom: "2026-06-01T06:00:00.000Z",
          dateTo: "2026-09-01T05:59:59.999Z",
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("exposes the requested Dentalink-style chart catalog", () => {
    const service = new ReportsAnalyticsService({} as never);

    expect(service.getChartsCatalog().map((item) => item.type)).toEqual([
      "results",
      "money-flow",
      "patient-analysis",
      "expenses",
      "professional-efficiency",
      "sales-by-procedure",
      "sales-by-category",
      "budget-capture-efficiency",
      "daily-collection",
      "professional-ranking",
      "delinquent-patients",
      "financing-status",
      "payroll-discount-status",
      "patient-referrals",
      "captured-budgets",
    ]);
    expect(service.getChartsCatalog()).toHaveLength(15);
    expect(
      service
        .getChartsCatalog()
        .find((item) => item.type === "patient-analysis"),
    ).toEqual(
      expect.objectContaining({
        renderer: "redirect",
        destination: "/pacientes/analisis",
      }),
    );
  });

  it("applies collection-report configuration per split without duplicating mixed payments", async () => {
    const service = new ReportsAnalyticsService({
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          id: "branch-2",
          name: "Sucursal 2",
          timezone: "America/Mexico_City",
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: "branch-1", name: "Sucursal 1" },
          { id: "branch-2", name: "Sucursal 2" },
        ]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            branchId: "branch-1",
            amount: 1000,
            paymentMethod: {
              name: "Efectivo",
              includeInCollectionReports: true,
            },
            splits: [
              {
                amount: 400,
                paymentMethod: {
                  name: "Efectivo",
                  includeInCollectionReports: true,
                },
              },
              {
                amount: 600,
                paymentMethod: {
                  name: "Tarjeta",
                  includeInCollectionReports: false,
                },
              },
            ],
          },
        ]),
      },
      budget: { findMany: jest.fn().mockResolvedValue([]) },
    } as never);

    const result = await service.generateChartReport(
      actor,
      "daily-collection",
      {
        preset: ReportsPeriodPreset.CUSTOM,
        dateFrom: "2026-07-01",
        dateTo: "2026-07-10",
      },
    );

    expect(result.summary).toEqual(
      expect.objectContaining({ total: 400, payments: 1 }),
    );
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Total recaudado",
          cells: expect.arrayContaining([
            expect.objectContaining({ amount: 400 }),
          ]),
        }),
        expect.objectContaining({
          label: "Efectivo",
          cells: expect.arrayContaining([
            expect.objectContaining({ amount: 400 }),
          ]),
        }),
      ]),
    );
  });

  it("conciles realized sales and cost snapshots in monthly results", async () => {
    const service = new ReportsAnalyticsService({
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          id: "branch-2",
          name: "Sucursal 2",
          timezone: "America/Mexico_City",
        }),
      },
      treatmentPlanItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            total: 1000,
            performedAmount: 1000,
            quantity: 1,
            completedAt: new Date("2026-07-05T16:00:00.000Z"),
            laboratoryCostSnapshot: 50,
            internalCostSnapshot: 25,
            procedure: { id: "procedure-1", categoryId: "category-1" },
            treatmentPlan: {
              branchId: "branch-1",
              professionalId: "professional-1",
              professional: { commissionRate: 10 },
            },
          },
        ]),
      },
      inventoryMovement: {
        findMany: jest.fn().mockResolvedValue([
          {
            quantity: -2,
            unitCost: 10,
            occurredAt: new Date("2026-07-06T16:00:00.000Z"),
          },
        ]),
      },
      professionalContract: {
        findMany: jest.fn().mockResolvedValue([
          {
            professionalId: "professional-1",
            commissionRate: 15,
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            endsAt: null,
            branches: [{ branchId: "branch-1" }],
            categoryRates: [{ procedureCategoryId: "category-1", rate: 20 }],
            fixedAmounts: [],
          },
        ]),
      },
    } as never);

    const result = await service.generateChartReport(actor, "results", {
      preset: ReportsPeriodPreset.CUSTOM,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
    });

    expect(result.chart).toEqual([
      expect.objectContaining({
        sales: 1000,
        costs: 295,
        result: 705,
        percent: 70.5,
      }),
    ]);
    expect(result.summary).toEqual(
      expect.objectContaining({ sales: 1000, costs: 295, net: 705 }),
    );
  });
});
