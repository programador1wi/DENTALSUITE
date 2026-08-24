import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { NovedadesDrawer } from "./novedades-drawer";
import { novedadesStoreApi } from "../stores/use-novedades-store";

describe("NovedadesDrawer", () => {
  beforeEach(() => {
    localStorage.clear();
    novedadesStoreApi.setState({
      isOpen: true,
      readIds: []
    });
  });

  it("renders releases and allows filtering", () => {
    render(
      <MemoryRouter>
        <NovedadesDrawer />
      </MemoryRouter>
    );

    expect(screen.getByText("Novedades y Actualizaciones")).toBeInTheDocument();
    expect(screen.getByText("Todas (4)")).toBeInTheDocument();
    expect(screen.getByText("Nuevas (2)")).toBeInTheDocument();
    expect(screen.getByText("Mejoras (2)")).toBeInTheDocument();

    // Check title of first item
    expect(
      screen.getByText("Contact Center inteligente con automatizaciones y recordatorios multicanal")
    ).toBeInTheDocument();

    // Filter to IMPROVEMENT only
    fireEvent.click(screen.getByText("Mejoras (2)"));

    // Item 1 (category NEW) should not be visible now
    expect(
      screen.queryByText("Contact Center inteligente con automatizaciones y recordatorios multicanal")
    ).not.toBeInTheDocument();

    // Item 3 (category IMPROVEMENT) should be visible
    expect(
      screen.getByText("Firma Digital en Consentimientos y Recetas Electrónicas")
    ).toBeInTheDocument();
  });

  it("marks all as read when button is clicked", () => {
    render(
      <MemoryRouter>
        <NovedadesDrawer />
      </MemoryRouter>
    );

    const markAllBtn = screen.getByRole("button", { name: /Marcar todo como visto/i });
    expect(markAllBtn).toBeInTheDocument();

    fireEvent.click(markAllBtn);

    expect(novedadesStoreApi.getState().getUnreadCount()).toBe(0);
    expect(screen.getByText("Estás al día con las actualizaciones")).toBeInTheDocument();
  });
});
