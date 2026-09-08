import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeveloperApiScopeChecklist } from "./developer-api-scope-checklist";
import type { DeveloperApiScope } from "../services/api-keys.service";

const options = [
  {
    value: "patients:read" as const,
    label: "Consultar pacientes",
    description: "Listar pacientes autorizados."
  },
  {
    value: "patients:write" as const,
    label: "Crear pacientes",
    description: "Crear pacientes autorizados."
  },
  {
    value: "appointments:read" as const,
    label: "Consultar citas",
    description: "Listar citas autorizadas."
  },
  {
    value: "appointments:write" as const,
    label: "Crear citas",
    description: "Crear citas autorizadas."
  },
  {
    value: "budgets:read" as const,
    label: "Consultar presupuestos",
    description: "Consultar presupuestos autorizados."
  },
  {
    value: "pricing:read" as const,
    label: "Consultar precios",
    description: "Consultar precios autorizados."
  }
];

function StatefulChecklist() {
  const [selected, setSelected] = useState<DeveloperApiScope[]>(["patients:read"]);
  return <DeveloperApiScopeChecklist options={options} value={selected} onChange={setSelected} />;
}

describe("DeveloperApiScopeChecklist", () => {
  it("groups the six external permissions using the role permission pattern", () => {
    render(<StatefulChecklist />);

    expect(screen.getByRole("heading", { name: "Pacientes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Presupuestos y precios" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.queryByText("Marcar todos los permisos")).not.toBeInTheDocument();
  });

  it("toggles scopes individually and updates the selected counter", () => {
    render(<StatefulChecklist />);

    expect(screen.getByRole("checkbox", { name: "Crear pacientes" })).not.toBeChecked();
    fireEvent.click(screen.getByText("Crear pacientes"));

    expect(screen.getByRole("checkbox", { name: "Crear pacientes" })).toBeChecked();
    expect(screen.getByText("2 de 6 seleccionados")).toBeInTheDocument();
  });

  it("reveals the description and technical scope from the information control", () => {
    render(<StatefulChecklist />);

    const information = screen.getByRole("button", { name: "Información sobre Consultar citas" });
    fireEvent.click(information);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Listar citas autorizadas.");
    expect(screen.getByRole("tooltip")).toHaveTextContent("appointments:read");
  });
});
