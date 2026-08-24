import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { NovedadesPage } from "./novedades-page";
import { novedadesStoreApi } from "../stores/use-novedades-store";

describe("NovedadesPage", () => {
  beforeEach(() => {
    localStorage.clear();
    novedadesStoreApi.setState({
      isOpen: false,
      readIds: []
    });
  });

  it("renders full page layout, release items and search filter", () => {
    render(
      <MemoryRouter>
        <NovedadesPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Novedades y Actualizaciones")).toBeInTheDocument();

    // Check search functionality
    const searchInput = screen.getByPlaceholderText(/Buscar por función o tag/i);
    fireEvent.change(searchInput, { target: { value: "Fintech" } });

    expect(
      screen.getByText("Fintech Dental: Conciliación automática y pasarelas de pago integradas")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Contact Center inteligente con automatizaciones y recordatorios multicanal")
    ).not.toBeInTheDocument();
  });

  it("filters by category correctly", () => {
    render(
      <MemoryRouter>
        <NovedadesPage />
      </MemoryRouter>
    );

    // Click on "Correcciones" filter
    const fixButton = screen.getByRole("button", { name: /^Correcciones/i });
    fireEvent.click(fixButton);

    // When no fix items exist in sample, shows empty state
    expect(screen.getByText("No se encontraron novedades")).toBeInTheDocument();
  });
});
