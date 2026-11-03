import { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PatientsController } from "../patients/patients.controller";
import { PatientsService } from "../patients/patients.service";
import { PatientAnalyticsService } from "../patients/patient-analytics.service";
import { PatientFieldConfigService } from "../patient-field-config/patient-field-config.service";

describe("PermissionsGuard Negative HTTP Tests", () => {
  let app: INestApplication;
  const activeActor = {
    id: "user-test",
    organizationId: "org-1",
    permissions: [] as string[],
    branchIds: ["branch-1"]
  };

  const patientsServiceMock = {
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue({ id: "p-1", firstName: "Test", lastName: "Patient" }),
    create: jest.fn().mockResolvedValue({ id: "p-1", firstName: "Test", lastName: "Patient" }),
    update: jest.fn().mockResolvedValue({ id: "p-1", firstName: "Test", lastName: "Patient" }),
    deactivate: jest.fn().mockResolvedValue({ id: "p-1", status: "INACTIVE" })
  };

  const analyticsMock = {};
  const fieldConfigMock = {
    assertRequiredFields: jest.fn().mockResolvedValue(undefined)
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        Reflector,
        PermissionsGuard,
        { provide: PatientsService, useValue: patientsServiceMock },
        { provide: PatientAnalyticsService, useValue: analyticsMock },
        { provide: PatientFieldConfigService, useValue: fieldConfigMock }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          context.switchToHttp().getRequest().user = activeActor;
          return true;
        }
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies GET /api/v1/patients (403) when user has empty permissions", async () => {
    activeActor.permissions = [];
    await request(app.getHttpServer())
      .get("/api/v1/patients")
      .expect(403);
  });

  it("denies POST /api/v1/patients (403) when user only has read-only permission (patients.read)", async () => {
    activeActor.permissions = ["patients.read"];
    await request(app.getHttpServer())
      .post("/api/v1/patients")
      .send({ firstName: "Juan", lastName: "Perez" })
      .expect(403);
  });

  it("allows GET /api/v1/patients (200) when user has canonical patients.read permission", async () => {
    activeActor.permissions = ["patients.read"];
    await request(app.getHttpServer())
      .get("/api/v1/patients")
      .expect(200);
  });

  it("allows POST /api/v1/patients (201) when user has canonical patients.create permission", async () => {
    activeActor.permissions = ["patients.create"];
    await request(app.getHttpServer())
      .post("/api/v1/patients")
      .send({ firstName: "Juan", lastName: "Perez" })
      .expect(201);
  });

  it("allows any action when user has organization.manage_all super-permission", async () => {
    activeActor.permissions = ["organization.manage_all"];
    await request(app.getHttpServer())
      .get("/api/v1/patients")
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/patients")
      .send({ firstName: "Juan", lastName: "Perez" })
      .expect(201);
  });
});
