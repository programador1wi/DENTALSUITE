import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppointmentCommentModal, AppointmentDurationModal } from "./appointment-action-modals";
import type { Appointment } from "../services/appointments.service";

const { refetchComments } = vi.hoisted(() => ({
  refetchComments: vi.fn()
}));

vi.mock("../hooks/use-appointments", () => ({
  useAppointmentNotes: () => ({
    data: [
      {
        id: "note-1",
        appointmentId: "appointment-1",
        userId: "user-2",
        user: { id: "user-2", firstName: "Laura", lastName: "Garcia" },
        note: "Comentario previo",
        isPrivate: false,
        createdAt: "2026-06-06T14:00:00.000Z"
      }
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchComments
  })
}));

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
    notes: "Comentario actual",
    cancellationReason: null,
    createdAt: "2026-06-06T13:00:00.000Z",
    updatedAt: "2026-06-06T13:00:00.000Z",
    branch: { id: "branch-1", name: "Sucursal centro" },
    patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez", phone: "555-0101", email: null },
    professional: { id: "professional-1", firstName: "Dra.", lastName: "Ruiz", color: null },
    chair: { id: "chair-1", name: "Sillon 1" },
    specialty: null,
    createdBy: { id: "user-1", firstName: "Carlos", lastName: "Perez" },
    ...overrides
  };
}

describe("AppointmentCommentModal", () => {
  beforeEach(() => {
    refetchComments.mockResolvedValue({});
  });

  it("adds appointment comments and shows the comment history", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <AppointmentCommentModal
        appointment={buildAppointment()}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByRole("dialog", { name: "Comentario" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comentario" })).toBeInTheDocument();
    expect(screen.queryByText("Comentario privado")).not.toBeInTheDocument();
    expect(screen.queryByText("Notas heredadas")).not.toBeInTheDocument();
    expect(screen.getByText("Comentario actual")).toBeInTheDocument();
    expect(screen.getByText("Comentario previo")).toBeInTheDocument();
    expect(screen.getByText(/Carlos Perez/)).toBeInTheDocument();
    expect(screen.getByText(/Laura Garcia/)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("Ingrese un nuevo comentario");
    expect(textarea).toHaveValue("");

    fireEvent.change(textarea, { target: { value: "  Nuevo comentario  " } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("appointment-1", "Nuevo comentario"));
    expect(onConfirm.mock.calls[0]).toHaveLength(2);
    expect(refetchComments).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("AppointmentDurationModal", () => {
  it("updates duration without sending implicit overbooking intent", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <AppointmentDurationModal
        appointment={buildAppointment()}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Minutos"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("appointment-1", {
        startAt: "2026-06-06T15:00:00.000Z",
        endAt: "2026-06-06T15:40:00.000Z",
        durationMinutes: 40
      })
    );
    expect(onConfirm.mock.calls[0]?.[1]).not.toHaveProperty("allowOverbooking");
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the duration modal open when backend rejects an overlap", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error("No se puede modificar la cita porque se empalma con otra cita del doctor o sillón."));

    render(
      <AppointmentDurationModal
        appointment={buildAppointment()}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Minutos"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Minutos")).toBeInTheDocument();
  });
});
