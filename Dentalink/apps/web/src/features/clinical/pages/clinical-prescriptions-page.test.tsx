import { fireEvent, render, screen } from "@testing-library/react";
import { ClinicalPrescriptionsPage } from "./clinical-prescriptions-page";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "patient-1" })
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock("@/stores/branch.store", () => ({
  useBranchStore: (selector: (state: { activeBranchId: string }) => string) => selector({ activeBranchId: "branch-1" })
}));

vi.mock("@/features/patients/hooks/use-patients", () => ({
  usePatient: () => ({
    data: { id: "patient-1", branchId: "branch-1" },
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("@/features/settings/professionals/hooks/use-professionals", () => ({
  useProfessionals: () => ({
    data: [
      {
        id: "professional-1",
        firstName: "Andrea",
        lastName: "Silva",
        specialties: [{ id: "specialty-general", name: "Odontologia General (Integral)" }]
      }
    ],
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("@/features/settings/specialties/hooks/use-specialties", () => ({
  useSpecialtyClinicalTemplatesForSpecialties: () => ({
    data: [
      {
        id: "template-1",
        specialtyId: "specialty-general",
        specialtyName: "Odontologia General (Integral)",
        type: "PRESCRIPTION",
        name: "Receta General",
        content: "<p>Nombre generico del medicamento</p>",
        isActive: true,
        createdAt: "2026-06-30T00:00:00.000Z",
        createdBy: null
      }
    ],
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("@/features/treatments/hooks/use-treatments", () => ({
  useTreatmentPlans: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null
  })
}));

vi.mock("../hooks/use-clinical", () => ({
  useClinicalSummary: () => ({
    data: {},
    isLoading: false,
    isError: false,
    error: null
  }),
  useClinicalPrescriptions: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null
  }),
  useClinicalMutations: () => ({
    createPrescription: { mutateAsync: vi.fn(), isPending: false },
    printPrescription: { mutateAsync: vi.fn() },
    updatePrescriptionStatus: { mutateAsync: vi.fn() }
  })
}));

vi.mock("../components/clinical-shell", () => ({
  ClinicalShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("../components/rich-text-editor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Cuerpo de la receta" value={value} onChange={(event) => onChange(event.target.value)} />
  )
}));

vi.mock("../components/vademecum-modal", () => ({
  VademecumModal: () => null
}));

describe("ClinicalPrescriptionsPage templates", () => {
  it("loads prescription templates from specialty settings and applies the selected template", () => {
    render(<ClinicalPrescriptionsPage />);

    expect(screen.getByText("Receta General")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cargar plantilla de receta"), {
      target: { value: "template-1" }
    });

    expect(screen.getByLabelText("Cuerpo de la receta")).toHaveValue("<p>Nombre generico del medicamento</p>");
    expect(screen.getByText("Plantilla: Receta General / Odontologia General (Integral)")).toBeInTheDocument();
  });
});
