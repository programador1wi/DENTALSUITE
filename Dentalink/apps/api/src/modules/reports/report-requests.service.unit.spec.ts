import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../../common/types/auth-user";
import { ReportRequestsService } from "./report-requests.service";

describe("ReportRequestsService", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "admin@example.com",
    firstName: "System",
    lastName: "Admin",
    roleIds: [],
    roleNames: ["System Admin"],
    permissions: ["organization.manage_all"],
    branchIds: ["branch-1"]
  };

  it("persists a request as PENDING and returns it for history before generation", async () => {
    const createdAt = new Date("2026-08-20T12:00:00.000Z");
    const prisma = {
      branch: {
        findMany: jest.fn()
          .mockResolvedValueOnce([{ id: "branch-1" }])
          .mockResolvedValueOnce([{ id: "branch-1", timezone: "America/Mexico_City" }])
      },
      reportRequest: {
        upsert: jest.fn().mockResolvedValue({
          id: "request-1",
          organizationId: "org-1",
          requestedById: "user-1",
          reportCode: "PRICE_LIST",
          reportNameSnapshot: "Listado de precios",
          categorySnapshot: "LISTADO DE PRECIOS",
          parametersJson: {
            branchId: "branch-1",
            branchName: "Sucursal Norte",
            priceListId: "price-list-1",
            priceListName: "Arancel general",
            priceListVersionId: "version-2",
            priceListVersionNumber: 2
          },
          status: "PENDING",
          format: "xlsx",
          createdAt,
          storageKey: null,
          checksum: null
        })
      }
    };
    const priceListReport = {
      prepareSelection: jest.fn().mockResolvedValue({
        branchId: "branch-1",
        branchName: "Sucursal Norte",
        priceListId: "price-list-1",
        priceListName: "Arancel general",
        priceListVersionId: "version-2",
        priceListVersionNumber: 2
      })
    };
    const service = new ReportRequestsService(prisma as never, {} as never, priceListReport as never);

    const result = await service.create(actor, {
      reportCode: "PRICE_LIST",
      format: "xlsx" as never,
      parameters: { branchId: "branch-1", priceListId: "price-list-1" },
      surface: "REQUEST"
    });

    expect(result).toMatchObject({
      id: "request-1",
      reportCode: "PRICE_LIST",
      reportName: "Listado de precios",
      status: "PENDING",
      requestedAt: createdAt
    });
    expect(prisma.reportRequest.upsert).toHaveBeenCalledTimes(1);
    expect(priceListReport.prepareSelection).toHaveBeenCalledWith(actor, {
      branchId: "branch-1",
      priceListId: "price-list-1"
    });
  });

  it("rejects Listado de precios before queueing when the arancel is missing", async () => {
    const priceListReport = { prepareSelection: jest.fn() };
    const service = new ReportRequestsService({} as never, {} as never, priceListReport as never);

    await expect(
      service.create(actor, {
        reportCode: "PRICE_LIST",
        format: "xlsx" as never,
        parameters: { branchId: "branch-1" },
        surface: "REQUEST"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(priceListReport.prepareSelection).not.toHaveBeenCalled();
  });

  it("rejects an invalid history status instead of leaking a Prisma 500", async () => {
    const service = new ReportRequestsService({} as never, {} as never, {} as never);

    await expect(service.list(actor, { status: "CANCELLED" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects nonexistent warranty data with a stable unavailable code and reason", async () => {
    const service = new ReportRequestsService({} as never, {} as never, {} as never);

    await expect(
      service.create(actor, {
        reportCode: "WARRANTIES_APPLIED",
        format: "xlsx" as never,
        parameters: {},
        surface: "REQUEST"
      })
    ).rejects.toMatchObject({
      response: {
        code: "REPORT_UNAVAILABLE",
        message: "No existe un proceso persistente de garantías aplicadas."
      }
    });
  });
});
