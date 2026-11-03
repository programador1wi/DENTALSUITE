import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingReportsPanel } from "./marketing-reports-panel";

const mocks = vi.hoisted(() => ({
  getMarketingReports: vi.fn(),
  previewMarketingReport: vi.fn(),
  exportMarketingReport: vi.fn(),
  createCampaign: vi.fn(),
  listTemplates: vi.fn(),
  scheduleCampaign: vi.fn(),
  sendCampaignNow: vi.fn(),
  sendCampaignTest: vi.fn()
}));

vi.mock("../services/email-marketing.service", () => mocks);

const reports = [
  {
    code: "PATIENTS_TREATED_BY_PROFESSIONAL",
    name: "Pacientes tratados por un profesional",
    description: "Pacientes atendidos por el profesional seleccionado.",
    category: "CITAS",
    requiredParameters: [
      { key: "professionalId", label: "Profesional", type: "professional", required: true }
    ],
    optionalParameters: [],
    resultColumns: [],
    exportable: true
  },
  {
    code: "PATIENTS_INACTIVE_MONTHS",
    name: "Pacientes que no han asistido durante X meses",
    description: "Pacientes sin actividad durante el intervalo.",
    category: "ACTIVIDAD",
    requiredParameters: [
      {
        key: "months",
        label: "Tiempo sin asistir",
        type: "number",
        required: true,
        defaultValue: 6,
        options: [
          { value: 1, label: "1 mes" },
          { value: 24, label: "24 meses" }
        ]
      }
    ],
    optionalParameters: [
      { key: "branchId", label: "Sucursal", type: "branch" },
      { key: "includeCancelled", label: "Incluir citas anuladas", type: "boolean", defaultValue: false }
    ],
    resultColumns: [],
    exportable: true
  },
  {
    code: "PATIENTS_BY_AGREEMENT",
    name: "Pacientes pertenecientes a un convenio",
    description: "Pacientes del convenio seleccionado.",
    category: "PERSONAL",
    requiredParameters: [{ key: "agreementId", label: "Convenio", type: "agreement", required: true }],
    optionalParameters: [{ key: "branchId", label: "Sucursal", type: "branch" }],
    resultColumns: [],
    exportable: true
  },
  {
    code: "ALL_PATIENTS",
    name: "Todos los pacientes",
    description: "Todos los pacientes visibles.",
    category: "PERSONAL",
    requiredParameters: [],
    optionalParameters: [{ key: "branchId", label: "Sucursal", type: "branch" }],
    resultColumns: [],
    exportable: true
  }
];

const sender = {
  organization: { name: "Clínica Demo", email: "contacto@demo.local" },
  defaultSender: { fromAddress: "no-reply@demo.local", fromName: "Clínica Demo", provider: "smtp" },
  domains: [],
  branches: [{ id: "branch-1", name: "Sucursal Centro" }],
  professionals: [{ id: "professional-1", firstName: "Ana", lastName: "López" }],
  agreements: [{ id: "agreement-1", name: "Convenio Empresa Norte" }]
};

function renderPanel(onOpenCampaigns = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <MarketingReportsPanel sender={sender} onOpenSettings={vi.fn()} onOpenCampaigns={onOpenCampaigns} />
    </QueryClientProvider>
  );
}

const patientRow = (id: string, name = "Eduardo Chanona") => ({
  patientId: id,
  documentNumber: `DOC-${id}`,
  fullName: name,
  firstName: name.split(" ")[0],
  lastName: name.split(" ").slice(1).join(" "),
  phone: "5551234567",
  email: `${id}@example.com`,
  branch: "Sucursal Centro",
  professional: "TET TEST",
  lastAppointment: null,
  lastAttentionAt: "2026-07-20T23:10:11.943Z",
  debt: 0,
  agreement: null,
  eligible: true,
  eligibilityReasons: []
});

describe("MarketingReportsPanel report dropdowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMarketingReports.mockResolvedValue(reports);
    mocks.listTemplates.mockResolvedValue([]);
    mocks.previewMarketingReport.mockResolvedValue({
      report: reports[3],
      parameters: {},
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, hasMore: false },
      summary: { results: 0, visible: 0, eligible: 0, ineligible: 0 }
    });
  });

  it("opens only the controls declared by the selected report", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Pacientes tratados por un profesional/ }));

    expect(screen.getAllByText("Selecciona un profesional").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana López").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Selecciona un convenio")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Pacientes pertenecientes a un convenio/ }));

    expect(screen.getAllByText("Selecciona un convenio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Convenio Empresa Norte").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Selecciona un profesional")).toHaveLength(0);
  });

  it("renders interval choices and an explicit no-extra-filters state", async () => {
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: /Pacientes que no han asistido durante X meses/ })
    );
    expect(screen.getAllByText("1 mes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("24 meses").length).toBeGreaterThan(0);
    expect(screen.getByText("Incluir citas anuladas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Todos los pacientes/ }));
    expect(screen.getByText(/no necesita criterios adicionales/i)).toBeInTheDocument();
  });

  it("keeps the authorized branch when generating a report", async () => {
    renderPanel();

    fireEvent.change(await screen.findByLabelText("Sucursal de los reportes"), {
      target: { value: "branch-1" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Todos los pacientes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Generar reporte" }));

    await waitFor(() =>
      expect(mocks.previewMarketingReport).toHaveBeenCalledWith(
        "ALL_PATIENTS",
        expect.objectContaining({ parameters: { branchId: "branch-1" } })
      )
    );
  });

  it("shows the professional and latest clinical attention for treated patients", async () => {
    mocks.previewMarketingReport.mockResolvedValue({
      report: reports[0],
      parameters: { professionalId: "professional-1" },
      items: [
        {
          patientId: "patient-1",
          documentNumber: "DOC-1",
          fullName: "Eduardo Chanona",
          firstName: "Eduardo",
          lastName: "Chanona",
          phone: "5551234567",
          email: "eduardo@example.com",
          branch: "Sucursal Centro",
          professional: "TET TEST",
          lastAppointment: null,
          lastAttentionAt: "2026-07-20T23:10:11.943Z",
          debt: 0,
          agreement: null,
          eligible: true,
          eligibilityReasons: []
        }
      ],
      pagination: { page: 1, pageSize: 50, total: 1, hasMore: false },
      summary: { results: 1, visible: 1, eligible: 1, ineligible: 0 }
    });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Pacientes tratados por un profesional/ }));
    fireEvent.change(screen.getByLabelText("Profesional *"), { target: { value: "professional-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Generar reporte" }));

    expect(await screen.findByText("Eduardo Chanona")).toBeInTheDocument();
    expect(screen.getByText("TET TEST")).toBeInTheDocument();
    expect(screen.getByText("Última atención")).toBeInTheDocument();
    expect(screen.queryByText("Elegibilidad")).not.toBeInTheDocument();
    expect(screen.queryByText("No elegible")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar todos los pacientes" }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "Seleccionar Eduardo Chanona" })).toBeChecked()
    );
    expect(mocks.previewMarketingReport).toHaveBeenLastCalledWith(
      "PATIENTS_TREATED_BY_PROFESSIONAL",
      expect.objectContaining({ page: 1, pageSize: 100 })
    );
  });

  it("loads the next page, exports the chosen scope and returns to the report library", async () => {
    mocks.exportMarketingReport.mockResolvedValue({ rowCount: 2 });
    mocks.previewMarketingReport.mockImplementation(async (_code: string, payload: { page?: number }) =>
      payload.page === 2
        ? {
            report: reports[3],
            parameters: {},
            items: [patientRow("patient-2", "María López")],
            pagination: { page: 2, pageSize: 50, total: 2, hasMore: false },
            summary: { results: 2, visible: 1, eligible: 1, ineligible: 0 }
          }
        : {
            report: reports[3],
            parameters: {},
            items: [patientRow("patient-1")],
            pagination: { page: 1, pageSize: 50, total: 2, hasMore: true },
            summary: { results: 2, visible: 1, eligible: 1, ineligible: 0 }
          }
    );
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /Todos los pacientes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Generar reporte" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cargar 1 resultados más" }));

    expect(await screen.findByText("María López")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Contenido del reporte Excel"), {
      target: { value: "INELIGIBLE" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Descargar XLSX" }));
    await waitFor(() =>
      expect(mocks.exportMarketingReport).toHaveBeenCalledWith(
        "ALL_PATIENTS",
        expect.objectContaining({ scope: "INELIGIBLE" })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Generar un nuevo reporte" }));
    expect(await screen.findByText("Selecciona y despliega un reporte")).toBeInTheDocument();
  });

  it("creates a frozen campaign draft and opens the campaign history after saving", async () => {
    const openCampaigns = vi.fn();
    mocks.createCampaign.mockResolvedValue({ id: "campaign-1" });
    mocks.previewMarketingReport.mockResolvedValue({
      report: reports[0],
      parameters: { professionalId: "professional-1" },
      items: [patientRow("patient-1")],
      pagination: { page: 1, pageSize: 50, total: 1, hasMore: false },
      summary: { results: 1, visible: 1, eligible: 1, ineligible: 0 }
    });
    renderPanel(openCampaigns);

    fireEvent.click(await screen.findByRole("button", { name: /Pacientes tratados por un profesional/ }));
    fireEvent.change(screen.getByLabelText("Profesional *"), { target: { value: "professional-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Generar reporte" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar Eduardo Chanona" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear una nueva campaña" }));

    expect(await screen.findByText("Crear campaña de Marketing")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Asunto *"), { target: { value: "Seguimiento preventivo" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar destinatarios" }));
    fireEvent.click(screen.getByRole("button", { name: "Preparar contenido" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear borrador y revisar" }));

    await waitFor(() => expect(mocks.createCampaign).toHaveBeenCalled());
    expect(mocks.createCampaign.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        subject: "Seguimiento preventivo",
        patientIds: ["patient-1"],
        reportCode: "PATIENTS_TREATED_BY_PROFESSIONAL",
        fromName: "Clínica Demo"
      })
    );
    expect(await screen.findByText("Prueba controlada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar a envío" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));
    expect(openCampaigns).toHaveBeenCalledTimes(1);
  });

  it("hydrates the selected report from the route and emits navigation back to the library", async () => {
    const onReportChange = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    render(
      <QueryClientProvider client={client}>
        <MarketingReportsPanel
          sender={sender}
          selectedReportCode="PATIENTS_TREATED_BY_PROFESSIONAL"
          onReportChange={onReportChange}
          onOpenSettings={vi.fn()}
        />
      </QueryClientProvider>
    );

    const reportButton = await screen.findByRole("button", {
      name: /Pacientes tratados por un profesional/
    });
    await waitFor(() => expect(reportButton).toHaveAttribute("aria-expanded", "true"));

    fireEvent.click(reportButton);
    expect(onReportChange).toHaveBeenCalledWith();
  });
});
