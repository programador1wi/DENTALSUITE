import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PatientSubnav } from "./patient-subnav";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ hasPermission: () => true })
}));

vi.mock("../hooks/use-patients", () => ({
  usePatient: () => ({ data: { id: "patient-1", patientNumber: 1 } })
}));

import { APP_ROUTES } from "@/lib/routes";

describe("PatientSubnav", () => {
  it("renders only the confirmed primary patient tabs", () => {
    render(
      <MemoryRouter initialEntries={["/pacientes/000001/facturacion/anulados"]}>
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
      <MemoryRouter initialEntries={["/pacientes/000001/facturacion/devoluciones"]}>
        <PatientSubnav patientId="patient-1" />
      </MemoryRouter>
    );

    const billingTab = screen.getByRole("link", { name: "Facturacion y pagos" });

    expect(billingTab).toHaveAttribute("href", APP_ROUTES.patients.billingPayments("000001"));
    expect(billingTab).toHaveClass("text-[#0879d5]");
  });
});
