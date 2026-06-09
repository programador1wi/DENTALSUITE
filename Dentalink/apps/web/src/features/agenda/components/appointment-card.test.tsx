import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppointmentCard } from "./appointment-card";
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
    startAt: "2026-06-06T15:00:00.000Z",
    endAt: "2026-06-06T15:30:00.000Z",
    durationMinutes: 30,
    notes: null,
    cancellationReason: null,
    branch: { id: "branch-1", name: "Sucursal centro" },
    patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez", phone: "555-0101", email: null },
    professional: { id: "professional-1", firstName: "Dra.", lastName: "Ruiz", color: null },
    chair: { id: "chair-1", name: "Sillon 1" },
    specialty: null,
    ...overrides
  };
}

describe("AppointmentCard comment action", () => {
  it("opens the appointment comment action from the compact card button", () => {
    const appointment = buildAppointment();
    const onEdit = vi.fn();
    const onMenuAction = vi.fn();

    render(
      <MemoryRouter>
        <AppointmentCard
          appointment={appointment}
          compact
          onEdit={onEdit}
          onMenuAction={onMenuAction}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar comentario de cita" }));

    expect(onMenuAction).toHaveBeenCalledWith(appointment, "addComment");
    expect(onEdit).not.toHaveBeenCalled();
  });
});
