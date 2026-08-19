import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("keeps one primary action and exposes compact mobile actions", () => {
    const onExport = vi.fn();
    render(
      <PageHeader
        title="Pacientes"
        description="Gestión clínica y administrativa"
        primaryAction={<button type="button">Nuevo paciente</button>}
        mobileActions={[{ id: "export", label: "Exportar pacientes", onSelect: onExport }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Pacientes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo paciente" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Más acciones" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Exportar pacientes" }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
