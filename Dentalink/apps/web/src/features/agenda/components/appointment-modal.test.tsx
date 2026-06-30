import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppointmentModal, SAME_DAY_APPOINTMENT_MESSAGE } from "./appointment-modal";

const availabilityData = [
  {
    day: { date: "2026-06-29" },
    slots: [
      { startAt: "2026-06-29T09:00:00.000", endAt: "2026-06-29T09:30:00.000", available: true },
      { startAt: "2026-06-29T10:00:00.000", endAt: "2026-06-29T10:30:00.000", available: true }
    ]
  },
  {
    day: { date: "2026-06-30" },
    slots: [
      { startAt: "2026-06-30T09:00:00.000", endAt: "2026-06-30T09:30:00.000", available: true }
    ]
  }
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[1] === "availability-week") {
      return { data: availabilityData, isLoading: false, isError: false, error: null };
    }

    return { data: [], isLoading: false, isError: false, error: null };
  }
}));

vi.mock("@/features/settings/specialties/hooks/use-specialties", () => ({
  useSpecialties: () => ({
    data: [{ id: "specialty-1", name: "General" }],
    isLoading: false,
    isError: false,
    error: null
  }),
  useSpecialtyAppointmentReasons: () => ({
    data: [
      {
        id: "reason-1",
        name: "Control",
        durationMinutes: 30,
        color: null,
        isActive: true
      }
    ],
    isLoading: false,
    isError: false,
    error: null
  })
}));

function renderAppointmentModal() {
  return render(
    <AppointmentModal
      open
      defaultDate="2026-06-29"
      initialValues={{
        branchId: "branch-1",
        specialtyId: "specialty-1",
        professionalId: "professional-1",
        chairId: "chair-1",
        durationMinutes: 30
      }}
      branches={[{ id: "branch-1", name: "Centro", agendaSlotMinutes: 30 } as never]}
      professionals={[
        {
          id: "professional-1",
          firstName: "Dra.",
          lastName: "Ruiz",
          commissionRate: "0",
          isActive: true,
          specialties: [{ id: "specialty-1", name: "General" }],
          branches: [
            {
              id: "branch-1",
              name: "Centro",
              status: "ACTIVE",
              agendaSlotMinutes: 30,
              defaultAppointmentDurationMinutes: 30
            }
          ]
        } as never
      ]}
      chairs={[{ id: "chair-1", branchId: "branch-1", name: "Sillon 1", isActive: true } as never]}
      patients={[]}
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      onCreatePatient={vi.fn()}
      multipleMode
    />
  );
}

async function openScheduleStep() {
  fireEvent.click(screen.getByRole("button", { name: /Control/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continuar a horario/ }));
  await waitFor(() => expect(screen.getByText("Horarios libres")).toBeInTheDocument());
}

describe("AppointmentModal multiple booking", () => {
  it("shows the booking problem and keeps one slot when selecting two slots on the same day", async () => {
    renderAppointmentModal();
    await openScheduleStep();

    fireEvent.click(screen.getAllByRole("button", { name: "09:00" })[0]);
    expect(screen.getByText("1 hora(s) seleccionada(s)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "10:00" }));

    expect(screen.getByText("Han ocurrido los siguientes problemas:")).toBeInTheDocument();
    expect(screen.getByText(SAME_DAY_APPOINTMENT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText("1 hora(s) seleccionada(s)")).toBeInTheDocument();
    expect(screen.getByText("Dar cita")).toBeInTheDocument();

    const closeButtons = screen.getAllByRole("button", { name: "Cerrar" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(screen.queryByText(SAME_DAY_APPOINTMENT_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByText("Dar cita")).toBeInTheDocument();
  }, 10000);

  it("allows selected slots on different days", async () => {
    renderAppointmentModal();
    await openScheduleStep();

    const nineOClockButtons = screen.getAllByRole("button", { name: "09:00" });
    fireEvent.click(nineOClockButtons[0]);
    fireEvent.click(nineOClockButtons[1]);

    expect(screen.queryByText(SAME_DAY_APPOINTMENT_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByText("2 hora(s) seleccionada(s)")).toBeInTheDocument();
  });
});
