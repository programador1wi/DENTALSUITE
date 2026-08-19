import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Alert } from "./alert";

describe("Alert component", () => {
  it("renders with default info variant, icon and role", () => {
    render(<Alert title="Información">Este es un mensaje informativo.</Alert>);
    const alert = screen.getByRole("status");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Información")).toBeInTheDocument();
    expect(screen.getByText("Este es un mensaje informativo.")).toBeInTheDocument();
  });

  it("renders warning variant properly", () => {
    render(<Alert variant="warning" title="Atención">Los pagos no reflejan descuentos por planilla.</Alert>);
    expect(screen.getByText("Atención")).toBeInTheDocument();
    expect(screen.getByText("Los pagos no reflejan descuentos por planilla.")).toBeInTheDocument();
  });

  it("renders danger variant with alert role and assertive aria-live", () => {
    render(<Alert variant="danger" title="Error">Ha ocurrido un fallo crítico.</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("handles dismissal internally when dismissible is true", () => {
    render(<Alert title="Aviso" dismissible>Contenido que se cerrará</Alert>);
    expect(screen.getByText("Contenido que se cerrará")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /cerrar aviso/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText("Contenido que se cerrará")).not.toBeInTheDocument();
  });

  it("calls onDismiss callback when clicked", () => {
    const onDismissMock = vi.fn();
    render(<Alert title="Aviso" onDismiss={onDismissMock}>Contenido</Alert>);

    const closeBtn = screen.getByRole("button", { name: /cerrar aviso/i });
    fireEvent.click(closeBtn);

    expect(onDismissMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();
  });

  it("renders custom action if provided", () => {
    render(
      <Alert
        title="Actualización"
        action={<button type="button">Actualizar ahora</button>}
      >
        Nueva versión disponible.
      </Alert>
    );

    expect(screen.getByRole("button", { name: /actualizar ahora/i })).toBeInTheDocument();
  });

  it("hides icon when icon={false}", () => {
    const { container } = render(<Alert icon={false}>Sin icono</Alert>);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});
