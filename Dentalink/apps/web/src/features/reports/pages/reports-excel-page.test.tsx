import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsExcelPage } from "./reports-excel-page";
import { downloadReportExport } from "../services/reports.service";
import { requestExcelReport } from "../hooks/use-reports";

const mocks = vi.hoisted(() => ({
  requestExcelReport: vi.fn(),
  downloadReportExport: vi.fn(),
  catalog: [
    {
      id: "users-list",
      code: "USERS_LIST",
      name: "Listado usuarios",
      type: "professionals",
      title: "Listado usuarios",
      category: "USUARIOS",
      description: "Listado de todos los usuarios del sistema.",
      permission: "users.read",
      supportedFormats: ["csv", "xlsx"],
      parameters: [
        {
          key: "status",
          label: "Estado",
          type: "select",
          required: true,
          defaultValue: "ALL",
          options: [
            { label: "Todos", value: "ALL" },
            { label: "Habilitados", value: "ENABLED" },
            { label: "Deshabilitados", value: "DISABLED" }
          ]
        }
      ],
      handler: "users-list",
      enabled: true,
      filters: ["status"],
      lastRunAt: null,
      keywords: ["usuarios"]
    },
    {
      id: "appointments-patients",
      code: "APPOINTMENTS_PATIENTS",
      name: "Citas pacientes",
      type: "appointments",
      title: "Citas pacientes",
      category: "AGENDA",
      description: "Citas de pacientes dentro de un rango.",
      permission: "reports.read",
      supportedFormats: ["csv", "xlsx"],
      parameters: [
        { key: "branchId", label: "Sucursal", type: "branch" },
        { key: "dateFrom", label: "Fecha inicial", type: "date", required: true, maxRangeDays: 366 },
        { key: "dateTo", label: "Fecha final", type: "date", required: true, maxRangeDays: 366 },
        { key: "professionalId", label: "Profesional", type: "professional", dependsOn: "branchId" }
      ],
      handler: "appointments-patients",
      enabled: true,
      filters: ["branchId", "dateFrom", "dateTo", "professionalId"],
      lastRunAt: null,
      keywords: ["citas"]
    },
    {
      id: "dentist-contracts",
      code: "DENTIST_CONTRACTS",
      name: "Contratos dentistas",
      type: "professionals",
      title: "Contratos dentistas",
      category: "USUARIOS",
      description: "Listado de todos los contratos de los dentistas del sistema.",
      permission: "reports.read",
      supportedFormats: ["csv", "xlsx"],
      parameters: [
        { key: "branchId", label: "Sucursal", type: "branch", required: true }
      ],
      handler: "dentist-contracts",
      enabled: true,
      filters: ["branchId"],
      lastRunAt: null,
      keywords: ["contratos", "dentistas"]
    }
  ]
}));

const requestExcelReportMock = vi.mocked(requestExcelReport);
const downloadReportExportMock = vi.mocked(downloadReportExport);

vi.mock("../hooks/use-reports", () => ({
  useExcelCatalog: () => ({ data: mocks.catalog, isLoading: false, isError: false, error: null }),
  requestExcelReport: mocks.requestExcelReport
}));

vi.mock("../services/reports.service", async () => {
  const actual = await vi.importActual<typeof import("../services/reports.service")>("../services/reports.service");
  return {
    ...actual,
    downloadReportExport: mocks.downloadReportExport
  };
});

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({ data: [{ id: "branch-1", name: "Dental + Suc. Aguascalientes" }], isLoading: false, isError: false })
}));

vi.mock("@/features/settings/professionals/hooks/use-professionals", () => ({
  useProfessionals: () => ({ data: [{ id: "prof-1", firstName: "Ana", lastName: "Lopez" }], isLoading: false })
}));

vi.mock("@/features/settings/payment-methods/hooks/use-payment-methods", () => ({
  usePaymentMethods: () => ({ data: [{ id: "cash", name: "Efectivo" }], isLoading: false })
}));

describe("ReportsExcelPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    requestExcelReportMock.mockResolvedValue({
      id: "request-1",
      type: "professionals",
      reportCode: "USERS_LIST",
      reportName: "Listado usuarios",
      category: "USUARIOS",
      format: "xlsx",
      status: "COMPLETED",
      requestedAt: "2026-07-10T12:00:00.000Z",
      completedAt: "2026-07-10T12:00:01.000Z",
      expiresAt: "2026-07-17T12:00:00.000Z",
      parameters: { status: "ALL" },
      filters: { dateFrom: "", dateTo: "" },
      file: { format: "xlsx", fileName: "users-list.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: "ZmFrZQ==" },
      errorMessage: null
    });
  });

  it("renders the sidebar categories and filters inside the active category", async () => {
    render(<ReportsExcelPage />);

    expect(screen.getByRole("button", { name: /Todas/ })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: /Agenda/ }));

    expect(screen.getByRole("button", { name: /Agenda/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Citas pacientes")).toBeInTheDocument();
    expect(screen.queryByText("Listado usuarios")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar reporte"), { target: { value: "usuarios" } });

    await waitFor(() => {
      expect(screen.getByText("No se encontraron reportes.")).toBeInTheDocument();
    });
  });

  it("opens the dynamic request modal when clicking a report row", () => {
    render(<ReportsExcelPage />);

    fireEvent.click(screen.getByRole("button", { name: "Solicitar generacion de reporte de Listado usuarios" }));

    expect(screen.getByText("Solicitar generacion de reporte de Listado usuarios")).toBeInTheDocument();
    expect(screen.getByLabelText("Estado")).toBeInTheDocument();
    expect(screen.getAllByText("Listado de todos los usuarios del sistema.").length).toBeGreaterThan(1);
  });

  it("downloads the last completed report without opening the modal", () => {
    localStorage.setItem(
      "dentalwarner.report-excel-history",
      JSON.stringify([
        {
          id: "completed-1",
          reportCode: "USERS_LIST",
          reportName: "Listado usuarios",
          category: "USUARIOS",
          format: "xlsx",
          status: "COMPLETED",
          requestedAt: "2026-07-10T12:00:00.000Z",
          completedAt: "2026-07-10T12:00:01.000Z",
          expiresAt: "2099-01-01T00:00:00.000Z",
          parameters: { status: "ALL" },
          filters: { dateFrom: "", dateTo: "" },
          file: { format: "xlsx", fileName: "users-list.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: "ZmFrZQ==" },
          errorMessage: null
        }
      ])
    );

    render(<ReportsExcelPage />);

    fireEvent.click(screen.getByRole("button", { name: /Descargar ultimo reporte de Listado usuarios/ }));

    expect(downloadReportExportMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Solicitar generacion de reporte de Listado usuarios")).not.toBeInTheDocument();
  });

  it("requests CSV and XLSX with reportCode and dynamic parameters", async () => {
    render(<ReportsExcelPage />);

    fireEvent.click(screen.getByRole("button", { name: "Solicitar generacion de reporte de Listado usuarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Solicitar archivo CSV" }));

    await waitFor(() => {
      expect(requestExcelReportMock).toHaveBeenCalledWith(expect.objectContaining({
        reportCode: "USERS_LIST",
        format: "csv",
        parameters: { status: "ALL" }
      }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Solicitar archivo XLSX" }));

    await waitFor(() => {
      expect(requestExcelReportMock).toHaveBeenCalledWith(expect.objectContaining({
        reportCode: "USERS_LIST",
        format: "xlsx",
        parameters: { status: "ALL" }
      }));
    });
  });

  it("opens Contratos dentistas with required branch and requests XLSX after branch selection", async () => {
    requestExcelReportMock.mockResolvedValueOnce({
      id: "request-contracts",
      type: "professionals",
      reportCode: "DENTIST_CONTRACTS",
      reportName: "Contratos dentistas",
      category: "USUARIOS",
      format: "xlsx",
      status: "COMPLETED",
      requestedAt: "2026-07-10T12:00:00.000Z",
      completedAt: "2026-07-10T12:00:01.000Z",
      expiresAt: "2026-07-17T12:00:00.000Z",
      parameters: { branchId: "branch-1" },
      filters: { dateFrom: "", dateTo: "", branchId: "branch-1" },
      file: { format: "xlsx", fileName: "dentist-contracts.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: "ZmFrZQ==" },
      errorMessage: null
    });
    render(<ReportsExcelPage />);

    fireEvent.click(screen.getByRole("button", { name: "Solicitar generacion de reporte de Contratos dentistas" }));
    fireEvent.click(screen.getByRole("button", { name: "Solicitar archivo XLSX" }));

    expect(screen.getByText("Selecciona los campos obligatorios.")).toBeInTheDocument();
    expect(screen.getByLabelText("Sucursal")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sucursal"), { target: { value: "branch-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar archivo XLSX" }));

    await waitFor(() => {
      expect(requestExcelReportMock).toHaveBeenCalledWith(expect.objectContaining({
        reportCode: "DENTIST_CONTRACTS",
        format: "xlsx",
        parameters: { branchId: "branch-1" }
      }));
    });
  });
});
