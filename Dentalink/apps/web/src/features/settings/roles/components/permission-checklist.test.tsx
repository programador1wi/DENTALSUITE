import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PermissionChecklist } from "./permission-checklist";
import type { PermissionListItem } from "@/features/settings/permissions/services/permissions.service";

const permissions: PermissionListItem[] = [
  {
    id: "basic",
    key: "patients.read",
    name: "Read patients",
    module: "patients",
    isActive: true,
    label: "Ver pacientes",
    businessGroup: "Pacientes",
    presentationTier: "BASIC",
    delegable: true
  },
  {
    id: "advanced",
    key: "patients.deactivate",
    name: "Deactivate patients",
    module: "patients",
    isActive: true,
    label: "Desactivar pacientes",
    businessGroup: "Pacientes",
    presentationTier: "ADVANCED",
    delegable: true
  },
  {
    id: "internal",
    key: "system.manage_all",
    name: "Manage all",
    module: "system",
    isActive: true,
    label: "Administración total",
    businessGroup: "Administración",
    presentationTier: "INTERNAL",
    delegable: false
  }
];

function StatefulChecklist() {
  const [selected, setSelected] = useState(["advanced", "internal"]);
  return <PermissionChecklist allPermissions={permissions} selectedIds={selected} onChange={setSelected} />;
}

describe("PermissionChecklist", () => {
  it("shows non-internal permissions and keeps internal permissions hidden", () => {
    render(<StatefulChecklist />);

    expect(screen.getByText("Ver pacientes")).toBeInTheDocument();
    expect(screen.getByText("Desactivar pacientes")).toBeInTheDocument();
    expect(screen.queryByText("Administración total")).not.toBeInTheDocument();
  });

  it("filters permissions by search query", () => {
    render(<StatefulChecklist />);

    const searchInput = screen.getByPlaceholderText("Filtrar permisos...");
    fireEvent.change(searchInput, { target: { value: "Desactivar" } });

    expect(screen.queryByText("Ver pacientes")).not.toBeInTheDocument();
    expect(screen.getByText("Desactivar pacientes")).toBeInTheDocument();
  });

  it("preserves hidden selections when toggling visible permissions", () => {
    render(<StatefulChecklist />);

    expect(screen.getByRole("checkbox", { name: "Desactivar pacientes" })).toBeChecked();

    fireEvent.click(screen.getByText("Ver pacientes"));
    expect(screen.getByRole("checkbox", { name: "Ver pacientes" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Desactivar pacientes" })).toBeChecked();
  });

  it("allows selecting all visible delegable permissions without losing internal selections", () => {
    render(<StatefulChecklist />);

    const selectAllCheckbox = screen.getByLabelText("Marcar todos los permisos");
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByRole("checkbox", { name: "Ver pacientes" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Desactivar pacientes" })).toBeChecked();
  });
});
