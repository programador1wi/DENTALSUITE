import "reflect-metadata";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "../../common/types/auth-user";
import { ReportExportFormat } from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

describe("ReportsService Excel requests", () => {
  const actor: AuthUser = {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    roleIds: [],
    roleNames: [],
    permissions: ["reports.read", "reports.export"],
    branchIds: ["branch-1"]
  };

  it("keeps the existing report engine behind legacy Excel requests", async () => {
    const service = new ReportsService({} as never);
    const getAppointmentsReport = jest.spyOn(service, "getAppointmentsReport").mockResolvedValue({
      filters: { dateFrom: "2026-07-01T00:00:00.000Z", dateTo: "2026-07-10T23:59:59.999Z", branchId: "branch-1" },
      data: { rows: [{ total: 1 }] },
      export: {
        format: ReportExportFormat.XLSX,
        fileName: "appointments-report.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: "ZmFrZQ=="
      }
    });

    const result = await service.createExcelRequest(actor, {
      type: "appointments",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-10",
      branchId: "branch-1"
    });

    expect(getAppointmentsReport).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ type: "appointments", format: "xlsx", branchId: "branch-1" })
    );
    expect(result.status).toBe("COMPLETED");
    expect(result.reportCode).toBe("APPOINTMENTS_SUMMARY");
    expect(result.file?.fileName).toBe("appointments-report.xlsx");
  });

  it("exposes Excel report definitions filtered by report permission", () => {
    const service = new ReportsService({} as never);

    const catalog = service.getExcelCatalog(actor);

    expect(catalog.map((item) => item.code)).toEqual(expect.arrayContaining(["APPOINTMENTS_SUMMARY", "APPOINTMENTS_PATIENTS", "PATIENT_PAYMENTS"]));
    expect(catalog.some((item) => item.code === "USERS_LIST")).toBe(false);
  });

  it("rejects disabled reports instead of letting the frontend choose a generator", async () => {
    const service = new ReportsService({} as never);

    await expect(
      service.createExcelRequest(actor, {
        reportCode: "PRICE_LIST",
        format: ReportExportFormat.CSV,
        parameters: {}
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects report-specific permissions", async () => {
    const service = new ReportsService({} as never);

    await expect(
      service.createExcelRequest(actor, {
        reportCode: "USERS_LIST",
        format: ReportExportFormat.CSV,
        parameters: { status: "ALL" }
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("generates users list with required status and CSV formula escaping", async () => {
    const userActor: AuthUser = { ...actor, permissions: [...actor.permissions, "users.read"] };
    const service = new ReportsService({
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "u-1",
            firstName: "=Maria",
            lastName: "Lopez",
            email: "+danger@example.com",
            phone: null,
            status: "ACTIVE",
            isActive: true,
            role: { name: "Admin" },
            branches: [{ branch: { name: "Centro" } }],
            lastLoginAt: null,
            createdAt: new Date("2026-07-01T00:00:00.000Z")
          }
        ])
      }
    } as never);

    const result = await service.createExcelRequest(userActor, {
      reportCode: "USERS_LIST",
      format: ReportExportFormat.CSV,
      parameters: { status: "ENABLED" }
    });

    const csv = Buffer.from(result.file?.base64 ?? "", "base64").toString("utf8");
    expect(result.status).toBe("COMPLETED");
    expect(result.reportName).toBe("Listado usuarios");
    expect(result.parameters).toEqual({ status: "ENABLED" });
    expect(csv).toContain("'=Maria Lopez");
    expect(csv).toContain("'+danger@example.com");
  });

  it("requires Listado usuarios status", async () => {
    const userActor: AuthUser = { ...actor, permissions: [...actor.permissions, "users.read"] };
    const service = new ReportsService({} as never);

    await expect(
      service.createExcelRequest(userActor, {
        reportCode: "USERS_LIST",
        format: ReportExportFormat.XLSX,
        parameters: { status: "" }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("generates dentist contracts scoped to an authorized branch", async () => {
    const service = new ReportsService({
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: "branch-1", organizationId: "org-1" })
      },
      professionalContract: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "contract-1",
            contractType: "PERFORMED_AND_PAID",
            commissionBase: "CLINICAL",
            paymentDiscount: "NONE",
            paymentCondition: "ANY_DUE_DATE",
            commissionRate: 45,
            priceListName: "Base",
            isActive: true,
            startsAt: new Date("2026-01-01T00:00:00.000Z"),
            endsAt: null,
            professional: {
              firstName: "Ana",
              lastName: "Lopez",
              email: "ana@example.com",
              licenseNumber: "CED-1",
              specialties: [{ specialty: { name: "Ortodoncia" } }]
            },
            branches: [{ branch: { name: "Dental + Suc. Aguascalientes" } }]
          }
        ])
      }
    } as never);

    const result = await service.createExcelRequest(actor, {
      reportCode: "DENTIST_CONTRACTS",
      format: ReportExportFormat.CSV,
      parameters: { branchId: "branch-1" }
    });

    const csv = Buffer.from(result.file?.base64 ?? "", "base64").toString("utf8");
    expect(result.status).toBe("COMPLETED");
    expect(result.reportCode).toBe("DENTIST_CONTRACTS");
    expect(result.parameters).toEqual({ branchId: "branch-1" });
    expect(csv).toContain("Ana Lopez");
    expect(csv).toContain("Dental + Suc. Aguascalientes");
  });

  it("requires branch for dentist contracts", async () => {
    const service = new ReportsService({} as never);

    await expect(
      service.createExcelRequest(actor, {
        reportCode: "DENTIST_CONTRACTS",
        format: ReportExportFormat.XLSX,
        parameters: {}
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
