import { strFromU8, unzipSync } from "fflate";
import { marketingReportDefinitions } from "./email-marketing.catalog";
import { EmailMarketingService } from "./email-marketing.service";

const actor = {
  id: "user-1",
  organizationId: "org-1",
  email: "admin@example.com",
  firstName: "System",
  lastName: "Admin",
  roleIds: [],
  roleNames: [],
  permissions: [],
  branchIds: ["branch-1"]
};

describe("EmailMarketingService report export", () => {
  it("opens with patient data and omits marketing-consent columns for the registered-email report", async () => {
    const rows = [
      {
        patientId: "patient-1",
        publicId: "P-0001",
        documentNumber: "DOC-1",
        firstName: "Eduardo",
        lastName: "Chanona",
        fullName: "Eduardo Chanona",
        phone: "529612222222",
        email: "eduardo@example.com",
        branchId: "branch-1",
        branch: "León Valle",
        professional: "TET TEST",
        professionalId: "professional-1",
        lastAppointment: null,
        lastAttentionAt: new Date("2026-07-20T12:00:00.000Z"),
        debt: 0,
        agreement: null,
        birthDate: null,
        patientStatus: "ACTIVE",
        budgetStatus: null,
        budgetTotal: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        inclusionReason: "Paciente atendido por el profesional",
        eligible: true,
        eligibilityReasons: []
      },
      {
        patientId: "patient-2",
        publicId: "P-0002",
        documentNumber: "DOC-2",
        firstName: "María",
        lastName: "Pérez",
        fullName: "María Pérez",
        phone: "529613333333",
        email: "maria@example.com",
        branchId: "branch-1",
        branch: "León Valle",
        professional: "TET TEST",
        professionalId: "professional-1",
        lastAppointment: null,
        lastAttentionAt: new Date("2026-07-18T12:00:00.000Z"),
        debt: 0,
        agreement: null,
        birthDate: null,
        patientStatus: "INACTIVE",
        budgetStatus: null,
        budgetTotal: null,
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
        inclusionReason: "Paciente atendido por el profesional",
        eligible: true,
        eligibilityReasons: []
      }
    ];
    const prisma = {
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ name: "Dentalwarner Corporate" }) },
      branch: { findFirst: jest.fn() },
      professional: {
        findFirst: jest.fn().mockResolvedValue({ firstName: "TET", lastName: "TEST" })
      },
      agreement: { findFirst: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const reports = {
      exportRows: jest.fn().mockResolvedValue(rows),
      catalog: jest.fn().mockReturnValue(marketingReportDefinitions)
    };
    const service = new EmailMarketingService(
      prisma as never,
      reports as never,
      {} as never,
      {} as never,
      {} as never
    );

    const result = await service.exportReport(actor, "PATIENTS_TREATED_BY_PROFESSIONAL", {
      parameters: { professionalId: "professional-1" },
      scope: "ALL"
    });
    const files = unzipSync(new Uint8Array(Buffer.from(result.base64, "base64")));
    const workbook = strFromU8(files["xl/workbook.xml"]);
    const patientsSheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const summarySheet = strFromU8(files["xl/worksheets/sheet2.xml"]);

    expect(workbook.indexOf('name="Pacientes"')).toBeLessThan(workbook.indexOf('name="Resumen"'));
    expect(patientsSheet).toContain("Eduardo");
    expect(patientsSheet).toContain("Chanona");
    expect(patientsSheet).toContain("eduardo@example.com");
    expect(patientsSheet).toContain("María");
    expect(patientsSheet).toContain("Correo electrónico");
    expect(patientsSheet).not.toContain("Elegibilidad");
    expect(patientsSheet).not.toContain("Motivo de exclusión");
    expect(summarySheet).toContain("Pacientes con correo registrado");
    expect(summarySheet).not.toContain("Pacientes no elegibles");
    expect(result.rowCount).toBe(2);
  });
});
