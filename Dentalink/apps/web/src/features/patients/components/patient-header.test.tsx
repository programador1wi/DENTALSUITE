import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientHeader } from "./patient-header";
import * as patientHooks from "../hooks/use-patients";

vi.mock("../hooks/use-patients", () => ({
  usePatient: vi.fn()
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: any, public options?: any) {}
}

describe("PatientHeader", () => {
  const mockPatient = {
    id: "patient-3336",
    patientNumber: 3336,
    organizationId: "org-1",
    branchId: "branch-1",
    firstName: "Bertha Judith",
    lastName: "Roldan Ledesma",
    documentType: "CURP",
    documentNumber: "ROLD860512MDFXXX01",
    gender: "F",
    birthDate: "1986-05-12T00:00:00.000Z",
    status: "ACTIVE",
    medicalAlerts: [
      { id: "alt-1", type: "Alergia", description: "Penicilina", severity: "CRITICAL", isActive: true }
    ],
    summary: {
      balance: 5000,
      nextAppointment: "2026-09-01T10:00:00.000Z"
    },
    agreement: {
      id: "agr-1",
      name: "Beneficios Dentales"
    }
  };

  beforeEach(() => {
    global.IntersectionObserver = MockIntersectionObserver as any;

    vi.mocked(patientHooks.usePatient).mockReturnValue({
      data: mockPatient as any,
      isLoading: false,
      isError: false
    } as any);
  });

  it("renders patient full name, ID, and information tags in main header", () => {
    render(
      <MemoryRouter>
        <PatientHeader patientId="patient-3336" />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Bertha Judith Roldan Ledesma", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/ID 003336/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/ROLD860512MDFXXX01/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Beneficios Dentales/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders quick action links for agenda, payments, and history with canonical 6-digit ID", () => {
    render(
      <MemoryRouter>
        <PatientHeader patientId="patient-3336" />
      </MemoryRouter>
    );

    const agendarLinks = screen.getAllByRole("link", { name: /Agendar/i });
    expect(agendarLinks.length).toBeGreaterThan(0);
    expect(agendarLinks[0]).toHaveAttribute("href", "/agenda/day?patientId=003336");
  });

  it("renders sticky mini-header container ready for scroll pinning", () => {
    render(
      <MemoryRouter>
        <PatientHeader patientId="patient-3336" />
      </MemoryRouter>
    );

    const stickyRegion = screen.getByRole("region", { name: "Identificador persistente de paciente" });
    expect(stickyRegion).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bertha Judith Roldan Ledesma", level: 2 })).toBeInTheDocument();
  });
});
