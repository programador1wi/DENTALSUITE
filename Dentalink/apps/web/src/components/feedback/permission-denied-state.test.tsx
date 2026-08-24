import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PermissionDeniedState } from "./permission-denied-state";
import { ErrorState } from "./error-state";

describe("PermissionDeniedState & ErrorState UX Feedbacks", () => {
  it("renders page variant with title, description, and return home button", () => {
    render(
      <BrowserRouter>
        <PermissionDeniedState
          variant="page"
          title="Sección Restringida"
          description="Se requiere el rol de Tesorería para acceder a esta vista."
        />
      </BrowserRouter>
    );

    expect(screen.getByRole("heading", { name: "Sección Restringida" })).toBeInTheDocument();
    expect(
      screen.getByText("Se requiere el rol de Tesorería para acceder a esta vista.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Volver al inicio/i })).toBeInTheDocument();
  });

  it("renders tab variant for section-level restrictions without full page redirect", () => {
    render(
      <PermissionDeniedState
        variant="tab"
        title="Historial Financiero Bloqueado"
        description="No tienes permiso para ver balances de caja."
      />
    );

    expect(screen.getByRole("heading", { name: "Historial Financiero Bloqueado" })).toBeInTheDocument();
    expect(screen.getByText("No tienes permiso para ver balances de caja.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Volver al inicio/i })).not.toBeInTheDocument();
  });

  it("ErrorState automatically degrades to PermissionDeniedState on 403 or Forbidden messages", () => {
    render(<ErrorState message="HTTP 403: Forbidden - Insufficient permissions" />);

    expect(screen.getByRole("heading", { name: "Acceso restringido" })).toBeInTheDocument();
    expect(screen.getByText("HTTP 403: Forbidden - Insufficient permissions")).toBeInTheDocument();
  });

  it("ErrorState renders standard error alert on generic errors", () => {
    render(<ErrorState message="Error al conectar con la base de datos" />);

    expect(screen.getByText("Error al conectar con la base de datos")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Acceso restringido" })).not.toBeInTheDocument();
  });
});
