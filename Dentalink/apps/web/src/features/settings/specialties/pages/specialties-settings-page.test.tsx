import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpecialtiesSettingsPage } from "./specialties-settings-page";

const updateReason = vi.fn();

vi.mock("../hooks/use-specialties", () => ({
  useSpecialties: () => ({
    data: [
      {
        id: "specialty-1",
        name: "Ortodoncia",
        description: "Corrección de anomalías dento-faciales y brackets",
        isActive: true
      }
    ],
    isLoading: false,
    isError: false,
    error: null
  }),
  useSpecialtyAppointmentReasons: () => ({
    data: [
      {
        id: "reason-208",
        specialtyId: "specialty-1",
        legacyId: 208,
        name: "ALINEADORES",
        durationMinutes: 60,
        color: "#000000",
        isActive: false
      },
      {
        id: "reason-207",
        specialtyId: "specialty-1",
        legacyId: 207,
        name: "ADITAMENTOS ADICIONALES",
        durationMinutes: 30,
        color: "#000000",
        isActive: true
      }
    ],
    isLoading: false,
    isError: false,
    error: null
  }),
  useSpecialtyClinicalTemplates: () => ({ data: [], isLoading: false, isError: false, error: null }),
  useCreateSpecialty: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSpecialty: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeactivateSpecialty: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSpecialtyClinicalTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSpecialtyClinicalTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSpecialtyAppointmentReason: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSpecialtyAppointmentReason: () => ({ mutateAsync: updateReason, isPending: false })
}));

vi.mock("@/features/clinical/components/rich-text-editor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Contenido" value={value} onChange={(event) => onChange(event.target.value)} />
  )
}));

describe("SpecialtiesSettingsPage appointment reasons", () => {
  beforeEach(() => {
    updateReason.mockReset();
    updateReason.mockResolvedValue({});
  });

  it("shows legacy ids, suspended state, and opens the edit modal", () => {
    render(<SpecialtiesSettingsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Configurar" })[0]!);

    expect(screen.getByText("207")).toBeInTheDocument();
    expect(screen.getByText("208")).toBeInTheDocument();
    expect(screen.getByText("ADITAMENTOS ADICIONALES")).toBeInTheDocument();
    expect(screen.getByText("Suspendido")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar ADITAMENTOS ADICIONALES" }));

    expect(screen.getByText("Editar motivo de atención")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ADITAMENTOS ADICIONALES")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "30 min" })).toHaveValue("30");
  });

  it("suspends a reason through the row action", async () => {
    render(<SpecialtiesSettingsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Configurar" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Suspender ADITAMENTOS ADICIONALES" }));

    await waitFor(() => {
      expect(updateReason).toHaveBeenCalledWith({
        specialtyId: "specialty-1",
        reasonId: "reason-207",
        payload: { isActive: false }
      });
    });
  });
});
