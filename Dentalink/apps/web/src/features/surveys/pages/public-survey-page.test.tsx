import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicSurveyPage } from "./public-survey-page";
import { getPublicSurvey, startPublicSurvey, submitPublicSurvey } from "../services/surveys.service";

vi.mock("../services/surveys.service", () => ({
  getPublicSurvey: vi.fn(),
  startPublicSurvey: vi.fn(),
  submitPublicSurvey: vi.fn()
}));

const publicSurvey = {
  state: "READY" as const,
  brand: { organizationName: "Dental Warner", branchName: "Sucursal Centro", logoUrl: null, primaryColor: "#185FA5" },
  survey: {
    name: "Encuesta de satisfacción",
    type: "SATISFACTION" as const,
    version: 1,
    welcomeHtml: "<p>Hola paciente</p>",
    footerHtml: "<p>Gracias</p>",
    sections: [
      {
        id: "section-1",
        name: "Atención",
        description: null,
        position: 0,
        questions: [{
          id: "question-1",
          text: "¿Cómo fue tu atención?",
          description: null,
          type: "LIKERT_5" as const,
          isRequired: true,
          position: 0,
          options: Array.from({ length: 5 }, (_, index) => ({ id: `option-${index + 1}`, label: String(index + 1), value: String(index + 1), position: index }))
        }]
      },
      {
        id: "section-2",
        name: "Comentarios",
        description: null,
        position: 1,
        questions: [{ id: "question-2", text: "¿Algo más?", description: null, type: "FREE_TEXT" as const, isRequired: false, position: 0, options: [] }]
      }
    ]
  }
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/public/surveys/respond/token-123"]}>
        <Routes><Route path="/public/surveys/respond/:token" element={<PublicSurveyPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("PublicSurveyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(getPublicSurvey).mockResolvedValue(publicSurvey);
    vi.mocked(startPublicSurvey).mockResolvedValue({ responseId: "response-1", state: "STARTED" });
    vi.mocked(submitPublicSurvey).mockResolvedValue({ responseId: "response-1", state: "SUBMITTED", message: "Gracias por compartir tu opinión." });
  });

  it("does not advance while a required question is unanswered", async () => {
    renderPage();
    expect(await screen.findByText("¿Cómo fue tu atención?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByText("Responde esta pregunta para continuar.")).toBeInTheDocument();
    expect(screen.queryByText("¿Algo más?")).not.toBeInTheDocument();
  });

  it("advances section by section and starts the response once", async () => {
    renderPage();
    await screen.findByText("¿Cómo fue tu atención?");
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("¿Algo más?")).toBeInTheDocument();
    await waitFor(() => expect(startPublicSurvey).toHaveBeenCalledTimes(1));
  });
});
