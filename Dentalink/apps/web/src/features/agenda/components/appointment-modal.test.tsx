import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppointmentModal, SAME_DAY_APPOINTMENT_MESSAGE, type AppointmentSubmitOptions } from "./appointment-modal";
import type { PatientDetail, PatientPayload } from "@/features/patients/services/patients.service";
import type { CreateTreatmentPlanPayload } from "@/features/treatments/services/treatments.service";
import type { AppointmentPayload } from "../services/appointments.service";

type AppointmentModalSubmit = (payloads: AppointmentPayload[], options?: AppointmentSubmitOptions) => Promise<void>;

const treatmentPlansByPatient = vi.hoisted(() => new Map<string, unknown[]>());
const patientDayAppointmentsByPatient = vi.hoisted(() => new Map<string, unknown[]>());
const allowedPermissions = vi.hoisted(
  () =>
    new Set([
      "organization.manage_all",
      "treatment_plans.read",
      "treatment_plans.create"
    ])
);

const availabilityData = [
  {
    day: { date: "2026-06-29" },
    slots: [
      { startAt: "2026-06-29T09:00:00.000", endAt: "2026-06-29T09:30:00.000", available: true },
      { startAt: "2026-06-29T09:30:00.000", endAt: "2026-06-29T10:00:00.000", available: true },
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
  useQueryClient: () => ({ setQueryData: vi.fn() }),
  useMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useQuery: ({ enabled = true, queryKey }: { enabled?: boolean; queryKey: unknown[] }) => {
    if (queryKey[1] === "availability-week") {
      return { data: availabilityData, isLoading: false, isError: false, error: null };
    }

    if (queryKey[1] === "patient-day-limit") {
      const patientId = String(queryKey[3] ?? "");
      return {
        data: enabled ? patientDayAppointmentsByPatient.get(patientId) ?? [] : [],
        isLoading: false,
        isError: false,
        error: null
      };
    }

    if (queryKey[0] === "treatment-plans") {
      const params = queryKey[1] as { patientId?: string } | undefined;
      return {
        data: enabled ? treatmentPlansByPatient.get(params?.patientId ?? "") ?? [] : [],
        isLoading: false,
        isError: false,
        error: null
      };
    }

    return { data: [], isLoading: false, isError: false, error: null };
  }
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    hasPermission: (permission: string) => allowedPermissions.has(permission)
  })
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

const patientAna = {
  id: "patient-1",
  branchId: "branch-1",
  branchName: "Centro",
  firstName: "Ana",
  lastName: "Lopez",
  documentNumber: "ANA-1",
  email: "ana@example.com",
  phone: "+521111111111",
  status: "ACTIVE",
  createdAt: "2026-06-01T00:00:00.000Z",
  hasDebt: false,
  hasFutureAppointment: false,
  isNew: false,
  hasCriticalAlert: false
} as never;

const patientBob = {
  id: "patient-2",
  branchId: "branch-1",
  branchName: "Centro",
  firstName: "Bob",
  lastName: "Perez",
  documentNumber: "BOB-1",
  email: "bob@example.com",
  phone: "+522222222222",
  status: "ACTIVE",
  createdAt: "2026-06-01T00:00:00.000Z",
  hasDebt: false,
  hasFutureAppointment: false,
  isNew: false,
  hasCriticalAlert: false
} as never;

function treatmentPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-current",
    name: "Plan activo actual",
    status: "IN_PROGRESS",
    kind: "GENERAL",
    isAlternative: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    patient: { id: "patient-1", firstName: "Ana", lastName: "Lopez" },
    professional: {
      id: "professional-1",
      firstName: "Dra.",
      lastName: "Ruiz",
      specialties: []
    },
    branch: { id: "branch-1", name: "Centro" },
    specialty: { id: "specialty-1", name: "General" },
    specialtySnapshotName: "General",
    itemsCount: 3,
    budgetCount: 1,
    ...overrides
  };
}

function renderAppointmentModal({
  onCreateTreatmentPlan = vi
    .fn<(payload: CreateTreatmentPlanPayload) => Promise<{ id: string }>>()
    .mockResolvedValue({ id: "created-plan" }),
  onCreatePatient = vi.fn<(payload: PatientPayload) => Promise<PatientDetail>>().mockResolvedValue({
    id: "patient-new",
    firstName: "Nuevo",
    lastName: "Paciente"
  } as PatientDetail),
  onSubmit = vi.fn<AppointmentModalSubmit>().mockResolvedValue(undefined),
  onClose = vi.fn(),
  patients = [],
  initialValues = {
    branchId: "branch-1",
    specialtyId: "specialty-1",
    professionalId: "professional-1",
    chairId: "chair-1",
    durationMinutes: 30
  },
  branches = [{ id: "branch-1", name: "Centro", agendaSlotMinutes: 30 } as never],
  professionals = [
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
  ],
  multipleMode = true
}: {
  onCreateTreatmentPlan?: (payload: CreateTreatmentPlanPayload) => Promise<{ id: string }>;
  onCreatePatient?: (payload: PatientPayload) => Promise<PatientDetail>;
  onSubmit?: AppointmentModalSubmit;
  onClose?: () => void;
  patients?: never[];
  initialValues?: Partial<AppointmentPayload>;
  branches?: never[];
  professionals?: never[];
  multipleMode?: boolean;
} = {}) {
  return render(
    <AppointmentModal
      open
      defaultDate="2026-06-29"
      initialValues={initialValues}
      branches={branches}
      professionals={professionals}
      chairs={[{ id: "chair-1", branchId: "branch-1", name: "Sillon 1", isActive: true } as never]}
      patients={patients}
      onClose={onClose}
      onSubmit={onSubmit}
      onCreatePatient={onCreatePatient}
      onCreateTreatmentPlan={onCreateTreatmentPlan}
      multipleMode={multipleMode}
    />
  );
}

async function openScheduleStep() {
  fireEvent.click(screen.getByRole("button", { name: /Control/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continuar a horario/ }));
  await waitFor(() => expect(screen.getByText("Horarios libres")).toBeInTheDocument());
}

async function openPatientStep() {
  await openScheduleStep();
  fireEvent.click(screen.getAllByRole("button", { name: "09:00" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await waitFor(() => expect(screen.getByText("Paciente existente")).toBeInTheDocument());
}

function selectExistingPatient(search: string, name: RegExp) {
  fireEvent.change(screen.getByPlaceholderText("Buscar por nombre, documento, telefono o correo"), {
    target: { value: search }
  });
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("AppointmentModal multiple booking", () => {
  beforeEach(() => {
    treatmentPlansByPatient.clear();
    patientDayAppointmentsByPatient.clear();
    allowedPermissions.clear();
    allowedPermissions.add("organization.manage_all");
    allowedPermissions.add("treatment_plans.read");
    allowedPermissions.add("treatment_plans.create");
  });

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

  it("merges contiguous same-day slots into one appointment block", async () => {
    const onSubmit = vi.fn<AppointmentModalSubmit>().mockResolvedValue(undefined);
    renderAppointmentModal({ onSubmit, patients: [patientAna] });
    await openScheduleStep();

    fireEvent.click(screen.getAllByRole("button", { name: "09:00" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "09:30" }));

    expect(screen.queryByText(SAME_DAY_APPOINTMENT_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByText("1 hora(s) seleccionada(s)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    selectExistingPatient("Ana", /ANA LOPEZ/i);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0][0];
    expect(onSubmit.mock.calls[0][0]).toHaveLength(1);
    expect(payload.durationMinutes).toBe(60);
    expect(new Date(payload.endAt).getTime() - new Date(payload.startAt).getTime()).toBe(60 * 60 * 1000);
  });

  it("uses a slot opened from the global day agenda as resolved schedule context", async () => {
    const onSubmit = vi.fn<AppointmentModalSubmit>().mockResolvedValue(undefined);
    renderAppointmentModal({
      onSubmit,
      patients: [patientAna],
      multipleMode: false,
      branches: [{ id: "branch-1", name: "Centro", agendaSlotMinutes: 20 } as never],
      professionals: [
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
              agendaSlotMinutes: 20,
              defaultAppointmentDurationMinutes: 20
            }
          ]
        } as never
      ],
      initialValues: {
        branchId: "branch-1",
        professionalId: "professional-1",
        chairId: "chair-1",
        startAt: "2026-06-29T10:20:00.000",
        endAt: "2026-06-29T10:40:00.000",
        durationMinutes: 20
      }
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Buscar motivo existente")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /Control/ }));

    expect(screen.getByRole("button", { name: "Continuar a paciente" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar a paciente" }));

    await waitFor(() => expect(screen.getByText("Paciente existente")).toBeInTheDocument());
    expect(screen.queryByText("Horarios libres")).not.toBeInTheDocument();
    selectExistingPatient("Ana", /ANA LOPEZ/i);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        branchId: "branch-1",
        professionalId: "professional-1",
        specialtyId: "specialty-1",
        chairId: "chair-1",
        patientId: "patient-1",
        durationMinutes: 40
      })
    );
    expect(new Date(payload.startAt).getTime()).toBe(new Date("2026-06-29T10:20:00.000").getTime());
    expect(new Date(payload.endAt).getTime() - new Date(payload.startAt).getTime()).toBe(40 * 60 * 1000);
  });

  it("shows treatment plans grouped by professional when selecting an existing patient", async () => {
    treatmentPlansByPatient.set("patient-1", [
      treatmentPlan(),
      treatmentPlan({
        id: "plan-other",
        name: "Plan con otro profesional",
        professional: { id: "professional-2", firstName: "Dr.", lastName: "Santos", specialties: [] },
        itemsCount: 2,
        budgetCount: 0
      })
    ]);
    renderAppointmentModal({ patients: [patientAna] });
    await openPatientStep();

    selectExistingPatient("Ana", /ANA LOPEZ/i);

    await waitFor(() => expect(screen.getByText("Con Dra. Ruiz")).toBeInTheDocument());
    expect(screen.getByText("Con otros profesionales")).toBeInTheDocument();
    expect(screen.getByText("Plan activo actual")).toBeInTheDocument();
    expect(screen.getByText("Plan con otro profesional")).toBeInTheDocument();
    expect(screen.getByText("3 prestaciones")).toBeInTheDocument();
    expect(screen.getByText("1 presupuestos")).toBeInTheDocument();
  });

  it("submits the selected existing treatment plan id", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    treatmentPlansByPatient.set("patient-1", [treatmentPlan()]);
    renderAppointmentModal({ onSubmit, patients: [patientAna] });
    await openPatientStep();

    selectExistingPatient("Ana", /ANA LOPEZ/i);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0][0]).toEqual(expect.objectContaining({ treatmentPlanId: "plan-current" }));
  });

  it("sends the notify by email option and shows sending state while saving", async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn<AppointmentModalSubmit>().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    const onClose = vi.fn();
    renderAppointmentModal({ onSubmit, onClose, patients: [patientAna] });
    await openPatientStep();

    selectExistingPatient("Ana", /ANA LOPEZ/i);
    fireEvent.click(screen.getByRole("checkbox", { name: /Notificar por correo/i }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.any(Array), { notifyByEmail: true })
    );
    expect(screen.getByRole("button", { name: /Enviando correo/i })).toBeDisabled();

    resolveSubmit?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("blocks submit before calling the API when the patient already has an active appointment that day", async () => {
    const onSubmit = vi.fn<AppointmentModalSubmit>().mockResolvedValue(undefined);
    patientDayAppointmentsByPatient.set("patient-1", [
      {
        id: "existing-appt",
        patientId: "patient-1",
        status: "SCHEDULED",
        startAt: "2026-06-29T12:00:00.000",
        endAt: "2026-06-29T12:30:00.000",
        professional: { id: "professional-1", firstName: "Dra.", lastName: "Ruiz" }
      }
    ]);
    renderAppointmentModal({ onSubmit, patients: [patientAna] });
    await openPatientStep();

    selectExistingPatient("Ana", /ANA LOPEZ/i);

    expect(screen.getByText(/Este paciente ya tiene una cita activa este dia/i)).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Guardar cita" });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("creates a draft treatment plan before submitting when the new plan option is selected", async () => {
    const onCreateTreatmentPlan = vi.fn().mockResolvedValue({ id: "new-plan" });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderAppointmentModal({ onCreateTreatmentPlan, onSubmit, patients: [patientAna] });
    await openPatientStep();

    selectExistingPatient("Ana", /ANA LOPEZ/i);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() => expect(onCreateTreatmentPlan).toHaveBeenCalledTimes(1));
    expect(onCreateTreatmentPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-1",
        patientId: "patient-1",
        professionalId: "professional-1",
        name: "Plan de Tratamiento Inicial",
        status: "DRAFT"
      })
    );
    expect(onSubmit.mock.calls[0][0][0]).toEqual(expect.objectContaining({ treatmentPlanId: "new-plan" }));
  });

  it("resets the treatment plan selection when changing patient", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    treatmentPlansByPatient.set("patient-1", [treatmentPlan({ id: "plan-patient-1" })]);
    treatmentPlansByPatient.set("patient-2", [
      treatmentPlan({
        id: "plan-patient-2",
        name: "Plan de Bob",
        patient: { id: "patient-2", firstName: "Bob", lastName: "Perez" }
      })
    ]);
    renderAppointmentModal({ onSubmit, patients: [patientAna, patientBob] });
    await openPatientStep();

    selectExistingPatient("Ana", /ANA LOPEZ/i);
    selectExistingPatient("Bob", /BOB PEREZ/i);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0][0]).toEqual(expect.objectContaining({ patientId: "patient-2", treatmentPlanId: "plan-patient-2" }));
  });

  it("does not show existing treatment plans while creating a new patient", async () => {
    renderAppointmentModal({ patients: [patientAna] });
    await openPatientStep();

    fireEvent.click(screen.getByRole("button", { name: "Paciente nuevo" }));

    expect(screen.queryByText("Selecciona el plan que quedara asociado a esta cita.")).not.toBeInTheDocument();
  });

  it("keeps the modal open and shows backend duplicate errors when creating a new patient", async () => {
    const duplicateMessage = "Ya existe un paciente con el mismo nombre, apellidos, teléfono y correo. Selecciona el paciente existente.";
    const onCreatePatient = vi.fn().mockRejectedValue(new Error(duplicateMessage));
    const onSubmit = vi.fn<AppointmentModalSubmit>().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderAppointmentModal({ onCreatePatient, onSubmit, onClose, patients: [patientAna] });
    await openPatientStep();

    fireEvent.click(screen.getByRole("button", { name: "Paciente nuevo" }));
    fireEvent.change(screen.getByLabelText("Nombre legal *"), { target: { value: "CHANONA" } });
    fireEvent.change(screen.getByLabelText("Apellidos *"), { target: { value: "ARREOLA" } });
    fireEvent.change(screen.getByLabelText("E-mail *"), { target: { value: "programador1.wi@gmail.com" } });
    fireEvent.change(screen.getByLabelText("Telefono movil *"), { target: { value: "9613184040" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() =>
      expect(onCreatePatient).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "CHANONA",
          lastName: "ARREOLA",
          email: "programador1.wi@gmail.com",
          phone: "9613184040"
        })
      )
    );
    expect(await screen.findByText(duplicateMessage)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
