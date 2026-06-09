import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AgendaDailyList } from "./agenda-daily-list";
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
    status: "COMPLETED",
    startAt: "2026-06-06T15:00:00.000Z",
    endAt: "2026-06-06T15:30:00.000Z",
    durationMinutes: 30,
    notes: "Trae radiografia",
    cancellationReason: null,
    branch: { id: "branch-1", name: "Sucursal centro" },
    patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez", phone: "555-0101", email: null },
    professional: { id: "professional-1", firstName: "Dra.", lastName: "Ruiz", color: null },
    chair: { id: "chair-1", name: "Sillon 1" },
    specialty: null,
    ...overrides
  };
}

describe("AgendaDailyList comment action", () => {
  it("opens the appointment comment action from the daily list button", () => {
    const appointment = buildAppointment();
    const onMenuAction = vi.fn();

    render(
      <MemoryRouter>
        <AgendaDailyList
          appointments={[appointment]}
          date="2026-06-06"
          onDateChange={vi.fn()}
          onEdit={vi.fn()}
          onCancel={vi.fn()}
          onReschedule={vi.fn()}
          onConfirm={vi.fn()}
          onArrive={vi.fn()}
          onWaitingRoom={vi.fn()}
          onStart={vi.fn()}
          onComplete={vi.fn()}
          onNoShow={vi.fn()}
          onMenuAction={onMenuAction}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar comentario de cita" }));

    expect(onMenuAction).toHaveBeenCalledWith(appointment, "addComment");
  });
});
