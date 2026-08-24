import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsChartsPage } from "./reports-charts-page";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  exportReport: vi.fn(),
  catalog: [
    ["results", "Resultados", "chart-table"],
    ["money-flow", "Flujos de dinero", "chart-table"],
    ["patient-analysis", "Análisis de pacientes", "redirect"],
    ["expenses", "Gastos", "matrix"],
    ["professional-efficiency", "Eficiencia profesional", "table"],
    ["sales-by-procedure", "Ventas por procedimiento", "table"],
    ["sales-by-category", "Ventas por categoría", "table"],
    ["budget-capture-efficiency", "Eficiencia de captación", "stacked-cohort"],
    ["daily-collection", "Cobranza diaria", "matrix"],
    ["professional-ranking", "Ranking profesionales", "table"],
    ["delinquent-patients", "Pacientes morosos", "table"],
    ["financing-status", "Estado financiamientos", "matrix"],
    ["payroll-discount-status", "Descuentos por planilla", "matrix"],
    ["patient-referrals", "Derivación pacientes", "table"],
    ["captured-budgets", "Presupuestos capturados", "captured-budgets"],
  ].map(([type, title, renderer]) => ({
    type,
    title,
    renderer,
    description: `${title} real`,
  })),
}));

vi.mock("../hooks/use-reports", () => ({
  useChartsCatalog: () => ({
    data: mocks.catalog,
    isLoading: false,
    isError: false,
  }),
  requestChartReport: mocks.generate,
  requestExcelReport: mocks.exportReport,
}));

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({ data: [{ id: "branch-1", name: "Sucursal Centro" }] }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => (
    <div>{children as never}</div>
  ),
  BarChart: ({ children }: { children: unknown }) => (
    <div>{children as never}</div>
  ),
  Bar: () => <div />,
  CartesianGrid: () => <div />,
  Legend: () => <div />,
  Tooltip: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

function renderPage(initial = "/reportes/graficos?reporte=results") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/reportes/graficos" element={<ReportsChartsPage />} />
        <Route
          path="/pacientes/analisis"
          element={<div>Vista análisis pacientes</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function reportResponse(): Awaited<ReturnType<typeof mocks.generate>> {
  return {
    schemaVersion: 2,
    type: "results",
    renderer: "chart-table",
    title: "Resultados",
    description: "Resultado mensual",
    filters: {
      dateFrom: "2026-08-01T06:00:00.000Z",
      dateTo: "2026-09-01T05:59:59.999Z",
      branchId: null,
      branchName: "Todas",
      branchIds: ["branch-1"],
      timezone: "America/Mexico_City",
      currency: "MXN",
      preset: "custom",
      periodMode: "automatic",
      asOf: "2026-08-21",
    },
    definitions: {},
    summary: { sales: 1000, costs: 200, net: 800 },
    chart: [{ label: "Agosto", percent: 80 }],
    rows: [{ label: "Ventas", level: 0, values: [1000] }],
    data: {
      months: [{ key: "2026-08", label: "Agosto" }],
      rows: [{ label: "Ventas", level: 0, values: [1000] }],
    },
  };
}

describe("ReportsChartsPage", () => {
  beforeEach(() => {
    mocks.generate.mockReset();
    mocks.exportReport.mockReset();
    mocks.generate.mockResolvedValue(reportResponse());
  });

  it("exposes exactly the 15 requested report options", () => {
    renderPage();
    const selector = screen.getByLabelText(
      "Otros gráficos",
    ) as HTMLSelectElement;
    expect(selector.options).toHaveLength(15);
    expect(
      Array.from(selector.options).map((option) => option.value),
    ).not.toContain("sales-book");
  });

  it("redirects patient analysis to the existing patient view", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Otros gráficos"), {
      target: { value: "patient-analysis" },
    });
    expect(
      await screen.findByText("Vista análisis pacientes"),
    ).toBeInTheDocument();
  });

  it("generates the current period automatically and applies edited dates only on request", async () => {
    renderPage();
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    expect(mocks.generate).toHaveBeenCalledWith(
      "results",
      expect.objectContaining({
        currency: "MXN",
        page: 1,
        pageSize: 50,
      }),
    );
    expect(mocks.generate.mock.calls[0]?.[1]).not.toHaveProperty("dateFrom");
    expect(mocks.generate.mock.calls[0]?.[1]).not.toHaveProperty("dateTo");

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-07-01" },
    });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Filtros sin aplicar")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generar" }));
    await waitFor(() =>
      expect(mocks.generate).toHaveBeenCalledWith(
        "results",
        expect.objectContaining({
          preset: "custom",
          dateFrom: "2026-07-01",
          dateTo: "2026-08-31",
          currency: "MXN",
          page: 1,
          pageSize: 50,
        }),
      ),
    );
    expect(
      (await screen.findAllByText("$1,000")).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("resets filters and generates automatically when report type changes", async () => {
    renderPage();
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Otros gráficos"), {
      target: { value: "money-flow" },
    });

    await waitFor(() =>
      expect(mocks.generate).toHaveBeenCalledWith(
        "money-flow",
        expect.not.objectContaining({ dateFrom: expect.anything() }),
      ),
    );
    expect(mocks.generate).toHaveBeenCalledTimes(2);
  });

  it("exports the applied period instead of unapplied draft filters", async () => {
    mocks.generate.mockImplementation(async (_type, query) => ({
      ...reportResponse(),
      filters: query.dateFrom
        ? {
            ...reportResponse().filters,
            dateFrom: "2026-07-01T06:00:00.000Z",
            dateTo: "2026-09-01T05:59:59.999Z",
            periodMode: "historical" as const,
          }
        : reportResponse().filters,
      exportCode: "DAILY_COLLECTION",
    }));
    mocks.exportReport.mockResolvedValue({
      status: "PENDING",
      reportName: "Cobranza diaria",
    });
    renderPage();
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generar" }));
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-07-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));

    await waitFor(() =>
      expect(mocks.exportReport).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            dateFrom: "2026-07-01",
            dateTo: "2026-08-31",
          }),
        }),
      ),
    );
  });
});
