import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientSecondaryNav } from "./patient-secondary-nav";

const permissionState = vi.hoisted(() => ({
  allowed: new Set<string>()
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    hasPermission: (permission: string) => permissionState.allowed.has(permission)
  })
}));

describe("PatientSecondaryNav", () => {
  beforeEach(() => {
    permissionState.allowed = new Set(["appointments.read"]);
  });

  it("renders visible secondary tabs and filters protected tabs", () => {
    render(
      <MemoryRouter initialEntries={["/patients/patient-1/profile/appointments"]}>
        <PatientSecondaryNav
          label="Vistas de datos personales"
          tabs={[
            { to: "/patients/patient-1/profile", label: "Datos personales" },
            { to: "/patients/patient-1/profile/appointments", label: "Citas", permission: "appointments.read" },
            { to: "/patients/patient-1/profile/emails", label: "Emails", permission: "emails.read" }
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: "Vistas de datos personales" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Datos personales" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Citas" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Emails" })).not.toBeInTheDocument();
  });

  it("marks a secondary tab active by activeMatch", () => {
    render(
      <MemoryRouter initialEntries={["/patients/patient-1/billing/deleted"]}>
        <PatientSecondaryNav
          label="Vistas de facturacion"
          tabs={[
            { to: "/patients/patient-1/billing", label: "Pagos" },
            {
              to: "/patients/patient-1/billing/deleted",
              label: "Pagos eliminados",
              activeMatch: "/patients/patient-1/billing/deleted"
            }
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Pagos eliminados" })).toHaveClass("text-[#0879d5]");
  });
});
