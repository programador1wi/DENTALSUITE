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
    branchIds: ["branch-1", "branch-2"]
  };

  it("scopes analytics to all authorized branches when branchId is omitted", async () => {
    const service = new ReportsAnalyticsService({ branch: { findFirst: jest.fn() } } as never);

    const filters = await service.resolveFilters(actor, {
      preset: ReportsPeriodPreset.CUSTOM,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-10"
    });

    expect(filters.branchWhere).toEqual({ in: ["branch-1", "branch-2"] });
    expect(filters.branchId).toBeUndefined();
    expect(filters.branchName).toBe("Todas las sucursales autorizadas");
  });

  it("rejects branch filters outside the actor scope before querying metrics", async () => {
    const service = new ReportsAnalyticsService({ branch: { findFirst: jest.fn() } } as never);

    await expect(
      service.resolveFilters(actor, {
        preset: ReportsPeriodPreset.CUSTOM,
        dateFrom: "2026-07-01",
        dateTo: "2026-07-10",
        branchId: "branch-3"
      })
    ).rejects.toThrow(ForbiddenException);
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
      "sales-book"
    ]);
  });

  it("applies graphical-report configuration per split without duplicating mixed payments", async () => {
    const service = new ReportsAnalyticsService({
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            amount: 1000,
            paidAt: new Date("2026-07-05T16:00:00.000Z"),
            paymentMethod: { name: "Efectivo", includeInGraphicalReports: true },
            splits: [
              {
                amount: 400,
                paymentMethod: { name: "Efectivo", includeInGraphicalReports: true }
              },
              {
                amount: 600,
                paymentMethod: { name: "Tarjeta", includeInGraphicalReports: false }
              }
            ]
          }
        ])
      }
    } as never);

    const result = await service.generateChartReport(actor, "daily-collection", {
      preset: ReportsPeriodPreset.CUSTOM,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-10"
    });

    expect(result.summary).toEqual(expect.objectContaining({ total: 400, payments: 1 }));
    expect(result.rows).toEqual([expect.objectContaining({ method: "Efectivo", amount: 400 })]);
  });
});
