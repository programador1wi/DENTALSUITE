import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PatientAppointmentsStats } from "./patient-appointments-stats";
import type { Appointment } from "@/features/agenda/services/appointments.service";

// Mock Recharts ResponsiveContainer to avoid 0-width issue in jsdom
vi.mock("recharts", async () => {
  const original = await vi.importActual<any>("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 400, height: 200 }}>{children}</div>
  };
});

describe("PatientAppointmentsStats", () => {
  const sampleAppointments: Appointment[] = [
    {
      id: "appt-1",
      organizationId: "org-1",
      title: "Limpieza",
      patientId: "p1",
      professionalId: "prof-1",
      branchId: "b1",
      chairId: "c1",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T11:00:00.000Z",
      durationMinutes: 60,
      status: "COMPLETED",
      professional: { id: "prof-1", firstName: "Ana", lastName: "Gomez" },
      branch: { id: "b1", name: "Sucursal Central" }
    },
    {
      id: "appt-2",
      organizationId: "org-1",
      title: "Control",
      patientId: "p1",
      professionalId: "prof-1",
      branchId: "b1",
      chairId: "c1",
      startAt: "2026-08-02T10:00:00.000Z",
      endAt: "2026-08-02T11:00:00.000Z",
      durationMinutes: 60,
      status: "NO_SHOW",
      professional: { id: "prof-1", firstName: "Ana", lastName: "Gomez" },
      branch: { id: "b1", name: "Sucursal Central" }
    },
    {
      id: "appt-3",
      organizationId: "org-1",
      title: "Extracción",
      patientId: "p1",
      professionalId: "prof-1",
      branchId: "b1",
      chairId: "c1",
      startAt: "2026-08-03T10:00:00.000Z",
      endAt: "2026-08-03T11:00:00.000Z",
      durationMinutes: 60,
      status: "CANCELLED_BY_PATIENT",
      professional: { id: "prof-1", firstName: "Ana", lastName: "Gomez" },
      branch: { id: "b1", name: "Sucursal Central" }
    },
    {
      id: "appt-4",
      organizationId: "org-1",
      title: "Revisión",
      patientId: "p1",
      professionalId: "prof-1",
      branchId: "b1",
      chairId: "c1",
      startAt: "2026-08-04T10:00:00.000Z",
      endAt: "2026-08-04T11:00:00.000Z",
      durationMinutes: 60,
      status: "SCHEDULED",
      professional: { id: "prof-1", firstName: "Ana", lastName: "Gomez" },
      branch: { id: "b1", name: "Sucursal Central" }
    }
  ];

  it("renders empty state when there are no appointments", () => {
    render(<PatientAppointmentsStats appointments={[]} />);
    expect(screen.getByText("No hay citas registradas para generar estadísticas.")).toBeInTheDocument();
  });

  it("calculates and renders correct KPI values and attendance rate", () => {
    render(<PatientAppointmentsStats appointments={sampleAppointments} />);

    // Total appointments
    expect(screen.getByText("4")).toBeInTheDocument();

    // Headers
    expect(screen.getAllByText("Atendidas").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("No Asistió").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Canceladas").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Próximas").length).toBeGreaterThanOrEqual(1);

    // Rates (1 completed, 1 no-show => 50% resolved attendance rate)
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(1);

    // Asesor de Sobreagendamiento banner
    expect(screen.getByText("Asesor de Sobreagendamiento")).toBeInTheDocument();
  });
});
