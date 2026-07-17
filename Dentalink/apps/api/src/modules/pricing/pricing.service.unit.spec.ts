import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { CurrencyCode, PriceListItemStatus, PriceListScopeType, PriceListStatus, Prisma } from "@prisma/client";
import { PricingService } from "./pricing.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.test",
  firstName: "Ada",
  lastName: "Admin",
  roleIds: [],
  roleNames: [],
  permissions: ["price_list.view"],
  branchIds: ["branch-1"]
};

function procedure() {
  return { id: "proc-1", code: "PROC-1", name: "Consulta", isActive: true, category: { name: "Diagnostico" } };
}

function priceItem(priority: number, id = "item-1") {
  return {
    id,
    basePrice: new Prisma.Decimal("2500.00"),
    laboratoryCost: new Prisma.Decimal("300.00"),
    internalCost: new Prisma.Decimal("100.00"),
    priceListVersion: {
      id: `version-${id}`,
      versionNumber: 2,
      currency: CurrencyCode.MXN,
      priceList: { id: `list-${id}`, code: `LIST-${id}`, name: `Lista ${id}`, priority },
      scopes: [{ id: `scope-${id}`, scopeType: PriceListScopeType.BRANCH, scopeKey: "branch-1", priority }]
    }
  };
}

describe("PricingService", () => {
  beforeEach(() => {
    process.env.PRICE_LISTS_V2_ENABLED = "true";
  });

  it("blocks a treatment when no active price exists", async () => {
    const prisma = {
      procedure: { findFirst: jest.fn().mockResolvedValue(procedure()) },
      priceListVersionItem: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new PricingService(prisma as never);
    await expect(service.resolve(actor, { branchId: "branch-1", procedureId: "proc-1" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("selects the highest explicit scope priority deterministically and returns exact decimal strings", async () => {
    const prisma = {
      procedure: { findFirst: jest.fn().mockResolvedValue(procedure()) },
      priceListVersionItem: { findMany: jest.fn().mockResolvedValue([priceItem(10, "low"), priceItem(200, "high")]) }
    };
    const service = new PricingService(prisma as never);
    const result = await service.resolve(actor, { branchId: "branch-1", procedureId: "proc-1" });
    expect(result.version.itemId).toBe("high");
    expect(result.basePrice).toBe("2500.00");
    expect(result.finalPrice).toBe("2500.00");
    expect(result.laboratoryCost).toBe("300.00");
  });

  it("rejects a manual price without backend permission", async () => {
    const prisma = {
      procedure: { findFirst: jest.fn().mockResolvedValue(procedure()) },
      priceListVersionItem: { findMany: jest.fn().mockResolvedValue([priceItem(10)]) }
    };
    const service = new PricingService(prisma as never);
    await expect(
      service.resolve(actor, {
        branchId: "branch-1",
        procedureId: "proc-1",
        manualPrice: "100.00",
        manualReason: "Authorized exception"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps published version items immutable", async () => {
    const prisma = {
      priceListVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: "version-1",
          organizationId: "org-1",
          status: PriceListStatus.ACTIVE,
          priceList: {},
          scopes: [],
          items: []
        })
      }
    };
    const service = new PricingService(prisma as never);
    await expect(
      service.upsertVersionItem(actor, "version-1", {
        procedureId: "proc-1",
        basePrice: "20.00"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("builds the clinical catalog only from active versions and exposes the resolved version item", async () => {
    const candidate = {
      id: "version-item-3",
      procedureId: "proc-1",
      status: PriceListItemStatus.ACTIVE,
      procedureVariant: null,
      procedure: {
        ...procedure(),
        categoryId: "category-1",
        displayId: 1,
        description: null,
        type: "CLINICAL",
        defaultDuration: 30,
        requiresTooth: false,
        requiresSurface: false,
        requiresLab: false,
        requiresOdontogramSymbol: false,
        defaultOdontogramSymbol: null,
        category: { id: "category-1", name: "Diagnostico", description: null, sortOrder: 1 }
      }
    };
    const findMany = jest.fn().mockResolvedValue([candidate]);
    const prisma = { priceListVersionItem: { findMany } };
    const service = new PricingService(prisma as never);
    jest.spyOn(service, "resolve").mockResolvedValue({
      procedure: { id: "proc-1", code: "PROC-1", name: "Consulta", category: "Diagnostico" },
      priceList: { id: "list-1", code: "BASE", name: "Tarifario Base" },
      version: { id: "version-3", number: 3, itemId: "version-item-3" },
      agreement: null,
      rule: { source: "BASE_PRICE", agreementRuleId: null, manualReason: null },
      basePrice: "500.00",
      appliedPrice: "500.00",
      discountPercent: "0.00",
      discountAmount: "0.00",
      coverageAmount: "0.00",
      copayAmount: "500.00",
      finalPrice: "500.00",
      allowDiscount: true,
      maxDiscountPercent: "100.00",
      currency: CurrencyCode.MXN,
      laboratoryCost: "0.00",
      internalCost: "0.00",
      trace: { branchId: "branch-1", clinicalDate: new Date(), scopeIds: [], correlationId: null },
      pricedAt: new Date(),
      pricedById: actor.id
    });

    const catalog = await service.catalog(actor, { branchId: "branch-1" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PriceListItemStatus.ACTIVE,
          priceListVersion: expect.objectContaining({ status: PriceListStatus.ACTIVE })
        })
      })
    );
    expect(catalog.activeVersion).toMatchObject({ id: "version-3", number: 3 });
    expect(catalog.categories[0].items[0]).toMatchObject({ id: "version-item-3", price: "500.00" });
  });

  it("publishes v3 atomically, supersedes v2 and records both audit events", async () => {
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      priceListVersion: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: "version-3", status: PriceListStatus.ACTIVE })
      },
      priceList: { update: jest.fn().mockResolvedValue({}) },
      pricingAuditEvent: { create: auditCreate },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) }
    };
    const draftVersion = {
      id: "version-3",
      organizationId: "org-1",
      priceListId: "list-1",
      versionNumber: 3,
      version: 1,
      status: PriceListStatus.DRAFT,
      validFrom: null,
      validTo: null,
      currency: CurrencyCode.MXN,
      changeSummary: null,
      previousVersionId: "version-2",
      priceList: { id: "list-1", priority: 0 },
      scopes: [],
      items: [{ id: "version-item-3", procedureId: "proc-1", status: PriceListItemStatus.ACTIVE, procedure: procedure() }]
    };
    const prisma = {
      priceListVersion: {
        findFirst: jest.fn().mockResolvedValue(draftVersion),
        findMany: jest.fn().mockResolvedValue([
          { id: "version-2", versionNumber: 2, status: PriceListStatus.ACTIVE, _count: { items: 3, treatmentItems: 4 } }
        ])
      },
      priceListVersionItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: "version-item-3", procedureId: "proc-1", procedureVariantId: null, basePrice: "500.00", status: PriceListItemStatus.ACTIVE }
        ])
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new PricingService(prisma as never);
    jest.spyOn(service, "validateVersion").mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      checkedAt: new Date()
    });

    await service.publishVersion(actor, "version-3", { expectedVersion: 1, changeSummary: "Nueva prestación" });

    expect(tx.priceListVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PriceListStatus.SUPERSEDED } })
    );
    expect(tx.priceListVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "version-3" }, data: expect.objectContaining({ status: PriceListStatus.ACTIVE }) })
    );
    expect(auditCreate.mock.calls.map(([call]) => call.data.action)).toEqual([
      "price_list.version_superseded",
      "price_list.published"
    ]);
  });
});
