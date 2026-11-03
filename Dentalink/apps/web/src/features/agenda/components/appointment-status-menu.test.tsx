import { fireEvent, render, screen } from "@testing-library/react";
import { AppointmentStatusMenu } from "./appointment-status-menu";
import type { Appointment } from "../services/appointments.service";

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment-1",
    organizationId: "org-1",
    branchId: "branch-1",
    patientId: "patient-1",
    professionalId: "professional-1",
    chairId: "chair-1",
    specialtyId: null,
    treatmentPlanId: null,
    title: "Control dental",
    reason: null,
    status: "SCHEDULED",
    startAt: "2026-07-09T15:00:00.000Z",
    endAt: "2026-07-09T15:30:00.000Z",
    durationMinutes: 30,
    notes: null,
    cancellationReason: null,
    branch: { id: "branch-1", name: "Sucursal centro" },
    patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez", phone: "555-0101", email: "ana@example.com" },
    professional: { id: "professional-1", firstName: "Dra.", lastName: "Ruiz", color: null },
    chair: { id: "chair-1", name: "Sillon 1" },
    specialty: null,
    ...overrides
  };
}

describe("AppointmentStatusMenu", () => {
  it("shows a sending state while the email confirmation status is pending", () => {
    render(<AppointmentStatusMenu appointment={buildAppointment()} pendingStatus="NOTIFIED_BY_EMAIL" onChangeStatus={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Enviando correo/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
