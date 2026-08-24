import "reflect-metadata";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "../../common/types/auth-user";
import { PriceListReportService } from "./price-list-report.service";

describe("PriceListReportService", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    permissions: ["reports.read", "reports.export", "price_list.export"],
    branchIds: ["branch-1"]
  };

  it("returns only the current applicable version as a branch option", async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1", name: "Sucursal Norte" }) },
      priceList: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "price-list-1",
            code: "AR-GEN",
            name: "Arancel general",
            currency: "MXN",
            isDefault: false,
            branchAssignments: [{ id: "assignment-1" }],
            versionsV2: [{ id: "version-2", versionNumber: 2, currency: "MXN", scopes: [] }]
          }
        ])
      }
    };
    const service = new PriceListReportService(prisma as never);

    await expect(service.options(actor, "branch-1")).resolves.toEqual([
      {
        id: "price-list-1",
        code: "AR-GEN",
        name: "Arancel general",
        currency: "MXN",
        versionNumber: 2
      }
    ]);
    expect(prisma.priceList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-1", isActive: true, status: "ACTIVE" }) })
    );
  });

  it("rejects a branch outside the authenticated scope", async () => {
    const service = new PriceListReportService({} as never);
    await expect(service.options(actor, "branch-2")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an arancel that is not among the current branch options", async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1", name: "Sucursal Norte" }) },
      priceList: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new PriceListReportService(prisma as never);

    await expect(
      service.prepareSelection(actor, { branchId: "branch-1", priceListId: "forged-price-list" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("exports active treatments from every category in deterministic order", async () => {
    const prisma = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: "branch-1", name: "Sucursal Norte" }) },
      priceListVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: "version-2",
          versionNumber: 2,
          currency: "MXN",
          priceList: {
            id: "price-list-1",
            code: "AR-GEN",
            name: "Arancel general",
            isDefault: false,
            branchAssignments: [{ id: "assignment-1" }]
          },
          scopes: []
        })
      },
      priceListVersionItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            basePrice: { toString: () => "800.00", valueOf: () => "800.00" },
            laboratoryCost: { toString: () => "0.00", valueOf: () => "0.00" },
            allowDiscount: true,
            maxDiscountPercent: { toString: () => "10.00", valueOf: () => "10.00" },
            displayCategory: { name: "Cirugia", sortOrder: 2 },
            procedure: { displayId: 20, code: "CIR-01", name: "Extraccion", category: { name: "General", sortOrder: 1 } },
            procedureVariant: null
          },
          {
            basePrice: { toString: () => "500.00", valueOf: () => "500.00" },
            laboratoryCost: { toString: () => "100.00", valueOf: () => "100.00" },
            allowDiscount: false,
            maxDiscountPercent: { toString: () => "0.00", valueOf: () => "0.00" },
            displayCategory: null,
            procedure: { displayId: 10, code: "DX-01", name: "Consulta", category: { name: "Diagnostico", sortOrder: 1 } },
            procedureVariant: { name: "Inicial" }
          }
        ])
      }
    };
    const service = new PriceListReportService(prisma as never);

    const result = await service.rows(actor, {
      branchId: "branch-1",
      branchName: "Sucursal Norte",
      priceListId: "price-list-1",
      priceListName: "Arancel general",
      priceListVersionId: "version-2",
      priceListVersionNumber: 2
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row["Categoría"])).toEqual(["Diagnostico", "Cirugia"]);
    expect(result.rows[0]).toMatchObject({ Tratamiento: "Consulta", Variante: "Inicial", Precio: 500 });
    expect(prisma.priceListVersionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          priceListVersionId: "version-2",
          status: "ACTIVE",
          procedure: { isActive: true }
        })
      })
    );
  });
});
