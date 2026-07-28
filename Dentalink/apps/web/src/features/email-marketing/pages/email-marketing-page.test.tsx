import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  EmailMarketingPage,
  emailMarketingPaths,
  emailMarketingReportPath,
  resolveEmailMarketingTab
} from "./email-marketing-page";

const serviceMocks = vi.hoisted(() => ({
  archiveTemplate: vi.fn(),
  createDomain: vi.fn(),
  createTemplate: vi.fn(),
  getMarketingSettings: vi.fn(),
  getSenderConfiguration: vi.fn(),
  listCampaigns: vi.fn(),
  listTemplates: vi.fn(),
  updateMarketingSettings: vi.fn(),
  verifyDomain: vi.fn()
}));

vi.mock("../services/email-marketing.service", () => serviceMocks);
vi.mock("../components/marketing-reports-panel", () => ({
  MarketingReportsPanel: ({
    selectedReportCode,
    campaignOpen,
    onReportChange,
    onOpenCampaign
  }: {
    selectedReportCode?: string;
    campaignOpen?: boolean;
    onReportChange: (reportCode?: string) => void;
    onOpenCampaign: (reportCode: string) => void;
  }) => (
    <div>
      <p data-testid="route-state">
        {selectedReportCode ?? "biblioteca"} · {campaignOpen ? "campaña" : "reporte"}
      </p>
      <button type="button" onClick={() => onReportChange("PATIENTS_TREATED_BY_PROFESSIONAL")}>
        Abrir reporte simulado
      </button>
      {selectedReportCode && (
        <button type="button" onClick={() => onOpenCampaign(selectedReportCode)}>
          Abrir campaña simulada
        </button>
      )}
    </div>
  )
}));

describe("email marketing routes", () => {
  it("gives every main section a stable URL", () => {
    expect(emailMarketingPaths).toEqual({
      reports: "/crm/email-marketing/reports",
      campaigns: "/crm/email-marketing/campaigns",
      templates: "/crm/email-marketing/templates",
      settings: "/crm/email-marketing/settings"
    });
  });

  it("builds report and campaign paths without losing the report code", () => {
    expect(emailMarketingReportPath("PATIENTS_TREATED_BY_PROFESSIONAL")).toBe(
      "/crm/email-marketing/reports/PATIENTS_TREATED_BY_PROFESSIONAL"
    );
    expect(emailMarketingReportPath("PATIENTS_TREATED_BY_PROFESSIONAL", true)).toBe(
      "/crm/email-marketing/reports/PATIENTS_TREATED_BY_PROFESSIONAL/campaign"
    );
  });

  it("resolves the active tab for nested report URLs", () => {
    expect(resolveEmailMarketingTab("/crm/email-marketing/reports/ALL_PATIENTS/campaign")).toBe("reports");
    expect(resolveEmailMarketingTab("/crm/email-marketing/campaigns")).toBe("campaigns");
    expect(resolveEmailMarketingTab("/crm/email-marketing/templates")).toBe("templates");
    expect(resolveEmailMarketingTab("/crm/email-marketing/settings")).toBe("settings");
  });

  it("keeps browser Back inside Email Marketing across report and campaign views", async () => {
    serviceMocks.getSenderConfiguration.mockResolvedValue({
      organization: { name: "Clínica Demo", email: "contacto@demo.local" },
      defaultSender: { fromAddress: "no-reply@demo.local", fromName: "Clínica Demo", provider: "smtp" },
      domains: [],
      branches: [],
      professionals: [],
      agreements: []
    });
    const router = createMemoryRouter(
      [
        {
          path: "/crm/email-marketing",
          element: <Navigate to="/crm/email-marketing/reports" replace />
        },
        { path: "/crm/email-marketing/reports", element: <EmailMarketingPage /> },
        { path: "/crm/email-marketing/reports/:reportCode", element: <EmailMarketingPage /> },
        {
          path: "/crm/email-marketing/reports/:reportCode/campaign",
          element: <EmailMarketingPage />
        }
      ],
      { initialEntries: ["/crm/email-marketing"] }
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await screen.findByText("Abrir reporte simulado");
    expect(router.state.location.pathname).toBe(emailMarketingPaths.reports);

    fireEvent.click(screen.getByRole("button", { name: "Abrir reporte simulado" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        emailMarketingReportPath("PATIENTS_TREATED_BY_PROFESSIONAL")
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir campaña simulada" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        emailMarketingReportPath("PATIENTS_TREATED_BY_PROFESSIONAL", true)
      )
    );

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        emailMarketingReportPath("PATIENTS_TREATED_BY_PROFESSIONAL")
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("route-state")).toHaveTextContent("PATIENTS_TREATED_BY_PROFESSIONAL · reporte")
    );

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(emailMarketingPaths.reports));
    await waitFor(() => expect(screen.getByTestId("route-state")).toHaveTextContent("biblioteca · reporte"));
  });
});
