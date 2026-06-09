import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PatientSubnav } from "./patient-subnav";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: () => true })
}));

describe("PatientSubnav", () => {
  it("renders only the confirmed primary patient tabs", () => {
    render(
      <MemoryRouter initialEntries={["/patients/patient-1/billing/deleted"]}>
        <PatientSubnav patientId="patient-1" />
      </MemoryRouter>
    );

    const links = screen.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Datos personales",
      "Ficha clinica",
      "Planes de tratamiento",
      "Facturacion y pagos",
      "Recibir pago"
    ]);
    expect(screen.queryByRole("link", { name: "Citas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gestion CRM" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Consentimientos" })).not.toBeInTheDocument();
  });

  it("keeps Facturacion y pagos active for billing subtabs", () => {
    render(
      <MemoryRouter initialEntries={["/patients/patient-1/billing/refunds"]}>
        <PatientSubnav patientId="patient-1" />
      </MemoryRouter>
    );

    const billingTab = screen.getByRole("link", { name: "Facturacion y pagos" });

    expect(billingTab).toHaveAttribute("href", "/patients/patient-1/billing");
    expect(billingTab).toHaveClass("text-[#0879d5]");
  });
});
