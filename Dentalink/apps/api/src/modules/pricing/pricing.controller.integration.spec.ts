import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AdminPriceListsController, PricingController } from "./pricing.controller";
import { PricingService } from "./pricing.service";

describe("PricingController integration", () => {
  let app: INestApplication;
  const actor = {
    id: "user-1",
    organizationId: "org-1",
    permissions: ["organization.manage_all"],
    branchIds: ["branch-1"]
  };
  const pricing = {
    resolve: jest.fn().mockResolvedValue({
      basePrice: "100.00",
      finalPrice: "90.00",
      currency: "MXN",
      version: { id: "version-1", number: 1, itemId: "item-1" },
      trace: { branchId: "branch-1" }
    }),
    createList: jest.fn().mockResolvedValue({ id: "list-1", status: "DRAFT", currentVersion: 1 }),
    history: jest.fn().mockResolvedValue({
      priceList: { id: "list-1", code: "BASE", name: "Tarifario Base" },
      latestVersion: { id: "version-3", versionNumber: 3, status: "DRAFT" },
      activeVersion: { id: "version-2", versionNumber: 2, status: "ACTIVE" },
      publicationPreview: { newItemsCount: 1 },
      versions: [],
      events: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }
    })
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PricingController, AdminPriceListsController],
      providers: [{ provide: PricingService, useValue: pricing }]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
        context.switchToHttp().getRequest().user = actor;
        return true;
      } })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => app.close());

  it("returns a traceable price contract instead of a bare number", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/pricing/resolve")
      .send({ branchId: "branch-1", procedureId: "proc-1" })
      .expect(201);
    expect(response.body).toMatchObject({
      basePrice: "100.00",
      finalPrice: "90.00",
      currency: "MXN",
      version: { id: "version-1", itemId: "item-1" }
    });
  });

  it("creates a draft through the versioned admin route", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/price-lists")
      .send({
        code: "BASE-2027",
        name: "Base 2027",
        currency: "MXN",
        scopes: [{ scopeType: "ORGANIZATION", scopeKey: "org-1" }]
      })
      .expect(201)
      .expect({ id: "list-1", status: "DRAFT", currentVersion: 1 });
    expect(pricing.createList).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1" }), expect.objectContaining({ code: "BASE-2027" }));
  });

  it("returns active and latest versions separately in the human audit history", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/price-lists/list-1/history")
      .expect(200);
    expect(response.body).toMatchObject({
      latestVersion: { versionNumber: 3, status: "DRAFT" },
      activeVersion: { versionNumber: 2, status: "ACTIVE" },
      publicationPreview: { newItemsCount: 1 }
    });
    expect(pricing.history).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1" }), "list-1", 1, 50, undefined);
  });
});
