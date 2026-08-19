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
  it("shows usual permissions first and keeps internal permissions hidden", () => {
    render(<StatefulChecklist />);

    expect(screen.getByText("Ver pacientes")).toBeInTheDocument();
    expect(screen.queryByText("Desactivar pacientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Administración total")).not.toBeInTheDocument();
  });

  it("reveals advanced permissions without losing hidden selections", () => {
    render(<StatefulChecklist />);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar avanzadas" }));
    expect(screen.getByRole("checkbox", { name: "Desactivar pacientes" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Ver pacientes" }));
    expect(screen.getByRole("checkbox", { name: "Desactivar pacientes" })).toBeChecked();
  });
});
