import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientProfilePage } from "./patient-profile-page";

let profileTab: string | undefined = "appointments";

const patient = {
  id: "patient-1",
  organizationId: "org-1",
  branchId: "branch-1",
  branch: { id: "branch-1", name: "Dental + Suc. Leon" },
  agreement: null,
  firstName: "Demo",
  lastName: "Sucursal",
  birthDate: null,
  gender: null,
  documentType: null,
  documentNumber: null,
  email: "demo@example.com",
  phone: "+529610000012",
  alternatePhone: null,
  occupation: null,
  referredBy: null,
  source: null,
  status: "ACTIVE",
  contacts: [],
  address: null,
  medicalAlerts: [],
  notes: [
    {
      id: "note-1",
      note: "Comentario administrativo",
      isPrivate: true,
      createdAt: "2026-06-09T12:00:00.000Z",
      user: { id: "user-1", firstName: "Admin", lastName: "Uno" },
      attachments: [],
    },
  ],
  summary: {
    nextAppointment: null,
    lastAppointment: null,
    balance: 0,
    activeTreatments: 0,
    activeBenefits: 0,
    coverageExpiringSoon: null,
    hasCriticalAlert: false,
  },
  timeline: [],
};

const appointments = [
  {
    id: "appointment-1",
    organizationId: "org-1",
    branchId: "branch-1",
    patientId: "patient-1",
    professionalId: "professional-1",
    treatmentPlanId: "plan-1",
    title: "Control",
    reason: "Revision",
    status: "SCHEDULED",
    startAt: "2026-06-09T18:00:00.000Z",
    endAt: "2026-06-09T18:30:00.000Z",
    durationMinutes: 30,
    branch: { id: "branch-1", name: "Dental + Suc. Leon" },
    patient: { id: "patient-1", firstName: "Demo", lastName: "Sucursal" },
    professional: {
      id: "professional-1",
      firstName: "Lilia",
      lastName: "Nunez",
    },
    chair: { id: "chair-1", name: "Sillon 1" },
    specialty: null,
    treatmentPlan: { id: "plan-1", name: "Diagnostico", status: "ACCEPTED" },
  },
];

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ id: "patient-1", profileTab }),
  useLocation: () => ({
    pathname: profileTab
      ? `/patients/patient-1/profile/${profileTab}`
      : "/patients/patient-1/profile",
  }),
}));

vi.mock("../components/patient-header", () => ({
  PatientHeader: () => <div>Patient header</div>,
}));

vi.mock("../components/patient-subnav", () => ({
  PatientSubnav: () => <div>Patient subnav</div>,
}));

vi.mock("../components/patient-secondary-nav", () => ({
  PatientSecondaryNav: ({ tabs }: { tabs: Array<{ label: string }> }) => (
    <nav>
      {tabs.map((tab) => (
        <span key={tab.label}>{tab.label}</span>
      ))}
    </nav>
  ),
}));

vi.mock("../components/patient-family-policies", () => ({
  PatientFamilyPolicies: () => (
    <div>No hay beneficios o pólizas asociados a este paciente.</div>
  ),
}));

vi.mock("../hooks/use-patient-identity", () => ({
  usePatientIdentity: () => ({ data: { contacts: [], memberships: [] } }),
}));

vi.mock("@/features/agenda/hooks/use-appointments", () => ({
  useAppointments: () => ({
    data: appointments,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useAppointment: () => ({
    data: appointments[0],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useAppointmentNotes: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useAddAppointmentNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock(
  "@/features/settings/admin-workflows/hooks/use-admin-workflows",
  () => ({
    useAgreements: () => ({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    }),
  }),
);

vi.mock("@/features/settings/branches/hooks/use-branches", () => ({
  useBranches: () => ({
    data: [{ id: "branch-1", name: "Dental + Suc. Leon" }],
  }),
}));

vi.mock("@/features/settings/users/hooks/use-users", () => ({
  useUsersQuery: () => ({
    data: [{ id: "user-2", firstName: "Sarahi", lastName: "Admin" }],
  }),
}));

vi.mock("@/features/documents/hooks/use-documents", () => ({
  useDocumentsMutations: () => ({
    uploadPatientBinaryFile: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("../hooks/use-patients", () => ({
  usePatient: () => ({
    data: patient,
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePatientTimeline: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePatientBenefitsCoverages: () => ({
    data: {
      summary: {
        total: 0,
        active: 0,
        pendingValidation: 0,
        documents: 0,
        nextExpiration: null,
      },
      items: [],
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePatientBenefitsCoverageMutations: () => ({
    createCoverage: { mutateAsync: vi.fn(), isPending: false },
    updateCoverage: { mutateAsync: vi.fn(), isPending: false },
    changeStatus: { mutate: vi.fn(), isPending: false },
    validateInsurance: { mutateAsync: vi.fn(), isPending: false },
  }),
  useUpdatePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddPatientNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddPatientAlert: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendPatientEmail: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePatientEmails: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePatientTasks: () => ({
    data: [
      {
        id: "task-1",
        patientId: "patient-1",
        type: "Agendar Cita",
        detail: "Fijar cita por ausencia",
        dueDate: "2026-08-28T00:00:00.000Z",
        assignedToId: null,
        assignedTo: null,
        createdBy: { id: "user-1", firstName: "Admin", lastName: "Uno" },
        status: "PENDING",
        completedAt: null,
        completedBy: null,
        createdAt: "2026-06-09T12:00:00.000Z",
        updatedAt: "2026-06-09T12:00:00.000Z",
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePatientTaskMutations: () => ({
    createTask: { mutateAsync: vi.fn(), isPending: false },
    updateTask: { mutate: vi.fn(), isPending: false },
    completeTask: { mutate: vi.fn(), isPending: false },
  }),
}));

describe("PatientProfilePage subtabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Dentalink-style appointment columns", () => {
    profileTab = "appointments";

    render(<PatientProfilePage />);

    expect(screen.getByRole("heading", { name: "Citas" })).toBeInTheDocument();
    expect(screen.getByText("# Tratamiento")).toBeInTheDocument();
    expect(screen.getByText("Dental + Suc. Leon")).toBeInTheDocument();
    expect(screen.getAllByText("Lilia Nunez").length).toBeGreaterThan(0);
  });

  it("renders administrative comments editor with attachments", () => {
    profileTab = "comments";

    render(<PatientProfilePage />);

    expect(
      screen.getByRole("heading", { name: "Comentarios administrativos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Adjuntar Archivos")).toBeInTheDocument();
    expect(screen.getByText("Comentario administrativo")).toBeInTheDocument();
  });

  it("renders a single benefits and coverages experience", () => {
    profileTab = "benefits-coverages";

    render(<PatientProfilePage />);

    expect(
      screen.getAllByText("Beneficios y coberturas").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /No hay beneficios o pólizas asociados a este paciente/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Otros beneficios y convenios"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Citas")).toBeInTheDocument();
    expect(screen.getByText("Comentarios administrativos")).toBeInTheDocument();
    expect(screen.getByText("Tareas de gestion")).toBeInTheDocument();
    expect(screen.getByText("Emails")).toBeInTheDocument();
  });

  it("renders real patient task rows", () => {
    profileTab = "tasks";

    render(<PatientProfilePage />);

    expect(
      screen.getByRole("heading", { name: "Tareas de gestion" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Agendar Cita")).toBeInTheDocument();
    expect(screen.getByText("Fijar cita por ausencia")).toBeInTheDocument();
  });

  it("renders email registry filters and empty state", () => {
    profileTab = "emails";

    render(<PatientProfilePage />);

    expect(
      screen.getByRole("heading", { name: "Registro de Emails" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Redactar nuevo email")).toBeInTheDocument();
    expect(
      screen.getByText("No se encontró ningún registro de email"),
    ).toBeInTheDocument();
  });
});
